# 두 개의 편집 가능한 유유랩 클론 예제

저장소 루트에서 `npm ci`와 `npm run dev`를 실행하고 Vite가 표시한 주소를 사용합니다.

| 원본 | 로컬 경로 | 범위 |
| --- | --- | --- |
| `https://uulab.co.kr/` | `/home/` | 홈페이지 아홉 본문 섹션, 공통 탐색·테마·스크롤 |
| `https://uulab.co.kr/services/` | `/services/` | 서비스 페이지, 메뉴·테마·FAQ |
| 기존 서비스 별칭 | `/` | 이전 진입점 호환 유지 |

두 페이지 사이의 링크는 로컬로 연결합니다. 포트폴리오·인사이트·문의 등 범위 밖의 경로는 운영 원본으로 이어집니다. 문의나 구매를 자동 제출하지 않습니다. 콘텐츠는 빌드 시 HTML로 생성되어 브라우저 JavaScript 없이도 읽을 수 있습니다.

홈페이지 문구·통계·인사이트는 관찰일 스냅샷이며 실시간 데이터 연동이 아닙니다. [홈페이지 구현·검증 기록](../../docs/case-studies/uulab-home/report.md), [서비스 사례](../../docs/case-studies/uulab-services/report.md), [자산 출처](../../THIRD_PARTY_NOTICES.md)를 확인하세요.

홈페이지 데이터·템플릿·스타일은 `src/home-content.js`, `src/home-render.js`, `src/home.css`에 있습니다. 공통 탐색과 컨트롤은 `src/render.js`, `src/main.js`를 공유합니다. `npm run build`는 `dist/demo`를 생성하며 재빌드 시 해당 생성 폴더를 비웁니다.

일반 검사는 `npm run check`, 세 엔진 동작 검사는 `npm run check:browsers`입니다. 원본 비교는 별도입니다. 프로덕션 예제 서버를 4173 포트에서 실행한 후 다음 명령을 사용합니다.

```bash
npm run verify:suite -- --manifest suites/uulab-home.json --out artifacts/home-live
```
