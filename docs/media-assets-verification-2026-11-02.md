# CSS 배경·미디어 자산 관찰 검증 — 2026-11-02

## 변경 범위

기준 main은 `fac53ee9b3643f2977e9f4ce9a548bfb6ee9034a`, 최종 검증한 구현은 `778d33b06adf651b680da296fdd5fb2da34039b7`다. 이 결과를 기록하는 후속 커밋은 문서만 변경한다.

기존 capture에 읽기 전용 `visualAssets` 수집을 추가하고 observe가 이를 자산 목록과 보고서에 반영하도록 했다. computed CSS background-image, 생성된 ::before/::after, image-set URL 후보, video 포스터, video/audio의 currentSrc·src·직접 자식 source 선언을 기록한다. URL별로 중복을 묶되 사용 위치·화면·역할은 보존한다. CSS 박스 치수를 원본 이미지 크기로 바꾸지 않는다.

선언된 type은 실제 MIME이 아니며 currentSrc는 재생 성공이 아니다. 권리는 unknown, 로컬 경로와 실제 MIME은 null, 재생 검증은 false로 유지한다. 수집기는 play/load/fetch를 호출하거나 DOM을 변경하지 않는다. 원본 사이트 자체의 자바스크립트와 네트워크 요청은 기존 브라우저 캡처에서 계속 실행된다. observe는 오프라인이다.

기존 예제 HTML/CSS/JS·자산·의존성 잠금 파일·독립 스킬·픽셀 비교 기준은 변경하지 않았다. [사용법과 수집 제한](media-assets.md)을 참고한다.

## 실제 검사

[최종 기능 검증 실행](https://github.com/uulab-official/website-cloner/actions/runs/41455697073), job `125311672652`는 완료·성공이다. [동일 구현의 일반 CI](https://github.com/uulab-official/website-cloner/actions/runs/41455697001)도 성공했다. 완전한 Actions checkout과 고정 의존성, 실제 로컬 HTTP 서버, 설치한 브라우저를 사용했다.

| 검사 | 결과 |
| --- | --- |
| 도구·Chromium 브라우저 검사 | 480개 통과 |
| 실제 빌드 출력 검사 | 7개 통과 |
| 프로덕션 예제 검사 | 10개 통과 |
| **전체 npm run check** | **497개 통과** |
| 신규 오프라인 검사 56개 + 세 엔진 자산 파이프라인 3개 | **59개 통과** |

각 실행의 실패·취소·건너뜀·todo는 0개다. 별도 59개 실행은 전체 검사와 겹치므로 고유 검사로 합산하지 않는다. 스킬 검사와 프로덕션 빌드도 성공했다.

먼저 로컬에서 parser/normalizer 검사 43개를 작성해 29개 실패·14개 통과를 확인했다. 일부 거부 검사는 구현 부재를 거부로 받아 초기에도 통과했으므로 모두 실패했다고 주장하지 않는다. collector/공백 처리 추가 시 4개 실패, observe 통합은 3개 실패를 확인한 뒤 수정했다. 자체 검토 중 추가한 4개 edge-case 검사에서는 3개 실패·1개 통과를 확인하고, 같은 문서 fragment 오탐·unquoted CSS 줄바꿈·반복 참조 상한을 수정했다. 최종 신규 및 기존 관련 오프라인 검사는 103/103 통과했다.

로컬은 이전 검증 artifact의 텍스트 snapshot이며 전체 소스나 설치된 npm 패키지가 없는 환경이다. 이 부분 검사를 전체 검사로 대체하지 않았으며 위 Actions 전체 실행은 미실행 없이 완료했다.

## 실제 세 엔진 파이프라인

Chromium 151.0.7922.34, Firefox 153.0, WebKit 26.5 각각에서 320·640px 폭의 HTTP 테스트 페이지를 capture한 뒤 observe했다. 반응형 배경, 두 개의 image-set 선언, 가상요소, 같은 URL의 img/배경/포스터 중복, 영상 대체 소스와 오디오 선언을 포함했다.

각 엔진은 **9개 URL 후보·24개 사용 관찰**을 기록했다. 공용 이미지의 80×40 원본 크기는 유지됐고 img·css-background·video-poster 역할이 함께 보존됐다. 페이지에서 수집기 실행 후 미디어가 paused이며 currentTime이 0인 것을 확인했다. 실제 미디어 파일의 재생 성공을 검사한 것은 아니며, fixture의 미디어 주소는 의도적으로 재생 가능한 파일을 제공하지 않는다.

오프라인 observe 중 서버 요청이 추가되지 않았고, 생성 HTML에 script/iframe/img/video/audio가 없으며 외부 HTTP 요청을 만들지 않는 것을 확인했다. 390·1440px 보고서에서 문서 전체 가로 넘침이 없었다. 넓은 표는 표 내부에서 가로 스크롤한다. 데스크톱 자산 목록과 모바일 보고서 이미지를 직접 검토했다. 이 페이지는 검사 fixture이지 새 운영 사이트를 클론한 사례가 아니다.

## 새 운영 원본 관찰과 기존 캡처 호환

2026-11-02 **22:49:17~22:49:27 한국 시간**에 운영 원본 `https://uulab.co.kr/services/`를 Chromium에서 1440·768·390px 폭, 높이 900px로 새로 캡처했다. 각 화면에서 DOM 421개, 배경 값 14개, 미디어 요소 0개를 관찰했다. 배경은 파일 URL이 없는 그라데이션이므로 추가 파일 후보를 만들지 않았다. 최종 자산 후보는 기존 이미지 **4개 URL·15개 관찰**이며 경고는 0개다. 기능 동등성은 not_verified, 시각 비교는 not_performed, reviewRequired는 true다.

이 실행은 **원본 관찰만** 수행했으며 새 원본·복제본 비교나 새로운 사이트 구현이 아니다. 예제 화면이나 복제 정확도가 이번 변경으로 개선됐다고 주장하지 않는다.

별도로 이전 실사이트 캡처를 새 observe로 재처리했다. 3개 화면·기존 이미지 4개를 보존하면서 확장 자산의 assetCoverage를 not_recorded로 표시하고 화면별 media_not_recorded 경고 3개를 남겼다. 미수집을 자산 없음으로 오인하지 않았다. 이는 과거 캡처 호환 검사이며 새 캡처가 아니다.

## 교차검산·보존

별도 Python/tinycss2로 원본 CSS를 파싱하고 미디어 선언·img와 최종 자산 목록의 URL·화면·역할별 관찰 수를 대조했다. 운영 원본 1개와 세 엔진 fixture 3개, 총 **4개 묶음 모두 일치**했다. 입력 해시 **31개**와 PNG **18개**의 전체 디코딩·치수도 대조했다. 이는 독립 계산 경로의 데이터 검산이며 독립 코드 리뷰는 아니다.

원본 artifact ID는 `13147380333`, ZIP SHA-256은 `1d01f95efba6aa58c9aadfa1cdba8ce25ba8d57b9247a6a31d434493b8d31e5c`다. 다운로드한 ZIP 해시와 검토한 구현·테스트·워크플로·가이드 13개 파일이 CI snapshot과 바이트 단위로 일치했다. 원본 artifact 만료 예정은 2026-11-16 13:49:28 UTC다. 검토용 묶음에 check.log, media-tests.log, fixtures, live-source/live-report, 교차검산 결과와 코드 snapshot을 보존한다. 폰트 파일은 포함하지 않는다.

작성자가 diff·파서·입력 상한·파일 보호·HTML·진단·실제 보고서를 자체 검토했다. 독립 코드 리뷰는 받지 않았다.

## 남은 범위

폰트 파일, 프레임, Shadow DOM, canvas, mask, border-image, 숨겨진 상태 전체, 영상·오디오 재생, 실제 Safari·휴대폰·터치, macOS/Windows 및 백엔드 동등성은 검증하지 않았다. CSS 추출기는 범용 CSS 검증기가 아니다. 자산 다운로드·권리 승인·앱 자동 생성은 제공하지 않는다. 수집 범위와 문자열/참조 상한을 넘으면 경고와 누락 수를 남긴다. 원본 값의 개인정보를 공유 전에 검토해야 하며 파일 해시는 출처 진위 인증이나 동시 파일시스템 변경에 대한 샌드박스가 아니다.
