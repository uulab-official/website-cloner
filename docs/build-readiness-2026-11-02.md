# 안전한 재빌드·CI 런타임 정비 — 2026-11-02

## 변경 범위

기준은 `6880114c6cac67a85d9bc3a92b7f2c1f9fdc4ddb`, 검증한 구현은 `52f568f21ad6c516ce38bd844a1fb8d92684520e`다. 예제의 작성한 HTML 진입점·src·CSS·자산과 package-lock.json은 변경하지 않았다. 이번 작업은 안전한 빌드 정리, CI 실행환경, 현재 사용 안내와 검사 도구 도움말을 다룬다. 이 결과를 기록한 후속 문서 커밋은 검증한 코드를 변경하지 않는다.

Vite가 확정한 root/outDir를 정리 전에 검사하고, 생성 폴더인 dist/demo만 비우도록 했다. 다른 출력 경로, dist 또는 dist/demo의 심볼릭 링크·일반 파일은 거부한다. 첫 빌드에서 출력 폴더가 아직 없는 경우는 허용한다. 재빌드의 오래된 파일은 제거하되 형제 출력은 보존한다. 이 생성 폴더에는 개인 파일을 넣으면 안 된다. 해당 정책을 우회하는 사용자 정의 config나 검사 직후 외부 프로세스가 파일시스템을 바꾸는 공격을 격리하는 샌드박스는 아니다.

기존 10개와 새 Build readiness를 합친 11개 워크플로의 Actions를 공식 릴리스의 40자리 커밋에 고정했다. checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2는 Node 24 런타임을 사용한다. 애플리케이션 검사에 지정한 기존 Node 22/24 버전과 기존 워크플로의 실행 조건·시간 제한·읽기 권한은 유지했다. checkout에는 persist-credentials: false를 설정했다. 모든 수동 실사이트 워크플로를 이번에 재실행한 것은 아니다.

현재 안내는 세 엔진 캡처, 예제 동작 검사와 원본 비교의 차이, PNG 비교와 HTML 보고서의 산출물 차이, 안전한 빌드 출력 정책을 설명하도록 정리했다. 과거 날짜의 사례 문서와 라이선스·출처는 보존했다.

## 실패 재현과 실제 검사

[수정 전 실행](https://github.com/uulab-official/website-cloner/actions/runs/41438666407)은 새 빌드 검사 7개가 모두 실패했다. 오래된 산출물이 남는 문제 1개, 위험한 outDir 지정 4개, 심볼릭 링크 2개를 실제 Vite 빌드로 재현했다. 삭제 시나리오는 전부 임시 프로젝트 안에서만 실행했다. 기존 전체 327개 도구 검사와 프로덕션 예제 10개는 통과했다.

[수정 후 전체 실행](https://github.com/uulab-official/website-cloner/actions/runs/41440679286), job `125261450481`은 완료·성공이다. 완전한 Actions checkout에서 npm ci, 잠금 파일의 의존성, 실제 로컬 HTTP 서버와 설치한 세 브라우저로 검사했다. 부분 로컬 snapshot의 검사를 전체 검사로 대체하지 않았다.

| 검사 | 실제 결과 |
| --- | --- |
| 도구·Chromium 브라우저 검사 | 328개 통과 |
| 실제 Vite 빌드 출력 검사 | 7개 통과 |
| 프로덕션 예제 검사 | 10개 통과 |
| 전체 npm run check | **345개 통과** |
| Chromium 151.0.7922.34 | 동일 동작 검사 38/38 통과 |
| Firefox 153.0 | 동일 동작 검사 38/38 통과 |
| WebKit 26.5 | 동일 동작 검사 38/38 통과 |

각 실행에서 실패·취소·건너뜀·todo는 0개다. 세 엔진의 114회 실행은 같은 38개를 반복한 것이므로 전체 345개에 추가 고유 검사로 합산하지 않는다. 별도 빌드 검사 단계도 위 7개의 반복이다. 스킬 검사와 프로덕션 빌드가 성공했고, 수정 후 빌드 로그에는 기존 outDir 경고가 없었다. 수정 전 로그와 비교 기준 빌드 로그에는 원래 경고를 그대로 보존한다.

도움말의 오래된 Chromium-only 문구는 로컬에서 추가한 assertion 실패를 확인한 뒤 수정했다. 이 검사 1개는 전체 328개에 포함된다. Node.js는 이 증거 실행에서 v22.23.4다. 애플리케이션 Node와 Action의 실행용 Node를 혼동하지 않는다.

## 산출물·문서 확인

기준 main을 별도 checkout에서 같은 의존성으로 빌드해 상대 경로와 SHA-256 목록을 비교했다. **생성 파일 13개의 경로·내용이 전부 동일**했다. 따라서 이번 빌드 설정 변경이 프런트엔드 산출물을 바꾸지 않았음을 확인했다. 이는 운영 원본 사이트가 변하지 않았다는 의미가 아니다.

README, CONTRIBUTING 및 현재 가이드 6개, 총 8개 문서의 로컬 Markdown 링크 대상과 npm 명령 이름을 실제 파일·package.json과 대조해 통과했다. 외부 Skills CLI 설치와 모든 외부 링크를 실제 사용해 본 것은 아니다. 브라우저 검사에서 구현의 프로덕션 화면 PNG 21개도 보존했다. 이번에는 운영 원본을 새로 캡처하지 않았으며, 이 PNG는 원본/구현 짝 비교가 아니다.

내려받은 원본 ZIP의 SHA-256이 Actions 기록과 일치했고, 코드 snapshot의 검토 대상 텍스트 167개가 로컬 검토본과 일치했다. 산출물 manifest 두 개도 바이트 단위로 같았다. 작성자가 변경 diff·경로 보호·워크플로 조건·실패 처리·문서와 로그를 자체 검토했다. 독립 코드 리뷰는 받지 않았다.

## 재현과 증거

```bash
npm ci
npx playwright install chromium firefox webkit
npm run test:build
npm run check
npm run check:browsers -- --out artifacts/browser-check
```

[빌드·CI 정책](build-and-ci.md)과 [전체 문서 안내](README.md)를 참고한다. Build readiness 워크플로는 수동 실행 또는 해당 작업 브랜치에서 재현하며 운영 사이트에 접속하지 않는다.

수정 후 artifact ID는 `13140740713`, 원본 ZIP SHA-256은 `c1f131af209a3a595fb6f52a61731fb3131958a0ae751a0a4435eb285fc897fc`다. 만료 예정은 2026-11-16 12:30:34 UTC다. check.log, build-tests.log, browsers/index.html, 엔진별 로그·PNG, baseline-files.sha256, current-files.sha256 및 reviewable code.tar.gz를 포함한다. 폰트 파일은 배포 증거에 포함하지 않는다.

## 남은 범위

실제 macOS Safari·물리 휴대폰·터치·Windows/macOS 실행·백엔드·원본 전체 모션은 이 작업으로 검증하지 않았다. 기존 의도적인 메뉴·아이콘·하단 링크 차이와 8px 높이 차이도 수정하지 않았다. 업데이트한 모든 수동 실사이트 워크플로의 실행 성공을 주장하지 않는다. 이번 성공 범위는 명시한 빌드·검사·문서·산출물 동일성이다.
