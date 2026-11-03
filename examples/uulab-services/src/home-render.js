import { homeContent as content } from './home-content.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const destination = path => path === '/services/' ? path : path === '/' ? '/home/' : `https://uulab.co.kr${path}`;
const arrow = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>';
const svg = paths => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">${paths.map(d=>`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${escape(d)}"/>`).join('')}</svg>`;
const link = (path,label,className='') => `<a class="${className}" href="${escape(destination(path))}">${escape(label)}</a>`;
const rich = parts => parts.map(p=>p.href ? link(p.href,p.text,'home-inline-link') : escape(p.text)).join('');
const heading = (id,group,extra='') => `<div class="home-heading ${extra}"><h2 id="${id}">${escape(group.title)}</h2><p>${escape(group.description)}</p></div>`;
const action = (path,label,secondary=false) => `<a class="home-button${secondary?' home-button--secondary':''}" href="${escape(destination(path))}">${escape(label)}${arrow}</a>`;

/** Static, editable semantic content. Source scripts are not included. */
export function renderHomeMain(projectCards) {
  return `<main id="main-content" class="home-page" tabindex="-1">
  <section class="home-hero" aria-labelledby="home-title">
    <div class="home-hero-background" aria-hidden="true"><span></span><span></span></div>
    <div class="home-container home-hero-content">
      <div class="home-eyebrow"><span aria-hidden="true"></span>${escape(content.hero.eyebrow)}</div>
      <h1 id="home-title"><span>${escape(content.hero.lines[0])}</span><span class="home-gradient-text">${escape(content.hero.lines[1])}</span></h1>
      <p class="home-hero-copy">${escape(content.hero.description)}</p>
      <div class="home-actions">${action('/portfolio/','대표 사례 보기')}${action('/services/','서비스 범위 확인',true)}</div>
      <div class="home-stats">${content.hero.stats.map(([value,label])=>`<div><strong>${escape(value)}</strong><span>${escape(label)}</span></div>`).join('')}</div>
    </div><div class="home-scroll-hint" aria-hidden="true"><span></span></div>
  </section>
  <section class="home-section home-section--compact home-intro" aria-labelledby="home-intro-title"><div class="home-container home-intro-grid">
    <div class="home-intro-copy"><h2 id="home-intro-title">${escape(content.intro.title)}</h2><div>${content.intro.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</div></div>
    <div class="home-asides">${content.intro.cards.map(c=>`<article><h3>${escape(c.title)}</h3><p>${rich(c.copy)}</p></article>`).join('')}</div>
  </div></section>
  <section class="home-section home-section--compact home-journey" aria-labelledby="home-journey-title"><div class="home-container">
    <div class="home-introduction"><p class="home-kicker">공개 자료 읽는 법</p><h2 id="home-journey-title">${escape(content.journey.title)}</h2><p>${escape(content.journey.description)}</p></div>
    <div class="home-journey-grid">${content.journey.cards.map((c,i)=>`<article><span class="home-number">0${i+1}</span><h3>${escape(c.title)}</h3><p>${escape(c.description)}</p>${link(c.link.href,c.link.label,'home-journey-link')}</article>`).join('')}</div>
  </div></section>
  <section class="home-section home-muted" aria-labelledby="home-decisions-title"><div class="home-container">${heading('home-decisions-title',content.decisions)}
    <div class="home-decisions-grid">${content.decisions.cards.map((c,i)=>`<article class="home-decision home-tone-${i}"><div class="home-icon">${svg(c.icon)}</div><h3>${escape(c.title)}</h3><p>${escape(c.description)}</p>${link(c.link.href,c.link.label,'home-card-link')}</article>`).join('')}</div>
  </div></section>
  <section class="home-section" aria-labelledby="home-solutions-title"><div class="home-container">${heading('home-solutions-title',content.solutions)}
    <div class="home-solutions-grid">${content.solutions.cards.map((c,i)=>`<article class="home-solution home-solution-tone-${i}"><div class="home-icon">${svg(c.icon)}</div><h3>${escape(c.title)}</h3><p>${escape(c.description)}</p><div class="home-tags">${c.tags.map(t=>`<span>${escape(t)}</span>`).join('')}</div></article>`).join('')}</div>
    <div class="home-more">${action('/services/','서비스 범위 상세 보기')}</div>
  </div></section>
  <section class="home-section home-muted" aria-labelledby="home-projects-title"><div class="home-container">${heading('home-projects-title',content.projects)}
    <div class="projects-grid">${projectCards}</div><div class="home-more">${action('/portfolio/','모든 프로젝트 보기')}</div>
  </div></section>
  <section class="home-section home-insights" aria-labelledby="home-insights-title"><div class="home-container">${heading('home-insights-title',content.insights,'home-heading--insights')}
    <div class="home-principles">${content.insights.principles.map(c=>`<div><p class="home-principle-title">${escape(c.title)}</p><p>${escape(c.description)}</p></div>`).join('')}</div>
    <div class="home-insights-grid">${content.insights.articles.map(c=>`<article><div class="home-insight-tags">${c.tags.map(t=>`<span>${escape(t)}</span>`).join('')}</div><h3>${link(c.href,c.title)}</h3><p class="home-insight-date">${escape(c.date)}</p><p class="home-insight-note">${escape(c.note)}</p><p class="home-insight-description">${escape(c.description)}</p>${link(c.href,'글 읽기','home-inline-link')}</article>`).join('')}</div>
    <div class="home-more">${action('/insights/','인사이트 전체 보기')}</div>
  </div></section>
  <section class="home-section home-section--compact home-questions" aria-labelledby="home-questions-title"><div class="home-container">
    <div class="home-introduction"><p class="home-kicker">처음 방문하셨다면</p><h2 id="home-questions-title">${escape(content.questions.title)}</h2><p>${escape(content.questions.description)}</p></div>
    <div class="home-questions-grid">${content.questions.cards.map(c=>`<article><h3>${escape(c.title)}</h3><p>${escape(c.description)}</p></article>`).join('')}</div>
    <div class="home-question-links">${link('/services/','서비스 범위 보기 →','home-small-button')}${link('/content-map/','전체 콘텐츠 지도 →','home-small-button home-small-button--secondary')}</div>
  </div></section>
  <section class="home-section home-contact" aria-labelledby="home-contact-title"><div class="home-container"><div class="home-contact-inner">
    <h2 id="home-contact-title">${escape(content.contact.lines[0])}<br><span>${escape(content.contact.lines[1])}</span></h2><p class="home-contact-copy">${escape(content.contact.description)}</p>
    <div class="home-actions">${action('/contact/','프로젝트 문의하기',true)}${action('/portfolio/','포트폴리오 보기')}</div>
    <div class="home-contact-grid">${content.contact.cards.map(c=>`<div><div class="home-icon">${svg(c.icon)}</div><h3>${escape(c.title)}</h3><p>${escape(c.description)}</p></div>`).join('')}</div>
  </div></div></section>
  </main>`;
}
