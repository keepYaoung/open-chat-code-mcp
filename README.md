# cokacremote

VPS 또는 EC2 인스턴스에서 상시 실행하는 Node.js 원격 개발 MCP 서버입니다. ChatGPT나 다른 MCP 클라이언트가 인스턴스의 셸, 프로세스, 파일 시스템을 직접 사용하도록 구성했습니다.

이 서버에는 작업공간 샌드박스, 명령 허용목록, 실행 승인, 경로 제한이 없습니다. 도구는 MCP 서버 프로세스의 실제 OS 권한을 그대로 사용합니다. `deploy/remote-dev-mcp.service`는 요구사항에 맞춰 `root`로 실행됩니다.

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

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run build

export MCP_AUTH_TOKEN="$(openssl rand -hex 32)"
export MCP_DEFAULT_CWD=/root
npm start
```

기본 MCP URL은 `http://0.0.0.0:3000/mcp`, 상태 확인 URL은 `/health`입니다.

개발 모드에서는 다음 명령을 사용할 수 있습니다.

```bash
MCP_AUTH_TOKEN=development-token npm run dev
```

## 인증 방식

`MCP_AUTH_TOKEN`이 설정되면 모든 MCP 요청에 다음 헤더가 필요합니다.

```http
Authorization: Bearer <MCP_AUTH_TOKEN>
```

ChatGPT 플러그인 연결용으로 내장 OAuth 2.1 Authorization Server를 활성화할 수 있습니다.

```bash
MCP_OAUTH_ENABLED=true
MCP_PUBLIC_URL=https://mcp.example.com
MCP_OAUTH_STATE_FILE=/var/lib/remote-dev-mcp/oauth-state.json
```

활성화하면 다음 기능을 제공합니다.

- RFC 9728 Protected Resource Metadata
- RFC 8414 Authorization Server Metadata
- Dynamic Client Registration(DCR)
- Authorization Code + PKCE(S256)
- `resource` audience 검증
- 액세스 토큰, 회전형 refresh token, token revocation

ChatGPT에서 연결을 승인할 때 표시되는 로그인 화면에는 `MCP_AUTH_TOKEN` 값을 입력합니다. 이 값은 승인용 비밀번호 역할도 하며, 기존처럼 정적 Bearer 토큰으로 직접 호출하는 방식도 계속 지원됩니다. 등록 클라이언트와 토큰 해시는 `MCP_OAUTH_STATE_FILE`에 권한 `600`으로 저장됩니다.

인증을 서버 앞단의 OAuth 프록시나 사설 네트워크에서 처리한다면 다음과 같이 내장 토큰 검사를 끌 수 있습니다.

```bash
MCP_ALLOW_NO_AUTH=true
```

내장 OAuth 대신 외부 IdP 또는 OAuth 게이트웨이를 사용할 수도 있습니다. 이 경우 Node 서버는 `127.0.0.1`에만 바인딩하고 앞단에서 인증을 처리합니다. ChatGPT에서 익명 MCP로 직접 연결할 경우에는 `MCP_ALLOW_NO_AUTH=true`를 사용할 수 있습니다. 이 경우 URL을 아는 누구나 인스턴스의 전체 권한을 사용할 수 있다는 점은 의도된 동작입니다.

OpenAI의 현재 원격 MCP 인증 요구사항은 [MCP 서버 인증 문서](https://developers.openai.com/plugins/build/auth)에 정리되어 있습니다.

## VPS/EC2 배포

예시는 `/opt/remote-dev-mcp`에 설치하는 경우입니다.

```bash
sudo mkdir -p /opt/remote-dev-mcp
sudo cp -a package.json package-lock.json tsconfig.json src deploy /opt/remote-dev-mcp/
cd /opt/remote-dev-mcp
sudo npm ci
sudo npm run build
sudo npm prune --omit=dev

sudo cp deploy/remote-dev-mcp.env.example /etc/remote-dev-mcp.env
sudo chmod 600 /etc/remote-dev-mcp.env
sudo editor /etc/remote-dev-mcp.env

sudo cp deploy/remote-dev-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now remote-dev-mcp
sudo systemctl status remote-dev-mcp
```

`/usr/bin/node`가 실제 Node.js 경로와 다르면 systemd 파일의 `ExecStart`를 수정합니다. `which node`로 확인할 수 있습니다.

공개 인터넷에서 사용할 때는 HTTPS가 필요합니다. [Nginx 예제](deploy/nginx.remote-dev-mcp.conf)의 도메인과 인증서 경로를 바꾼 뒤 활성화합니다. Streamable HTTP의 SSE 응답을 위해 proxy buffering을 비활성화하고 긴 read timeout을 사용합니다.

## ChatGPT 연결

배포 URL이 `https://mcp.example.com/mcp`라고 가정합니다.

- ChatGPT 인증 연결: `MCP_OAUTH_ENABLED=true`로 배포하고 해당 URL을 연결한 뒤, 승인 화면에 `MCP_AUTH_TOKEN`을 입력합니다.
- ChatGPT 익명 개발 연결: 내장 인증을 끄고 해당 URL을 연결합니다.
- 외부 인증 연결: 내장 OAuth 대신 OAuth 2.1 게이트웨이나 IdP를 사용할 수 있습니다.
- OpenAI Responses API: remote MCP 도구의 서버 URL을 지정하고 서버가 요구하는 인증 토큰을 전달합니다.

ChatGPT의 최신 연결 경로는 **Settings → Security and login → Developer mode**를 활성화한 뒤 플러그인 추가 화면에서 원격 MCP URL을 등록하는 방식입니다. 자세한 내용은 [OpenAI 원격 MCP 문서](https://developers.openai.com/api/docs/mcp)를 참고합니다.

## 검증

```bash
npm run typecheck
npm test
npm run build
```

테스트에는 실제 Streamable HTTP MCP 클라이언트 연결, bearer 인증, 도구 목록, `run_script`, 파일 읽기·쓰기, 장기 프로세스, 청크 전송 및 unified diff 적용이 포함됩니다.

## 주요 환경 변수

| 변수 | 기본값 | 설명 |
|---|---:|---|
| `MCP_HOST` | `0.0.0.0` | HTTP 바인드 주소 |
| `MCP_PORT` | `3000` | HTTP 포트 |
| `MCP_ENDPOINT` | `/mcp` | Streamable HTTP MCP 경로 |
| `MCP_PUBLIC_URL` | 없음 | 외부 HTTPS 기준 URL |
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
| `MCP_MAX_OUTPUT_BYTES` | `1048576` | 한 도구 응답의 최대 출력 |
| `MCP_MAX_RETAINED_PROCESS_OUTPUT_BYTES` | `4194304` | 프로세스별 보관 출력 |
| `MCP_PROCESS_RETENTION_MS` | `3600000` | 완료 프로세스 보관 시간 |
| `MCP_SESSION_TTL_MS` | `86400000` | 유휴 MCP 세션 보관 시간 |
| `MCP_MAX_FILE_CHUNK_BYTES` | `1048576` | 파일 전송 청크 크기 |

## 라이선스

[MIT License](LICENSE)
