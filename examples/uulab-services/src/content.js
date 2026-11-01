/**
 * Editable content transcribed from the user-owned UULab services page.
 * Layout and interaction code are authored separately in render.js/styles.css.
 * Only /services/ is recreated; other observed destinations stay on uulab.co.kr.
 */
export const sourceOrigin = 'https://uulab.co.kr';

export const navigation = [
  { label: '홈', path: '/' },
  { label: '회사소개', path: '/about/' },
  { label: '서비스', path: '/services/' },
  { label: '포트폴리오', path: '/portfolio/' },
  { label: '인사이트', path: '/insights/' },
];

export const hero = {
  title: '서비스',
  description: '유유랩은 공개 웹 서비스, 브라우저 AI 도구, 실시간 인터랙션, 데이터 제품을 실제 운영 가능한 수준으로 구축합니다.',
};

export const services = [
  {
    icon: 'globe',
    title: '웹 서비스 구축',
    description: '브랜드 사이트를 넘어 실제 운영 가능한 웹 애플리케이션과 서비스형 제품을 구축합니다.',
    features: [
      '반응형 마케팅 사이트와 서비스 랜딩 구축',
      '운영 가능한 웹 애플리케이션 설계 및 개발',
      '계정, 관리자, 데이터 흐름, 동적 QR 같은 운영형 제품 구조 정리',
      '정적 배포와 경량 백엔드 기반 운영 구조 제안',
    ],
  },
  {
    icon: 'wand-magic-sparkles',
    title: '브라우저 AI · 도구 제품',
    description: '업로드 없는 브라우저 처리, 로컬 AI, 유틸리티 도구 같은 실험형 제품을 빠르게 제품화합니다.',
    features: [
      'WebGPU · WebAssembly 기반 브라우저 처리 경험 설계',
      '로컬 AI, 모델 탐색, 회의록·STT 실험형 프로토타입 구축',
      '파일, 문서, 데이터 유틸리티 제품 카탈로그 구성',
      '짧은 주기로 검증 가능한 공개 서비스 출시',
    ],
  },
  {
    icon: 'bolt',
    title: '실시간 상호작용 제품',
    description: '멀티플레이, 협업, 채팅, 참여형 인터랙션처럼 상태 동기화가 필요한 제품을 구현합니다.',
    features: [
      '실시간 채팅, 룸, 세션, 참여자 상태 설계',
      '협업 드로잉, 게임, 실험형 인터랙션 구현',
      '브라우저에서 즉시 체험 가능한 가벼운 진입 구조 설계',
      'Appwrite, Supabase, Cloudflare 기반 동기화 구조 구성',
    ],
  },
  {
    icon: 'chart-bar',
    title: '데이터 시각화 · 분석 경험',
    description: '숫자를 보여주는 것에 그치지 않고 사용자가 이해하고 판단할 수 있는 분석 화면을 만듭니다.',
    features: [
      '대시보드와 리포트형 정보 구조 설계',
      '차트, 비교, 필터, 요약 흐름이 있는 분석 화면 구축',
      '데이터 도구와 실험형 리서치 서비스 제품화',
      '브라우저 안에서 바로 쓸 수 있는 가벼운 도구 경험 구성',
    ],
  },
];

export const serviceScope = [
  '유유랩은 단순한 외주 제작사가 아니라, 서비스 기획부터 인터페이스 설계, 프론트엔드 구현, 데이터 연동, 배포 구조까지 한 흐름으로 정리하는 디지털 제품 스튜디오입니다. 기업 홈페이지, 운영 대시보드, 브라우저 기반 AI 도구, 데이터 시각화 서비스, 프로토타입 제품 등 실제 운영 가능한 웹 서비스를 구축합니다.',
  '특히 React, Astro, TypeScript, Vite, Tailwind CSS를 중심으로 빠른 프로토타이핑과 정적 배포 구조에 강점이 있으며, Appwrite, Supabase, Cloudflare 같은 경량 백엔드 및 배포 플랫폼과의 조합을 자주 사용합니다.',
  '프로젝트 성격에 따라 브라우저 AI, WebGPU, 데이터 시각화, 실시간 상호작용 같은 특수 기능도 함께 설계하며, 고객이 실제로 운영 가능한 수준까지 정보 구조와 제품 흐름을 다듬는 데 집중합니다.',
];

export const deliverableLabels = [
  '함께 정할 산출물',
  '완료를 확인하는 방법',
  '먼저 협의할 조건',
];

export const deliverables = [
  {
    question: '방문자가 회사의 작업과 문의 방법을 이해해야 하나요?',
    title: '브랜드·기업 홈페이지',
    description: '회사 소개, 서비스 범위, 사례 본문, 문의 동선을 하나의 구조로 정리합니다. 관리자가 자주 바꾸는 항목과 개발자가 관리할 항목을 먼저 나눠 정적 발행 또는 편집 도구의 필요성을 결정합니다.',
    details: [
      '페이지 구조도, 확정 원고와 이미지 목록, 반응형 화면, 메타데이터, 문의 연결, 콘텐츠 수정 안내를 협의합니다.',
      '모바일 메뉴에서 사례 본문과 문의처에 도달하고, 이미지가 로딩되지 않거나 자바스크립트가 꺼져도 주요 설명을 읽을 수 있는지 확인합니다.',
      '회원·결제·다국어 편집·기존 콘텐츠 이전은 자료량과 연동 방식에 따라 별도 범위를 정합니다.',
    ],
    link: { label: '유유랩의 운영 방식 보기', path: '/about/' },
  },
  {
    question: '사용자가 파일이나 텍스트를 넣고 결과를 가져가야 하나요?',
    title: '브라우저 파일·AI 도구',
    description: '대표 입력 한 가지와 기대 출력부터 정하고 파일 선택, 처리 상태, 결과 검토, 다운로드를 연결합니다. 모델 준비 시간이 있는 제품은 첫 방문과 캐시 재사용 흐름을 나눕니다.',
    details: [
      '입력·출력 명세, 지원 환경 안내, 처리 위치 설명, 오류와 재시도 흐름, 대표 샘플과 결과 비교표를 협의합니다.',
      '정상 입력 외에 미지원 형식과 처리 중단을 확인하고, 실패한 뒤에도 원본을 보존하거나 다시 시작할 수 있는지 점검합니다.',
      '온디바이스 실행과 외부 API 사용은 처리 위치·운영 비용이 다르므로 사전에 선택합니다. 모든 기기에서 같은 모델 속도를 전제로 하지 않습니다.',
    ],
    link: { label: 'Meetlog 처리·보존 설계 보기', path: '/portfolio/meetlog/' },
  },
  {
    question: '여러 사람이 같은 상태를 보고 참여해야 하나요?',
    title: '참여형·실시간 웹 제품',
    description: '참여자 역할, 서버가 확정할 상태, 공개 정보와 개인 정보를 먼저 구분합니다. 연결 중단, 중복 요청, 방 종료처럼 정상 화면만으로 설명되지 않는 상황도 설계에 포함합니다.',
    details: [
      '역할·권한표, 상태 전이도, 세션과 만료 규칙, 재접속 시나리오, 운영자가 확인할 이벤트 항목을 협의합니다.',
      '동시 접근과 새로고침에서 결과가 일관되고 다른 사용자의 비공개 정보가 전달되지 않는지 확인합니다. 목표 동시 접속 규모의 부하 시험은 별도 조건을 정합니다.',
      '비회원 서비스의 브라우저 식별과 계정 기반 기기 간 동기화는 다릅니다. 어떤 범위로 결과를 유지할지 제품 목적에 맞춰 결정합니다.',
    ],
    link: { label: 'NTH 순번·재방문 설계 보기', path: '/portfolio/nth/' },
  },
  {
    question: '숫자를 보여주는 것에서 실제 비교와 판단으로 이어져야 하나요?',
    title: '데이터 비교·시각화 화면',
    description: '누가 어떤 질문에 답할지 정한 뒤 원본 필드, 단위, 기간, 결측 규칙을 정의합니다. 데이터 수집과 화면 표시, 사람이 작성하는 해설의 역할을 분리합니다.',
    details: [
      '데이터 필드 정의, 원천·갱신 기준, 필터와 비교 화면, 빈 상태와 오류 안내, 계산 예시를 협의합니다.',
      '같은 조건의 값만 비교하는지, 단위를 바꾸면 표시도 함께 바뀌는지, 누락을 0으로 오해하게 만들지 않는지 샘플로 대조합니다.',
      '원천 데이터의 제공 범위와 이용 조건, 수집 주기는 착수 전에 확인합니다. 차트 구현만으로 원천의 정확성이나 실시간 갱신이 확보되는 것은 아닙니다.',
    ],
    link: { label: 'LLMFit 사양 비교 사례 보기', path: '/portfolio/llmfit/' },
  },
];

export const technologies = [
  { title: '프론트엔드', color: 'blue', items: ['Astro', 'React', 'TypeScript', 'Vite', 'Tailwind CSS'] },
  { title: '백엔드 · 데이터', color: 'green', items: ['Appwrite', 'Supabase', 'Node.js'] },
  { title: '실험형 기술', color: 'cyan', items: ['WebGPU', 'WebAssembly', 'WebLLM', 'MediaPipe'] },
  { title: '배포 · 시각화', color: 'yellow', items: ['Cloudflare', 'Recharts', 'Three.js', 'Fabric.js'] },
];

export const processSteps = [
  { icon: 'lightbulb', title: '1. 질문 정의', description: '대상 사용자, 핵심 작업과 완료 조건을 한 문장으로 좁힙니다.' },
  { icon: 'palette', title: '2. 흐름과 경계', description: '입력·결과·빈 상태·권한·실패 상황을 화면 흐름으로 정리합니다.' },
  { icon: 'code', title: '3. 구현과 대조', description: '공개 가능한 샘플과 실제 동작을 대조해 범위와 제한을 기록합니다.' },
  { icon: 'rocket', title: '4. 공개와 인수인계', description: '배포 경로, 수정 방법, 운영자가 다시 확인할 문서를 함께 남깁니다.' },
];

export const projects = [
  {
    id: 'ai-studio', title: 'AI Studio', image: '/assets/ai-studio.png',
    subtitle: '브라우저 안에서 끝나는 프라이버시 중심 올인원 툴 스위트',
    description: '이미지, 비디오, PDF, 데이터 작업을 서버 업로드 없이 처리하는 브라우저 기반 생산성 웹 앱',
    technologies: ['React', 'TypeScript', 'Vite'], more: 4, duration: '1개월',
  },
  {
    id: 'gpu-playground', title: 'GPU Playground', image: '/assets/gpu-playground.png',
    subtitle: '브라우저에서 실시간으로 실행하는 WebGPU 시뮬레이션 & 벤치마크',
    description: '파티클, 프랙탈, 보이드, 레이마칭 등 다양한 GPU 시뮬레이션을 실시간으로 실행하는 WebGPU 실험 플랫폼',
    technologies: ['React', 'TypeScript', 'Vite'], more: 3, duration: '1개월',
  },
  {
    id: 'blogpilot', title: 'BlogPilot', image: '/assets/blogpilot.png',
    subtitle: '템플릿 기반 AI 블로그 자동화 스튜디오',
    description: '고정 템플릿 구조에 제목, 카피, FAQ, CTA, 이미지를 교체해 브랜드 블로그를 자동 운영하는 웹 서비스',
    technologies: ['Appwrite', 'React', 'TypeScript'], more: 2, duration: '2개월',
  },
];

export const questions = [
  {
    question: '아이디어만 있어도 상담할 수 있나요?',
    answer: '대상 사용자, 가장 먼저 끝내고 싶은 작업, 참고 화면을 알려주시면 초기 범위를 논의할 수 있습니다. 기능 목록이 길다면 대표 사용 흐름 한 가지를 먼저 정하고 나머지는 우선순위로 나눕니다.',
  },
  {
    question: '일정과 비용은 무엇을 기준으로 정하나요?',
    answer: '화면 수만으로 계산하지 않고 역할과 권한, 외부 연동, 데이터 이전, 지원 환경, 필요한 검증 범위를 함께 봅니다. 원고·디자인·접근 권한 등 제공 자료의 준비 상태도 일정에 영향을 주므로 실제 범위 확인 후 협의합니다.',
  },
  {
    question: '배포 후 콘텐츠나 기능은 어떻게 수정하나요?',
    answer: '수정 빈도에 맞춰 저장소에서 관리할 내용과 편집 화면에서 바꿀 내용을 나눕니다. 계정 소유 주체, 자동 배포, 수정 이력과 복구 방법, 유지보수 범위를 인수인계 때 정리합니다.',
  },
  {
    question: '기존 서비스 일부만 개선할 수도 있나요?',
    answer: '가능한 개선 범위는 현재 구조와 접근 가능한 자료를 본 뒤 정합니다. 예를 들어 입력 오류 복구, 모바일 탐색, 결과 내보내기처럼 사용자가 막히는 흐름을 특정하면 필요한 수정과 확인 항목을 작게 나눌 수 있습니다.',
  },
];

export const footerLinks = [
  ...navigation,
  { label: '콘텐츠 지도', path: '/content-map/' },
  { label: '편집 원칙', path: '/editorial-policy/' },
];

export const legalLinks = [
  { label: '개인정보처리방침', path: '/privacy/' },
  { label: '이용약관', path: '/terms/' },
  { label: '콘텐츠 지도', path: '/content-map/' },
  { label: '편집 원칙', path: '/editorial-policy/' },
];
