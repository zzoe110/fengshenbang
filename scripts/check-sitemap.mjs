// scripts/check-sitemap.mjs
// 部署后自动校验：线上 sitemap 是否完整收录"应收录"的页面，且无误收录 / 死链。
// 触发：GitHub Actions（push main 后等待部署完成 / 每日定时 / 手动），或本地 `node scripts/check-sitemap.mjs`
//
// 设计要点：
//  - "应收录"集合 = 固定栏目页（与 build.js buildSitemap() 的 urls 数组保持一致） + data/*.json 里的案例/博客详情页
//  - tool/ 内部员工工具、baidu_verify / ByteDanceVerify 验证文件 属于"应排除"项，一旦被收录即告警
//  - push 触发时先做"等待部署"轮询（线上 sitemap 的 lastmod >= 今天 视为已部署最新），避免时序误报

import fs from 'node:fs';

const DOMAIN = 'https://www.fsbtop.top';

// 固定栏目页（与 build.js 的 urls 数组保持一致；tool/ 与验证文件有意不收录）
const STATIC_PAGES = [
  '/',
  '/services.html',
  '/blog.html',
  '/cases.html',
  '/about.html',
  '/contact.html',
];

const EXCLUDE_PATTERN = /(^|\/)tool\//.source + '|' + /(baidu_verify|ByteDanceVerify)/.source;
const DANGER_RE = new RegExp(EXCLUDE_PATTERN);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fullUrl = (p) => DOMAIN + (p === '/' ? '/' : p);

function expectedUrls() {
  const set = new Set(STATIC_PAGES.map(fullUrl));
  try {
    const cases = JSON.parse(fs.readFileSync('data/cases.json', 'utf8')).cases || [];
    cases.forEach((c) => { if (c && c.id) set.add(fullUrl('/cases/' + c.id + '.html')); });
  } catch (e) { console.warn('读取 data/cases.json 失败:', e.message); }
  try {
    const blog = JSON.parse(fs.readFileSync('data/blog.json', 'utf8')).blog || [];
    blog.forEach((b) => { if (b && b.id) set.add(fullUrl('/blog/' + b.id + '.html')); });
  } catch (e) { console.warn('读取 data/blog.json 失败:', e.message); }
  return set;
}

async function fetchSitemap() {
  const res = await fetch(DOMAIN + '/sitemap.xml', { redirect: 'follow' });
  if (!res.ok) throw new Error('sitemap HTTP ' + res.status);
  return await res.text();
}

function parseLocs(xml) {
  const locs = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) locs.push(m[1].trim());
  return locs;
}

// 等待 EdgeOne 部署完成：线上 sitemap 的 lastmod >= 今天 视为已部署最新
async function waitForDeploy(maxMs = 300000) {
  const today = new Date().toISOString().slice(0, 10);
  const start = Date.now();
  let xml = '';
  while (Date.now() - start < maxMs) {
    try { xml = await fetchSitemap(); } catch { xml = ''; }
    const m = xml.match(/<lastmod>([\d-]+)<\/lastmod>/);
    if (m && m[1] >= today) return xml;
    await sleep(10000);
  }
  // 超时仍返回最新抓到的（可能是部署慢），继续校验
  try { return await fetchSitemap(); } catch { return xml; }
}

async function main() {
  console.log('[check-sitemap] 等待部署完成...');
  const xml = await waitForDeploy();
  if (!xml) {
    console.error('❌ 无法获取线上 sitemap，终止校验');
    process.exit(2);
  }
  const locs = parseLocs(xml);
  const sitemapSet = new Set(locs);
  const expected = expectedUrls();

  const missing = [...expected].filter((u) => !sitemapSet.has(u));

  const dead = [];
  for (const u of expected) {
    try {
      const r = await fetch(u, { method: 'HEAD' });
      if (r.status >= 400) dead.push(u + ' (' + r.status + ')');
    } catch (e) { dead.push(u + ' (ERR ' + e.message + ')'); }
  }

  // 误收录：sitemap 含但不在期望集合，且属于危险项（tool/、验证文件）
  const danger = [...sitemapSet].filter((u) => DANGER_RE.test(u));
  const extra = [...sitemapSet].filter((u) => !expected.has(u) && !DANGER_RE.test(u));

  console.log('期望收录: ' + expected.size + '  实际 sitemap: ' + locs.length);
  let ok = true;
  if (missing.length) { ok = false; console.log('\n❌ 漏收录（应收录但 sitemap 缺失）:'); missing.forEach((u) => console.log('  ' + u)); }
  if (dead.length) { ok = false; console.log('\n❌ 死链/不可达:'); dead.forEach((u) => console.log('  ' + u)); }
  if (danger.length) { ok = false; console.log('\n❌ 误收录（应排除却进了 sitemap）:'); danger.forEach((u) => console.log('  ' + u)); }
  if (extra.length) { console.log('\n⚠️ 额外收录（不在期望列表，请确认是否合法）:'); extra.forEach((u) => console.log('  ' + u)); }

  if (ok) {
    console.log('\n✅ sitemap 一致性校验通过');
    process.exit(0);
  } else {
    console.log('\n❌ 校验未通过，请检查 build.js 或确认部署已生效');
    process.exit(1);
  }
}

main().catch((e) => { console.error('脚本异常:', e); process.exit(2); });
