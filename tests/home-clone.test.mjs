import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderPage } from '../examples/uulab-services/src/render.js';

const home = () => renderPage({ page: 'home' });
test('home is an authored second page, not the existing services alias', () => {
  const html = home();
  assert.match(html, /브라우저에서 바로/);
  assert.match(html, /디지털 제품/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(html, /<iframe|<canvas|<script\b/i);
});
test('home includes full observed body sections rather than a hero-only placeholder', () => {
  const html = home();
  for (const text of ['기능 뒤에 남는 질문까지 설계합니다', '제품을 보고, 근거를 읽고, 기준을 확인하세요', '세 가지 제품, 서로 다른 설계 결정', '실제로 확인할 수 있는 작업 범위', '유유랩과 공개 사례를 이해하는 질문', '성공 사례', '추천 인사이트', '운영 가능한 웹 제품을']) assert.ok(html.includes(text), text);
});
test('home and services navigate locally and each marks its own current page', () => {
  for (const page of ['home','services']) {
    const html = renderPage({page});
    const active = [...html.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)].map(m=>m[0]);
    assert.ok(active.length >= 2);
    assert.ok(active.every(tag => tag.includes(`href="/${page}/"`)), `${page} active links`);
    assert.ok(html.includes('href="/home/"'));
    assert.ok(html.includes('href="/services/"'));
    assert.ok(html.includes('href="https://uulab.co.kr/portfolio/"'));
  }
});
test('the historical default remains the services page', () => {
  assert.match(renderPage(), /<h1[^>]*>서비스<\/h1>/);
  assert.match(renderPage(), /상담 전에 자주 확인하는 내용/);
});
test('home has unique identifiers, one main region and shared progressive controls', () => {
  const html=home();
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal((html.match(/<main\b/g)||[]).length,1);
  assert.match(html, /class="home-page"/);
  for(const id of ['main-content','mobile-navigation','darkModeToggle','backToTopButton']) assert.ok(ids.includes(id));
});
test('the homepage is an explicit noindex build entry with scoped CSS', async () => {
  const config=await readFile(new URL('../examples/uulab-services/vite.config.js',import.meta.url),'utf8');
  assert.match(config, /home\/index\.html/);
  const html=await readFile(new URL('../examples/uulab-services/home/index.html',import.meta.url),'utf8');
  assert.match(html, /name="robots" content="noindex"/);
  assert.match(html, /uulab:home/);
  assert.match(html, /home\.css/);
});
test('normal cross-browser checks include the new homepage regressions', async () => {
  const checker = await readFile(new URL('../scripts/check-browsers.mjs', import.meta.url), 'utf8');
  assert.match(checker, /'tests\/home-browser\.test\.mjs'/);
});
