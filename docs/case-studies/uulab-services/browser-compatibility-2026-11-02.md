# 세 브라우저 예제 동작 검증 — 2026-11-02

## 범위와 실제 변경

편집 가능한 유유랩 예제의 메뉴·테마·FAQ·스크롤 헤더·진행률·반응형 동작을 Chromium 외 Firefox와 WebKit에서도 반복 검사하도록 `npm run check:browsers`를 추가했다. 기존 테스트 네 파일을 같은 브라우저 선택 도우미로 실행하고, 프로덕션 빌드 화면을 엔진별로 보존한다. 예제 `src/`의 CSS/JS/마크업, 의존성 및 잠금 파일은 이번 변경에서 수정하지 않았다.

기존 `capture`, `verify`, `verify:suite`는 **여전히 Chromium 전용**이다. 이번 실행은 운영 원본을 새로 캡처하거나 비교하지 않았다. 화면 PNG는 구현의 실제 프로덕션 빌드이며 원본/복제본 비교 이미지가 아니다. Playwright의 Linux WebKit을 실제 Safari나 아이폰 검증으로 표시하지 않는다.

## 확인한 실행과 결과

검증한 코드 커밋은 `1857daf70c44fc41f6ebccce183a786c0ef21d6c`이다. 이 문서를 추가한 후속 커밋은 코드·테스트·설정·의존성을 변경하지 않는다.

- [전체 검사 및 세 브라우저 실행](https://github.com/uulab-official/website-cloner/actions/runs/41379115705), 작업 `125065797730`: 완료/성공.
- [별도 일반 CI](https://github.com/uulab-official/website-cloner/actions/runs/41379115710): 완료/성공.
- 환경: Linux Ubuntu Actions runner, Node.js `v22.23.4`, 잠금 파일의 Playwright `1.62.1`과 그에 맞는 설치 브라우저.
- 브라우저 검사 실행: `2026-11-02T02:43:45.406Z`–`2026-11-02T02:45:32.183Z`, 한국 시간 **11:43:45–11:45:32**.

| 검사 | 실제 결과 |
| --- | --- |
| 기존 전체 검사 `npm run check` | 도구/브라우저 268개 + 프로덕션 예제 10개 = **278개 통과** |
| Chromium `151.0.7922.34` | **38 / 38 통과** |
| Firefox `153.0` | **38 / 38 통과** |
| WebKit `26.5` | **38 / 38 통과** |

위 모든 실행에서 실패·취소·건너뜀·todo는 0개다. 스킬 검사와 프로덕션 빌드도 성공했다. 세 엔진은 **동일한 38개 검사**를 반복한 114회 실행이며, 이를 전체 278개와 합쳐 고유 테스트 수라고 표시하지 않는다. 이번에 추가한 41개 도구/CLI 검사와 1개 프로덕션 상태 검사는 전체 278개 안에 포함된다.

컨트롤 단위 검사는 실제 작성한 HTML/CSS/JS와 로컬 이미지 대체물을 사용한다. 프로덕션 예제 검사는 실제 빌드 자산, 테마 유지, 메뉴와 키보드, FAQ, 320/390/768/1024/1440px 가로 넘침을 검사한다. 추가 상태 검사에서는 데스크톱 기본·다크·FAQ, 모바일 폭 기본·메뉴·다크·FAQ를 각 엔진에서 캡처한다. 총 **21개 PNG**의 유효성·실제 이미지 크기·기록된 상태를 확인했다.

## 발견하고 수정한 검사 오류

첫 코드 `b504687edf02b4903b769bb7591e34aa49674102`의 [첫 세 브라우저 실행](https://github.com/uulab-official/website-cloner/actions/runs/41378597943)은 Chromium/Firefox 38개 통과, WebKit 36개 통과·2개 실패였다. WebKit은 같은 FAQ 포커스 테두리를 `3px solid rgb(59, 130, 246)`로 반환했고, 기존 검사는 Chromium 순서인 `rgb(59, 130, 246) solid 3px` 문자열만 허용했다.

테두리 색·선 종류·두께를 각각 `outlineColor`, `outlineStyle`, `outlineWidth`로 비교하고, 기존의 2px 간격과 그림자 검사도 유지했다. 테스트를 건너뛰거나 기준값을 완화하지 않았으며, 애플리케이션 CSS를 바꾼 수정도 아니다. 수정 후 WebKit도 38개 모두 통과했다.

출력 경로 검토에서는 보고서를 `dist/demo` 안에 만들면 빌드 출력과 섞일 수 있음을 발견했다. 먼저 추가한 6개 경로 충돌 테스트의 실패를 확인한 뒤, 정규화한 경로가 코드·의존성·프로덕션 빌드와 겹치면 출력을 만들기 전에 거부하도록 수정했다. 로컬 관련 검사 140개를 다시 실행해 모두 통과했지만, 이 부분 작업 폴더 결과를 위 전체 Actions 검사와 혼동하지 않는다.

## 잘못된 성공 판정 방지

잘못되거나 중복된 브라우저 이름, Firefox/WebKit과 Chromium 실행 파일 경로의 혼용, 서로 충돌하는 실행 경로를 거부한다. 설치되지 않은 엔진을 Chromium으로 대체하지 않는다. 프로세스 성공 종료만으로 합격하지 않고, 실제 엔진/버전과 전체 TAP 집계가 일치하며 모든 테스트가 통과했는지 확인한다. 시간 초과/취소/실패/건너뜀/불완전한 출력은 실패로 기록한다.

한 엔진이 실패해도 나머지는 검사한다. 사용자가 중단하면 이후 엔진은 미실행으로 표시한다. 로그·버전·스크린샷·JSON 및 스크립트 없는 HTML 보고서를 남긴다. CI는 운영 원본 사이트나 실제 문의·구매 제출에 의존하지 않으며, 실패한 실행의 자료도 14일 보관한다.

## 화면 검토와 한계

최종 WebKit 모바일 FAQ와 Firefox 데스크톱 다크 화면을 직접 열어 검토했고, 첫 실행에서는 WebKit 모바일 메뉴와 Firefox 기본 화면도 검토했다. 모든 PNG는 생성된 가상 시안이 아니라 브라우저의 실제 프로덕션 화면이다. 엔진별 글꼴/네이티브 FAQ 표시/스크롤 위치 차이는 그대로 보존한다. 예를 들어 FAQ 모바일 캡처의 scrollY는 Chromium 10413, Firefox 10442, WebKit 10414px였다. 이 상태 캡처는 이전 원본 짝 검증과 다른 동작 순서를 사용하므로 그 보고서의 픽셀 비율과 직접 비교하지 않는다.

작성자 자체 검토로 변경 diff, 경로 보호, 환경 전달, 로그 집계, 오류/중단 처리와 실제 기록을 점검했다. 독립 코드 리뷰는 받지 않았다. 내려받은 코드 스냅샷의 파일은 로컬 검토 파일과 바이트 단위로 일치했고, ZIP SHA-256도 Actions 기록과 일치했다.

실제 macOS Safari, Windows/macOS runner, 물리 휴대폰·터치, 원본과의 Firefox/WebKit 시각 비교, 원본 전체 모션 및 백엔드 동등성은 미검증이다. 이전의 읽기 쉬운 불투명 메뉴/하단 링크와 8px 모바일 전체 높이 차이는 변경하지 않았다. 기존 Vite outDir 경고 및 Actions v4 런타임 마이그레이션도 별도 과제로 남아 있다.

## 증거와 재현

Actions 아티팩트 `demo-browser-compatibility-1857daf70c44fc41f6ebccce183a786c0ef21d6c`, ID `13113145014`, 원본 ZIP SHA-256 `b33785de9ea4c3d52fa1a7e6b9d2aab89a0b03d253ce7885586dc717f9dfcf8d`, 만료 예정 `2026-11-16T02:45:32Z`다. `report/index.html`, `report/browser-check.json`, 각 엔진의 `tests.log`/`evidence.json`/PNG, `check.log`, 코드 스냅샷과 버전 기록을 포함하며 폰트 파일은 없다.

```bash
npm ci
npx playwright install chromium firefox webkit
npm run check
npm run check:browsers -- --out artifacts/browser-check
```

[명령 옵션과 결과 해석](../../browser-compatibility.md)을 참고한다. Playwright의 엔진 범위는 [공식 브라우저 문서](https://playwright.dev/docs/browsers)에 설명되어 있다.
