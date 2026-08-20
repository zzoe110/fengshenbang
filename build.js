#!/usr/bin/env node
/**
 * 烽审榜 SSG 生成器（零依赖，仅用 Node 内置模块）
 * ------------------------------------------------------------
 * 为每篇「客户案例 / 博客文章」生成独立静态 HTML 详情页，
 * 自带完整独立 SEO（title / description / keywords / canonical / og:*），
 * 正文直接写进 HTML（不依赖 JS 渲染），让不执行 JS 的爬虫
 * （百度、ChatGPT、国内 AI 搜索、社交分享）也能抓到真实内容。
 *
 * 用法：node build.js
 * 输出：cases/<id>.html  blog/<id>.html  sitemap.xml
 *
 * 配合 .github/workflows/build.yml：push 到 main 时自动运行，
 * 把生成的静态页 commit 回仓库，EdgeOne（无构建）直接托管。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DOMAIN = 'https://www.fsbtop.top';

const SITE = {
  name: '烽审榜',
  fullName: '兴义市烽审榜技术咨询服务行',
  author: '外行澯烽哥',
  email: 'contact@fengshenbang.com',
  logo: 'assets/images/logo.png',
  ogImage: 'assets/images/og-default.png', // 默认社交分享图（见任务：生成 og:image）
  icp: '黔ICP备2026013377号',
  navItems: [
    { key: 'home', label: '首页', href: 'index.html' },
    { key: 'services', label: '主营业务', href: 'services.html' },
    { key: 'blog', label: '博客文章', href: 'blog.html' },
    { key: 'cases', label: '客户案例', href: 'cases.html' },
    { key: 'about', label: '关于我们', href: 'about.html' },
    { key: 'contact', label: '联系我们', href: 'contact.html' },
    { key: 'tool', label: '工具', href: 'tool/index.html' }
  ],
  footerServices: [
    { label: '企业品牌运营', href: 'services.html#brand-operations' },
    { label: '口腔运营', href: 'services.html#dental-operations' },
    { label: '口腔GEO', href: 'services.html#dental-geo' },
    { label: 'AI落地赋能', href: 'services.html#ai-empowerment' }
  ],
  footerContact: [
    { label: '邮箱咨询', href: 'mailto:contact@fengshenbang.com', email: true },
    { label: '联系我们', href: 'contact.html' },
    { label: '关于我们', href: 'about.html' },
    { label: '后台登录', href: 'admin/login.html' }
  ]
};
SITE.friendLinks = readJson('data/friendlinks.json') || []; // 友情链接（后台可管理）

// 站点级 JSON-LD（Organization + Person 双实体），静态写进每个详情页 <head>，
// 让不执行 JS 的 AI 爬虫（百度 / ChatGPT / 文心 / 豆包 / DeepSeek）也能读取实体关系。
// 与 main.js injectJSONLD 结构一致，但用绝对 URL（schema.org 最佳实践）。

// 字节跳动 TTZZ 收录辅助（push.js）：注入每个详情页 <head>，浏览时自动被蜘蛛爬取，提升收录概率。
const TTZZ_SCRIPT = `<script>
(function(){
var el = document.createElement("script");
el.src = "https://lf1-cdn-tos.bytegoofy.com/goofy/ttzz/push.js?27db1be7c9185e037665c3fff17bc969114b243c37dcfe3ff4125fdf92a1e9dbfd9a9dcb5ced4d7780eb6f3bbd089073c2a6d54440560d63862bbf4ec01bba3a";
el.id = "ttzz";
var s = document.getElementsByTagName("script")[0];
s.parentNode.insertBefore(el, s);
})(window)
</script>`;

const SITE_JSONLD = `<script type="application/ld+json" id="fsb-static-jsonld">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "name": "兴义市烽审榜技术咨询服务行",
      "alternateName": "烽审榜",
      "url": "https://www.fsbtop.top/",
      "logo": "https://www.fsbtop.top/assets/images/logo.png",
      "description": "兴义市烽审榜技术咨询服务行（商标「烽审榜」）提供企业品牌运营、口腔内外运营、口腔GEO优化、AI落地赋能、传统企业策划与YouTuber出海服务，覆盖品牌定位、AI搜索优化、智能体开发全链路，已服务150+客户、满意度98%。",
      "slogan": "从品牌到AI，助力企业破局增长",
      "foundingLocation": { "@type": "Place", "name": "贵州省兴义市" },
      "areaServed": [
        { "@type": "AdministrativeArea", "name": "贵州省" },
        { "@type": "AdministrativeArea", "name": "兴义市" },
        { "@type": "Country", "name": "中国" }
      ],
      "address": { "@type": "PostalAddress", "addressRegion": "贵州省", "addressLocality": "兴义市", "addressCountry": "CN" },
      "knowsAbout": ["企业品牌运营","品牌策划","品牌定位","VI视觉设计","新媒体矩阵运营","口腔GEO优化","生成式引擎优化","GEO优化","AI搜索优化","口腔内外运营","口腔门诊运营","口腔机构获客","AI落地赋能","企业AI应用","智能体开发","员工AI培训","传统企业策划","企业数字化转型","传统企业转型","YouTuber运营","YouTube频道出海运营"],
      "founder": { "@type": "Person", "name": "外行澯烽哥", "alternateName": "澯烽" }
    },
    {
      "@type": "Person",
      "name": "外行澯烽哥",
      "alternateName": "澯烽",
      "jobTitle": "烽审榜主理人",
      "url": "https://www.fsbtop.top/",
      "worksFor": { "@type": "Organization", "name": "兴义市烽审榜技术咨询服务行", "url": "https://www.fsbtop.top/" },
      "description": "外行澯烽哥，兴义市烽审榜技术咨询服务行主理人，专注口腔GEO优化、企业品牌运营与AI落地赋能，以「外行」视角拆解专业、用营销思维做口腔科普。",
      "knowsAbout": ["口腔GEO优化","生成式引擎优化","企业品牌运营","AI落地赋能","智能体开发","口腔科普","新媒体内容营销"]
    }
  ]
}
</script>`;

// 案例详情页内联样式（复刻 case.html 的 <style>，保证视觉一致）
const CASE_STYLE = `
    .case-container { max-width: 820px; margin: 6rem auto 3rem; padding: 0 1.5rem; }
    .case-back { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--color-gold-secondary); text-decoration: none; font-size: var(--fs-sm); margin-bottom: 2rem; }
    .case-back:hover { color: var(--color-gold-highlight); }
    .case-header { margin-bottom: 2.5rem; padding-bottom: 2rem; border-bottom: 1px solid var(--color-border); }
    .case-industry { display: inline-block; padding: 0.25rem 0.85rem; border-radius: var(--radius-sm); font-size: var(--fs-xs); font-weight: 600; letter-spacing: 0.08em; background: rgba(184, 146, 74, 0.15); color: var(--color-gold-highlight); margin-bottom: 1.25rem; }
    .case-title { font-size: var(--fs-3xl); font-weight: 800; color: var(--color-text-primary); line-height: 1.3; margin-bottom: 1.25rem; }
    .case-meta { display: flex; gap: 1.5rem; color: var(--color-text-tertiary); font-size: var(--fs-sm); flex-wrap: wrap; }
    .case-meta span { display: flex; align-items: center; gap: 0.35rem; }
    .case-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 0 0 2.5rem; padding: 1.5rem; background: rgba(184, 146, 74, 0.05); border: 1px solid rgba(184, 146, 74, 0.2); border-radius: var(--radius-md); }
    .case-metric { text-align: center; }
    .case-metric-value { font-family: var(--font-en); font-size: var(--fs-2xl); font-weight: 800; background: var(--gradient-gold); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1.2; margin-bottom: 0.25rem; }
    .case-metric-label { font-size: var(--fs-xs); color: var(--color-text-tertiary); }
    .case-content { font-size: var(--fs-base); line-height: 1.85; color: var(--color-text-secondary); }
    .case-content p { margin-bottom: 1.25rem; }
    .case-content h2 { font-size: var(--fs-2xl); margin: 2.25rem 0 1rem; color: var(--color-text-primary); }
    .case-content h3 { font-size: var(--fs-lg); margin: 1.75rem 0 0.75rem; color: var(--color-text-primary); }
    .case-content ul, .case-content ol { margin-bottom: 1.25rem; padding-left: 1.5rem; }
    .case-content li { margin-bottom: 0.5rem; }
    .case-content img { max-width: 100%; border-radius: var(--radius-md); margin: 1.5rem 0; }
    .case-content blockquote { border-left: 3px solid var(--color-gold-primary); padding: 1rem 1.5rem; margin: 1.5rem 0; background: var(--color-bg-secondary); border-radius: 0 var(--radius-md) var(--radius-md) 0; color: var(--color-text-secondary); }
    .case-content blockquote p { margin-bottom: 0.5rem; }
    .case-content blockquote p:last-child { margin-bottom: 0; }
    .case-content pre { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1rem 1.25rem; overflow-x: auto; margin: 1.5rem 0; }
    .case-content code { font-family: var(--font-mono, monospace); font-size: 0.9em; color: var(--color-gold-highlight); }
    .case-content pre code { color: var(--color-text-secondary); }
    .case-content hr { border: none; border-top: 1px solid var(--color-border); margin: 2rem 0; }
    .case-content table { display: block; width: 100%; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 1.5rem 0; font-size: var(--fs-sm); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .case-content thead { background: var(--color-bg-secondary); }
    .case-content th, .case-content td { border: 1px solid var(--color-border); padding: 0.6rem 0.9rem; text-align: left; min-width: 90px; line-height: 1.5; }
    .case-content th { font-weight: 600; color: var(--color-text-primary); white-space: nowrap; }
    .case-content tbody tr:nth-child(even) { background: var(--color-bg-secondary); }
    .case-content tbody tr:hover { background: rgba(201,162,77,0.08); }
    .case-service-link { display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 2.5rem; padding-top: 2rem; border-top: 1px solid var(--color-border); color: var(--color-gold-secondary); text-decoration: none; font-weight: 600; }
    .case-service-link:hover { color: var(--color-gold-highlight); }
    @media (max-width: 768px) {
      .case-container { margin-top: 5rem; }
      .case-title { font-size: var(--fs-2xl); }
    }
`;

// 博客详情页内联样式（复刻 blog-detail.html 的 <style>）
const ARTICLE_STYLE = `
    .article-container { max-width: 800px; margin: 6rem auto 3rem; padding: 0 1.5rem; }
    .article-header { margin-bottom: 2.5rem; padding-bottom: 2rem; border-bottom: 1px solid var(--color-border); }
    .article-back { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--color-gold-secondary); text-decoration: none; font-size: var(--fs-sm); margin-bottom: 2rem; }
    .article-back:hover { color: var(--color-gold-highlight); }
    .article-category { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: var(--fs-xs); font-weight: 600; margin-bottom: 1rem; }
    .article-category.tech { background: rgba(76,175,80,0.15); color: #4caf50; }
    .article-category.business { background: rgba(33,150,243,0.15); color: #2196f3; }
    .article-title { font-size: var(--fs-3xl); font-weight: 800; color: var(--color-text-primary); line-height: 1.3; margin-bottom: 1rem; }
    .article-meta { display: flex; gap: 1.5rem; color: var(--color-text-tertiary); font-size: var(--fs-sm); flex-wrap: wrap; }
    .article-meta span { display: flex; align-items: center; gap: 0.35rem; }
    .article-tags { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; }
    .article-tag { padding: 0.2rem 0.6rem; background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 4px; font-size: var(--fs-xs); color: var(--color-text-tertiary); }
    .article-content { font-size: var(--fs-base); line-height: 1.8; color: var(--color-text-secondary); }
    .article-content p { margin-bottom: 1.25rem; }
    .article-content h2 { font-size: var(--fs-2xl); margin: 2rem 0 1rem; color: var(--color-text-primary); }
    .article-content h3 { font-size: var(--fs-lg); margin: 1.5rem 0 0.75rem; color: var(--color-text-primary); }
    .article-content ul, .article-content ol { margin-bottom: 1.25rem; padding-left: 1.5rem; }
    .article-content li { margin-bottom: 0.5rem; }
    .article-content img { max-width: 100%; border-radius: var(--radius-md); margin: 1.5rem 0; }
    .article-content blockquote { border-left: 3px solid var(--color-gold-primary); padding: 1rem 1.5rem; margin: 1.5rem 0; background: var(--color-bg-secondary); border-radius: 0 var(--radius-md) var(--radius-md) 0; }
    .article-content table { display: block; width: 100%; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 1.5rem 0; font-size: var(--fs-sm); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .article-content thead { background: var(--color-bg-secondary); }
    .article-content th, .article-content td { border: 1px solid var(--color-border); padding: 0.6rem 0.9rem; text-align: left; min-width: 90px; line-height: 1.5; }
    .article-content th { font-weight: 600; color: var(--color-text-primary); white-space: nowrap; }
    .article-content tbody tr:nth-child(even) { background: var(--color-bg-secondary); }
    .article-content tbody tr:hover { background: rgba(201,162,77,0.08); }
`;

// ---------- 工具函数 ----------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); }
  catch (e) { return null; }
}

function toAbs(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return DOMAIN + '/' + String(url).replace(/^\//, '');
}

// 去掉 HTML 标签并压缩空白，截取前 max 字（用于 description）
function stripHtml(html, max) {
  let t = (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (max && t.length > max) t = t.slice(0, max);
  return t;
}

// 去掉正文开头的内部 SEO 元信息块（<p>SEO标题... 到下一个 <hr> 之间的全部内容）
function stripSeoMeta(html) {
  if (!html) return '';
  let h = String(html).replace(/^\s*<p>[^<]*SEO标题[\s\S]*?<hr\s*\/?>\s*/i, '');
  return h.trim();
}

// 进一步去掉开头的「作者 | ...」署名块（用于 description / 列表预览，避免泄露内部信息）
function stripPreamble(html) {
  let h = stripSeoMeta(html);
  h = h.replace(/^\s*<p>[^<]*作者\s*\|[\s\S]*?<\/p>\s*(?:<hr\s*\/?>)?\s*/i, '');
  return h.trim();
}

// 子目录页面（cases/ blog/）里，把内容中的相对资源路径 assets/ data/ 加 ../ 前缀
function relativize(html) {
  if (!html) return '';
  return html
    .replace(/(src|href)="(assets\/)/g, '$1="../$2')
    .replace(/(src|href)="(data\/)/g, '$1="../$2');
}

// ---------- 站点 SEO 配置（后台独立设置，data/seo.json） ----------
const seoRaw = readJson('data/seo.json');
const SEO = (seoRaw && seoRaw.seo) || {};

// ---------- 导航 / 页脚（静态内联，不依赖运行时 JS） ----------
function renderNav(activeKey, base) {
  const links = SITE.navItems.map(it => {
    const cls = it.key === activeKey ? ' class="active"' : '';
    return '<a href="' + base + it.href + '"' + cls + '>' + esc(it.label) + '</a>';
  }).join('');
  const cta = '<a href="' + base + 'admin/login.html" class="nav-cta">后台登录</a>';
  return '<nav class="nav">' + links + cta + '</nav>';
}

function renderFooter(base) {
  const year = new Date().getFullYear();
  const navLinks = SITE.navItems.map(it => '<a href="' + base + it.href + '">' + esc(it.label) + '</a>').join('');
  const svc = SITE.footerServices.map(it => '<a href="' + base + it.href + '">' + esc(it.label) + '</a>').join('');
  const con = SITE.footerContact.map(it => {
    if (it.email) return '<a href="' + it.href + '" data-site-email>' + esc(it.label) + '</a>';
    return '<a href="' + base + it.href + '">' + esc(it.label) + '</a>';
  }).join('');
  const fl = (SITE.friendLinks && SITE.friendLinks.length)
    ? '<details class="fl-details"><summary>友情链接</summary><div class="fl-list">' +
        SITE.friendLinks.map(l => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.name) + '</a>').join('') +
      '</div></details>'
    : '';
  return '' +
    '<footer class="footer"><div class="container">' +
      '<div class="footer-grid">' +
        '<div class="footer-brand">' +
          '<img src="' + base + SITE.logo + '" alt="' + esc(SITE.name) + '">' +
          '<p class="footer-tagline">' + esc(SITE.fullName) + '<br>专业企业品牌运营 · 口腔GEO优化 · AI落地赋能</p>' +
        '</div>' +
        '<div class="footer-col"><h4>导航</h4>' + navLinks + '</div>' +
        '<div class="footer-col"><h4>服务</h4>' + svc + '</div>' +
        '<div class="footer-col"><h4>联系</h4>' + con + '</div>' +
      '</div>' +
      '<div class="footer-friendlinks">' + fl + '</div>' +
      '<div class="footer-bottom">' +
        '<p>© ' + year + ' ' + esc(SITE.fullName) + ' · ' + esc(SITE.name) + '®注册商标 · All Rights Reserved</p>' +
        '<p class="footer-icp"><a class="footer-icp-link" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">' + esc(SITE.icp) + '</a></p>' +
      '</div>' +
    '</div></footer>';
}

// ---------- 案例详情页 ----------
function renderCasePage(item) {
  const base = '../';
  const e = SEO['case_' + item.id];
  const sd = (e && e.data) || {};
  const title = sd.title || (item.title + ' - ' + SITE.name);
  const desc = sd.description || stripHtml(stripPreamble(item.summary), 150);
  const kw = sd.keywords || ((item.industry || '') + ',' + (item.client || '') + ',' + SITE.name + '案例');
  const og = sd.ogImage ? toAbs(sd.ogImage) : toAbs(SITE.ogImage);
  const url = DOMAIN + '/cases/' + item.id + '.html';

  const body = relativize(stripSeoMeta(item.summary));
  const metrics = (item.metrics || []).map(m =>
    '<div class="case-metric"><div class="case-metric-value">' + esc(m.value) + '</div><div class="case-metric-label">' + esc(m.label) + '</div></div>'
  ).join('');
  const svcLink = item.serviceId
    ? '<a href="' + base + 'services.html#' + encodeURIComponent(item.serviceId) + '" class="case-service-link">了解相关业务 →</a>'
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="keywords" content="${esc(kw)}">
  <meta name="author" content="${esc(SITE.author)}">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${esc(og)}">
  <meta property="og:site_name" content="${esc(SITE.name)}">
  <meta property="article:published_time" content="${esc(item.publishDate || '')}">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/png" href="${base}assets/images/logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <meta name="color-scheme" content="light dark">
  <link rel="stylesheet" href="${base}assets/css/variables.css">
  <link rel="stylesheet" href="${base}assets/css/main.css">
  <link rel="stylesheet" href="${base}assets/css/responsive.css">
  <style>${CASE_STYLE}</style>
  <!-- 主题系统：theme.css(悬浮切换按钮样式) + theme.js(日间/黑金切换与默认主题，与首页共用 localStorage 保持一致) -->
  <link rel="stylesheet" href="${base}assets/css/theme.css">
  <script src="${base}assets/js/theme.js"></script>
  ${SITE_JSONLD}
  ${TTZZ_SCRIPT}
</head>
<body data-nav="cases">
  <header class="header">
    <div class="container header-inner">
      <a href="${base}index.html" class="logo">
        <img src="${base}assets/images/logo.png" alt="${esc(SITE.name)} Logo">
        <span class="logo-text">技术咨询服务行</span>
      </a>
      ${renderNav('cases', base)}
      <button class="menu-toggle" aria-label="菜单"><span></span><span></span><span></span></button>
    </div>
  </header>

  <main class="case-container">
    <a href="${base}cases.html" class="case-back">← 返回案例列表</a>
    <article>
      <div class="case-header">
        <span class="case-industry">${esc(item.industry || '')}</span>
        <h1 class="case-title">${esc(item.title)}</h1>
        <div class="case-meta">
          <span>🏢 ${esc(item.client || '')}</span>
          <span>📅 ${esc(item.publishDate || '')}</span>
        </div>
      </div>
      ${metrics ? '<div class="case-metrics">' + metrics + '</div>' : ''}
      <div class="case-content">${body}</div>
      ${svcLink}
    </article>
  </main>

  ${renderFooter(base)}
</body>
</html>`;
}

// ---------- 博客详情页 ----------
function renderBlogPage(item) {
  const base = '../';
  const e = SEO['blog_' + item.id];
  const sd = (e && e.data) || {};
  const title = sd.title || (item.title + ' - ' + SITE.name);
  const desc = sd.description || stripHtml(item.summary || item.content, 150);
  const kw = sd.keywords || (item.tags || []).join(',') || '';
  const og = sd.ogImage ? toAbs(sd.ogImage) : toAbs(SITE.ogImage);
  const url = DOMAIN + '/blog/' + item.id + '.html';

  const body = relativize(stripSeoMeta(item.content));
  const catLabel = item.category === 'tech' ? '💻 技术' : '📈 业务';
  const tags = (item.tags || []).map(t => '<span class="article-tag">#' + esc(t) + '</span>').join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="keywords" content="${esc(kw)}">
  <meta name="author" content="${esc(item.author || SITE.author)}">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${esc(og)}">
  <meta property="og:site_name" content="${esc(SITE.name)}">
  <meta property="article:published_time" content="${esc(item.publishDate || '')}">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/png" href="${base}assets/images/logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <meta name="color-scheme" content="light dark">
  <link rel="stylesheet" href="${base}assets/css/variables.css">
  <link rel="stylesheet" href="${base}assets/css/main.css">
  <link rel="stylesheet" href="${base}assets/css/responsive.css">
  <style>${ARTICLE_STYLE}</style>
  <!-- 主题系统：theme.css(悬浮切换按钮样式) + theme.js(日间/黑金切换与默认主题，与首页共用 localStorage 保持一致) -->
  <link rel="stylesheet" href="${base}assets/css/theme.css">
  <script src="${base}assets/js/theme.js"></script>
  ${SITE_JSONLD}
  ${TTZZ_SCRIPT}
</head>
<body data-nav="blog">
  <header class="header">
    <div class="container header-inner">
      <a href="${base}index.html" class="logo">
        <img src="${base}assets/images/logo.png" alt="${esc(SITE.name)} Logo">
        <span class="logo-text">技术咨询服务行</span>
      </a>
      ${renderNav('blog', base)}
      <button class="menu-toggle" aria-label="菜单"><span></span><span></span><span></span></button>
    </div>
  </header>

  <main class="article-container">
    <a href="${base}blog.html" class="article-back">← 返回博客列表</a>
    <article>
      <div class="article-header">
        <span class="article-category ${esc(item.category || 'tech')}">${catLabel}</span>
        <h1 class="article-title">${esc(item.title)}</h1>
        <div class="article-meta">
          <span>✍️ ${esc(item.author || SITE.author)}</span>
          <span>📅 ${esc(item.publishDate || '')}</span>
          <span>⏱ ${esc(item.readTime || 5)} 分钟</span>
        </div>
        ${tags ? '<div class="article-tags">' + tags + '</div>' : ''}
      </div>
      <div class="article-content">${body}</div>
    </article>
  </main>

  ${renderFooter(base)}
</body>
</html>`;
}

// ---------- sitemap ----------
function buildSitemap(cases, blogs) {
  const urls = [
    { loc: '/', pri: '1.0' },
    { loc: '/services.html', pri: '0.9' },
    { loc: '/blog.html', pri: '0.8' },
    { loc: '/cases.html', pri: '0.8' }
  ];
  cases.forEach(c => urls.push({ loc: '/cases/' + c.id + '.html', pri: '0.7' }));
  blogs.forEach(b => urls.push({ loc: '/blog/' + b.id + '.html', pri: '0.7' }));

  const today = new Date().toISOString().slice(0, 10);
  const items = urls.map(u =>
    '  <url>\n' +
    '    <loc>' + DOMAIN + u.loc + '</loc>\n' +
    '    <lastmod>' + today + '</lastmod>\n' +
    '    <changefreq>weekly</changefreq>\n' +
    '    <priority>' + u.pri + '</priority>\n' +
    '  </url>'
  ).join('\n');

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    items + '\n</urlset>\n';
}

// ---------- 主流程 ----------
function main() {
  const casesData = readJson('data/cases.json');
  const blogData = readJson('data/blog.json');
  const cases = (casesData && casesData.cases) || [];
  const blogs = (blogData && blogData.blog) || [];

  const casesDir = path.join(ROOT, 'cases');
  const blogDir = path.join(ROOT, 'blog');
  if (!fs.existsSync(casesDir)) fs.mkdirSync(casesDir, { recursive: true });
  if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });

  let count = 0;
  cases.forEach(c => {
    if (!c || !c.id) return;
    fs.writeFileSync(path.join(casesDir, c.id + '.html'), renderCasePage(c), 'utf8');
    count++;
  });
  blogs.forEach(b => {
    if (!b || !b.id) return;
    fs.writeFileSync(path.join(blogDir, b.id + '.html'), renderBlogPage(b), 'utf8');
    count++;
  });

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), buildSitemap(cases, blogs), 'utf8');

  console.log('[SSG] 生成 ' + cases.length + ' 篇案例 + ' + blogs.length + ' 篇博客静态详情页，已更新 sitemap.xml');
}

main();
