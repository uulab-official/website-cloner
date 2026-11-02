# 예제 브라우저 호환성 검사

`npm run check:browsers`는 **편집 가능한 유유랩 예제**의 같은 동작 검사를 Chromium, Firefox, WebKit에서 실행합니다. 임의 사이트가 모든 브라우저에서 동일하게 복제됐다는 인증이 아닙니다. 기존 `capture`, `verify`, `verify:suite`는 여전히 Chromium 전용입니다.

## 실행

```bash
npm ci
npx playwright install chromium firefox webkit
npm run check:browsers -- --out artifacts/browser-check
```

Linux에서 시스템 라이브러리까지 준비하려면 `npx playwright install --with-deps chromium firefox webkit`을 사용합니다. 이 설치는 저장소의 고정 Playwright 버전에 맞는 브라우저를 받습니다. Node.js 22.12+와 기존 package-lock.json을 사용하며 새 npm 의존성은 없습니다.

한 브라우저만 검사하거나 실행 계획만 확인할 수도 있습니다.

```bash
npm run check:browsers -- --browsers webkit --out artifacts/webkit
npm run check:browsers -- --browsers firefox,webkit --dry-run
```

예제를 한 번 빌드한 뒤 각 엔진의 검사 결과를 별도로 남깁니다. 한 엔진이 실패해도 다른 엔진의 검사를 계속합니다. 시간 초과는 프로세스 트리를 종료하고 실패로 남기며, 사용자가 중단하면 나머지는 미실행으로 표시합니다. 일반 `npm run check`도 계속 실행해야 합니다. 브라우저별 명령은 기존 도구 전체 검사를 대신하지 않습니다.

## 결과

`index.html`, `browser-check.json`, `build.log`, 엔진별 `tests.log`와 `evidence.json`, 프로덕션 빌드의 화면 PNG를 생성합니다. 화면은 데스크톱 기본/다크/FAQ와 모바일 폭 기본/메뉴/다크/FAQ, 엔진당 7장입니다. **원본 사이트를 캡처하거나 비교한 이미지는 아닙니다.**

종료 코드만 0이라고 합격하지 않습니다. 모든 테스트의 완료·통과 개수, 실패·취소·건너뜀·todo 0개, 선택한 엔진과 실제 실행 버전의 일관성을 확인합니다. 설치되지 않은 엔진을 Chromium으로 대체하지 않습니다. 실행되지 않은 검사는 통과로 세지 않습니다.

`--overwrite`는 이 도구가 만든 출력만 교체합니다. 코드·의존성·프로덕션 빌드 경로와 겹치는 출력을 거부합니다. 보고서 안에 개인 파일을 넣은 뒤 덮어쓰지 마세요. `--dry-run`은 출력을 만들거나 브라우저를 시작하지 않습니다.

`CLONER_CHROMIUM_PATH` 또는 `CAPTURE_TEST_EXECUTABLE_PATH`는 Chromium 단독 검사에만 사용할 수 있습니다. 다른 엔진과 함께 설정하면 명확히 실패합니다. 엔진 선택은 테스트용 `CLONER_TEST_BROWSER`이며 캡처 CLI에 적용되는 옵션이 아닙니다.

## 검증 범위

메뉴 상태·Escape·포커스 복귀·낮은 화면 스크롤, 테마와 저장, FAQ 키보드 동작, 스크롤 헤더/진행률, 반응형 버튼 위치, JavaScript 비활성 폴백과 동작 줄이기, 프로덕션 자산/가로 넘침을 검사합니다. 컨트롤 단위 검사는 로컬 이미지 대체물을 쓰지만 보고서 PNG는 실제 프로덕션 빌드의 자산을 사용합니다.

Linux Playwright WebKit은 실제 macOS Safari 또는 iPhone Safari가 아닙니다. 화면 폭을 좁혀 실행해도 실제 터치/기기 검증은 아닙니다. Windows/macOS 실행, 원본 전체 모션, 백엔드 동등성은 별도 범위입니다. 엔진마다 글꼴 렌더링·포커스·픽셀 반올림이 다를 수 있으며 화면 이미지를 동일성 점수로 환산하지 않습니다.

GitHub Actions의 **Demo browser compatibility**는 main/PR과 작업 브랜치에서 실행하고, 실패한 실행도 로그와 이미지를 14일 보존합니다. 운영 원본이나 실제 문의/구매 요청에는 의존하지 않습니다.

공식 참고: https://playwright.dev/docs/browsers 및 https://playwright.dev/docs/api/class-browsertype
