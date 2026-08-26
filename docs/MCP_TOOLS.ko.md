# MCP 도구 안내

[English](MCP_TOOLS.md)

이 문서는 Open Chat Code MCP가 제공하는 23개 도구의 사용자용 안내입니다. 쓰기·실행·삭제·권한 변경·네트워크 영향을 줄 수 있는 도구를 사용하기 전에는 사용자에게 어떤 도구를 왜 쓰는지 알립니다. 현재 채팅 세션에서 사용자가 실행을 명시적으로 요청했을 때만 실행합니다.

## 읽기와 상태 점검

| 도구 | 용도 | 주의점 |
| --- | --- | --- |
| `doctor` | 호스트 상태, 허용 경로, Git 요약, 디스크, 인증, 샌드박스, HTTPS 상태를 점검합니다. | 읽기 전용입니다. 설치 직후나 연결 이상 시 먼저 사용합니다. |
| `check_security_updates` | 보안 관련 호스트 코드와 설정된 공식 소스를 비교합니다. | 매일 첫 코딩 작업 전에 실행합니다. `security_review_required`이면 파일 변경 전 검토합니다. |
| `list_directory` | 폴더 구조를 확인합니다. | 큰 저장소는 깊이와 항목 수를 제한합니다. |
| `stat_path` | 경로가 파일·폴더·심볼릭 링크인지 확인합니다. | 읽기 전용 메타데이터입니다. |
| `read_file` | UTF-8 텍스트 또는 파일 일부를 읽습니다. | 큰 파일은 `nextOffset`으로 이어 읽습니다. |
| `download_file` | 바이너리 또는 base64 파일 일부를 읽습니다. | `eof=true`까지 `nextOffset`을 사용합니다. |
| `hash_file` | 파일 내용을 검증하거나 SHA-256 사전 조건을 구합니다. | 정확한 패치 전 SHA-256 사용을 권장합니다. |
| `read_process` | 관리 중인 명령의 새 출력만 읽습니다. | 이전 `nextSeq`을 `afterSeq`으로 전달합니다. |
| `list_processes` | 실행 중이거나 최근 끝난 명령을 확인합니다. | 읽기 전용 프로세스 목록입니다. |

## 파일과 폴더 수정

| 도구 | 용도 | 주의점 |
| --- | --- | --- |
| `write_file` | 파일 하나를 만들고, 교체하거나, 뒤에 덧붙입니다. | 덮어쓰기인지 추가인지 먼저 설명합니다. |
| `replace_in_file` | 정확히 일치하는 텍스트를 교체합니다. | 기본값은 한 곳만 교체하여 모호한 수정을 막습니다. |
| `apply_partial_patch` | UTF-8 파일 하나에 여러 정확한 교체를 원자적으로 적용합니다. | 작은 수정에 우선 사용하고, 오래된 내용 위험이 있으면 `hash_file`의 `expectedSha256`을 함께 사용합니다. |
| `apply_patch` | 여러 파일에 통합 diff를 적용합니다. | 가능하면 먼저 `checkOnly=true`로 검증합니다. |
| `upload_file` | base64 파일을 조각으로 업로드합니다. | 파일 교체 첫 조각에는 `truncate=true`를 사용합니다. |
| `make_directory` | 폴더를 만듭니다. | 대상 경로를 설명합니다. |
| `copy_path` | 파일 또는 폴더를 복사합니다. | 대상과 덮어쓰기 동작을 확인합니다. |
| `move_path` | 파일 또는 폴더를 이동하거나 이름을 바꿉니다. | 대상 경로를 확인하고, 요청 없이는 덮어쓰지 않습니다. |
| `remove_path` | 파일 또는 폴더를 영구 삭제합니다. | 휴지통 복구가 없습니다. 정확한 대상을 말하고 명시적 승인을 받습니다. |
| `chmod_path` | Unix 파일 권한을 바꿉니다. | 변경 목적과 `0755` 같은 모드를 설명합니다. |

## 명령 실행과 운영

| 도구 | 용도 | 주의점 |
| --- | --- | --- |
| `exec_command` | Git, 테스트, 빌드, 패키지 명령, 로그, 서비스, Xcode 같은 로컬 앱을 포함한 셸 명령을 실행합니다. | 강력한 도구이며 연결된 호스트에서 실행됩니다. `MCP_MACOS_SANDBOX=false`이면 LaunchAgent 사용자의 더 넓은 macOS 명령 권한을 사용합니다. |
| `run_script` | Bash, sh, Node.js, Python 또는 임의 인터프리터로 완성된 스크립트를 실행합니다. | 한 줄 명령보다 여러 단계의 구조화된 로직이 필요할 때 사용합니다. `exec_command`와 같은 수준으로 신중하게 다룹니다. |
| `write_stdin` | 장기 실행 명령에 입력을 보냅니다. | 실행 도구가 반환한 `sessionId`에만 사용합니다. |
| `terminate_process` | `SIGINT`, `SIGTERM`, `SIGKILL`로 관리 중인 명령을 멈춥니다. | 어떤 프로세스를 멈추는지 설명하고 `SIGKILL`보다 `SIGINT` 또는 `SIGTERM`을 우선합니다. |

## 경로와 프로세스 규칙

- 상대 경로는 `MCP_DEFAULT_CWD`를 기준으로 합니다.
- 설정된 경우 파일 도구는 `MCP_ALLOWED_PATHS` 안으로 제한됩니다. 개인 파일이 넓게 섞인 폴더를 허용 루트로 사용하지 않습니다.
- `exec_command`와 `run_script`는 파일 도구보다 운영체제 접근 범위가 넓을 수 있으며, 특히 `MCP_MACOS_SANDBOX=false`일 때 그렇습니다.
- 끝나지 않은 명령은 `sessionId`를 반환합니다. `read_process`로 상태를 확인하고 필요할 때 `write_stdin` 또는 `terminate_process`를 사용합니다.
- 변경 뒤 실제 작업 폴더에서 Git 상태와 diff를 확인하고, Codex·Claude·Cursor 등 전용 코딩 도구로 로컬 변경을 검토합니다.
