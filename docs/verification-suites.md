# 여러 경로·상태를 한 번에 검증하기

`verify:suite`는 기존 `verify`를 순서대로 실행하는 로컬 도구입니다. 사이트 자동 생성기나 완성도 점수 계산기가 아닙니다. 추가 npm 의존성 없이 개별 캡처·픽셀 비교를 묶고 HTML/JSON 보고서를 만듭니다. 스킬만 독립 설치하는 방식은 바뀌지 않습니다.

[무오차 RGBA 진단과 필드 해석](exact-pixel-evidence.md) · [2026-11-02 새 캡처 검증 결과](case-studies/uulab-services/exact-pixels-2026-11-02.md)

## 실행

```bash
npm ci
npx playwright install chromium
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

다른 터미널에서 설정을 확인하고 실행합니다.

```bash
npm run verify:suite -- --manifest suites/uulab-services.json --dry-run
npm run verify:suite -- --manifest suites/uulab-services.json --out artifacts/services-suite
```

`--dry-run`은 동작 파일까지 검사하지만 캡처하거나 출력 폴더를 만들지 않습니다. 예제 설정은 기본 화면(1440/768/390), 모바일 메뉴(390), 테마 버튼으로 전환한 다크 상태(1440), 구현의 루트 경로 별칭(1440/390), FAQ 열림(1440/390), 다크 모바일 메뉴(390)를 합쳐 **6개 사례·10개 화면 조건**을 요청합니다. 모바일 폭은 실제 휴대폰/터치 기기 검증을 의미하지 않습니다.

오리진은 `--source-origin https://your-authorized-site.example`과 `--target-origin http://localhost:5173`으로 덮어쓸 수 있습니다. `--browser chromium|firefox|webkit`는 스위트 전체의 원본·구현에 같은 엔진을 지정합니다. 엔진별 출력 폴더를 분리하고 필요한 엔진을 먼저 설치하세요. 기존 Chromium 실행 파일은 `--executable-path /absolute/path/to/chromium`으로 지정합니다. 실행 파일은 설정 JSON이 아닌 CLI에서만 받습니다.

## 설정 예제

```json
{
  "schemaVersion": 1,
  "sourceOrigin": "https://your-authorized-site.example",
  "targetOrigin": "http://localhost:4173",
  "defaults": { "widths": [1440, 390], "height": 900, "scheme": "light" },
  "cases": [
    { "id": "home", "path": "/" },
    { "id": "services", "path": "/services/", "targetPath": "/rebuilt/services/" },
    {
      "id": "faq-open", "path": "/services/", "widths": [390], "state": "faq-open",
      "sourceActions": "./actions/source-faq.json",
      "targetActions": "./actions/target-faq.json", "keepScroll": true
    }
  ]
}
```

오리진은 경로·쿼리·프래그먼트·자격증명이 없는 HTTP(S) 주소입니다. `path`는 `/`로 시작하며 `targetPath`를 생략하면 같은 경로를 사용합니다. 경로에 쿼리를 사용할 수 있지만 비밀 값은 넣지 마세요. 동작 파일은 **설정 파일 디렉터리 기준**으로 해석합니다. 원본/구현의 선택자가 다르면 동작 파일을 따로 지정합니다.

`defaults`와 사례에서 `widths`, `height`, `scheme`, `state`, `keepScroll`, `maxDiffRatio`, `timeoutMs`를 지정할 수 있습니다. 사례 값이 기본값을 덮어씁니다. `maxDiffRatio: null`은 상속한 임계값을 해제합니다. 다른 값에 `null`을 넣지 마세요. 기본적으로 캡처 전에 화면 위로 복귀하며, FAQ 위치를 유지하려면 `keepScroll: true`를 지정합니다.

사례 수는 1~50개, 너비는 중복 없는 1~10개이며 너비/높이는 1~8192 정수입니다. ID는 영문·숫자로 시작하는 1~64자의 영문·숫자·`_`·`-`이며 Windows 예약 이름과 대소문자 중복은 거부합니다. 시간 제한은 1000~3600000ms이고 생략 시 너비 수에 맞춰 계산합니다. 알 수 없는 필드는 거부합니다.

동작 파일은 `[{"type":"click","selector":"#menu"}]`처럼 기존 capture의 click/scroll 배열입니다. JavaScript나 셸 명령은 받지 않습니다. 모든 동작 파일을 검사한 후에 출력 폴더를 생성/교체합니다. **소유하거나 허가받은 페이지에 관찰용 동작만 지정하세요.** 클릭이 구매·문의 제출을 유발하는지는 자동 판단하지 않으므로 제출 동작을 넣으면 안 됩니다.

## 결과 해석

출력은 `suite.json`, `index.html`, `cases/<id>/`의 개별 검증 보고서입니다. HTML에는 원격 자산이나 스크립트가 없습니다.

| 값 | 의미 |
| --- | --- |
| `completed` | 요청한 비교가 실행되고 필요한 파일이 존재함. 시각적 동일성 판정이 아님 |
| `failed` | 프로세스 실패, 시간 초과, 누락·불일치 또는 명시한 임계값 초과 |
| `skipped` | fail-fast 또는 취소로 실행하지 않은 사례 |
| `visualGate: not_requested` | 시각 임계값을 지정하지 않음 |
| `visualGate: not_evaluated` | 임계값은 있지만 신뢰할 수 있게 평가할 수 없음 |
| `visualGate: passed/failed` | 명시한 픽셀 차이 임계값 판정 |

진단 경고는 `reviewRequired`로 별도 집계합니다. 비율을 평균 내어 완성도 점수로 만들지 않습니다. 기능/백엔드/모션 일치는 검증되지 않습니다. 기본적으로 실패 후 다음 사례도 실행합니다. `--fail-fast`는 나머지를 보고서에 skipped로 남깁니다. 취소나 시간 초과 시 하위 프로세스를 종료합니다. Windows의 taskkill 분기는 Linux 실행 결과만으로 검증했다고 주장하지 않습니다.

**비교기의 0%도 픽셀 동일성을 뜻하지 않습니다.** 기본 pixelmatch는 색상 허용 오차 0.1과 안티앨리어싱 제외를 사용합니다. 약한 색 차이는 넓은 면적에 있어도 무시할 수 있습니다. 실제 메뉴 사례는 기본 결과 0%인데 반투명/불투명 배경이 눈으로 다르고, 허용 오차 없는 RGBA 비교에서는 약 34.99%의 픽셀이 달랐습니다. [실측 설명](case-studies/uulab-services/fidelity-polish-2026-11-01.md)을 참고하고 반드시 side-by-side 이미지를 검토하세요. RGBA 차이 비율 역시 품질 점수가 아닙니다.

새 보고서는 기존 비율과 별개로 `exactPixels` 및 `exact-diff.png`를 제공합니다. 허용 오차 기준 0%인데 실제 RGBA 값이 다르면 자동 검토 경고를 남깁니다. 과거 보고서의 미측정 값은 동일하다고 추정하지 않으며, 기존 `maxDiffRatio`는 계속 허용 오차 적용 비율에만 적용됩니다. [무오차 진단 안내](exact-pixel-evidence.md)에서 정확한 의미와 호환성을 확인하세요.

종료 코드 0은 비교 완료, 1은 입력/실행/비교 실패입니다. 임계값 없는 종료 코드 0을 시각적 승인으로 해석하지 마세요. `--overwrite`는 같은 도구가 만든 출력만 교체하며 입력 파일을 보호합니다. 기존 출력에 개인 파일을 넣은 뒤 덮어쓰지 마세요. 보고서에는 페이지 텍스트·URL·로그가 들어갈 수 있으므로 게시 전에 민감정보를 검토하세요.

집계기는 URL, 화면 크기, 상태, 테마, 임계값, 하위 프로세스와 행별 결과를 교차 확인합니다. 필수 증거의 누락·빈 파일·최종 파일 심볼릭 링크를 실패 처리합니다. PNG 디코딩/픽셀 계산은 기존 compare가 담당합니다. 집계기 테스트의 계약용 fixture는 실제 브라우저 캡처가 아닙니다.

## 테스트와 GitHub Actions

```bash
node --test tests/suite-config.test.mjs tests/suite-runner.test.mjs tests/suite-cli.test.mjs
npm run check
```

새 테스트는 기존 전체 검사에 자동 포함됩니다. `.github/workflows/verification-suite.yml`은 전체 검사 후 실제 운영 원본과 프로덕션 빌드를 비교하고 성공/실패 모두 로그와 증거를 14일 보관합니다. Actions의 **Verification suite integration → Run workflow**로 수동 실행할 수 있습니다. 작업 브랜치 `feat/verification-suite-integration`의 push에서도 실행하지만 일반 main/PR CI에는 실사이트 의존성을 추가하지 않습니다.

**Clone fidelity review → Run workflow**는 동일한 스위트에 더해 390 × 320 메뉴 캡처와 기본 상태 full-page 비교를 수행합니다. 이 워크플로는 `work/clone-fidelity` push에서도 실행합니다. full-page 결과는 아티팩트 `full-page/summary.json`에 별도 보관하며, 크기 불일치는 비율을 계산하지 않고 `dimension_mismatch`, exit code 1, `reviewRequired: true`로 남깁니다. 워크플로는 그 명시적인 진단을 보존하되 그 밖의 비교 실패는 실패 처리합니다. 따라서 워크플로 완료를 전체 페이지 합격으로 해석하면 안 됩니다.

**Exact pixel evidence → Run workflow**는 전체 검사 후 같은 10개 화면에 두 측정값과 무오차 마스크를 기록합니다. `work/exact-pixel-evidence` push에서도 실행하며, 스크린샷·JSON·로그를 14일 보관합니다.
