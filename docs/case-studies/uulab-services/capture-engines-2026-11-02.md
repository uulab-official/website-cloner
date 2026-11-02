# 원본·구현의 세 엔진 짝 비교 — 2026-11-02

## 실제 변경과 범위

`capture`, `verify`, `verify:suite`에 `--browser chromium|firefox|webkit`를 추가했다. 생략하면 기존 Chromium 경로다. 하나의 실행에서는 원본과 구현, 스위트 전체가 같은 엔진을 사용한다. 여러 엔진은 별도 출력 디렉터리에서 각각 실행한다. manifest 스키마와 예제 `src/`, 자산, npm 의존성 및 잠금 파일은 변경하지 않았다.

실제 BrowserType 이름과 버전을 기록하고, 요청한 엔진과 원본/구현의 관측 엔진이 일치하는지 검사한다. 양쪽이 서로 같아도 요청과 다른 엔진이면 거부한다. 잘못된 엔진명이나 Firefox/WebKit과 Chromium 실행 파일 경로 조합은 기존 출력을 교체하기 전에 거부한다. 설치되지 않은 엔진을 Chromium으로 대체하지 않는다. 짝 보고서와 집계 보고서에 엔진을 표시하며 오래된 기록의 누락된 정보는 `not recorded`다.

기존 pixelmatch 허용 오차, 무오차 RGBA 계산, 시각 임계값과 기능 미검증 표시는 유지했다. 이번 작업은 엔진 선택과 증거의 전달·검증 기능이며 클론 화면 자체를 고친 변경은 아니다.

## 실제 검사

[전체 실행](https://github.com/uulab-official/website-cloner/actions/runs/41391886995), job `125104875633`은 완료/성공이다. 준비 커밋 `924d0e6`에서 명시된 변경을 적용하고 검사한 뒤, 임시 적용 도구를 제거해 커밋한 **검증 코드 SHA는 `b4040bfd08ed048121f1a836b82dc17665d5bb45`**, 코드 tree는 `85c02b5bb40389c51c3885f72dc1a37322126d47`이다. artifact의 `commit.txt`와 `tree.txt`도 이 값을 기록한다. 최종 통합은 이 검증된 코드 tree에 결과 문서만 추가하며 임시 쓰기 워크플로는 포함하지 않는다.

| 검사 | 실제 결과 |
| --- | --- |
| 전체 `npm run check` | 도구/브라우저 **303개 + 프로덕션 예제 10개 = 313개 통과** |
| 새 파일의 세 엔진 대상 검사 | **39개 통과**, 그 안에 엔진별 실제 HTTP 성공/실패 검사 2개씩 포함 |
| 스킬 검사·프로덕션 빌드 | 성공 |
| 새 실사이트 비교 | 엔진별 6개 사례·10개 화면 조건, **총 18개 사례·30개 비교 완료** |

실패·취소·건너뜀·todo는 위 두 테스트 실행에서 모두 0개다. 39개 실행은 전체 검사와 겹치는 검사의 반복·엔진 확장이므로 313개에 더해 고유 테스트 수라고 표시하지 않는다. 새 기본 검사 35개는 313개 안에 포함된다.

수정 전 로컬 관련 기준선 179개가 통과했고, 새 검사에서는 32개 assertion 실패·1개 통과·브라우저 2개 미실행을 확인했다. 수정 후 로컬 관련 검사는 218개 통과·브라우저 2개 미실행이었다. 실제 전체 실행은 고정 의존성과 실제 HTTP fixture를 사용하는 Actions checkout에서 수행했으며, 부분 작업 폴더의 로컬 결과를 전체 검사로 대체하지 않았다. 준비 커밋을 그대로 검사하는 별도 워크플로의 실패는 코드 적용 전 기록이며 최종 구현 성공의 근거는 위 검증 코드와 로그다.

## 새 실사이트 캡처

소유한 운영 HTTPS 원본 `https://uulab.co.kr/services/`와 로컬 프로덕션 빌드를 실제로 새 캡처했다. 기본 데스크톱/태블릿/모바일 폭, 메뉴, 다크 모드, 루트 경로 매핑, 열린 FAQ, 다크 모바일 메뉴를 포함한다. 원본끼리 엔진을 바꿔 비교한 것이 아니라 **같은 엔진의 원본과 구현 한 쌍**을 각각 비교했다.

환경은 Ubuntu Actions runner, Node `v22.23.4`, 고정 Playwright `1.62.1`, DPR 1, en-US, UTC, headless, 매번 새 컨텍스트, reduced-motion이다. 모바일은 화면 폭 검사이고 `isMobile: false`, `hasTouch: false`다.

| 엔진 | 실제 버전 | 한국 시간 실행 구간 | 완료한 화면 조건 |
| --- | --- | --- | ---: |
| Chromium | 151.0.7922.34 | 2026-11-02 14:06:14–14:07:18 | 10 |
| Firefox | 153.0 | 2026-11-02 14:07:18–14:08:32 | 10 |
| WebKit | 26.5 | 2026-11-02 14:08:32–14:09:59 | 10 |

모든 사례의 `visualGate`는 `not_requested`이고 기능 동등성은 `not_verified`다. 실행 완료는 시각 합격이 아니다. 60개 원본/구현 page.json의 콘솔 오류·페이지 오류·실패 요청·HTTP 실패 응답 배열은 모두 비어 있었다. 별도로 WebKit 원본의 가로 넘침 진단은 아래처럼 남아 있다.

대표 화면의 실제 비율:

| 엔진·화면 | 허용 오차 적용 차이 | 무오차 RGBA 차이 |
| --- | ---: | ---: |
| Chromium 기본 1440×900 | 0.170988% | 1.035725% |
| Firefox 기본 1440×900 | 0% | 46.505324% |
| WebKit 기본 1440×900 | 1.734028% | 51.175926% |
| Chromium FAQ 390×900 | 0% | 0.200570% |
| Firefox FAQ 390×900 | 0.006553% | 0.284615% |
| WebKit FAQ 390×900 | 4.623362% | 8.676923% |

**어느 비율도 완성도 점수가 아니다.** Firefox 기본 데스크톱에서는 602,709개 픽셀의 값이 달랐지만 최대 채널 차이는 255단계 중 **1**이었다. 차이는 y=80부터 높이 460px의 배경 영역에 있었고, 넓게 퍼진 작은 차이 때문에 무오차 비율이 커졌다. 따라서 46.51%를 심각한 레이아웃 손실이나 완성도 53.49%로 해석하면 잘못이다. 원본·구현·차이 이미지를 함께 검토해야 한다.

`reviewRequired` 사례 수는 Chromium 2, Firefox 3, WebKit 0이다. 이 자동 경고는 특히 허용 오차 0%와 실제 RGBA 불일치 등을 알리는 것이며, **WebKit의 0개는 차이가 없거나 시각적으로 승인됐다는 뜻이 아니다.** WebKit에는 표의 시각 차이가 실제로 남아 있다.

## 직접 확인한 차이와 전체 페이지 범위

Firefox 데스크톱 기본, Firefox 모바일 메뉴, WebKit 데스크톱 기본, WebKit 모바일 FAQ의 나란히 이미지를 직접 열어 검토했다. 메뉴의 반투명 원본/불투명 구현 차이는 이전의 의도적 선택 그대로다.

WebKit 모바일 FAQ에서는 질문의 줄바꿈과 하단 내용 배치가 달랐다. 원본의 layout viewport 폭은 384px, 구현은 390px이며 기본 hero 제목 영역도 각각 352px/358px다. 원본의 `overflow.horizontalPixels`는 6이고 이 진단은 10개 WebKit 원본 캡처 모두에 기록됐다. 구체적인 CSS/스크롤바 원인까지 수정·검증한 것은 아니므로 엔진 지원 완료를 시각 동일성으로 확장하지 않는다. 일부 WebKit 원본 헤더의 전환 중 위치도 기록에 남아 있어 모션 전체 동등성은 주장하지 않는다.

기본 모바일 full-page PNG 크기는 다음과 같다. **이번에는 이 PNG의 크기만 확인했으며 새 전체 페이지 픽셀 비교는 수행하지 않았다.** 뷰포트 비교는 동일한 390×900 이미지끼리 수행했고 full-page를 늘이거나 잘라 맞추지 않았다.

| 엔진 | 원본 full-page PNG | 구현 full-page PNG |
| --- | --- | --- |
| Chromium | 390×12617 | 390×12625 |
| Firefox | 390×12680 | 390×12688 |
| WebKit | 384×12749 | 390×12625 |

## 재검산·검토와 재현

Actions ZIP의 SHA-256을 확인하고, 별도 Pillow/NumPy 계산으로 **30개 쌍 모두**의 변경 픽셀 수·비율·동일 여부·최대/평균 채널 차이·변경 경계와 exact mask의 흑백/알파를 재검산해 일치함을 확인했다. 요청/실제 엔진과 양쪽 버전도 대조했다. 내려받은 코드 스냅샷의 수정 소스/테스트 11개는 로컬 검토 파일과 바이트 단위로 일치했다. 이는 독립된 계산 경로를 통한 교차검산이며 독립 코드 리뷰나 두 번째 브라우저 캡처가 아니다.

코드와 입력 보호·상태 전달·실패 처리·이미지는 작성자가 자체 검토했다. 독립 리뷰는 받지 않았다. 실제 macOS Safari, 물리 휴대폰·터치, Windows/macOS runner, 전체 모션·백엔드·모든 경로의 동등성은 미검증이다. 기존 Vite outDir 및 Actions v4 런타임 경고도 이번 범위에서 변경하지 않았다.

[측정 요약](evidence/capture-engines-2026-11-02.json)과 [사용법](../../capture-engines.md)을 참고한다. 원본 Actions artifact ID는 `13118161024`, ZIP SHA-256은 `c46b950d51c50f869fc4762af2a0b2a729b0055e9ef56b852b5bf0badae90f32`, 만료 예정은 `2026-11-16T05:10:00Z`다. ZIP의 `live/<engine>/index.html`, `check.log`, `engine-tests.log`, 엔진별 live 로그와 PNG/JSON을 보존한다. 폰트 파일은 포함하지 않는다.

```bash
npm ci
npx playwright install chromium firefox webkit
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

다른 터미널에서:

```bash
npm run verify:suite -- --manifest suites/uulab-services.json --browser firefox --out artifacts/live-firefox
npm run verify:suite -- --manifest suites/uulab-services.json --browser webkit --out artifacts/live-webkit
```

전체 로컬 회귀 및 새 실사이트 증거는 별도 **Paired capture engines** Actions 워크플로로 재현한다. 일반 main/PR CI에는 운영 원본 의존성을 추가하지 않았다.
