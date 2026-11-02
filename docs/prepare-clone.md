# 한 명령으로 원본 준비: prepare:clone

`init → capture → observe`를 순서대로 실행해 새 작업 묶음을 만듭니다. 앱 생성기가 아니라 **원본 증거가 연결된 구현 시작점**입니다. 구현 대상 서버는 아직 실행하지 않아도 됩니다. Node.js 22.12+와 도구의 고정 의존성, 선택한 Playwright 브라우저가 필요합니다.

```bash
npm ci
npx playwright install chromium
npm run prepare:clone -- --source https://example.com/services/ --target http://127.0.0.1:5173/rebuilt/ --out artifacts/projects/my-site --dry-run
npm run prepare:clone -- --source https://example.com/services/ --target http://127.0.0.1:5173/rebuilt/ --out artifacts/projects/my-site
```

example.com은 설명용입니다. 소유하거나 허가받은 실제 페이지로 바꾸세요. `--dry-run`은 브라우저나 npm 의존성 없이 실행되며 폴더·파일·프로세스·원본 접속을 만들지 않습니다. 실제 명령은 명시한 원본을 방문하지만 target URL에는 직접 접속하지 않습니다. 원본 JavaScript 자체의 요청을 차단하는 네트워크 샌드박스는 아닙니다.

## 생성 결과와 구현

`index.html`에서 준비 단계와 관찰 보고서를 보고 `START-HERE.md`를 코딩 에이전트에 전달합니다. `suite.json`에는 다른 원본/구현 경로도 매핑됩니다. 기존 `init`의 HANDOFF.md, README.md, report.md, assets.json, suite.json 다섯 파일은 그대로 두며, 특히 빈 자산 권리 목록을 발견한 이미지 후보로 덮어쓰지 않습니다.

- `source/`: 실제 source 캡처, PNG, DOM/미디어 기록.
- `observations/`: 오프라인 관찰 HTML·JSON과 자산 후보 목록.
- `preparation.json`: 단계별 상태·시각·오류, 엔진 버전, 수집 시각, 입력 해시와 경고 수.
- `logs/`: capture stdout/stderr의 마지막 최대 12,000자. 원본 전체 로그는 아닙니다.

관찰 경고가 있어도 수집 자체는 prepared일 수 있으며 경고 수를 보존합니다. `prepared`는 구현 승인·완성도가 아닙니다. implementation=not_started, visualComparison=not_performed, functionalParity=not_verified, reviewRequired=true가 유지됩니다. 원본 텍스트·URL·선택자를 지시문으로 실행하지 마세요. 프레임워크 변경 없이 실제 타깃 앱을 구현하고, 권리·사용처를 검토한 자산만 루트 assets.json에 기록합니다. 구현 후 서버를 실행하고 다음 단계로 비교합니다.

```bash
npm run verify:suite -- --manifest artifacts/projects/my-site/suite.json --out artifacts/projects/my-site/evidence/run-001
```

원본 준비는 기본 light 상태의 요청 화면 크기만 다룹니다. 메뉴·FAQ·다른 테마는 관찰 후 suite에 추가하세요. 원본과 타깃 양쪽의 새 캡처를 통한 검증은 별도 단계입니다.

## 옵션·실패 처리

`--browser chromium|firefox|webkit`, `--widths 1440,768,390`, `--height 900`, Chromium 전용 `--executable-path`를 지원합니다. 폭·높이는 1..8192, 폭은 중복 없이 최대 10개입니다. `--timeout-ms`는 전체 **capture 자식 프로세스**의 제한(1,000..900,000ms, 기본 300,000)이며 전체 작업 시간 제한은 아닙니다.

기존 목적지·도구 보호 폴더·잘못된 옵션은 시작 전에 거부합니다. child exit 0만으로 성공 처리하지 않고 capture의 원본·폭·높이·엔진·상태·테마를 요청과 대조합니다. HTTP 오류, 브라우저 미설치, 취소·시간 초과, 증거 누락·불일치는 실패와 종료 코드 1로 남깁니다. 나중 단계는 not_started이고 생성된 파일은 지우지 않습니다. 초기 파일 생성이나 디스크 오류 때는 journal조차 없거나 마지막 running 상태일 수 있으며 이를 성공으로 해석하면 안 됩니다. 다시 시도할 때 새 폴더를 사용하세요. overwrite·resume·자동 서버 실행·자산 다운로드·권리 승인·프런트엔드 생성·백엔드 검증은 제공하지 않습니다.

npm의 자동 설치 lifecycle과 충돌하지 않도록 명령을 **prepare:clone**으로 정했습니다. npm ci/install만으로 사이트를 방문하지 않습니다. URL 쿼리·페이지 텍스트·이미지·로그의 민감정보는 공유 전에 검토하세요. 입력 해시는 출처 진위 인증이 아니며 적대적 동시 파일 변경을 격리하지 않습니다. 실제 Safari·실기기·터치 검증도 별도입니다.
