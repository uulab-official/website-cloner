# Website Cloner 문서 안내

이 프로젝트는 **독립 에이전트 스킬 + 로컬 캡처·검증 도구 + 편집 가능한 실제 예제**입니다. URL 하나로 임의 사이트의 서버·인증·결제를 복원하는 서비스가 아닙니다.

## 작업에 맞는 명령

| 목적 | 명령 | 실행 범위 |
| --- | --- | --- |
| 코딩 에이전트로 재구현 | [website-clone 스킬](../skills/website-clone/SKILL.md) | 기존 프로젝트의 프레임워크 유지 |
| 새 사이트 작업 묶음 | `npm run init -- --help` | 검증 설정·자산 기록·에이전트 지시서 생성 |
| 원본 캡처를 관찰 보고서로 정리 | `npm run observe -- --help` | 오프라인 측정값·이미지 후보·진단, 구현/권리 승인 아님 |
| 새 작업과 원본 관찰 준비 | `npm run prepare:clone -- --help` | 명시한 원본만 캡처, 구현 서버 불필요 |
| 여러 페이지·상태 원본 준비 | [prepare:suite](prepare-suite.md) | 명시한 사례, 대상 방문 없이 순차 준비 |
| 페이지 관찰·PNG 수집 | `npm run capture -- --help` | 지정한 URL, 선택한 엔진 |
| 기존 PNG 두 장 비교 | `npm run compare -- --help` | 같은 크기의 이미지, 두 가지 차이 지표 |
| 원본·구현 한 경로 비교 | `npm run verify -- --help` | 양쪽을 같은 엔진에서 새 캡처 |
| 여러 경로·상태 비교 | `npm run verify:suite -- --help` | 명시적 JSON 설정, 엔진별 분리 실행 |
| 예제 동작 호환성 | `npm run check:browsers -- --help` | 작성한 예제만, 원본 비교 아님 |
| 안전한 빌드 출력 검사 | `npm run test:build` | 임시 폴더의 실제 Vite 빌드 |
| 전체 기본 검사 | `npm run check` | 스킬·도구·Chromium·빌드·예제 |

## 현재 사용 안내

[설치·시작](../README.md) · [원본 준비](prepare-clone.md) · [작업 초기화](project-init.md) · [원본 관찰 보고서](source-observations.md) · [짝 비교](paired-verification.md) · [일괄 비교](verification-suites.md) · [엔진 선택](capture-engines.md) · [무오차 픽셀 진단](exact-pixel-evidence.md) · [예제 브라우저 검사](browser-compatibility.md) · [빌드·CI 운영](build-and-ci.md) · [빌드·CI 정비 검증](build-readiness-2026-11-02.md)

`capture`, `verify`, `verify:suite`는 `--browser chromium|firefox|webkit`를 지원합니다. 기본은 Chromium입니다. 서로 다른 엔진에서 얻은 원본/구현을 한 쌍으로 비교하지 않습니다. 새 엔진 실행은 기존 출력과 다른 디렉터리를 사용하세요.

## 날짜가 있는 기록은 당시의 증거

[초기 사례](case-studies/uulab-services/report.md), [스위트 통합](case-studies/uulab-services/suite-integration-2026-11-01.md), [무오차 비교](case-studies/uulab-services/exact-pixels-2026-11-02.md), [스크롤 동작](case-studies/uulab-services/scroll-fidelity-2026-11-02.md), [진행 표시](case-studies/uulab-services/progress-fidelity-2026-11-02.md), [세 엔진 캡처](case-studies/uulab-services/capture-engines-2026-11-02.md), [스크롤바 안정화](case-studies/uulab-services/scrollbar-fidelity-2026-11-02.md)를 보존합니다. 오래된 기록에 남은 경고·검사 수·제한은 그 시점의 설명이며 현재 명령 계약을 덮어쓰지 않습니다.

## 결과 해석

실행 완료는 시각 승인과 다릅니다. 허용 오차 적용 비율이 0%여도 정확한 RGBA 값은 다를 수 있습니다. 원본/구현/차이 이미지와 페이지 오류 기록을 함께 보세요. 전체 높이가 다르면 이미지를 늘이거나 잘라 맞추지 않습니다.

Linux의 WebKit 실행은 실제 macOS/iPhone Safari 검증이 아닙니다. 모바일 폭 캡처도 물리 휴대폰이나 터치 검증이 아닙니다. 소유하거나 허가받은 페이지에서 관찰하고, 구매·문의 제출은 실행하지 마세요. 공개하기 전에 URL·페이지 텍스트·로그의 민감정보를 검토하세요.
