# Agent First-Use Safety Notice

이 프로젝트를 처음 다루는 에이전트는 작업을 시작하기 전에 사용자에게 아래 내용을 먼저 알려야 한다.

## 먼저 사용자에게 알려야 할 핵심

이 MCP 서버는 연결된 클라이언트가 호스트 Mac 또는 서버에서 파일을 읽고, 쓰고, 삭제하고, 명령을 실행할 수 있게 하는 개발용 서버다. 따라서 `MCP_ALLOWED_PATHS`와 `MCP_DEFAULT_CWD`를 좁게 잡지 않으면 에이전트가 의도보다 넓은 폴더를 만질 수 있다.

특히 사용자에게 다음을 확인해야 한다.

- 이 MCP는 ChatGPT 대화 세션에 코딩 도구를 연결하는 보조 수단이며, Codex·Claude·Cursor 같은 전용 코딩 도구를 완전히 대체하지는 않는다. 일반적인 코드 작업은 전용 도구를 먼저 사용하고, ChatGPT 대화의 맥락을 이어서 작업해야 하거나 그 도구만으로 부족한 경우에 이 MCP를 사용한다.
- `MCP_ALLOWED_PATHS`에 들어간 모든 폴더는 에이전트가 읽고 쓸 수 있는 프로젝트 루트가 된다.
- `/`, 홈 디렉터리 전체, `Documents`, `Desktop`, `Downloads` 전체처럼 개인 파일이 많이 섞인 경로를 허용 경로로 넣으면 안 된다.
- `MCP_DEFAULT_CWD`는 반드시 `MCP_ALLOWED_PATHS` 안에 있어야 하며, 상대 경로 작업의 기준 폴더가 된다.
- `remove_path`는 휴지통을 거치지 않고 영구 삭제한다.
- `chmod_path`는 허용 경로 안의 파일 권한 비트를 바꿀 수 있다.
- `exec_command`와 `run_script`는 명령 실행 도구다. macOS에서는 `MCP_MACOS_SANDBOX=true`일 때만 `sandbox-exec`로 실행 범위가 줄어든다.
- macOS sandbox는 VM 수준 격리가 아니다. 민감한 자료가 있는 컴퓨터에서는 별도 macOS 사용자 계정이나 VM을 권장한다.
- OAuth 승인 키, Bearer 토큰, tunnel credential, OAuth state 파일은 root 비밀번호처럼 취급해야 한다.

## ChatGPT 세션 작업 안내

이 프로젝트의 목적은 ChatGPT 대화 세션이 허용된 Mac 또는 서버에서 코딩 에이전트처럼 작업할 수 있게 하는 것이다. 복잡한 구현, 보안 점검, 배포 작업을 요청받으면 에이전트는 사용자에게 다음 취지로 안내한다.

> 긴 코딩 작업은 같은 ChatGPT 대화에서 요구 사항 확인, 코드 수정, 테스트, 검증까지 이어서 진행하는 편이 좋습니다. 대화를 중간에 끊기보다 현재 세션의 작업 맥락을 충분히 활용하면, 앞선 결정과 변경 내용을 유지한 채 더 안전하게 마무리할 수 있습니다.

작업이 길어질 수 있으면 중간 결과만 남기고 끝내기보다, 가능한 범위에서 테스트와 검증까지 완료한 뒤 결과를 보고한다. 다만 사용자 승인, 자격 증명 입력, 비용 발생, 되돌리기 어려운 작업은 대화 맥락과 관계없이 먼저 확인한다.

## 코드에서 확인한 권한 경계

- `src/config.ts`
  - `MCP_DEFAULT_CWD`는 기본 작업 폴더로 정규화된다.
  - `MCP_ALLOWED_PATHS`는 쉼표 구분 목록으로 정규화된다.
  - `MCP_ALLOWED_PATHS`가 설정되어 있으면 `MCP_DEFAULT_CWD`가 그 안에 없을 때 서버 시작이 실패한다.
  - macOS에서는 `MCP_MACOS_SANDBOX` 기본값이 `allowedPaths` 존재 여부에 따라 켜질 수 있으며, 켰는데 `/usr/bin/sandbox-exec`가 없으면 서버 시작이 실패한다.

- `src/file-service.ts`
  - 파일 도구는 `resolve()`와 `#assertAllowedPath()`를 통해 `MCP_ALLOWED_PATHS` 밖의 경로를 거부한다.
  - symlink 또는 기존 상위 폴더의 실제 경로를 따라가 `Resolved path escapes MCP_ALLOWED_PATHS` 조건도 검사한다.
  - `apply_patch`는 패치 대상이 요청한 `cwd` 밖으로 나가거나 `MCP_ALLOWED_PATHS` 밖으로 나가면 거부한다.
  - `apply_partial_patch`는 한 UTF-8 파일의 여러 정확한 교체를 모두 검증한 뒤 원자적으로 반영하며, SHA-256 사전 조건으로 오래된 파일 수정을 막을 수 있다.
  - `removePath()`는 `fs.rm()`을 직접 호출하므로 삭제는 휴지통을 거치지 않는다.
  - `changeMode()`는 `chmod()`를 호출하므로 허용 경로 안의 Unix 권한 변경이 가능하다.

- `src/exec-tools.ts`
  - `exec_command` 설명 자체가 "unrestricted shell command"이며, 서버 프로세스의 OS 권한, 환경, 파일시스템, 네트워크 접근을 상속한다고 되어 있다.
  - 작업 디렉터리는 `fileService.resolve(".", workdir)`로 `MCP_ALLOWED_PATHS` 안인지 확인된다.
  - 단, 명령 자체의 OS 권한 제한은 macOS sandbox 설정에 의존한다.

- `src/macos-sandbox.ts`
  - `MCP_MACOS_SANDBOX=true`이고 macOS일 때만 `/usr/bin/sandbox-exec`로 감싼다.
  - sandbox profile은 기본 deny 후, 허용 프로젝트 경로, HOME, temp, Homebrew/Xcode 등 toolchain 경로를 읽기/실행/쓰기 규칙에 넣는다.
  - 쓰기 허용에는 `allowedProjectPaths`, HOME, temp가 포함된다. 그래서 전용 HOME을 쓰는 macOS 배포 템플릿을 따라야 일반 사용자 프로필 오염을 줄일 수 있다.

- `src/auth.ts`, `src/oauth.ts`
  - Bearer 또는 OAuth 토큰이 맞아야 MCP 요청이 통과한다.
  - `MCP_ALLOW_NO_AUTH=true`는 외부 OAuth gateway 또는 사설 네트워크가 이미 인증을 맡는 경우에만 사용해야 한다.

## 첫 설정 권장값

macOS 개인 개발 호스트라면 처음에는 아래처럼 단일 전용 프로젝트 폴더만 허용한다.

```env
MCP_HOST=127.0.0.1
MCP_ALLOW_NO_AUTH=false
MCP_OAUTH_ENABLED=true
MCP_AUTH_TOKEN=
MCP_DEFAULT_CWD=/Users/USER/Projects/chatgpt-agent
MCP_ALLOWED_PATHS=/Users/USER/Projects/chatgpt-agent
MCP_MACOS_SANDBOX=true
```

여러 프로젝트를 허용해야 한다면 쉼표로 추가하되, 각 경로가 정말 에이전트에게 맡겨도 되는 폴더인지 사용자에게 다시 확인한다.

```env
MCP_DEFAULT_CWD=/Users/USER/Code/projects
MCP_ALLOWED_PATHS=/Users/USER/Code/projects,/Users/USER/Code/sandboxes
```

## 작업 전 확인 문구 예시

사용자가 이 프로젝트를 처음 연결하거나 설정할 때는 다음처럼 짧게 확인한다.

> 이 서버는 연결된 에이전트가 `MCP_ALLOWED_PATHS`에 들어간 폴더를 읽고, 쓰고, 삭제하고, 그 안에서 명령을 실행할 수 있게 합니다. 허용 경로에 홈 폴더 전체나 개인 자료 폴더를 넣지 말고, 전용 프로젝트 폴더만 넣는 것이 안전합니다. 현재 허용하려는 폴더가 정확히 어디인지 먼저 확인해도 될까요?

## 특히 피해야 할 설정

```env
MCP_ALLOWED_PATHS=/
MCP_ALLOWED_PATHS=/Users/USER
MCP_ALLOWED_PATHS=/Users/USER/Documents
MCP_ALLOWED_PATHS=/Users/USER/Desktop
MCP_ALLOWED_PATHS=/Users/USER/Downloads
MCP_ALLOW_NO_AUTH=true
```

`MCP_ALLOW_NO_AUTH=true`는 서버를 공개 인터넷에 직접 노출하는 설정과 함께 쓰면 안 된다. URL을 아는 사람이 서버 프로세스 권한으로 도구를 사용할 수 있다.
