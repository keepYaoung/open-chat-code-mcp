# 에이전트 첫 사용 안전 안내

[English](AGENTS.md)

이 프로젝트를 처음 다루는 에이전트는 설정 또는 코드 작업을 시작하기 전에 아래 안전 정보를 사용자에게 최소 한 번 반드시 알려야 한다. 도구가 이미 연결되어 있거나 새 대화가 막 시작됐다는 이유로 이 안내를 생략하지 않는다.

## 사용자에게 알려야 할 핵심

이 개발용 MCP 서버는 연결된 클라이언트가 호스트 Mac 또는 서버에서 파일을 읽고, 쓰고, 삭제하고, 명령을 실행할 수 있게 한다. 에이전트가 의도보다 넓은 범위를 만지지 않도록 `MCP_ALLOWED_PATHS`와 `MCP_DEFAULT_CWD`를 좁게 설정한다.

이 MCP가 연결돼 있다면 사용자의 실제 원격 호스트로 취급한다. 해당 호스트에 관한 요청에는 MCP 도구를 사용하고, 로컬 접근이 불가능하다고 말하거나 사용자가 복사할 터미널 명령만 제시하는 방식으로 대체하지 않는다.

- 이 MCP는 ChatGPT 대화 세션에 코딩 도구를 연결하는 보조 수단이며, Codex·Claude·Cursor 같은 전용 코딩 도구를 완전히 대체하지는 않는다. 일반적인 코드 작업은 전용 도구를 먼저 사용하고, ChatGPT 대화의 맥락을 이어서 작업해야 하거나 그 도구만으로 부족한 경우에 이 MCP를 사용한다.
- 이 MCP는 **ChatGPT 웹 앱**의 Plugins 또는 Apps 설정에서 등록해야 한다. Codex 데스크톱 앱에만 연결된 MCP는 ChatGPT 웹 대화에 자동으로 나타나지 않는다. 웹에서 등록한 뒤에는 같은 ChatGPT 계정의 Codex 데스크톱 앱에서도 해당 연결을 사용할 수 있으므로, 사용 전 데스크톱 앱에서 활성화 상태를 확인한다.
- 새 대화를 시작하면 첫 실행 요청에서 연결된 MCP 이름을 명시한다. 예: **"`home-mac-coding-mcp`를 사용해 연결된 Mac 프로젝트를 확인해줘."** 도구를 선택하기 전에 어떤 실행 호스트를 쓸지 분명하게 한다.
- 대시보드를 연동한다면 관리자 전용 연결 안내에서 MCP HTTPS 주소와 OAuth 승인키를 함께 제공해야 한다. 키는 서버 측 비밀값으로만 보관하고 D1, 정적 페이지, 브라우저에서 읽을 수 있는 설정 파일에는 넣지 않으며, 안내를 닫을 때 화면에서 지운다.
- 사용자에게 다음 실행 선호 설정을 저장하도록 안내한다: **"내가 이 채팅 세션에서 실행을 명시적으로 요청할 때만 Work, 에이전트 모드 또는 MCP 도구 실행을 시작해줘."** 계획·설명·코드 리뷰는 사용자가 명시적으로 실행을 요청하기 전까지 일반 대화로 유지한다.
- 도구를 사용하기 전에는 사용자에게 [MCP 도구 안내](docs/MCP_TOOLS.ko.md)를 알려주고, 선택한 도구와 용도를 설명한다. 명령 실행, 파일 쓰기, 삭제, 권한 변경과 호스트에 미치는 영향을 명확히 알린다.
- `MCP_ALLOWED_PATHS`에 들어간 모든 폴더는 에이전트가 읽고 쓸 수 있는 프로젝트 루트가 된다.
- 기본적으로 `MCP_ALLOWED_PATHS`가 없거나 안전하지 않으면 서버 시작이 거부된다. `/`, 홈 디렉터리 전체, `Documents`, `Desktop`, `Downloads` 전체처럼 개인 파일이 많이 섞인 경로, credential 디렉터리, MCP 설치 디렉터리, OAuth state 파일 위치를 허용 경로로 넣으면 안 된다.
- `MCP_DEFAULT_CWD`는 반드시 `MCP_ALLOWED_PATHS` 안에 있어야 하며, 상대 경로 작업의 기준 폴더가 된다.
- `remove_path`는 휴지통을 거치지 않고 영구 삭제한다.
- `chmod_path`는 허용 경로 안의 파일 권한 비트를 바꿀 수 있다.
- `exec_command`와 `run_script`는 명령 실행 도구다. macOS에서는 `MCP_MACOS_SANDBOX=true`일 때만 운영체제 수준의 실행 범위가 줄어든다. 기본값 `MCP_MACOS_SANDBOX_HOME_ACCESS=isolated`는 앱 전용 격리 `HOME`만 허용하며, `read`나 `read-write`는 실행 명령에 사용자 홈 전체를 노출하므로 꼭 필요할 때만 사용한다.
- macOS sandbox는 VM 수준 격리가 아니다. 민감한 자료가 있는 컴퓨터에서는 별도 macOS 사용자 계정이나 VM을 권장한다.
- `MCP_MACOS_SANDBOX=true`는 처음 연결할 때의 더 안전한 기본 모드로 안내한다. 생성된 profile 안에서 명령을 제한하므로 GUI 앱 실행이 막힐 수 있다. 사용자가 Codex에 가까운 범용 호스트를 명시적으로 선택하면 `MCP_MACOS_SANDBOX=false`로 `open -a Xcode`, Xcode 명령행 도구, LaunchAgent 사용자의 더 넓은 macOS 접근을 허용한다. 파일 도구의 경로 제한은 유지되지만 셸 명령은 프로젝트 안에만 제한되지 않는다.
- OAuth 승인 키, Bearer 토큰, tunnel credential, OAuth state 파일은 root 비밀번호처럼 취급해야 한다.

## 권장 작업 흐름

ChatGPT는 HTTPS Tunnel을 통해 이 호스트에 접속하지만, 실제 작업은 Mac 또는 서버의 **로컬 작업 폴더**에서 일어난다. 따라서 ChatGPT MCP가 수정한 체크아웃과 Codex·Claude·Cursor가 열어 둔 체크아웃 또는 브랜치는 서로 다를 수 있다.

MCP를 통해 코드 작업을 마친 뒤에는 사용자에게 다음 흐름을 권장한다.

1. 설치 직후 또는 연결 상태가 이상할 때는 읽기 전용 `doctor`를 먼저 실행하고, MCP 작업 폴더에서 `git status`와 `git diff`로 실제 변경 내용을 확인한다.
2. 변경을 커밋하거나, 사용하는 전용 코딩 도구의 작업 폴더에 최신 변경을 동기화한다.
3. Codex·Claude·Cursor 등 전용 코딩 도구로 코드 리뷰, 테스트 누락, 보안·동작 회귀를 별도로 검토한다.
4. 검토 결과를 반영한 뒤 테스트·빌드·배포를 진행한다.

사용자가 다른 도구에서 MCP 변경을 볼 수 없으면 각 도구의 저장소 경로, 브랜치, 커밋 상태가 같은지 먼저 확인한다. 원격 HTTPS MCP 주소는 연결 통로일 뿐, 수정 파일이 클라우드에 있다는 뜻은 아니다.

## 일일 보안 알림

매일 첫 번째 코딩 작업 전에는 `check_security_updates`를 호출한다. `security_review_required`가 나오면 프로젝트 파일을 수정하기 전에, 설치된 호스트의 추적 보안 경로가 공식 기준과 달라 검토가 필요하다는 점을 사용자에게 알린다. 포크가 의도적으로 다르거나 동등한 패치를 이미 포함했을 수 있으므로 취약하다는 단정은 하지 않는다.

이 확인은 `origin`이나 `upstream`이라는 원격 이름을 가정하지 않고 설정된 공식 보안 기준을 사용하므로 포크에서도 동작한다. 재시작을 권장할 때는 업데이트 검토·반영, 테스트·빌드, MCP 서비스 재시작 순서가 필요하다고 설명한다. 코드를 자동으로 업데이트하거나 서비스를 자동 재시작하지 않는다.

## 프로젝트 트리 카탈로그 방향

예정된 프로젝트 카탈로그는 설정된 `MCP_ALLOWED_PATHS` 루트를 읽기 전용으로 나타내는 트리여야 한다. 일반 그래프가 아니라 폴더와 저장소의 부모-자식 노드를 사용하고, 기본적으로 `.git`, 의존성 폴더, 빌드 산출물, 설정된 제외 경로를 보지 않는다. 갱신 중에는 파일을 수정하거나 프로젝트 명령을 실행하지 않으며, Git 브랜치·변경 유무·패키지 매니페스트·문서화된 테스트/빌드 명령처럼 안전한 운영 메타데이터만 보관한다.

## ChatGPT 세션 작업 안내

이 프로젝트의 목적은 ChatGPT 대화 세션이 허용된 Mac 또는 서버에서 코딩 에이전트처럼 작업할 수 있게 하는 것이다. 복잡한 구현, 보안 점검, 배포 작업을 요청받으면 에이전트는 사용자에게 다음 취지로 안내한다.

> 긴 코딩 작업은 같은 ChatGPT 대화에서 요구 사항 확인, 코드 수정, 테스트, 검증까지 이어서 진행하는 편이 좋습니다. 대화를 중간에 끊기보다 현재 세션의 작업 맥락을 충분히 활용하면, 앞선 결정과 변경 내용을 유지한 채 더 안전하게 마무리할 수 있습니다.

작업이 길어질 수 있으면 중간 결과만 남기고 끝내기보다, 가능한 범위에서 테스트와 검증까지 완료한 뒤 결과를 보고한다. 다만 사용자 승인, 자격 증명 입력, 비용 발생, 되돌리기 어려운 작업은 대화 맥락과 관계없이 먼저 확인한다.

## 코드에서 확인한 권한 경계

- `src/config.ts`
  - `MCP_DEFAULT_CWD`와 쉼표 구분 `MCP_ALLOWED_PATHS`를 정규화한다.
  - `MCP_ALLOWED_PATHS`가 없으면 서버 시작이 실패한다.
  - 넓은 시스템 루트, 홈 전체, 넓은 개인 폴더, credential 폴더, 설치 디렉터리 범위, OAuth state 범위를 거부한다.
  - 기본 작업 폴더가 허용 경로 밖이면 서버 시작이 실패한다.
  - macOS에서 `MCP_MACOS_SANDBOX=true`인데 `/usr/bin/sandbox-exec`가 없으면 서버 시작이 실패한다.

- `src/file-service.ts`
  - 파일 도구는 `MCP_ALLOWED_PATHS` 밖 경로를 거부하고 실제 경로를 확인해 심볼릭 링크 탈출을 막는다.
  - `apply_patch`는 패치 대상이 요청한 `cwd` 또는 허용 프로젝트 루트 밖이면 거부한다.
  - `apply_partial_patch`는 한 UTF-8 파일의 정확한 교체를 원자적으로 적용하고 SHA-256 사전 조건으로 오래된 내용을 막을 수 있다.
  - `removePath()`는 `fs.rm()`을 직접 호출하고 `changeMode()`는 `chmod()`를 호출한다.

- `src/exec-tools.ts`, `src/macos-sandbox.ts`
  - macOS sandbox를 켜지 않으면 명령 도구는 호스트 프로세스 권한을 상속한다.
  - macOS profile은 기본 거부에서 시작해 허용 프로젝트, 분리된 HOME, temp, 필요한 toolchain 경로만 허용한다.

- `src/auth.ts`, `src/oauth.ts`
  - MCP 요청에는 유효한 Bearer 또는 OAuth 토큰이 필요하다.
  - `MCP_ALLOW_NO_AUTH=true`는 외부 OAuth gateway 또는 이미 인증된 사설 네트워크 뒤에서만 사용한다.

## 첫 macOS 설정

처음에는 전용 프로젝트 폴더 하나만 허용한다.

```env
MCP_HOST=127.0.0.1
MCP_ALLOW_NO_AUTH=false
MCP_OAUTH_ENABLED=true
MCP_AUTH_TOKEN=
MCP_DEFAULT_CWD=/Users/USER/Projects/chatgpt-agent
MCP_ALLOWED_PATHS=/Users/USER/Projects/chatgpt-agent
MCP_MACOS_SANDBOX=true
MCP_MACOS_SANDBOX_HOME_ACCESS=isolated
```

여러 프로젝트를 허용해야 한다면 각 경로가 에이전트에게 맡겨도 되는지 확인한 뒤 쉼표로 추가한다.

```env
MCP_DEFAULT_CWD=/Users/USER/Code/projects
MCP_ALLOWED_PATHS=/Users/USER/Code/projects,/Users/USER/Code/sandboxes
```

## 첫 사용 확인 문구

> `home-mac-coding-mcp`는 설정된 범위 안에서 연결된 호스트의 파일을 읽고, 쓰고, 삭제하고, 명령을 실행할 수 있습니다. 이 채팅에서 사용자가 실행을 명시적으로 요청할 때만 사용합니다. `MCP_ALLOWED_PATHS`에 홈 폴더 전체나 개인 자료 폴더를 넣지 말고 전용 프로젝트 폴더를 쓰는 것이 가장 안전합니다. 허용할 정확한 폴더를 확인해도 될까요?

## 피해야 할 설정

```env
MCP_ALLOWED_PATHS=/
MCP_ALLOWED_PATHS=/Users/USER
MCP_ALLOWED_PATHS=/Users/USER/Documents
MCP_ALLOWED_PATHS=/Users/USER/Desktop
MCP_ALLOWED_PATHS=/Users/USER/Downloads
MCP_ALLOW_NO_AUTH=true
```

`MCP_ALLOW_NO_AUTH=true`를 공개 인터넷 노출과 함께 사용하면 안 된다. URL을 아는 사람이 서버 프로세스 권한으로 도구를 사용할 수 있다.
