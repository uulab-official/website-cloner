# 허용 오차 비교와 무오차 RGBA 비교

기존 `compare`, `verify`, `verify:suite` 명령을 그대로 사용합니다. 새 npm 의존성이나 별도 서비스는 없습니다. 비교기는 두 가지 측정값을 나란히 기록합니다.

| 측정 | 의미 |
| --- | --- |
| `changedPixelRatio` / Tolerance-filtered | 기존 pixelmatch 방식. 색상 허용 오차 0.1, 안티앨리어싱 제외. 기존 `maxDiffRatio` 판정 대상 |
| `exactPixels.changedPixelRatio` / Exact RGBA | PNG를 디코딩한 RGBA8 채널 중 하나라도 다른 픽셀의 비율. 허용 오차와 안티앨리어싱 제외 없음 |
| `exactPixels.identical` | 디코딩한 모든 RGBA8 채널 값이 같은지 여부. PNG 파일 바이트 동일성이나 사이트 기능 동일성이 아님 |

허용 오차 기준 0%인데 RGBA 값은 다르면 짝 보고서에 경고가 생기고 스위트는 `reviewRequired: true`로 집계합니다. 경고는 기존 임계값이나 종료 코드를 임의로 바꾸지 않습니다. **시각적 합격, 실행 완료, 정확한 채널 일치, 기능 동등성은 서로 다른 판정**입니다.

## 산출물

`comparisons/<width>x<height>/report.json`에 `exactPixels` 객체가 추가됩니다. `changedPixels`, `totalPixels`, `changedPixelRatio`, `identical`, `maxChannelDelta`, `meanAbsoluteChannelDelta`, 변경 영역을 감싸는 `bounds`를 저장합니다. 평균 변화량은 전체 이미지의 네 채널 절대 차이 평균이며 0~255 단위입니다.

`exact-diff.png`는 **흰색=채널 값이 다른 픽셀, 검정=동일한 픽셀**인 별도 진단 이미지입니다. 원본/구현 캡처를 수정한 파일이 아닙니다. 기존 `diff.png`, `side-by-side.png`도 유지합니다. 두 HTML 보고서와 JSON에서 측정값을 확인할 수 있습니다.

작은 색 차이가 넓은 영역에 있으면 무오차 차이 비율은 매우 높을 수 있습니다. 완전 투명한 픽셀의 보이지 않는 RGB 차이도 계산합니다. 이 수치를 완성도 점수나 눈에 보이는 차이의 크기로 해석하지 마세요.

## 호환성과 실패 처리

예전 보고서에 새 측정값이 없으면 `not measured`로 표시하며 동일 이미지라고 추정하지 않습니다. 제공된 새 측정값의 개수/비율/크기/일치 여부/범위가 모순되면 실패 처리합니다. 새 측정값이 있는 스위트 사례에는 비어 있지 않은 일반 파일 `exact-diff.png`도 필요합니다. 단순 파일 존재 검사는 암호학적 진위 검증이 아니며, 임의로 변조한 증거를 신뢰하는 보안 체계가 아닙니다.

크기가 다른 PNG는 계속 `dimension_mismatch`입니다. 리사이즈하지 않으며 무오차 값도 `null`이고 마스크를 만들지 않습니다. 기존 `--max-diff-ratio`는 계속 **허용 오차 적용 비율**의 기준이며, 무오차 기준 옵션을 새로 추가한 것은 아닙니다.

## 실행

```bash
npm ci
npx playwright install chromium
npm run check
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

다른 터미널에서:

```bash
npm run verify:suite -- --manifest suites/uulab-services.json --out artifacts/exact-live
```

`artifacts/exact-live/index.html`에서 사례를 열고 `Exact RGBA mask`를 확인합니다. 이미 가진 PNG만 비교하려면:

```bash
npm run compare -- --source source.png --target target.png --out artifacts/exact-pair
```

전체 검사와 새 실사이트 캡처는 Actions의 **Exact pixel evidence → Run workflow**로 재현할 수 있습니다. 일반 main/PR CI는 외부 운영 사이트에 의존하지 않습니다. 워크플로 증거 보관 기간은 14일입니다.

## 범위

이번 변경은 재사용 가능한 검증 도구·보고서·스킬 지침 보강입니다. 예제 화면 CSS/JS는 수정하지 않습니다. FAQ 스크롤 헤더/포커스와 모바일 전체 페이지 높이 차이를 해결했다고 주장하지 않습니다. 실제 휴대폰, Safari/Firefox, 일반 모션, 백엔드 동등성도 이 측정으로 검증하지 않습니다.

[2026-11-02 실사이트 검증 결과](case-studies/uulab-services/exact-pixels-2026-11-02.md)에서 새 캡처와 테스트 증거를 확인할 수 있습니다.
