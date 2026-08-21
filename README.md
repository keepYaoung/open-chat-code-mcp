# cokacremote

VPS 또는 EC2 인스턴스에서 상시 실행하는 Node.js 원격 개발 MCP 서버입니다. ChatGPT나 다른 MCP 클라이언트가 MCP Streamable HTTP를 통해 인스턴스의 셸, 프로세스와 파일 시스템을 직접 사용할 수 있습니다.

> [!WARNING]
> 이 서버에는 샌드박스, 명령 허용목록, 실행 승인 또는 경로 제한이 없습니다. 배포 예제는 서버를 `root`로 실행하므로 인증정보를 가진 클라이언트는 인스턴스 전체를 변경하거나 삭제할 수 있습니다. 인터넷에 공개할 때는 반드시 HTTPS와 인증을 사용하고, 신뢰하는 사용자만 연결해야 합니다.

## 주요 특징

- 셸 명령, 전체 스크립트, 빌드, 테스트, 패키지 설치, Git 및 서비스 관리
- 장기 실행 프로세스의 출력 폴링, 표준입력 전달과 종료 제어
- 절대경로를 포함한 호스트 파일 읽기·쓰기·수정·전송 및 삭제
- 정적 Bearer 인증과 ChatGPT용 OAuth 2.1/DCR/PKCE 내장
- 요청별 stateless JSON 전송, 프로세스별 출력 보관과 전송 크기 제한
- Linux VPS/EC2용 systemd 및 Nginx 배포 예제

## 제공 도구

### 실행 및 프로세스

- `exec_command`: 셸 명령, 빌드, 테스트, 패키지 설치, Git, 서비스 관리, 로그 조회
- `run_script`: Bash, sh, Node.js, Python 또는 임의 인터프리터로 전체 스크립트 실행
- `write_stdin`: 장기 실행 프로세스에 입력을 쓰고 후속 출력 조회
- `read_process`: 출력 커서 기반 폴링과 종료 상태 조회
- `terminate_process`: 프로세스 그룹에 `SIGINT`, `SIGTERM`, `SIGKILL` 전달
- `list_processes`: 실행 중이거나 최근 완료된 세션 조회

### 파일 시스템

- `list_directory`, `stat_path`, `read_file`, `write_file`
- `replace_in_file`, `apply_patch`
- `upload_file`, `download_file`, `hash_file`
- `make_directory`, `copy_path`, `move_path`, `remove_path`, `chmod_path`

상대경로는 `MCP_DEFAULT_CWD`에서 해석되지만 절대경로와 `~/...`도 허용됩니다. 업로드와 다운로드는 `nextOffset`을 사용한 base64 청크 전송 방식입니다.

총 20개 도구를 제공합니다. `remove_path`는 휴지통을 사용하지 않고 대상을 영구 삭제하며, `apply_patch`는 호스트의 `git apply --unsafe-paths`를 사용합니다.

### 파일 읽기와 전송 규칙

- `read_file`의 `offset`, `bytesRead`, `nextOffset`은 모두 바이트 단위입니다.
- `encoding="utf8"`일 때는 한글·이모지 같은 다중 바이트 문자를 청크 경계에서 자르지 않습니다. 완전한 문자 하나를 담기 위해 `bytesRead`가 요청한 `maxBytes`보다 최대 3바이트 커질 수 있지만, 서버의 `MCP_MAX_FILE_CHUNK_BYTES` 제한은 넘지 않습니다.
- 파일이 올바른 UTF-8이 아니면 텍스트를 임의로 치환하지 않고 오류를 반환합니다. 바이너리 파일은 `encoding="base64"`로 읽으세요.
- `write_file`과 `upload_file`의 base64 입력은 표준 알파벳, 길이와 패딩이 올바른지 엄격하게 검사합니다. 패딩이 생략된 표준 base64도 허용하며, 잘못된 입력은 파일을 변경하기 전에 거부됩니다.
- `write_file.fileMode`는 새 파일뿐 아니라 기존 파일을 덮어쓰거나 이어 쓸 때도 적용됩니다.
- `copy_path`는 대상이 이미 있고 `force=false`이면 파일과 디렉터리 모두 충돌 오류를 반환합니다.

## 전송 및 상태 모델

`/mcp`는 요청마다 독립적으로 처리되는 stateless Streamable HTTP JSON 엔드포인트입니다.

- 각 `POST /mcp` 요청은 새 MCP transport에서 처리되며 `Mcp-Session-Id`를 발급하거나 요구하지 않습니다.
- 이전 버전 클라이언트가 오래된 `Mcp-Session-Id` 헤더를 보내도 요청 처리에는 사용하지 않습니다.
- `GET /mcp`와 `DELETE /mcp`가 `405 Method Not Allowed`를 반환하는 것은 정상입니다. 서버 푸시용 SSE 세션은 유지하지 않습니다.
- MCP 전송 세션과 명령 프로세스의 `sessionId`는 서로 다릅니다. `exec_command`가 반환한 프로세스 `sessionId`는 후속 HTTP 요청의 `write_stdin`, `read_process`, `terminate_process`에서 계속 사용할 수 있습니다.
- 실행 중이거나 보존 중인 프로세스 상태는 서비스 메모리에 있으므로 서비스를 재시작하면 사라집니다.

## 요구사항

- Node.js 22 이상과 npm
- Linux 권장; 제공되는 운영 배포 예제는 systemd와 Nginx 기준
- `apply_patch` 사용을 위한 Git
- 키 생성을 위한 OpenSSL
- `run_script`의 Python 실행이 필요하면 Python 3
- ChatGPT에서 직접 연결하려면 공개적으로 접근 가능한 안정적인 HTTPS 도메인

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run build

export MCP_AUTH_TOKEN="$(openssl rand -hex 32)"
export MCP_DEFAULT_CWD=/root
npm start
```

기본 바인드 주소는 `0.0.0.0:3000`입니다. 같은 컴퓨터에서 접속할 때의 MCP URL은 `http://127.0.0.1:3000/mcp`, 상태 확인 URL은 `http://127.0.0.1:3000/health`입니다.

개발 모드에서는 다음 명령을 사용할 수 있습니다.

```bash
MCP_AUTH_TOKEN=development-token npm run dev
```

## 인증 방식

`MCP_AUTH_TOKEN`이 설정되면 모든 MCP 요청에 다음 헤더가 필요합니다.

```http
Authorization: Bearer <MCP_AUTH_TOKEN>
```

ChatGPT 연결용으로 내장 OAuth 2.1 Authorization Server를 활성화할 수 있습니다. 다음 값은 셸 명령이 아니라 환경 파일 형식의 예시입니다.

```dotenv
MCP_OAUTH_ENABLED=true
MCP_PUBLIC_URL=https://mcp.example.com
MCP_OAUTH_ISSUER=https://mcp.example.com
MCP_OAUTH_RESOURCE=https://mcp.example.com/mcp
MCP_OAUTH_STATE_FILE=/var/lib/remote-dev-mcp/oauth-state.json
```

활성화하면 다음 기능을 제공합니다.

- RFC 9728 Protected Resource Metadata
- RFC 8414 Authorization Server Metadata
- Dynamic Client Registration(DCR)
- Authorization Code + PKCE(S256)
- `resource` audience 검증
- 액세스 토큰, 회전형 refresh token, token revocation

OAuth가 활성화되면 `mcp:tools` 단일 범위를 사용합니다. ChatGPT에서 연결을 승인할 때 표시되는 화면에는 `MCP_AUTH_TOKEN` 값을 입력합니다. 이 값은 승인용 비밀번호인 동시에 MCP를 직접 호출할 수 있는 정적 Bearer 토큰이므로 root 자격증명처럼 취급해야 합니다. 등록 클라이언트와 토큰 해시는 `MCP_OAUTH_STATE_FILE`에 권한 `600`으로 저장됩니다.

OAuth 관련 HTTP 경로는 다음과 같습니다.

| 경로 | 용도 |
|---|---|
| `/.well-known/oauth-protected-resource` | RFC 9728 리소스 메타데이터 |
| `/.well-known/oauth-protected-resource/mcp` | `/mcp` 경로별 리소스 메타데이터 |
| `/.well-known/oauth-authorization-server` | RFC 8414 인증 서버 메타데이터 |
| `/register` | Dynamic Client Registration |
| `/authorize` | 사용자 승인 및 authorization code 발급 |
| `/token` | code/refresh token 교환 |
| `/revoke` | 토큰 폐기 |

인증을 서버 앞단의 OAuth 프록시나 사설 네트워크에서 처리한다면 다음과 같이 내장 토큰 검사를 끌 수 있습니다.

```dotenv
MCP_AUTH_TOKEN=
MCP_OAUTH_ENABLED=false
MCP_ALLOW_NO_AUTH=true
```

`MCP_AUTH_TOKEN`이 남아 있거나 OAuth가 활성화되어 있으면 `MCP_ALLOW_NO_AUTH=true`만으로 익명 모드가 되지 않습니다. 외부 IdP 또는 OAuth 게이트웨이를 사용할 때는 Node 서버를 `127.0.0.1`에만 바인딩하고 앞단에서 인증을 완료해야 합니다. 익명 MCP를 공개 인터넷에 노출하면 URL을 아는 누구나 인스턴스의 전체 권한을 사용할 수 있습니다.

OpenAI의 현재 원격 MCP 인증 요구사항은 [MCP 서버 인증 문서](https://developers.openai.com/plugins/build/auth)에 정리되어 있습니다.

## VPS/EC2 배포

예시는 Ubuntu 계열 서버의 `/opt/remote-dev-mcp`에 설치하는 경우입니다. 서비스 파일의 기술적인 이름은 하위 호환성을 위해 `remote-dev-mcp.service`로 유지됩니다.

```bash
sudo mkdir -p /opt/remote-dev-mcp
sudo cp -a package.json package-lock.json tsconfig.json src deploy /opt/remote-dev-mcp/
cd /opt/remote-dev-mcp
sudo npm ci
sudo npm run build
sudo npm prune --omit=dev

sudo install -d -m 0700 /var/lib/remote-dev-mcp

sudo cp deploy/remote-dev-mcp.env.example /etc/remote-dev-mcp.env
sudo chmod 600 /etc/remote-dev-mcp.env
sudo editor /etc/remote-dev-mcp.env

sudo cp deploy/remote-dev-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now remote-dev-mcp
sudo systemctl status remote-dev-mcp
```

`/usr/bin/node`가 실제 Node.js 경로와 다르면 systemd 파일의 `ExecStart`를 수정합니다. `which node`로 확인할 수 있습니다.

공개 인터넷에서 사용할 때는 HTTPS가 필요합니다. [Nginx 예제](deploy/nginx.remote-dev-mcp.conf)의 도메인과 인증서 경로를 바꾸고 유효한 인증서를 준비한 뒤 활성화합니다. Node 서버는 `127.0.0.1`에 바인딩하고 80/443만 외부에 공개하는 구성을 권장합니다. 긴 도구 호출이 프록시에서 먼저 종료되지 않도록 충분한 read timeout을 사용합니다.

운영 환경 파일에서는 최소한 다음 값을 실제 도메인에 맞춰야 합니다.

```dotenv
MCP_HOST=127.0.0.1
MCP_PUBLIC_URL=https://mcp.example.com
MCP_ALLOWED_HOSTS=mcp.example.com,127.0.0.1,localhost
MCP_AUTH_TOKEN=<openssl-rand-hex-32로-생성한-값>
MCP_OAUTH_ENABLED=true
MCP_OAUTH_ISSUER=https://mcp.example.com
MCP_OAUTH_RESOURCE=https://mcp.example.com/mcp
```

## ChatGPT 연결

배포 URL이 `https://mcp.example.com/mcp`라고 가정합니다.

1. ChatGPT에서 **Settings → Security and login → Developer mode**를 활성화합니다.
2. [ChatGPT Plugins](https://chatgpt.com/plugins)에서 추가 버튼을 누르고 MCP URL을 입력합니다.
3. OAuth 고급 설정이 표시되면 등록 방식을 **Dynamic Client Registration(DCR)**으로 선택합니다.
4. 기본 범위는 `mcp:tools`, token endpoint 인증 방식은 `none`을 사용합니다. DCR에서는 Client ID와 Client Secret을 직접 입력하지 않습니다.
5. 연결 승인 화면에서 `MCP_AUTH_TOKEN`을 입력하고 ChatGPT로 돌아갑니다.

이 서버는 DCR을 제공하며 CIMD와 OIDC는 제공하지 않습니다. ChatGPT 설정 화면에 CIMD 또는 OIDC를 사용할 수 없다는 안내가 나타나는 것은 오류가 아닙니다. 개발자 모드 제공 여부는 계정이나 워크스페이스 정책에 따라 달라질 수 있습니다.

공식 절차는 [ChatGPT MCP 연결 안내](https://developers.openai.com/plugins/quickstart#connect-your-mcp-server), 인증 요구사항은 [MCP 서버 인증 문서](https://developers.openai.com/plugins/build/auth)를 참고합니다. OpenAI Responses API에서 사용할 때는 [remote MCP 도구 안내](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)를 참고하여 서버 URL과 필요한 Bearer 토큰을 전달합니다.

## 운영 및 문제 해결

```bash
# 로컬 프록시 뒤의 Node 서비스 확인
curl http://127.0.0.1:3000/health

# 공개 HTTPS 경로 확인
curl https://mcp.example.com/health

# 서비스 상태와 실시간 로그
sudo systemctl status remote-dev-mcp
sudo journalctl -u remote-dev-mcp -f

# 설정 또는 코드 변경 후 재시작
sudo systemctl restart remote-dev-mcp
```

정상 health 응답 예시는 다음과 같습니다.

```json
{
  "status": "ok",
  "service": "cokacremote",
  "version": "0.1.0",
  "transportMode": "stateless-json",
  "activeMcpSessions": 0,
  "activeMcpRequests": 0,
  "managedProcesses": 0,
  "unrestrictedHostAccess": true,
  "oauthEnabled": true
}
```

- `activeMcpSessions`는 stateless 모드에서 항상 `0`입니다. 연결이 끊겼다는 뜻이 아닙니다.
- `activeMcpRequests`는 health 요청 시점에 처리 중인 MCP HTTP 요청 수입니다.
- `managedProcesses`는 실행 중인 프로세스뿐 아니라 결과 조회를 위해 잠시 보존된 완료 프로세스도 포함합니다. 실제 실행 여부는 `list_processes`의 `status`로 확인하세요. 완료 기록은 `MCP_PROCESS_RETENTION_MS` 이후 정리됩니다.
- 모든 MCP 응답에는 추적용 `X-Request-Id`가 포함됩니다. 서비스 로그의 `event="mcp_request"` 항목에는 RPC 메서드, 도구 이름, HTTP 상태, 처리 결과와 소요 시간이 기록되며 인증 토큰과 도구 인자는 기록하지 않습니다.

최근 MCP 요청 로그만 확인하려면 다음 명령을 사용할 수 있습니다.

```bash
sudo journalctl -u remote-dev-mcp -o cat | grep '"event":"mcp_request"'
```

- `Error fetching OAuth configuration`: `MCP_OAUTH_ENABLED`, 공개 URL 및 Nginx의 `/.well-known/` 프록시를 확인합니다.
- MCP 요청의 `401 Unauthorized`: Bearer 토큰 또는 OAuth access token을 확인합니다.
- `403 Host header is not allowed`: 요청 도메인을 `MCP_ALLOWED_HOSTS`에 추가합니다.
- 명령이 즉시 끝나지 않고 `sessionId`를 반환: `read_process`로 폴링하거나 `write_stdin`으로 입력을 보냅니다.
- MCP 요청은 서로 독립적인 stateless POST입니다. `GET /mcp`와 `DELETE /mcp`의 `405 Method Not Allowed`는 정상이며 독립 SSE 스트림을 제공하지 않는다는 뜻입니다.
- 서비스 재시작: 관리 중인 프로세스 정보와 아직 교환되지 않은 authorization code는 유지되지 않습니다. OAuth 등록과 발급된 토큰은 상태 파일에 유지됩니다.

## 검증

```bash
npm run typecheck
npm test
npm run build
```

기본 테스트는 실제 Streamable HTTP MCP 클라이언트를 사용하며 다음 범위를 포함합니다.

- Bearer 인증, stateless 요청 처리와 요청 추적 헤더
- 20개 도구 전체의 정상 흐름, 오류 흐름, 입력 경계값
- 대화형 stdin, 출력 페이징, 타임아웃, 종료, 완료 프로세스 보존
- UTF-8 문자 경계, 엄격한 base64 검사, 파일 모드, 복사·이동 충돌
- unified diff의 검사, 적용, 역적용, 3-way 적용

### 실행 중인 외부 MCP 전체 E2E 검증

개발 의존성이 설치된 별도 소스 복사본에서 다음처럼 실행하면 실제 HTTPS 엔드포인트의 20개 도구를 모두 검증할 수 있습니다.

```bash
MCP_E2E_URL='https://mcp.example.com/mcp' \
MCP_E2E_TOKEN='<bearer-token>' \
MCP_E2E_ROOT='/tmp/cokacremote-tools-e2e-manual' \
npx vitest run test/all-tools.integration.test.ts
```

이 검증은 대상 서버에서 실제 명령을 실행하고 테스트 파일을 생성·변경·삭제합니다. 안전을 위해 `MCP_E2E_ROOT`는 반드시 `/tmp/cokacremote-tools-e2e-*` 형식이어야 하며 테스트는 이 격리 디렉터리만 사용한 뒤 정리를 시도합니다. 운영 데이터가 있는 경로를 지정하지 말고, 실패하거나 중단된 뒤에는 지정한 경로가 남았는지 확인하세요. 운영 설치 디렉터리에서 `npm ci`를 실행하면 production-only 의존성 구성이 바뀔 수 있으므로, 테스트는 별도 복사본에서 실행하는 것을 권장합니다.

## 주요 환경 변수

| 변수 | 기본값 | 설명 |
|---|---:|---|
| `MCP_HOST` | `0.0.0.0` | HTTP 바인드 주소 |
| `MCP_PORT` | `3000` | HTTP 포트 |
| `MCP_ENDPOINT` | `/mcp` | Streamable HTTP MCP 경로 |
| `MCP_PUBLIC_URL` | 없음 | `/mcp`를 제외한 외부 HTTPS 기준 URL |
| `MCP_ALLOWED_HOSTS` | 없음 | 허용할 Host 헤더의 호스트명 목록(쉼표 구분) |
| `MCP_AUTH_TOKEN` | 없음 | bearer 토큰 |
| `MCP_ALLOW_NO_AUTH` | `false` | 인증 없이 시작 허용 |
| `MCP_OAUTH_ENABLED` | `false` | ChatGPT용 내장 OAuth 2.1/DCR 활성화 |
| `MCP_OAUTH_ISSUER` | `MCP_PUBLIC_URL` | OAuth issuer URL |
| `MCP_OAUTH_RESOURCE` | `<MCP_PUBLIC_URL><MCP_ENDPOINT>` | MCP resource audience |
| `MCP_OAUTH_STATE_FILE` | 작업 디렉터리 내부 | 등록 클라이언트와 토큰 해시 저장 파일 |
| `MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS` | `3600` | OAuth 액세스 토큰 수명 |
| `MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS` | `2592000` | OAuth refresh token 수명 |
| `MCP_OAUTH_AUTHORIZATION_CODE_TTL_SECONDS` | `300` | 일회용 authorization code 수명 |
| `MCP_DEFAULT_CWD` | 서버 시작 디렉터리 | 상대경로 기준 |
| `MCP_DEFAULT_SHELL` | `$SHELL` 또는 `/bin/bash` | `exec_command` 기본 셸 |
| `MCP_MAX_REQUEST_BODY` | `8mb` | HTTP 요청 본문 크기 제한 |
| `MCP_MAX_OUTPUT_BYTES` | `1048576` | 한 도구 응답의 최대 출력 |
| `MCP_MAX_RETAINED_PROCESS_OUTPUT_BYTES` | `4194304` | 프로세스별 보관 출력 |
| `MCP_PROCESS_RETENTION_MS` | `3600000` | 완료 프로세스 보관 시간 |
| `MCP_MAX_PROCESSES` | `128` | 동시에 보관할 프로세스 세션 수 |
| `MCP_MAX_FILE_CHUNK_BYTES` | `1048576` | 파일 청크 최대 크기. UTF-8 읽기도 이 상한을 넘지 않음 |
| `MCP_MAX_EDIT_FILE_BYTES` | `67108864` | 텍스트 교체 대상 파일의 최대 크기 |

## 프로젝트 구조

| 경로 | 역할 |
|---|---|
| `src/http-server.ts` | Stateless Streamable HTTP, OAuth 라우팅과 health endpoint |
| `src/mcp-server.ts` | MCP 서버 정보와 도구 등록 |
| `src/exec-tools.ts` | 명령·스크립트·장기 프로세스 도구 |
| `src/file-service.ts` | 파일 읽기·쓰기·전송과 경로 작업 구현 |
| `src/file-tools.ts` | 파일 시스템 도구와 입력 스키마 |
| `src/oauth.ts` | DCR, PKCE, token 발급·갱신·폐기와 승인 화면 |
| `deploy/` | systemd, 환경 파일과 Nginx 예제 |
| `test/all-tools.integration.test.ts` | 20개 도구 전체와 외부 엔드포인트 E2E 테스트 |
| `test/` | 설정, 파일, 프로세스, MCP 및 OAuth 단위·통합 테스트 |

## 라이선스

[MIT License](LICENSE)

## Disclaimer

THIS SOFTWARE IS PROVIDED “AS IS,” WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

IN NO EVENT SHALL THE AUTHOR, COPYRIGHT HOLDERS, OR CONTRIBUTORS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OF THE SOFTWARE.

This includes, but is not limited to:

* Data loss or corruption
* System damage or malfunction
* Security breaches or vulnerabilities
* Financial loss
* Direct, indirect, incidental, special, punitive, or consequential damages

The user assumes full responsibility for all consequences arising from the use of this software, whether such use was intended, authorized, or foreseeable.

**ALL RISKS ASSOCIATED WITH USE ARE BORNE BY THE USER**

















