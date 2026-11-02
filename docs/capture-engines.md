# 원본·구현 캡처의 브라우저 선택

`capture`, `verify`, `verify:suite`에서 `--browser chromium|firefox|webkit`를 지정할 수 있습니다. 생략하면 기존처럼 Chromium입니다. 예제만 검사하는 `check:browsers`와 달리 실제 요청 URL 양쪽을 선택한 엔진에서 새로 캡처하고 비교합니다.

```bash
npm ci
npx playwright install chromium firefox webkit
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

다른 터미널에서:

```bash
npm run capture -- --url https://uulab.co.kr/services/ --browser firefox --out artifacts/source-firefox
npm run verify -- --source https://uulab.co.kr/services/ --target http://127.0.0.1:4173/services/ --browser webkit --out artifacts/paired-webkit
npm run verify:suite -- --manifest suites/uulab-services.json --browser firefox --dry-run
npm run verify:suite -- --manifest suites/uulab-services.json --browser firefox --out artifacts/live-firefox
```

브라우저 하나가 원본과 구현 양쪽, 스위트의 모든 사례에 적용됩니다. 여러 엔진은 서로 다른 출력 디렉터리에서 각각 실행합니다. JSON manifest 스키마는 바뀌지 않았으며 사례별 `browser` 필드를 추가하는 방식은 지원하지 않습니다. `--executable-path`는 Chromium에서만 허용합니다. 테스트 전용 환경 변수 `CLONER_TEST_BROWSER`로 캡처 엔진을 암묵적으로 바꾸지 않습니다.

## 증거와 실패 처리

`capture.json`의 `browser`는 요청 엔진, `actualBrowser`와 `page.json`의 `environment.browser/browserVersion`은 실행한 엔진과 버전입니다. `verification.json`과 HTML에는 요청 엔진과 행별 실제 엔진/버전이 포함됩니다. 원본/구현의 엔진·버전·화면 조건이 다르거나 양쪽 모두 요청과 다른 엔진이면 비교하지 않습니다. 스위트도 하위 보고서의 엔진/버전 누락·불일치를 실패 처리합니다.

설치하지 않은 브라우저는 명시적으로 실패하며 Chromium으로 대체하지 않습니다. 잘못된 엔진이나 실행 파일 조합은 기존 출력을 지우기 전에 거부합니다. 예전 보고서에 엔진 정보가 없으면 `not recorded`로 표시합니다. `assessCase`로 예전 기록을 읽는 것과 새로 실행하는 엔진 지정 스위트의 엄격한 검증을 구분합니다.

기존 허용 오차/무오차 측정과 임계값은 바꾸지 않습니다. 엔진 간 비율을 평균 내거나 가장 좋은 값만 선택해 완성도로 제시하지 마세요. 엔진별로 같은 엔진의 원본·구현 쌍을 검토해야 합니다. 외부 페이지 오류·요청 실패도 경고로 보존합니다. 완료는 기능·모션·백엔드·전체 사이트 동등성 인증이 아닙니다.

## 검증

`npm run check`는 기본 Chromium 경로와 전체 회귀 검사를 유지합니다. 별도 Actions **Paired capture engines**는 세 엔진의 실제 로컬 성공/HTTP 실패 경로와 운영 원본 스위트를 실행합니다. 운영 사이트에 의존하는 검사는 수동 또는 해당 작업 브랜치에서만 실행하며 일반 main/PR CI에 외부 사이트 의존성을 추가하지 않습니다.

Linux Playwright WebKit은 실제 macOS Safari나 iPhone이 아니고, 좁은 화면 폭은 물리 기기·터치 검증이 아닙니다. 이번 기능은 브라우저 엔진 선택이며 기기 에뮬레이션을 추가하지 않습니다.

공식 참고: https://playwright.dev/docs/browsers · https://playwright.dev/docs/api/class-browsertype
