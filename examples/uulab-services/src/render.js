import { renderHomeMain } from './home-render.js';
import {
  sourceOrigin, navigation, hero, services, serviceScope, deliverableLabels,
  deliverables, technologies, processSteps, projects, questions, footerLinks, legalLinks,
} from './content.js';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const href = (path) => path === '/' ? '/home/' : path === '/services/' ? path : `${sourceOrigin}${path}`;
const icon = (name, extraClass = '') => `<i class="fas fa-${escapeHtml(name)} ${extraClass}" aria-hidden="true"></i>`;
const link = ({ label, path }, className = '', currentPage = 'services') => `<a href="${href(path)}"${className ? ` class="${className}"` : ''}${path === (currentPage === 'home' ? '/' : '/services/') ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`;

// These small control SVG paths are the observed source icons, kept as SVG so
// their shape and dimensions remain consistent without adding an icon package.
const sunPath = 'M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414 1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z';

function themeButton(id, mobile = false) {
  return `<button type="button" id="${id}" class="theme-toggle${mobile ? ' theme-toggle--mobile' : ''}" aria-label="다크모드 토글" aria-pressed="false" data-theme-toggle hidden>
    <svg class="sun-icon" aria-hidden="true" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="${sunPath}"></path></svg>
    <svg class="moon-icon" aria-hidden="true" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
  </button>`;
}

function navigationMarkup(currentPage = 'services') {
  return `<a class="skip-link" href="#main-content">본문 바로가기</a>
  <div class="particles" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
  <header class="navbar" id="navigation">
    <div class="container navbar-container">
      <nav class="navbar-row" aria-label="주요 탐색">
        <a class="brand" href="/home/"><img src="/assets/logo.png" alt="유유랩 로고" width="40" height="40"><span>유유랩</span></a>
        <div class="desktop-navigation">
          <div class="navigation-links">${navigation.map((item) => link(item, 'nav-link', currentPage)).join('\n')}</div>
          ${themeButton('darkModeToggle')}
          <a class="button" href="${sourceOrigin}/contact/">${icon('paper-plane')}문의하기</a>
        </div>
        <div class="mobile-controls">
          ${themeButton('darkModeToggleMobile', true)}
          <button class="navbar-toggler" type="button" aria-label="메뉴 열기" aria-controls="mobile-navigation" aria-expanded="false" hidden>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
        </div>
      </nav>
      <nav id="mobile-navigation" class="mobile-navigation" aria-label="모바일 메뉴" aria-hidden="true" hidden inert>
        ${[...navigation, { label: '문의하기', path: '/contact/' }].map((item) => link(item, 'nav-link-mobile', currentPage)).join('\n')}
      </nav>
    </div>
  </header>`;
}

function sectionHeading(id, title, subtitle) {
  return `<div class="section-heading"><h2 class="section-title" id="${id}">${escapeHtml(title)}</h2><p class="section-subtitle">${escapeHtml(subtitle)}</p></div>`;
}

function serviceMarkup(service) {
  return `<article class="service-card">
    <div class="service-icon">${icon(service.icon)}</div>
    <div class="service-body"><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description)}</p>
      <ul class="feature-list">${service.features.map((feature) => `<li>${icon('check')}<span>${escapeHtml(feature)}</span></li>`).join('')}</ul>
    </div>
  </article>`;
}

function deliverableMarkup(deliverable) {
  return `<article class="deliverable-card" data-service-deliverable>
    <p class="deliverable-question">${escapeHtml(deliverable.question)}</p>
    <h3>${escapeHtml(deliverable.title)}</h3>
    <p class="deliverable-description">${escapeHtml(deliverable.description)}</p>
    <dl>${deliverable.details.map((detail, index) => `<div><dt>${escapeHtml(deliverableLabels[index])}</dt><dd>${escapeHtml(detail)}</dd></div>`).join('')}</dl>
    <a class="detail-link" href="${href(deliverable.link.path)}">${escapeHtml(deliverable.link.label)}<span aria-hidden="true">→</span></a>
  </article>`;
}

function projectMarkup(project) {
  return `<article class="project-card" id="project-${project.id}">
    <a class="project-link" href="${sourceOrigin}/portfolio/${project.id}/" aria-label="${escapeHtml(project.title)} 서비스 설명과 상세 보기"></a>
    <div class="project-media">
      <img src="${project.image}" alt="${escapeHtml(project.title)}" width="1600" height="900" loading="lazy" decoding="async">
      <div class="project-badge project-badge--category"><span>웹 개발</span></div>
      <div class="project-badge project-badge--featured"><span>추천</span></div>
    </div>
    <div class="project-body">
      <h3>${escapeHtml(project.title)}</h3>
      <p class="project-subtitle">${escapeHtml(project.subtitle)}</p>
      <p class="project-description">${escapeHtml(project.description)}</p>
      <div class="project-technologies">${project.technologies.map((technology) => `<span>${escapeHtml(technology)}</span>`).join('')}<span class="more-technologies">+${project.more}</span></div>
      <div class="project-meta"><span>${project.duration}</span><span>신규 구축</span></div>
    </div>
  </article>`;
}

function footerMarkup(currentPage = 'services') {
  return `<footer class="site-footer">
    <div class="container footer-content">
      <div class="footer-grid">
        <div class="footer-about">
          <p class="footer-brand"><img src="/assets/logo.png" alt="유유랩 로고" width="32" height="32" loading="lazy"><span>유유랩</span></p>
          <p class="footer-description">공개 웹 서비스와 브라우저 기반 도구를 직접 만들며,<br>실제 화면과 운영 기록으로 설명 가능한 제품을 쌓아갑니다.</p>
          <a class="github-link" href="https://github.com/uulab-official" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><i class="fab fa-github" aria-hidden="true"></i></a>
        </div>
        <div><h2>바로가기</h2><nav class="footer-navigation" aria-label="바로가기">${footerLinks.map((item) => link(item, '', currentPage)).join('\n')}</nav></div>
        <div><h2>연락처</h2>
          <div class="contact-email">${icon('envelope')}<a href="mailto:uulab.official@gmail.com">uulab.official@gmail.com</a></div>
          <div class="business-details"><p>대표 최태호</p><p>사업자등록번호 345-08-03022</p><p>사업장 소재지 경기도 성남시 중원구 둔촌대로 154</p><a href="${sourceOrigin}/terms/">사업자 정보 보기</a></div>
        </div>
      </div>
      <hr>
      <div class="footer-bottom"><p>© 2026 유유랩. 모든 권리 보유.</p><nav class="legal-links" aria-label="법적 고지">${legalLinks.map((item) => link(item, '', currentPage)).join('\n')}</nav></div>
    </div>
  </footer>`;
}

/** Called by the Vite HTML transform, never by the browser. */
export function renderPage({ page = 'services' } = {}) {
  if (page !== 'home' && page !== 'services') throw new Error('Unknown example page');
  if (page === 'home') return `${navigationMarkup('home')}
    <div class="scroll-progress" data-scroll-progress aria-hidden="true" hidden></div>
    ${renderHomeMain(projects.map(projectMarkup).join('\n'))}
    ${footerMarkup('home')}
    <button id="backToTopButton" class="back-to-top" type="button" aria-label="맨 위로" hidden>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
    </button>`;
  return `${navigationMarkup()}
  <div class="scroll-progress" data-scroll-progress aria-hidden="true" hidden></div>
  <main id="main-content" tabindex="-1">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-background" aria-hidden="true"></div>
      <div class="container hero-container">
        <div class="hero-grid"><div><h1 id="hero-title">${hero.title}</h1><p>${hero.description}</p></div>
          <div class="hero-symbol"><div class="hero-disc">${icon('cogs')}</div></div>
        </div>
      </div>
    </section>
    <section class="section surface" aria-labelledby="services-title">
      <div class="container">${sectionHeading('services-title', '주요 서비스', '현재 포트폴리오에서 실제로 확인 가능한 구축 범위를 기준으로 정리했습니다')}
        <div class="services-grid">${services.map(serviceMarkup).join('\n')}</div>
      </div>
    </section>
    <section class="section surface-muted" aria-labelledby="scope-title">
      <div class="container container--scope"><div class="scope-card"><h2 id="scope-title">유유랩이 제공하는 서비스 범위</h2><div class="scope-copy">${serviceScope.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div></div></div>
    </section>
    <section class="section surface" aria-labelledby="delivery-title">
      <div class="container container--deliverables">
        <div class="delivery-intro"><h2 id="delivery-title">어떤 작업을 맡기고, 무엇을 받게 되나요?</h2><p>프로젝트 성격에 따라 협의하는 작업 범위와 산출물 예시입니다. 실제 제공 항목과 일정은 요구사항을 확인한 뒤 정하며, 포트폴리오에서 각 설계 주제의 구현 사례를 함께 볼 수 있습니다.</p></div>
        <div class="deliverables-grid" data-service-deliverables>${deliverables.map(deliverableMarkup).join('\n')}</div>
      </div>
    </section>
    <section class="section surface-muted" aria-labelledby="technology-title">
      <div class="container">${sectionHeading('technology-title', '기술 스택', '실제 공개 프로젝트에서 반복적으로 사용한 기술 중심으로 정리했습니다')}
        <div class="four-column-grid technology-grid">${technologies.map((group) => `<div><h3>${escapeHtml(group.title)}</h3><div class="technology-pills technology-pills--${group.color}">${group.items.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div></div>`).join('')}</div>
      </div>
    </section>
    <section class="section surface" aria-labelledby="process-title">
      <div class="container">${sectionHeading('process-title', '개발과 검증의 순서', '정상 흐름뿐 아니라 지원 범위, 실패 조건, 운영자가 확인할 근거까지 순서대로 정리합니다')}
        <div class="four-column-grid process-grid">${processSteps.map((step) => `<div><div class="process-icon">${icon(step.icon)}</div><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.description)}</p></div>`).join('')}</div>
      </div>
    </section>
    <section class="section surface-muted" aria-labelledby="projects-title">
      <div class="container">${sectionHeading('projects-title', '대표 프로젝트 사례', '실제 구축한 서비스 사례를 통해 유유랩의 개발 범위를 확인할 수 있습니다')}
        <div class="projects-grid">${projects.map(projectMarkup).join('\n')}</div>
        <div class="all-projects"><a href="${sourceOrigin}/portfolio/">전체 포트폴리오 보기${icon('arrow-right')}</a></div>
      </div>
    </section>
    <section class="section surface" aria-labelledby="faq-title">
      <div class="container container--faq"><h2 id="faq-title">상담 전에 자주 확인하는 내용</h2>
        <div class="faq-list">${questions.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('\n')}</div>
      </div>
    </section>
    <section class="section contact-section" aria-labelledby="contact-title">
      <div class="container"><h2 id="contact-title">프로젝트를 시작해보세요</h2><p>공개 사례와 필요한 작업 범위를 확인한 뒤, 현재 단계에 맞는 문의를 남겨주세요.</p><a class="button" href="${sourceOrigin}/contact/">${icon('paper-plane')}프로젝트 범위 문의</a></div>
    </section>
  </main>
  ${footerMarkup()}
  <button id="backToTopButton" class="back-to-top" type="button" aria-label="맨 위로" hidden>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
  </button>`;
}
