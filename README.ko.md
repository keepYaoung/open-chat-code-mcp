# Open Chat Code MCP

[English README](README.md)

에이전트 운영 규칙은 [AGENTS.md](AGENTS.md) 또는 [AGENTS.ko.md](AGENTS.ko.md)를 참고하세요.

챗GPT를 Codex처럼, 내 Mac 또는 서버를 ChatGPT와 다른 MCP 클라이언트가 사용할 수 있는 코딩 호스트로 만드는 프로젝트입니다.

`open-chat-code-mcp`는 MCP(Model Context Protocol)를 통해 파일 읽기/수정, Git, 테스트, 빌드, 관리형 셸 명령을 제공합니다. AI 클라이언트는 어느 기기에서든 연결할 수 있지만, 실제 작업은 설정한 Mac 또는 서버에서 실행됩니다.

```text
ChatGPT 또는 MCP 클라이언트
             |
             | HTTPS 기반 MCP
             v
     Open Chat Code MCP
             |
             v
        내 Mac 또는 서버
        |- 명령 실행
        |- 파일 읽기/쓰기
        |- Git, 테스트, 빌드
        `- 장기 실행 프로세스 관리
```

> [!IMPORTANT]
> 이 프로젝트는 샌드박스 데모가 아닙니다. 연결된 클라이언트는 허용된 프로젝트 경로 안에서 파일을 바꾸고 명령을 실행할 수 있습니다. OAuth, HTTPS, 좁은 경로 제한을 사용하고 민감한 자료가 있는 Mac에서는 별도 macOS 계정을 권장합니다.

## 빠른 안내

| 하고 싶은 일 | 참고할 항목 |
| --- | --- |
| 개인 Mac을 ChatGPT 코딩 호스트로 사용 | [macOS 설치](#macos-이-mac을-chatgpt-코딩-호스트로-사용하기) |
| Linux VPS 또는 EC2에서 실행 | [Linux 빠른 시작](#linux-빠른-시작), [VPS/EC2 배포](#vpsec2-배포) |
| 배포 뒤 ChatGPT 연결 | [ChatGPT 연결](#chatgpt-연결) |
| 제공 기능 확인 | [제공 도구](#제공-도구) |
| 실제 설정값 전체 확인 | [영문 환경 변수 표](README.md#key-environment-variables) |

## 제공 기능

- 로그인하면 자동으로 시작되는 로컬 코딩 호스트
- ChatGPT 연결용 OAuth 2.1, Dynamic Client Registration(DCR), PKCE
- 공유기 포트를 열지 않는 Cloudflare Tunnel 기반 HTTPS 주소
- macOS 명령 샌드박스와 명시적 프로젝트 경로 제한
- 장기 실행 명령의 상태 조회, 입력 전달, 종료 제어

## 안전한 사용과 검토 흐름

Open Chat Code MCP는 ChatGPT 대화의 맥락을 이어 코딩 접근을 제공하는 보조 도구이며, Codex·Claude·Cursor 같은 전용 코딩 도구를 완전히 대체하지는 않습니다. 일반적인 코드 작업은 전용 도구를 먼저 사용하고, ChatGPT 대화 맥락이 필요하거나 그 도구만으로 부족할 때 이 MCP를 사용하세요.

공개 HTTPS 주소는 연결 통로일 뿐입니다. ChatGPT는 설정된 Mac 또는 서버의 **로컬 체크아웃**을 수정하므로, 다른 도구는 서로 다른 저장소 경로 또는 브랜치를 열고 있을 수 있습니다.

MCP를 통한 작업 뒤에는 다음 흐름을 권장합니다.

1. MCP 작업 폴더에서 `git status`와 `git diff`로 실제 변경을 확인합니다.
2. 변경을 커밋하거나 전용 코딩 도구가 사용하는 체크아웃으로 동기화합니다.
3. Codex·Claude·Cursor 등 전용 도구로 코드 품질, 누락된 테스트, 보안, 동작 회귀를 별도로 검토합니다.
4. 검토 결과를 반영한 뒤 테스트·빌드·배포를 진행합니다.

`MCP_ALLOWED_PATHS`에 지정한 모든 폴더는 연결된 에이전트가 쓸 수 있습니다. `remove_path`는 파일을 영구 삭제하므로 프로젝트 루트는 좁게 유지하고, 비밀값·승인 키·토큰·tunnel credential은 허용 프로젝트 폴더에 두지 마세요.

## 일일 보안 업데이트 확인

매일 첫 번째 코딩 작업 전에는 MCP 클라이언트가 `check_security_updates`를 호출하고, `security_review_required` 결과가 나오면 프로젝트 파일을 바꾸기 전에 사용자에게 알려야 합니다. 이 도구는 현재 설치된 호스트의 보안 민감 경로를 Open Chat Code MCP 공식 기준과 비교하고, 그날의 결과를 로컬에 기록합니다.

포크도 지원합니다. `origin`이나 `upstream`이라는 원격 이름을 가정하지 않으며, 기본으로 `https://github.com/keepYaoung/open-chat-code-mcp.git`의 `main`을 확인합니다. 포크 사용자는 공식 보안 알림을 받기 위해 기본값을 유지하거나, 의도적으로 `MCP_SECURITY_SOURCE_URL`과 `MCP_SECURITY_SOURCE_REF`를 바꿀 수 있습니다.

`security_review_required`는 로컬 보안 관련 코드가 공식 기준과 다르므로 검토가 필요하다는 뜻입니다. 포크가 동등한 패치를 이미 적용했거나 해당 파일을 의도적으로 수정한 경우도 있으므로, 취약하다는 단정은 아닙니다. 검토가 필요하면 업데이트를 반영하고 테스트와 `npm run build`를 실행한 뒤 MCP 서비스를 재시작하세요. 재시작만으로는 소스 코드가 업데이트되지 않습니다.

## 동작 방식

1. ChatGPT가 공개 HTTPS 주소로 연결합니다.
2. Cloudflare Tunnel이 요청을 Mac의 `127.0.0.1` 로컬 서비스에만 전달합니다.
3. Open Chat Code MCP가 OAuth를 확인한 뒤 허용 범위 안에서 도구를 실행합니다.
4. 실행 결과가 ChatGPT 대화로 돌아갑니다.

## 문서 구성

- 이 문서: Mac 설치, ChatGPT 연결, 운영의 핵심 흐름
- [영문 전체 문서](README.md): Linux 배포, 모든 환경 변수, 검증 절차를 포함한 완전한 기술 문서
- [macOS 배포 파일 안내](deploy/macos/README.macOS.md): LaunchAgent와 환경 파일의 역할
- [Cloudflare Tunnel 예시](deploy/macos/cloudflared-config.example.yml): 공개 HTTPS 주소를 로컬 서비스로 연결하는 템플릿
- [macOS 환경 파일 예시](deploy/macos/cokacremote.env.example): 복사해서 로컬에서만 수정하는 설정 템플릿

## 제공 도구

이 서버는 명령 실행, 장기 프로세스 관리, 파일 작업을 포함한 23개 MCP 도구를 제공합니다.

- 셸 명령과 스크립트 실행, 테스트, 빌드, 패키지 설치, Git 작업
- 장기 실행 프로세스의 출력 조회, 표준 입력 전달, 종료
- 파일 읽기/쓰기/이동/복사/삭제, 부분 패치·unified diff 적용, 업로드/다운로드
- `doctor`로 허용 프로젝트 루트 접근, Git 브랜치·변경 요약, 디스크 여유, 인증·macOS 샌드박스 설정, 공개 HTTPS 상태를 읽기 전용으로 점검
- `check_security_updates`로 포크와 무관하게 공식 보안 기준을 하루 한 번 비교하고, 보안 관련 차이가 있을 때만 검토·빌드·재시작을 안내

설치 직후나 연결 상태가 이상할 때는 먼저 `doctor`를 실행하세요. 이 도구는 읽기 전용이며 설정된 프로젝트 루트 밖을 탐색하지 않습니다. `remove_path`는 파일을 휴지통으로 보내지 않고 영구 삭제합니다. 한 파일의 작은 수정은 `apply_partial_patch`를 쓰면 여러 교체를 모두 검증한 뒤 한 번에 반영하며, `hash_file`의 SHA-256으로 오래된 파일 수정을 막을 수 있습니다. 여러 파일의 unified diff는 `apply_patch`를 사용하고, 이 도구는 작업 폴더와 허용 프로젝트 루트 밖의 수정은 거부합니다. 삭제 도구는 특히 주의해서 사용하세요. 전체 도구 목록과 입력 형식은 [영문 README](README.md#available-tools)를 참고하세요.

## 프로젝트 트리 카탈로그 (예정)

다음 관리 단계는 설정된 프로젝트 루트를 바탕으로 만든 읽기 전용 프로젝트 트리입니다. 에이전트가 초기 인프라 설정 때 허용된 저장소와 폴더 구조를 파악하고, 이후 대화에서도 작은 상태 인덱스를 바탕으로 현재 위치를 이해하도록 하는 것이 목적입니다.

- `MCP_ALLOWED_PATHS`만 읽고 홈 디렉터리 전체를 스캔하지 않습니다.
- 일반 그래프가 아니라 폴더와 저장소의 부모-자식 관계를 나타내는 트리 노드를 사용합니다.
- 기본적으로 `.git`, 의존성 폴더, 빌드 산출물, 사용자가 제외한 경로는 보지 않습니다.
- 저장소 노드에는 브랜치, 변경 유무, 감지한 패키지 파일, 문서화된 테스트·빌드 명령처럼 안전한 메타데이터만 저장합니다.
- 카탈로그 갱신은 읽기 전용입니다. 별도 요청 없이 의존성을 설치하거나 파일을 수정하거나 프로젝트 명령을 실행하지 않습니다.

현재 호스트 상태는 `doctor`로 확인하고, 초기 설정 뒤 더 넓은 저장소·폴더 지도가 필요할 때 프로젝트 트리 카탈로그를 사용하게 됩니다.

## 요구 사항

- Node.js 22 이상과 npm
- Git
- Cloudflare Tunnel을 쓸 경우 `cloudflared`
- `run_script`로 Python을 실행할 경우 Python 3
- ChatGPT에서 접속할 때는 안정적인 공개 HTTPS 도메인

## macOS: 이 Mac을 ChatGPT 코딩 호스트로 사용하기

> [!IMPORTANT]
> macOS 샌드박스와 경로 제한은 실수의 영향 범위를 줄이지만 가상 머신 수준의 격리는 아닙니다. `sandbox-exec`는 레거시 macOS 기능이므로, 민감한 개인 자료가 있는 Mac에서는 전용 macOS 사용자 계정 또는 VM을 사용하는 편이 안전합니다. `MCP_MACOS_SANDBOX=true`인데 이 실행 파일이 없으면 서비스는 시작 단계에서 실패합니다.

### 1. 안전한 위치 정하기

서비스 파일은 `Desktop`, `Documents`, `Downloads` 밖에 둡니다. macOS 개인정보 보호 기능 때문에 백그라운드 LaunchAgent가 이런 폴더에 간헐적으로 접근하지 못할 수 있습니다.

아래 예시에서 `REPLACE_WITH_YOUR_USERNAME`을 실제 macOS 사용자명으로 바꿉니다.

```text
/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote
/Users/REPLACE_WITH_YOUR_USERNAME/Projects/chatgpt-agent
```

두 번째 경로가 MCP 서버가 읽고 쓸 수 있는 프로젝트 루트입니다. 서비스 파일은 보호 폴더 밖에 두고, 프로젝트 루트는 필요한 곳만 최소한으로 등록하세요.

Apple Silicon Mac에서 Homebrew를 사용한다면 다음을 설치합니다.

```bash
brew install node git cloudflared
node --version
cloudflared --version
```

Intel Mac에서 Homebrew 경로가 `/usr/local`이면, 아래 LaunchAgent 템플릿의 `/opt/homebrew` 경로도 맞춰야 합니다.

### 2. 서비스 설치

```bash
git clone https://github.com/keepYaoung/open-chat-code-mcp.git
cd open-chat-code-mcp
npm ci
npm run build
npm prune --omit=dev

mkdir -p "/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote"
mkdir -p "/Users/REPLACE_WITH_YOUR_USERNAME/Projects/chatgpt-agent"
cp -a . "/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app"
```

공개 예시 파일을 복사한 뒤, 복사본만 수정합니다. 실제 설정 파일은 절대 커밋하지 않습니다.

```bash
cd "/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app"
mkdir -p config logs state/home
cp deploy/macos/cokacremote.env.example config/cokacremote.env
chmod 600 config/cokacremote.env
openssl rand -hex 32
```

마지막 명령이 만든 값을 `config/cokacremote.env`의 `MCP_OAUTH_APPROVAL_KEY`에 설정합니다. OAuth만 쓸 경우 `MCP_AUTH_TOKEN`은 비워 둡니다. `MCP_DEFAULT_CWD`와 `MCP_ALLOWED_PATHS`에는 필요한 프로젝트만 넣고, `MCP_MACOS_SANDBOX=true`는 유지합니다. Windows에서 로컬 실험을 해야 한다면 먼저 [Windows 보안 및 배포 리뷰](docs/WINDOWS.ko.md)를 확인하세요.

여러 프로젝트를 허용하려면 쉼표로 구분합니다. 기본 작업 경로도 반드시 그중 하나여야 합니다.

```dotenv
MCP_DEFAULT_CWD=/Users/REPLACE_WITH_YOUR_USERNAME/Code/projects
MCP_ALLOWED_PATHS=/Users/REPLACE_WITH_YOUR_USERNAME/Code/projects,/Users/REPLACE_WITH_YOUR_USERNAME/Code/sandboxes
```

`/` 또는 사용자 홈 디렉터리 전체를 허용 경로로 지정하지 마세요.

### 3. Cloudflare Tunnel로 HTTPS 공개

Node.js 서비스는 `127.0.0.1:3000`에서만 대기합니다. Cloudflare Tunnel은 공유기 인바운드 포트를 열지 않고 공개 HTTPS 주소를 제공합니다.

```bash
cloudflared tunnel login
cloudflared tunnel create chatgpt-coding-host
cloudflared tunnel route dns chatgpt-coding-host mcp.example.com
```

`deploy/macos/cloudflared-config.example.yml`을 `~/.cloudflared/config.yml`로 복사하고 tunnel ID와 호스트명을 바꿉니다. 이후 설정을 확인하고 터널을 실행합니다.

```bash
cloudflared tunnel ingress validate
cloudflared tunnel --config ~/.cloudflared/config.yml run chatgpt-coding-host
```

`config/cokacremote.env`에는 같은 공개 호스트명을 설정합니다.

```dotenv
MCP_PUBLIC_URL=https://mcp.example.com
MCP_ALLOWED_HOSTS=mcp.example.com,127.0.0.1,localhost
MCP_OAUTH_ISSUER=https://mcp.example.com
MCP_OAUTH_RESOURCE=https://mcp.example.com/mcp
```

`~/.cloudflared/` 아래 tunnel credential JSON은 비밀입니다. 저장소나 클라우드 드라이브에 올리지 마세요.

### 4. 로그인 시 자동 시작

두 LaunchAgent 템플릿을 `~/Library/LaunchAgents/`로 복사합니다. `REPLACE_WITH_YOUR_USERNAME`을 모두 실제 사용자명으로 바꾸고, 터널 이름을 다르게 만들었다면 Cloudflare 템플릿도 수정하세요.

```bash
cp deploy/macos/com.example.cokacremote.plist ~/Library/LaunchAgents/com.example.cokacremote.plist
cp deploy/macos/com.example.cloudflared.plist ~/Library/LaunchAgents/com.example.cokacremote-cloudflared.plist
plutil -lint ~/Library/LaunchAgents/com.example.cokacremote.plist
plutil -lint ~/Library/LaunchAgents/com.example.cokacremote-cloudflared.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.example.cokacremote.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.example.cokacremote-cloudflared.plist
launchctl kickstart -k "gui/$(id -u)/com.example.cokacremote"
launchctl kickstart -k "gui/$(id -u)/com.example.cokacremote-cloudflared"
curl --fail http://127.0.0.1:3000/health
curl --fail https://mcp.example.com/health
```

서비스는 셸 기록, npm 캐시, Git 설정을 분리된 `HOME`에 보관합니다. 로그는 설치 폴더의 `logs/` 아래에 생성됩니다.

### 5. ChatGPT 연결

ChatGPT에서 커스텀 MCP 연결을 추가하고 다음 주소를 입력합니다.

```text
https://mcp.example.com/mcp
```

OAuth 승인 화면이 나오면 `MCP_OAUTH_APPROVAL_KEY` 값을 입력합니다. 이 값은 root 비밀번호처럼 취급하고 노출된 것으로 의심되면 즉시 교체하세요.

ChatGPT 화면 구성은 요금제와 워크스페이스에 따라 달라질 수 있습니다. 일반적으로 개발자 모드를 켠 뒤 Apps 또는 Plugins 설정에서 MCP 서버를 추가합니다. DCR을 선택할 수 있다면 이 서버는 DCR과 PKCE를 지원하므로 별도의 Client ID나 Client Secret을 만들 필요가 없습니다.

## 보안 점검표

- `deploy/macos/*.example.*`만 커밋하고 `config/cokacremote.env`는 커밋하지 않습니다.
- OAuth 상태, Cloudflare credential JSON, 액세스 토큰, 개인 키, 실제 호스트명을 저장소에 올리지 않습니다.
- Node.js 서비스는 `127.0.0.1`에만 바인딩하고 포트 `3000`을 인터넷에 직접 노출하지 않습니다.
- ChatGPT를 연결하기 전에 `MCP_ALLOWED_PATHS`를 검토합니다. 나열된 모든 경로는 에이전트가 쓸 수 있습니다.
- `MCP_OAUTH_APPROVAL_KEY`, `config/cokacremote.env`, `state/oauth-state.json`, `~/.cloudflared/*json`은 Mac에만 둡니다.
- 공개하기 전 `git status --ignored`로 자격 증명이 스테이징되지 않았는지 확인합니다.

## Linux 빠른 시작

Linux 서버와 Node.js 22 이상이 있다면 최소 실행은 다음과 같습니다.

```bash
git clone https://github.com/keepYaoung/open-chat-code-mcp.git
cd open-chat-code-mcp
npm install
npm run build

MCP_AUTH_TOKEN='replace-with-a-long-random-token' npm start
```

ChatGPT에서 원격으로 연결하려면 HTTPS 프록시 또는 Tunnel, `MCP_ALLOWED_HOSTS`, OAuth 또는 Bearer 인증을 추가로 구성해야 합니다. Linux 배포는 운영체제 수준의 제한을 별도로 구성하지 않으면 기본적으로 강력한 권한을 갖습니다. 일반적인 코딩 용도로 `root` 실행은 금지하세요.

## VPS/EC2 배포

Ubuntu 기반 VPS/EC2에서 systemd와 Nginx를 이용하는 전체 절차는 [영문 VPS/EC2 배포 문서](README.md#vpsec2-deployment)를 참고하세요. 서버를 공개 인터넷에 노출할 때는 Node.js를 `127.0.0.1`에만 바인딩하고, TLS가 적용된 프록시에서만 외부 요청을 받도록 구성해야 합니다.

## 운영과 문제 해결

macOS에서는 먼저 로컬 서비스와 공개 주소의 상태를 각각 확인합니다.

```bash
curl http://127.0.0.1:3000/health
curl https://mcp.example.com/health
```

- `401 Unauthorized`: OAuth 설정, 승인 키, Bearer 토큰을 확인합니다.
- `403 Host header is not allowed`: 요청 도메인을 `MCP_ALLOWED_HOSTS`에 추가합니다.
- OAuth 설정을 찾을 수 없다는 오류: `MCP_OAUTH_ENABLED`, 공개 URL, `/.well-known/` 경로 전달을 확인합니다.
- 명령이 바로 끝나지 않고 `sessionId`를 반환: `read_process`로 상태와 출력을 조회하거나 `write_stdin`으로 입력을 보냅니다.
- 서비스를 재시작하면 실행 중인 관리 프로세스 상태와 아직 교환되지 않은 인증 코드는 사라집니다. 등록된 OAuth 클라이언트와 발급된 토큰은 상태 파일에 남습니다.

환경 변수 전체 목록, OAuth 세부 방식, 외부 E2E 검증, 모든 Linux 운영 명령은 [영문 전체 문서](README.md)를 참고하세요.

## 라이선스

[MIT License](LICENSE)

## 면책 사항

이 소프트웨어는 어떠한 보증도 없이 제공됩니다. 데이터 손실, 시스템 장애, 보안 사고 또는 재정적 손실을 포함한 모든 결과에 대한 책임은 사용자가 집니다. 자세한 원문은 [영문 README의 면책 조항](README.md#disclaimer)을 참고하세요.
