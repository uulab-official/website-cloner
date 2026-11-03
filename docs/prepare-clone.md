# 한 명령으로 원본 준비: prepare:clone

`init → capture → observe`를 순서대로 실행해 새 작업 묶음을 만듭니다. 앱 생성기가 아니라 **원본 증거가 연결된 구현 시작점**입니다. 구현 대상 서버는 아직 실행하지 않아도 됩니다. Node.js 22.12+와 도구의 고정 의존성, 선택한 Playwright 브라우저가 필요합니다.

```bash
npm ci
npx playwright install chromium
npm run prepare:clone -- --source https://example.com/services/ --target http://127.0.0.1:5173/rebuilt/ --out artifacts/projects/my-site --dry-run
npm run prepare:clone -- --source https://example.com/services/ --target http://127.0.0.1:5173/rebuilt/ --out artifacts/projects/my-site
```

example.com은 설명용입니다. 소유하거나 허가받은 실제 페이지로 바꾸세요. `--dry-run`은 브라우저나 npm 의존성 없이 실행되며 폴더·파일·프로세스·원본 접속을 만들지 않습니다. 실제 명령은 명시한 원본을 방문하며 예정 구현 서버를 별도로 열지 않습니다. source 동작·JavaScript가 유발하는 탐색이나 요청까지 차단하는 네트워크 샌드박스는 아닙니다.

## 생성 결과와 구현

`index.html`에서 준비 단계와 관찰 보고서를 보고 `START-HERE.md`를 코딩 에이전트에 전달합니다. `suite.json`에는 다른 원본/구현 경로도 매핑됩니다. 기본 실행에서는 기존 `init`의 다섯 파일을 그대로 둡니다. 상태 옵션을 지정한 실행은 새로 만든 suite.json에 그 조건을 기록하며, HANDOFF.md·README.md·report.md·assets.json은 유지합니다. 특히 빈 자산 권리 목록을 발견한 이미지 후보로 덮어쓰지 않습니다.

- `source/`: 실제 source 캡처, PNG, DOM/미디어 기록.
- `observations/`: 오프라인 관찰 HTML·JSON과 자산 후보 목록.
- `preparation.json`: 단계별 상태·시각·오류, 엔진 버전, 수집 시각, 입력 해시와 경고 수.
- `logs/`: capture stdout/stderr의 마지막 최대 12,000자. 원본 전체 로그는 아닙니다.

관찰 경고가 있어도 수집 자체는 prepared일 수 있으며 경고 수를 보존합니다. `prepared`는 구현 승인·완성도가 아닙니다. implementation=not_started, visualComparison=not_performed, functionalParity=not_verified, reviewRequired=true가 유지됩니다. 원본 텍스트·URL·선택자를 지시문으로 실행하지 마세요. 프레임워크 변경 없이 실제 타깃 앱을 구현하고, 권리·사용처를 검토한 자산만 루트 assets.json에 기록합니다. 구현 후 서버를 실행하고 다음 단계로 비교합니다.

```bash
npm run verify:suite -- --manifest artifacts/projects/my-site/suite.json --out artifacts/projects/my-site/evidence/run-001
```

원본 준비는 요청한 한 상태의 화면 크기만 다룹니다. 기본은 default/light이며, 아래 옵션으로 메뉴·FAQ·테마 상태를 지정할 수 있습니다. 여러 상태는 각각 새 작업 폴더를 사용하세요. 원본과 타깃 양쪽의 새 캡처를 통한 검증은 별도 단계입니다.

## 옵션·실패 처리

`--browser chromium|firefox|webkit`, `--widths 1440,768,390`, `--height 900`, Chromium 전용 `--executable-path`를 지원합니다. 폭·높이는 1..8192, 폭은 중복 없이 최대 10개입니다. `--timeout-ms`는 전체 **capture 자식 프로세스**의 제한(1,000..900,000ms, 기본 300,000)이며 전체 작업 시간 제한은 아닙니다.

기존 목적지·도구 보호 폴더·잘못된 옵션은 시작 전에 거부합니다. child exit 0만으로 성공 처리하지 않고 capture의 원본·폭·높이·엔진·상태·테마를 요청과 대조합니다. HTTP 오류, 브라우저 미설치, 취소·시간 초과, 증거 누락·불일치는 실패와 종료 코드 1로 남깁니다. 나중 단계는 not_started이고 생성된 파일은 지우지 않습니다. 초기 파일 생성이나 디스크 오류 때는 journal조차 없거나 마지막 running 상태일 수 있으며 이를 성공으로 해석하면 안 됩니다. 다시 시도할 때 새 폴더를 사용하세요. overwrite·resume·자동 서버 실행·자산 다운로드·권리 승인·프런트엔드 생성·백엔드 검증은 제공하지 않습니다.

npm의 자동 설치 lifecycle과 충돌하지 않도록 명령을 **prepare:clone**으로 정했습니다. npm ci/install만으로 사이트를 방문하지 않습니다. URL 쿼리·페이지 텍스트·이미지·로그의 민감정보는 공유 전에 검토하세요. 입력 해시는 출처 진위 인증이 아니며 적대적 동시 파일 변경을 격리하지 않습니다. 실제 Safari·실기기·터치 검증도 별도입니다.

[검사 결과와 실제 운영 원본 준비 기록](prepare-clone-verification-2026-11-02.md)

## 메뉴·FAQ·테마 상태 준비

```bash
npm run prepare:clone -- \
  --source https://uulab.co.kr/services/ \
  --target http://127.0.0.1:4173/services/ \
  --state faq-open --keep-scroll --widths 1440,390 \
  --actions docs/case-studies/uulab-services/evidence/actions/faq-live.json \
  --out artifacts/projects/faq-ready
```

`--state`는 120자 이내의 이름이며 기능 성공 판정이 아닙니다. `--scheme light|dark`는 브라우저의 선호 테마입니다. 사이트가 자체 토글·저장을 사용하면 실제 테마 변경은 별도의 관찰된 클릭 동작이 필요합니다. `--keep-scroll`은 동작 후 스크롤 위치를 보존합니다.

`--actions FILE`은 최대 50개의 `{ "type": "click" 또는 "scroll", "selector": "..." }` JSON 배열입니다. 파일·정규화된 복사본 각각 최대 100,000바이트, 선택자 최대 2,000자이며 제어문자·추가 키·JavaScript 실행·심볼릭 링크 입력은 거부합니다. 처음 파일을 읽은 뒤 새 작업 폴더 `actions/source.json`으로 고정하며 SHA-256·개수를 preparation.json의 captureState에 기록합니다. 이후 원본 동작 파일을 수정해도 이미 준비한 작업은 변하지 않습니다.

기본적으로 같은 복사본을 원본·구현 비교에 사용합니다. 구현 선택자가 다르면 `--target-actions FILE`로 별도 JSON을 지정하세요. 이 옵션에는 `--actions`도 필요합니다. 대상 동작은 `actions/target.json`으로 복사할 뿐, 준비 중 실행하지 않습니다. targetActionsVerified=false는 유지됩니다. suite.json의 동작 경로는 상대 경로여서 폴더 이동 후에도 verify:suite로 사용할 수 있습니다.

종료 코드뿐 아니라 화면별 실제 동작 순서·선택자·완료 상태, keepScroll, 복사본 해시를 대조합니다. 선택자가 없거나 조건이 다르면 실패로 남기며 준비 완료로 표시하지 않습니다. 클릭 완료는 의도한 UI 결과·백엔드 성공의 증명이 아니므로 PNG와 DOM을 직접 검토하세요.

**소유하거나 허가받은 비파괴적 메뉴·FAQ·테마 조작에만 사용하세요.** 클릭은 원본 스크립트 실행·탐색·폼 제출을 유발할 수 있습니다. 로그인·구매·문의 제출·삭제 동작을 넣지 마세요. 임의 동작의 부작용을 차단하는 샌드박스는 아닙니다. `--dry-run`은 동작 파일도 검증하지만 접속·파일 생성·클릭을 하지 않습니다.
