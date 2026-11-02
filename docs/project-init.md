# 새 클론 작업 시작: init

이 명령은 Website Cloner 도구 저장소에서 실행합니다. 원본 URL과 구현할 URL이 서로 다른 경로여도 됩니다. 기존 앱은 별도 프로젝트 그대로 유지합니다.

```bash
npm run init -- --source https://example.com/services/ --target http://localhost:5173/rebuilt/ --out artifacts/projects/my-site --dry-run
npm run init -- --source https://example.com/services/ --target http://localhost:5173/rebuilt/ --out artifacts/projects/my-site
```

`example.com`은 설명용 주소입니다. 소유하거나 허가받은 실제 원본 URL로 바꾸세요. 이 예시의 사이트를 재구현하거나 검증했다는 뜻이 아닙니다.

## 생성하는 다섯 파일

| 파일 | 용도 |
| --- | --- |
| `suite.json` | 현재 verify:suite v1 설정. 원본 경로와 구현 경로를 명시적으로 연결 |
| `assets.json` | 독립 스킬과 동일한 `{ "schema_version": 1, "assets": [] }` 자산 목록 |
| `report.md` | Scope, Routes, Views and states, Measurements, Behavior, Checks, Gaps 기록 |
| `HANDOFF.md` | 기존 앱 프레임워크를 유지하는 재구현·관찰·검증 지시서 |
| `README.md` | 도구 저장소와 대상 앱을 구분한 실행 안내 |

기본은 `1440,768,390` 폭, 높이 `900`의 기본 상태 1개입니다. `--widths 390,1440 --height 800`처럼 변경합니다. 폭은 중복 없이 최대 10개, 폭·높이는 1~8192 정수입니다. 임의의 합격 임계값, 메뉴 선택자나 동작을 만들어 넣지 않습니다. 관찰 후 실제 경로·상태·동작 파일을 추가하세요.

## 다음 단계

생성한 파일들과 대상 앱을 코딩 에이전트에 제공하고 `HANDOFF.md`에 따라 진행하게 합니다. 스킬은 기존 방식으로 설치할 수 있으며 이 명령이 필수는 아닙니다.

```bash
npm run verify:suite -- --manifest artifacts/projects/my-site/suite.json --dry-run
# 대상 앱을 suite.json의 targetOrigin/targetPath에 실행한 뒤:
npm run verify:suite -- --manifest artifacts/projects/my-site/suite.json --out artifacts/projects/my-site/evidence/run-001
```

결과는 `evidence/run-001/index.html`에서 확인합니다. 엔진은 기존 `--browser chromium|firefox|webkit`로 선택합니다. 실제 검증 전에 해당 엔진을 도구 저장소에 설치해야 합니다. 초기화에는 브라우저나 npm 의존성이 필요하지 않지만 Node.js 22.12+는 필요합니다.

## 입력과 파일 보호

HTTP(S) URL만 받습니다. 쿼리는 보존하지만 계정정보 포함 URL, 제어문자, 역슬래시, 경로 순회와 fragment는 거부합니다. URL 파서가 `/a/../b`를 조용히 `/b`로 바꾸기 전에 검사합니다. fragment로 표현한 UI 상태는 관찰 후 동작 파일로 모델링하거나 현재 스위트가 지원하는 별도 URL로 명시하세요. 원본·구현 URL은 JSON 데이터에만 넣고 생성된 지시서나 셸 명령에 삽입하지 않습니다.

`--out`은 **새 경로**여야 합니다. 기존 빈 폴더·파일·심볼릭 링크도 거부합니다. 기존 부모 폴더의 별칭은 실제 경로로 해석해 결과의 `destination`에 표시하며 도구 소스·테스트·스킬·예제·빌드 등의 경로는 보호합니다. 새 하위 폴더와 파일을 배타적으로 생성하므로 동시에 실행해도 기존 파일을 덮어쓰지 않습니다. 쓰기 오류가 생기면 부분 생성 폴더를 지우지 않고 실패로 남깁니다. 검사 직후 다른 프로세스가 경로를 악의적으로 바꾸는 상황을 격리하는 샌드박스는 아닙니다.

`--dry-run`도 입력과 목적지 검사를 수행하지만 부모 디렉터리조차 만들지 않습니다. `--overwrite`는 지원하지 않습니다. CLI 성공 출력은 생성 결과 JSON이며, npm 실행 자체의 헤더가 불필요하면 `node scripts/init.mjs ...`로 실행합니다.

URL 쿼리는 파일에 저장됩니다. 비밀 토큰·개인정보는 넣지 마세요. 초기화는 원본 접속, 자산 다운로드, 권리 확인, 앱 코드 생성, 배포, 화면·동작 검증을 수행하지 않습니다. 보고서는 시작 상태로 두고 실제 작업 결과에 따라 갱신하세요.
