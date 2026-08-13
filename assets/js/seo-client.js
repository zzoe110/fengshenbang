// assets/js/seo-client.js
// 前台页面消费后台「全局页面 SEO」设置，注入 title / description / keywords / Open Graph / canonical。
// 用法：在 <body> 上标注两个 data 属性即可，无需其他代码：
//   首页（数据来自 config.json）：
//     <body data-seo-page="home" data-seo-source="config">
//   其他静态页（数据来自 data/seo.json 的 page_xxx）：
//     <body data-seo-page="cases" data-seo-source="seo">
// 脚本放在 </body> 前即可；在 DOMContentLoaded 后自动执行，对 SEO 零侵入、幂等。
(function () {
  'use strict';

  async function fetchJSON(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // 创建或更新一个 head 中的 meta / link 标签
  function upsert(selector, tag, attr, key, value) {
    if (!value) return;
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement(tag);
      if (tag === 'link') el.rel = key;
      else el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    if (tag === 'link') el.href = value;
    else el.setAttribute('content', value);
  }

  async function applyPageSEO() {
    const body = document.body;
    if (!body) return;
    const page = body.dataset.seoPage;
    if (!page) return;
    const source = (body.dataset.seoSource || 'seo').toLowerCase();

    let seo = null;
    if (source === 'config') {
      // 首页 SEO 存于 config.json（homeTitle / homeDescription / homeKeywords / homeOgImage）
      const cfg = await fetchJSON('/data/config.json');
      if (cfg) {
        seo = {
          title: cfg.homeTitle || '',
          description: cfg.homeDescription || '',
          keywords: cfg.homeKeywords || '',
          ogImage: cfg.homeOgImage || ''
        };
      }
    } else {
      // 其他页面 SEO 存于 data/seo.json 的 seo['page_xxx']
      const data = await fetchJSON('/data/seo.json');
      const map = (data && data.seo) || {};
      seo = map['page_' + page] || null;
    }
    if (!seo) return;

    const title = (seo.title || '').trim();
    const desc = (seo.description || '').trim();
    const kw = (seo.keywords || '').trim();
    const og = (seo.ogImage || '').trim();
    const url = location.href.split('#')[0];

    if (title) document.title = title;
    upsert('meta[name="description"]', 'meta', 'name', 'description', desc);
    upsert('meta[name="keywords"]', 'meta', 'name', 'keywords', kw);
    upsert('meta[property="og:title"]', 'meta', 'property', 'og:title', title || document.title);
    upsert('meta[property="og:description"]', 'meta', 'property', 'og:description', desc);
    upsert('meta[property="og:url"]', 'meta', 'property', 'og:url', url);
    if (og) upsert('meta[property="og:image"]', 'meta', 'property', 'og:image', og);
    // 唯一 canonical（去掉 hash，保留 path，拼成绝对地址，利于 GEO/AI 搜索收录）
    const canonical = location.origin + location.pathname;
    upsert('link[rel="canonical"]', 'link', 'rel', 'canonical', canonical);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPageSEO);
  } else {
    applyPageSEO();
  }
})();
