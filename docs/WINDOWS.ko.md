# Windows 보안 및 배포 리뷰

이 프로젝트의 현재 문서와 배포 템플릿은 macOS와 Linux 중심이다. Windows에서도 Node.js 서버 자체는 실행할 수 있지만, macOS의 `sandbox-exec` 래퍼에 해당하는 Windows용 격리 기능은 이 코드베이스에 없다.

따라서 Windows 지원은 현재 기준으로 다음처럼 보는 것이 안전하다.

> 로컬 또는 사설망 실험용은 가능하지만, 민감한 PC나 공개 인터넷 직접 노출용으로는 권장하지 않는다.

## 권장 판단

Windows에서 사용하려면 최소한 아래 조건을 지켜야 한다.

- 서버는 `127.0.0.1`에만 바인딩한다.
- 인증을 반드시 켠다.
- `MCP_ALLOWED_PATHS`는 전용 작업 폴더 하나로 좁힌다.
- `MCP_DEFAULT_CWD`는 `MCP_ALLOWED_PATHS` 안에 둔다.
- `MCP_DEFAULT_SHELL`을 Windows에 맞게 명시한다.
- 해당 Windows 사용자 계정에 에이전트가 접근하면 안 되는 민감 자료를 두지 않는다.

공개 접속 또는 상시 운영이 필요하다면 Windows 직접 실행보다 아래 구성이 낫다.

- 제공된 `MCP_MACOS_SANDBOX=true` 구성을 쓰는 macOS.
- VM, WSL2, 컨테이너, 또는 낮은 권한의 전용 사용자로 제한한 Linux.
- 별도 Windows 사용자 계정, Windows Sandbox, Hyper-V VM 같은 외부 격리 계층.

## 최소 Windows 로컬 설정

Node.js 22 이상과 Git을 설치한 뒤, 프로젝트 루트에서 PowerShell을 연다.

```powershell
npm ci
npm run build
```

현재 셸에 환경 변수를 설정한다.

```powershell
$env:MCP_HOST = "127.0.0.1"
$env:MCP_PORT = "3000"
$env:MCP_ENDPOINT = "/mcp"
$env:MCP_AUTH_TOKEN = "<긴-랜덤-토큰으로-교체>"
$env:MCP_ALLOW_NO_AUTH = "false"
$env:MCP_OAUTH_ENABLED = "false"
$env:MCP_DEFAULT_CWD = "C:\Users\USER\Projects\chatgpt-agent"
$env:MCP_ALLOWED_PATHS = "C:\Users\USER\Projects\chatgpt-agent"
$env:MCP_DEFAULT_SHELL = "powershell.exe"
npm start
```

PowerShell 7을 쓴다면 다음처럼 바꿀 수 있다.

```powershell
$env:MCP_DEFAULT_SHELL = "pwsh.exe"
```

아래처럼 사용자 폴더 전체나 개인 자료 폴더를 허용하면 안 된다.

```powershell
# 위험한 예시
$env:MCP_ALLOWED_PATHS = "C:\"
$env:MCP_ALLOWED_PATHS = "C:\Users\USER"
$env:MCP_ALLOWED_PATHS = "C:\Users\USER\Documents"
$env:MCP_ALLOWED_PATHS = "C:\Users\USER\Downloads"
```

## 코드 리뷰 결과

### 파일 도구에는 경로 제한이 적용된다

`src/config.ts`는 `MCP_ALLOWED_PATHS`를 정규화하고, `MCP_DEFAULT_CWD`가 허용 목록 밖이면 서버 시작을 거부한다. `src/file-service.ts`는 파일 도구 경로를 `resolve()`와 `#assertAllowedPath()`로 검사하며, symlink가 허용 경로 밖으로 빠져나가는 경우도 canonical path 검사로 막는다.

즉 `read_file`, `write_file`, `apply_patch`, `remove_path`, `chmod_path` 같은 파일 도구는 `MCP_ALLOWED_PATHS`를 설정했을 때 허용 경로 안으로 제한된다.

### Windows에서는 명령 실행이 sandbox되지 않는다

`src/exec-tools.ts`의 `exec_command`와 `run_script`는 서버 프로세스의 OS 권한, 환경 변수, 파일시스템, 네트워크 접근을 상속한다. `src/macos-sandbox.ts`는 `process.platform === "darwin"`이고 `MCP_MACOS_SANDBOX=true`일 때만 `/usr/bin/sandbox-exec`로 감싼다.

Windows에는 현재 같은 수준의 래퍼가 없다. 작업 디렉터리는 `MCP_ALLOWED_PATHS` 안인지 확인되지만, 명령 자체는 서버를 실행한 Windows 사용자 권한으로 동작한다.

### 기본 shell을 반드시 지정해야 한다

`src/config.ts`의 기본 `MCP_DEFAULT_SHELL`은 `$SHELL` 또는 `/bin/bash`다. 일반 Windows 환경에는 보통 둘 다 없다. Windows에서는 다음 중 하나를 명시해야 한다.

- `powershell.exe`
- `pwsh.exe`
- `cmd.exe`

PowerShell을 쓸 경우 에이전트가 보내는 명령도 Bash가 아니라 PowerShell 문법이어야 한다.

### `run_script` 기본값은 Unix 쪽에 가깝다

`run_script`의 기본 runtime은 `bash`다. Windows에서 이 값은 Git Bash, WSL, 또는 별도 Bash가 설치되어 `PATH`에 있을 때만 동작한다.

Windows에서는 가능한 한 아래를 우선한다.

- Node.js 스크립트는 `runtime=node`.
- Python은 `python3`가 없을 수 있으므로 필요하면 `interpreter=python`.
- PowerShell은 `runtime=custom`과 `interpreter=powershell.exe` 또는 `pwsh.exe`.

### 프로세스 종료가 완전하지 않을 수 있다

`src/process-manager.ts`는 non-Windows에서는 detached process group을 만들고 음수 PID로 프로세스 그룹에 signal을 보낸다. Windows에서는 `managed.child.kill(signal)`로 child process만 종료한다.

명령이 자식 프로세스를 다시 띄우는 경우, 후손 프로세스가 남을 수 있다.

### `chmod`는 Windows 보안 경계로 보기 어렵다

파일 도구에는 `chmod_path`가 있고 `write_file.fileMode`도 mode를 받을 수 있다. 하지만 Windows 권한 모델은 Unix mode bit와 정확히 대응하지 않는다. Windows에서 `chmod_path`를 보안 경계로 의존하면 안 된다.

## Windows 사용 전 체크리스트

- `C:\Users\USER\Projects\chatgpt-agent` 같은 전용 workspace를 만든다.
- `MCP_ALLOWED_PATHS`는 그 workspace 하나만 넣는다.
- 소스 코드, 테스트 파일, 버려도 되는 작업 파일만 workspace 안에 둔다.
- 비밀번호, 브라우저 프로필, SSH 키, 클라우드 credential, 사진, 개인 문서는 허용 경로 밖에 둔다.
- remote access가 필요해도 Node.js 서버는 `127.0.0.1`에 묶고, HTTPS tunnel 또는 reverse proxy 앞단에서 인증을 처리한다.
- 외부 인증 게이트웨이가 확실하지 않다면 `MCP_ALLOW_NO_AUTH=true`를 쓰지 않는다.
- 가능하면 낮은 권한의 전용 Windows 사용자 계정에서 실행한다.
- 패키지 설치, 시스템 설정 변경, 방화벽 변경, 서비스 관리 명령은 실행 전 사용자에게 다시 확인한다.

## 공개 노출 가이드

Windows에서 Node.js 서버를 공개 인터넷에 직접 노출하지 않는다.

원격 연결이 필요하면 반드시 신뢰할 수 있는 HTTPS tunnel 또는 reverse proxy 뒤에 두고, Node.js 서버는 `127.0.0.1`에만 바인딩한다.

공개 접근에는 다음 중 하나가 필요하다.

- 강한 `MCP_OAUTH_APPROVAL_KEY`를 쓰는 OAuth.
- 긴 랜덤 `MCP_AUTH_TOKEN`.
- Node.js 프로세스 앞에서 요청을 인증하는 upstream gateway.

아래 조합은 피해야 한다.

```env
MCP_ALLOW_NO_AUTH=true
```

특히 공개 URL과 `MCP_ALLOW_NO_AUTH=true`를 함께 쓰면 URL을 아는 사람이 서버 프로세스 권한으로 도구를 사용할 수 있다.
