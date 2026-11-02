# 빌드·CI 운영 안내

## 로컬 검사와 빌드

저장소의 Node.js 최소 버전은 22.12입니다. package-lock.json의 고정 의존성을 사용합니다.

```bash
npm ci
npx playwright install chromium firefox webkit
npm run test:build
npm run check
npm run check:browsers -- --out artifacts/browser-check
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Linux에서 브라우저 시스템 라이브러리 설치가 필요하면 `npx playwright install --with-deps chromium firefox webkit`을 사용합니다. 한글 폰트 환경도 원본/구현 양쪽에 동일하게 준비합니다. 실제 Safari나 휴대폰 검증과는 별개입니다.

## 빌드 출력의 소유 범위

예제의 생성 결과는 **dist/demo/**입니다. 빌드할 때 이 디렉터리의 예전 파일을 비우므로 개인 파일을 넣지 마세요. dist/other 같은 형제 출력과 소스 디렉터리는 정리 대상이 아닙니다.

Vite 설정이 확정된 뒤 정리 전에 출력 경로를 검사합니다. 다른 --outDir 지정, 다른 예제 root 지정, dist 또는 dist/demo의 심볼릭 링크/일반 파일을 거부합니다. 경로 검사는 신뢰하는 로컬 작업 디렉터리에서 실수로 잘못된 폴더를 비우는 것을 막기 위한 것이며, 다른 프로세스가 검사 직후 파일시스템을 바꾸는 공격까지 막는 샌드박스는 아닙니다.

출력을 옮기려면 먼저 정상 빌드한 dist/demo를 원하는 배포 경로로 복사하세요. 직접 vite를 실행해도 같은 설정을 사용하면 검사가 적용됩니다. 사용자 정의 --config로 검사를 우회한 실행은 지원 범위 밖입니다.

`npm run test:build`는 원본 저장소의 Vite 설정을 임시 프로젝트에 복사한 뒤 실제 빌드합니다. 재빌드의 오래된 파일 제거, 형제 파일 보존, 두 HTML 진입점, 위험한 경로·심볼릭 링크 거부를 검사합니다. 모든 삭제 시나리오는 임시 폴더 안에서만 실행합니다.

## GitHub Actions

워크플로는 공식 릴리스의 40자리 커밋에 고정합니다. Actions 실행용 Node 24와 애플리케이션 테스트용 Node 버전은 별개입니다. 기존 일반 CI의 Node 24 및 브라우저 검사의 Node 22를 유지합니다. npm 패키지 버전은 이번 변경에서 올리지 않습니다.

| Action | 릴리스 | 고정 커밋 |
| --- | --- | --- |
| actions/checkout | v7.0.1 | 3d3c42e5aac5ba805825da76410c181273ba90b1 |
| actions/setup-node | v7.1.0 | 949feb2413d6458794dcd2491c4babbbce0c15c1 |
| actions/upload-artifact | v7.0.2 | cf430e030ddbb5b0abf93d22962f4752f3646cd9 |

저장소 토큰 권한은 contents: read이고 checkout의 persist-credentials는 false입니다. CI에서 커밋·푸시하지 않습니다. Actions 런타임을 강제로 바꾸는 환경변수로 경고만 숨기지 않습니다. 자체 runner 사용 시 선택한 Action의 공식 최소 runner 버전을 확인해야 합니다.

일반 CI와 Demo browser compatibility는 로컬 fixture 및 프로덕션 빌드를 검사합니다. 실사이트 캡처 워크플로는 별도의 수동 실행/작업 브랜치 조건을 유지합니다. Build readiness는 빌드 보호 검사, 전체 검사, 세 엔진 검사, 이전 코드와의 산출물 해시 비교를 보존하는 수동/작업 브랜치용 작업입니다.

## 검증을 구분해서 해석하기

빌드 성공, 동작 검사 통과, 원본과의 시각 비교, 실제 기기 검증은 서로 다릅니다. 이번 빌드·CI 변경만으로 새 실사이트 비교나 실제 Safari·터치 검증을 수행했다고 볼 수 없습니다. 과거 날짜가 붙은 사례 문서의 경고와 수치는 당시 기록이므로 수정하지 않습니다.

공식 참고: [Vite build.emptyOutDir](https://vite.dev/config/build-options#build-emptyoutdir), [checkout 릴리스](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node 릴리스](https://github.com/actions/setup-node/releases/tag/v7.1.0), [upload-artifact 릴리스](https://github.com/actions/upload-artifact/releases/tag/v7.0.2).
