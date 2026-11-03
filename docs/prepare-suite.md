# 여러 페이지·상태 원본 준비

`prepare:suite`는 기존 `verify:suite`의 schemaVersion 1 설정을 읽어 **명시한 원본 경로와 상태만** 순서대로 준비합니다. 자동 크롤러나 앱 생성기가 아닙니다. 구현 서버는 없어도 됩니다. 모든 사례의 동작 파일을 검증·복사한 다음 첫 캡처를 시작합니다. 일반 실패 뒤에도 다음 사례를 실행하고, `--fail-fast` 또는 사용자 중단 때는 남은 사례를 `not_run`으로 보존합니다.

```bash
npm ci
npx playwright install chromium
npm run prepare:suite -- --manifest suites/uulab-services.json --out artifacts/projects/services-batch --dry-run
npm run prepare:suite -- --manifest suites/uulab-services.json --out artifacts/projects/services-batch
```

새 폴더만 허용합니다. `--dry-run`은 디렉터리·브라우저·네트워크를 만들지 않습니다. `--browser chromium|firefox|webkit`, Chromium 전용 `--executable-path`, `--fail-fast`, `--timeout-ms`를 지원합니다. capture 단계의 제한 시간은 사례마다 기본 300000ms, 허용 범위 1000..900000ms입니다. 설정 안의 `timeoutMs`는 이후 **검증기** 제한 시간으로 그대로 보존하며 준비 시간과 혼동하지 않습니다. `maxDiffRatio`도 보존하지만 원본만 준비하는 단계에서 시각 합격을 판정하지 않습니다.

## 결과

- `index.html`과 `preparation-suite.json`: 준비·실패·미실행·진행 중 개수, 증거 경로, 무결성 진단.
- `suite.json`: **실패·미실행을 포함한 전체 사례**, 원본/대상 경로, 폭·상태·테마·스크롤·검증 기준. 동작 파일은 상대 경로로 연결합니다.
- `actions/<case-id>/`: 첫 캡처 전에 고정한 동작 복사본. 원래 파일을 수정하거나 묶음을 이동해도 해당 복사본으로 검증합니다.
- `cases/<case-id>/`: 기존 prepare:clone과 같은 초기화·캡처·관찰·인계 자료. 자산 권리 기록과 구현 보고서는 사례마다 편집합니다.
- `START-HERE.md`: 전체 인계 순서와 검증 안내. 준비가 곧 구현·시각 승인·기능 동등성이라는 표현을 사용하지 않습니다.

원본/구현의 선택자가 다르면 `sourceActions`와 `targetActions`를 각각 지정하세요. `targetActions`만 필요한 경우에도 `sourceActions`에 빈 배열 `[]` 파일을 명시해야 합니다(prepare:clone과 같은 규칙). click/scroll만 허용하며 로그인·구매·문의 제출·삭제 동작을 넣으면 안 됩니다. 동작의 안전성을 의미적으로 자동 판정하지 않습니다.

구현 후 별도로 서버를 실행한 뒤 같은 묶음을 검증합니다.

```bash
npm run verify:suite -- --manifest artifacts/projects/services-batch/suite.json --out artifacts/projects/services-batch/evidence/run-001
```

준비할 때 Firefox/WebKit을 썼다면 검증에도 해당 `--browser`를 명시하세요. 검증은 원본과 대상을 새로 캡처하며 준비 PNG를 재사용하지 않습니다. 설정은 임의의 새 경로·상태를 추가할 수 있지만 자동으로 링크를 따라가지 않습니다.

## 실패와 한계

초기 설정·동작 검증 오류는 어떤 원본도 방문하기 전에 실패합니다. 캡처 오류, 부정확한 증거, 복사본 변경은 성공으로 표시하지 않습니다. 전체 배치는 사례 하나라도 실패·미실행이면 종료 코드 1입니다. 전체 상태가 `failed`이면 일부 사례가 `prepared`여도 전체 준비 성공으로 읽으면 안 됩니다. JSON·HTML 쓰기 실패나 강제 종료 때 남은 running 기록도 성공이 아닙니다. 덮어쓰기·삭제·재개·자동 재시도는 없습니다.

관찰 경고가 없어도 권리·백엔드·숨겨진 상태·실기기·전체 모션을 증명하지 않습니다. `targetVisited: false`는 도구가 별도 대상 캡처를 시작하지 않았다는 뜻이며 원본 스크립트의 간접 요청까지 차단하지 않습니다. networkAccess는 캡처를 시작할 수 있는 상태이지 요청 건수가 아닙니다. 해시는 출처 진위나 적대적 동시 파일 변경을 격리하는 보안 장치가 아닙니다. 공유 전 URL 쿼리·캡처·본문·로그를 검토하세요.
