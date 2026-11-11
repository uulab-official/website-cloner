# 명시적 UI 상태 검사

클릭 성공과 실제 상태 변경은 다릅니다. 기존 `click`·`scroll` 배열에 읽기 전용 `assert` 단계를 넣을 수 있습니다. `capture`, `verify`, `verify:suite`, `prepare:clone`, `prepare:suite` 모두 같은 형식을 사용합니다.

```json
[
  { "type": "click", "selector": "#menu-toggle" },
  { "type": "assert", "selector": "#menu", "check": "visible" },
  { "type": "assert", "selector": "#menu-toggle", "check": "attribute", "attribute": "aria-expanded", "value": "true" }
]
```

`check`는 `visible`, `hidden`, `attribute` 중 하나입니다. 모든 검사는 **정확히 하나의 DOM 요소**가 있어야 성공합니다. `hidden`은 요소가 있으면서 숨겨진 경우이며, 잘못된 선택자나 삭제된 요소를 성공으로 간주하지 않습니다. 여러 요소가 일치하면 실패합니다. `attribute`는 정확한 문자열을 비교하며 `open` 같은 불리언 HTML 속성은 `value: ""`로 검사합니다. 정규식·임의 JavaScript 실행은 지원하지 않습니다.

기본 재시도 제한은 5000ms이며 `timeoutMs` 정수 1..10000을 지정할 수 있습니다. 가시성은 Playwright의 visibility 정의입니다. 화면 안에 들어왔는지, 다른 요소에 가려졌는지, 접근성이나 실제 기기 동작은 증명하지 않습니다. Playwright의 `isVisible` 자체는 대기하지 않으므로 읽기 전용 재검사를 사용합니다. 브라우저 프로토콜 호출 지연은 상위 캡처 프로세스 제한의 적용을 받습니다.

검사는 배열의 해당 시점에 실행됩니다. 뒤의 클릭이 상태를 바꿀 수 있으므로 최종 상태가 중요하면 마지막에도 검사를 추가하세요. 자동 탐색·자동 예상값 추론이나 전체 기능 일치 판정이 아닙니다. 성공한 개별 검사가 있어도 `functionalParity: not_verified`를 유지합니다.

`page.json`의 각 assert에는 예상값과 `assertion.observed` 실제값이 남습니다. 실패하면 capture가 실패하고 준비 후속 단계·픽셀 비교를 성공으로 처리하지 않습니다. 완료 상태만 적힌 모순된 assertion 기록은 관찰·비교에서 거부합니다. 입력 해시와 기록 일관성 검사는 원본 진위 인증이 아닙니다.

준비 명령은 검사 조건도 작업 폴더에 복사합니다. `attribute`, `value`, `timeoutMs`가 그대로 보존돼 원래 파일 수정이나 폴더 이동 뒤에도 사용할 수 있습니다. 원본과 구현의 선택자 또는 상태 표현이 다르면 별도 동작 파일을 사용합니다.

## 유유랩 예제

프로덕션 예제를 4173 포트에서 실행한 뒤:

```bash
npm run verify:suite -- --manifest suites/uulab-asserted-states.json --out artifacts/asserted-states
```

이 설정은 홈페이지 모바일 다크 메뉴와 서비스 FAQ를 검사합니다. 사이트 전체가 아니라 명시한 2개 사례·3개 화면 조건입니다. 준비만 하려면 `prepare:suite`에 같은 manifest와 새 출력 경로를 전달합니다.

상태 검사 자체는 DOM을 수정하거나 클릭/스크롤·미디어 재생·다운로드를 하지 않습니다. 배열의 기존 클릭과 페이지 자체 스크립트의 부작용까지 차단하는 네트워크 샌드박스는 아닙니다. 허가받은 비파괴적 동작만 지정하고 URL·속성값·캡처·로그의 민감정보는 공유 전에 검토하세요.

참고: https://playwright.dev/docs/api/class-locator#locator-is-visible
