# WebKit 레이아웃과 스크롤바 초기화 — 2026-11-02

## 변경 범위

기준 main은 `0cf11fb971d708844af4553da7a98d0aa8def931`이다. 중단된 `work/scrollbar-fidelity`의 `ba02562`를 회수해 검토하고, 재실행에서 발견한 초기화 문제까지 수정했다. 단순히 이전 성공 결과를 재포장하거나 폭을 6px 줄여 캡처하지 않는다. 원본 사이트는 수정하지 않았으며 문의·구매 등 제출 동작도 없다.

DOM 증거는 요청한 창 크기, 실제 배치 영역(`layoutViewport`), 실제 문서 콘텐츠 폭을 구분한다. 이전 구현은 `max(scrollWidth, innerWidth)`를 콘텐츠 폭처럼 사용해 WebKit의 스크롤바 자리 6px을 가로 넘침으로 오인했다. 스크린샷 메모리 제한에는 보수적인 창 크기를 계속 사용하지만 넘침 판정에는 실제 콘텐츠 폭을 사용한다. 실제 넘침은 계속 검출하고, 원본·구현의 배치 폭이 다르면 경고와 원래 PNG/수치를 보존한다.

예제에서는 관찰한 `::-webkit-scrollbar`의 6px 폭, 트랙/손잡이 색과 3px 반경을 구현했다. 네 규칙은 `examples/uulab-services/index.html`과 `services/index.html` 두 진입점의 `scrollbar-critical`에 놓고 외부 stylesheet의 중복은 제거했다. 원본의 레거시 규칙을 이 사례에서 재현하는 것이지 모든 신규 사이트에 이 방식을 권하는 것은 아니다. 다른 템플릿에 이식할 때는 CSP의 인라인 스타일 정책을 별도로 반영해야 한다. 의존성·잠금 파일·픽셀 임계값은 변경하지 않았다.

## 재실행에서 발견한 문제와 원인 분리

회수한 실행 `41397382121`은 검사를 완료했지만, 같은 코드의 새 실행 `41414208356`에서는 WebKit 일부 구현 화면이 384px 대신 다시 390px로 배치됐다. 테스트가 통과했다는 이유로 시각 수정을 완료했다고 판단하지 않았다. 기존 스타일 검사는 HTML 내부에 CSS를 한꺼번에 넣어 외부 CSS 도착 순서 문제를 잡지 못했다.

프로덕션 빌드를 로컬 HTTP로 제공하면서 외부 CSS 응답을 120ms 지연했다. 원본 사이트가 아닌 진단 전용 로컬 응답을 세 조건으로 나눠 390/1440px에서 네 번씩, 총 24개 새 컨텍스트를 검사했다. 처음 로딩·전체 페이지 스크롤 이후·FAQ 열림의 폭을 기록했다.

| 진단 조건 | 세 상태에서 6px 예약 공간 유지 |
| --- | ---: |
| 외부 stylesheet 규칙만 사용 | 0 / 8 |
| 동일 규칙을 초기 HTML head 스타일로 제공 | 8 / 8 |
| `html { overflow-y: scroll }`만 초기 추가 | 0 / 8 |

[진단 실행 41416169740](https://github.com/uulab-official/website-cloner/actions/runs/41416169740), 코드 `c24b26a`의 결과다. 이는 CSS 도착 순서와 레이아웃 초기화의 관계를 보여주는 실험이며 WebKit 내부 원인의 모든 세부를 입증한 것은 아니다. 진단용 CSS 삽입 결과를 원본·복제본 시각 일치 증거로 사용하지 않았다.

새 `tests/scrollbar-loading.test.mjs`는 실제 작성한 HTML과 외부 CSS/JS를 HTTP로 제공한다. 수정 전 `6708117`, [실행 41417174235](https://github.com/uulab-official/website-cloner/actions/runs/41417174235)에서 초기 스타일 부재와 실제 WebKit `390 !== 384` 두 assertion이 실패했고 건너뜀은 없었다. 이미지 대체물은 동작 fixture에만 쓰며 시각 비교·프로덕션 반복은 실제 빌드 자산을 사용한다.

초기 수정 `b3cfa52`는 `/` 진입점만 수정하고 `/services/`의 별도 HTML을 놓쳤다. [프로덕션 반복 검사 41417722443](https://github.com/uulab-official/website-cloner/actions/runs/41417722443)가 이를 실패 처리했다. `/services/`의 스크롤바 폭은 `auto`, 루트 별칭은 6px이었다. Vite가 초기 스타일을 제거한 문제가 아니었으며 이 상태를 main에 합치지 않았다.

추가 회귀 검사는 두 HTML 파일을 각각 읽고 두 URL에서 CSS 지연·FAQ 이동·새로고침을 반복한다. 서비스 진입점 검사가 수정 전 assertion으로 실패한 기록을 남긴 뒤 두 HTML에 동일한 초기 규칙을 적용했다.

## 최종 검사

[최종 전체 실행 41419109262](https://github.com/uulab-official/website-cloner/actions/runs/41419109262), job `125190093390`은 완료/성공이다. 검증 코드 SHA는 `1a690453e195f4dae2c6dc9ad6fb5ac45cbc4e81`, tree는 `dd9ae4d2191b790f1f4981f6d4008fdfcd976970`이다. 후속 결과 문서는 이 코드·테스트·설정·의존성을 변경하지 않는다.

| 검사 | 실제 결과 |
| --- | --- |
| 전체 `npm run check` | 도구/브라우저 327개 + 프로덕션 예제 10개 = **337개 통과** |
| 세 엔진 배치·스타일·CSS 지연 검사 | **32개 통과** |
| 기존 예제 동작 반복 | Chromium / Firefox / WebKit 각각 **38 / 38 통과** |
| 실제 빌드 초기화 반복 | 변경하지 않은 baseline 응답 **8 / 8**, 처음 로딩·스크롤 후·FAQ 상태의 6px 예약 공간 유지 |
| 운영 원본·구현 짝 비교 | 엔진별 6개 사례·10개 화면, **18개 사례·30개 비교 완료** |

테스트의 실패·취소·건너뜀·todo는 모두 0개이고 빌드·스킬 검사도 성공했다. 32개와 엔진별 38개는 전체 검사와 겹치는 검사의 반복이므로 337개에 더해 고유 테스트 수로 표시하지 않는다. 로컬 부분 스냅샷 테스트를 전체 검사로 대체하지 않았다.

프로덕션 baseline 8개 컨텍스트에서는 HTML 응답을 수정하지 않았다. 함께 실행한 `critical`/`reserve` 변형 16개는 진단용이며 시각 일치 증거가 아니다. 지연 로딩 진단과 실제 live 캡처도 서로 다른 조건이다.

## 새 실사이트 비교

Linux Actions, Node `v22.23.4`, Playwright `1.62.1`, Chromium `151.0.7922.34` / Firefox `153.0` / WebKit `26.5`, DPR 1, en-US, UTC, headless, reduced-motion의 새 컨텍스트를 사용했다. 한국 시간 2026-11-02 **18:22:42–18:27:09**의 새 캡처다. 모든 사례의 `visualGate`는 `not_requested`, 기능 동등성은 `not_verified`다.

**30개 쌍 모두 원본과 구현의 배치 폭이 일치**했다. 모바일 WebKit은 창 폭 390px, 배치 폭 384px, 스크롤바 자리 6px, 실제 가로 넘침 0px이다. 데스크톱 WebKit도 양쪽 배치 폭 1434px로 일치했다. 60개 page.json의 콘솔/페이지 오류·실패 요청·HTTP 실패 응답 배열은 모두 비어 있고 실제 가로 넘침도 0px이었다.

변경 전 기준은 `b4040bf`의 세 엔진 캡처다. 아래 FAQ 두 원본 PNG의 SHA-256은 전후 동일하다.

| WebKit FAQ 화면 | 허용 오차 적용: 전 → 후 | 무오차 RGBA: 전 → 후 |
| --- | ---: | ---: |
| 1440 × 900 | 1.794290% → **0.002778%** | 4.437346% → **0.248920%** |
| 390 × 900 | 4.623362% → **0.004843%** | 8.676923% → **0.273504%** |

실제 side-by-side PNG를 열어 질문 줄바꿈과 본문 배치·포커스·버튼 정렬을 확인했다. Chromium 10개와 Firefox 10개의 구현 viewport PNG는 기준 캡처와 바이트 단위로 동일했다. 원본 30개 중 27개는 동일하고 WebKit 일부 기본 화면 3개는 변했으므로 그 화면의 변화를 전부 구현 개선으로 해석하지 않는다.

Pillow/NumPy로 30개 쌍의 변경 픽셀 수·비율·동일 여부·최대/평균 채널 변화·변경 경계와 exact mask의 흑백·알파를 재계산했고 모두 일치했다. 이는 수치 교차검산이지 독립 코드 리뷰나 두 번째 캡처가 아니다. 최종 검토 소스 8개와 Actions code.tar.gz의 대응 파일도 바이트 단위로 일치했다.

`reviewRequired`는 Chromium 2, Firefox 3, WebKit 3개 사례다. 경고 유무는 시각 승인 자체가 아니다. 이전 6px 거짓 가로 넘침 경고는 더 이상 생성되지 않지만 실제 콘텐츠 넘침 검사와 배치 폭 불일치 경고는 유지한다. 어느 픽셀 비율도 전체 사이트 완성도 점수가 아니다.

## 남은 차이와 검토 한계

기본 모바일 full-page PNG 크기는 Chromium `390×12617 / 390×12625`, Firefox `390×12680 / 390×12688`, WebKit **`384×12749 / 384×12757`**(원본 / 구현)이다. WebKit 폭 차이는 해결됐지만 읽기 쉬운 하단 링크 줄바꿈에서 오는 8px 높이 차이는 남는다. 이번 실행은 전체 페이지 PNG를 보존하고 크기를 확인했으며 **새 전체 페이지 픽셀 비교를 수행하지 않았다.**

FAQ 차이는 0이 아니고 기본 화면의 넓은 영역에 걸친 작은 채널 차이도 남는다. 읽기 쉬운 불투명 메뉴·달 아이콘·하단 링크를 유지했다. 원본과 구현을 임의로 리사이즈하거나 크롭하지 않았다.

코드·입력/구형 증거 호환성·실제 넘침 유지·보수적 자원 제한·CSS 초기화·실제 PNG는 작성자가 자체 검토했다. 독립 코드 리뷰는 받지 않았다. Windows/macOS, 실제 Safari·물리 휴대폰·터치, 전체 모션·백엔드 동등성은 미검증이다. 기존 Vite outDir 및 Actions v4 런타임 경고도 별도 과제다. 브라우저 동작 보고서 일부의 Chromium-only 설명은 오래된 문구이며 실제 capture/verify의 세 엔진 옵션을 제한하지 않는다. 해당 문구 정리는 이번 범위에 포함하지 않았다.

## 증거와 재현

Actions artifact ID `13129612094`, ZIP SHA-256 `799f5efe729ad8ac5b4e5dbc3e85aca3380f3a5dbc58670fecf2a7c211fe4e11`, 만료 예정 `2026-11-16T09:27:10Z`다. `check.log`, `viewport-tests.log`, `browsers/`, `initialization/`, `inspection/`, `live/<engine>/` 및 폰트 없는 부분 코드 스냅샷을 보존한다. [측정·해시 요약](evidence/scrollbar-fidelity-2026-11-02.json), [창/본문/스크롤바 증거 해석](../../viewport-evidence.md), [엔진 선택](../../capture-engines.md)을 참고한다.

```bash
npm ci
npx playwright install chromium firefox webkit
npm run check
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

다른 터미널에서 `npm run verify:suite -- --manifest suites/uulab-services.json --browser webkit --out artifacts/scrollbar-check`를 실행한다. 세 엔진 전체 검사와 프로덕션 반복 로딩은 Actions **Scrollbar fidelity**로 재현한다. 일반 main/PR CI에는 외부 운영 사이트 의존성을 추가하지 않았다.
