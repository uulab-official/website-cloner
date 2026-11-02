# CSS 배경·영상·오디오 자산 관찰

기존 `capture → observe` 흐름 그대로 사용한다. 새 캡처의 page.json에는 선택적인 `visualAssets` v1이 추가된다. 기존 캡처도 읽을 수 있지만 확장 자산 정보는 `not_recorded`와 검토 경고로 표시한다. 미수집과 자산 없음은 다르다.

```bash
npm run capture -- --url https://uulab.co.kr/services/ --out artifacts/media-source --widths 1440,768,390 --height 900
npm run observe -- --capture artifacts/media-source --out artifacts/media-report
```

## 기록하는 것

- `html`, `body`와 light-DOM 요소의 computed background-image 및 생성된 `::before`/`::after` 배경. 여러 URL 레이어와 `image-set` 선언 URL을 구분한다. 그라데이션은 파일로 취급하지 않는다.
- `video.poster`, `video/audio.currentSrc`, `src`, 직접 자식 `source`의 URL과 선언된 type/media. currentSrc만 선택 근거이며, 다른 소스는 선언 후보일 수 있다.
- 같은 URL이 img·CSS·poster에 반복되면 하나의 자산으로 묶고 화면·역할·selector 관찰은 보존한다. CSS 박스 치수를 원본 이미지 크기로 사용하지 않는다.
- HTML 보고서에 전체 자산 후보 수·역할·종류·수집 범위를 표시한다. CLI의 `imageCandidates`는 이미지 수, `assetCandidates`는 전체 수다.

주소를 관찰했다고 다운로드·디코딩·재생·권리 확인이 된 것은 아니다. `<source type>`은 `declaredType`으로만 보존하고 `content_type`은 미확인으로 남긴다. `rights: unknown`, `local_path: null`, `status: planned`, `playbackVerified: false`를 유지한다. 배경의 image-set 후보 전체를 보존하므로 실제로 선택된 파일과 같다고 보지 않는다.

## 수집 제한과 안전

DOM 5,000개, 배경 기록 500개, 미디어 요소 100개, 요소당 source 20개, 문자열당 8,000자(타입/쿼리는 1,000자), 추가 값 문자열 총 500,000자를 상한으로 한다. 생략·잘림을 coverage에 남기고 잘린 CSS/URL은 후보로 만들지 않는다. 프레임·Shadow DOM·폰트 파일·마스크·border-image·canvas는 미지원이다. CSS 토큰 추출기는 일반 CSS 검증기가 아니다.

수집기는 DOM을 읽을 뿐 play/load/fetch를 호출하거나 페이지를 바꾸지 않는다. 원본 페이지 자체가 로딩·스크립트 실행 중 발생시키는 네트워크는 기존 브라우저 캡처 범위에 속한다. observe는 오프라인이다. data/blob/file/javascript URL, 로컬 fragment와 계정정보가 포함된 URL은 재사용 후보에서 제외한다. 일부 capture 원시 텍스트에는 민감정보가 남을 수 있으므로 공유 전 검토한다.

보고서는 원본 값을 이스케이프하고 원격 이미지·영상·오디오를 삽입하지 않는다. 기존 출력 보호·실패 처리·픽셀 판정은 유지한다. 자동 앱 생성이나 임의 사이트의 모든 자산을 복원하는 기능이 아니다.

근거 API: [getComputedStyle](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle), [HTMLMediaElement.currentSrc](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentSrc).
