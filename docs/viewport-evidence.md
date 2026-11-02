# 창 크기, 본문 배치 영역, 스크롤바 공간 구분하기

`capture`의 `page.json`에 `layoutViewport`를 기록합니다. 요청한 화면 크기와 실제 본문이 배치되는 영역은 스크롤바 때문에 다를 수 있습니다. 화면 캡처를 리사이즈해 이 차이를 숨기지 마세요.

| 필드 | 의미 |
| --- | --- |
| `viewport.width/height` | 요청한 브라우저 화면 크기 |
| `layoutViewport.windowWidth/windowHeight` | 캡처 시 관측한 `innerWidth/innerHeight` |
| `layoutViewport.width/height` | 스크롤바를 제외한 배치 영역의 `clientWidth/clientHeight` |
| `layoutViewport.verticalGutter/horizontalGutter` | 창 크기와 배치 영역 사이에 예약된 공간 |
| `overflow.documentWidth` | 문서와 본문의 실제 `scrollWidth` 중 큰 값 |
| `overflow.horizontalPixels` | 실제 콘텐츠 폭이 배치 영역을 초과하는 양 |
| `document.width/height` | 스크린샷 자원 제한을 확인하는 보수적 크기. 창 크기도 포함하며 실제 PNG 크기와 별도 |

예를 들어 창 폭 390px, 배치 폭 384px, 문서 콘텐츠 폭 384px라면 스크롤바 자리는 6px이지만 가로 넘침은 0px입니다. 콘텐츠 폭이 424px라면 넘침은 40px입니다. 스크롤바를 두 번 빼거나 실제 콘텐츠 넘침을 무시하지 않습니다. 기존 1px 반올림 허용 범위는 유지합니다.

## 짝 비교의 판정

양쪽 창 크기·엔진·환경이 맞고 배치 영역만 다르면 픽셀 비교는 보존하되 경고를 남깁니다. 이는 줄바꿈이나 레이아웃 자체의 차이일 수 있어 원본을 강제로 수정하지 않습니다. 실제 가로 콘텐츠 넘침도 경고로 표시됩니다. `verify:suite`는 이 경고를 검토 필요로 집계합니다.

새 `layoutViewport`가 제공됐는데 정수·양수 크기, 창 크기 일치, 배치 크기+예약 공간=창 크기의 관계가 틀리면 증거를 실패 처리합니다. 예전 기록에는 이 필드가 없을 수 있습니다. 한쪽에만 새 필드가 있으면 배치 동일성 미확인 경고를 표시합니다. 양쪽 모두 없는 오래된 기록도 새 배치 측정을 소급 증명하지 않습니다.

## 관찰 상태를 맞추기

즉시 로딩, 리소스 안정화, 전체 페이지 스크롤 이후, 메뉴/FAQ 열림은 서로 다른 상태입니다. 첫 로딩 측정 하나를 다른 상태의 캡처 폭으로 가정하지 마세요. `page.json`의 캡처 시점 배치 폭·스크롤 좌표와 실제 PNG 크기를 함께 확인합니다.

CSS를 임시 삽입해 원인을 조사한 페이지는 별도의 진단 기록입니다. 이를 원본·구현 일치 증거에 섞지 않습니다. 실제 짝 캡처는 새 컨텍스트의 원본과 구현으로 수행하며 진단용 CSS를 주입하지 않습니다.

## 재현

```bash
npm run verify:suite -- --manifest suites/uulab-services.json --browser webkit --out artifacts/viewport-webkit
```

예제 프로덕션 서버를 먼저 실행해야 합니다. 브라우저 설치와 서버 실행은 [엔진 선택 문서](capture-engines.md)를 참고하세요. 스크롤바 관찰, 전체 회귀 검사, 세 엔진 예제 검사와 새 실사이트 비교는 Actions의 **Scrollbar fidelity** 워크플로로 재현합니다.

[실제 수정 및 검증 결과](case-studies/uulab-services/scrollbar-fidelity-2026-11-02.md)를 참고하세요. 이 진단은 실제 Safari·물리 휴대폰·터치·백엔드·전체 애니메이션 동등성 인증이 아닙니다.

기술 근거: [CSSOM View의 innerWidth](https://drafts.csswg.org/cssom-view/#dom-window-innerwidth), [clientWidth](https://drafts.csswg.org/cssom-view/#dom-element-clientwidth). 연결된 문서는 진행 중인 편집 초안입니다.
