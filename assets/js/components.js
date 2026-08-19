// ============================================================
// 全站统一「导航栏 + 页脚」组件（单一数据源）
// ------------------------------------------------------------
// 改这里 = 全站同步生效（index / about / contact / blog /
//   cases / services / blog-detail 共 7 个页面）。
// 每个页面只需保留：
//   1) <body data-nav="home|services|blog|cases|about|contact|tool">
//   2) 导航占位 <div id="site-nav"></div>
//   3) 页脚占位 <div id="site-footer"></div>
//   4) 在 config.js 之后引入本文件
// 以后加菜单、改页脚，只动这一个文件即可。
// ============================================================
(function () {
  'use strict';

  // 导航菜单项（顺序即显示顺序）。active 由 body[data-nav] 决定。
  var NAV_ITEMS = [
    { key: 'home',     label: '首页',     href: 'index.html' },
    { key: 'services', label: '主营业务', href: 'services.html' },
    { key: 'blog',     label: '博客文章', href: 'blog.html' },
    { key: 'cases',    label: '客户案例', href: 'cases.html' },
    { key: 'about',    label: '关于我们', href: 'about.html' },
    { key: 'contact',  label: '联系我们', href: 'contact.html' },
    { key: 'tool',     label: '工具',     href: 'tool/index.html' }
  ];

  // 页脚「联系」列（邮箱链接带 data-site-email，由 config.js 注入真实邮箱）
  var FOOTER_CONTACT = [
    { label: '邮箱咨询', href: 'mailto:contact@fengshenbang.com', email: true },
    { label: '联系我们', href: 'contact.html' },
    { label: '关于我们', href: 'about.html' },
    { label: '后台登录', href: 'admin/login.html' }
  ];

  // 页脚「服务」列（锚点定位到 services.html 各板块）
  var FOOTER_SERVICES = [
    { label: '企业品牌运营', href: 'services.html#brand-operations' },
    { label: '口腔运营',     href: 'services.html#dental-operations' },
    { label: '口腔GEO',      href: 'services.html#dental-geo' },
    { label: 'AI落地赋能',    href: 'services.html#ai-empowerment' }
  ];

  // 根据当前页面位置推算相对基准路径（支持子目录如 tool/）
  function getBase() {
    var segs = window.location.pathname.split('/').filter(Boolean);
    if (segs.length <= 1) return '';           // 根目录页面
    return '../'.repeat(segs.length - 1);       // 子目录页面回退
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderNav(activeKey, base) {
    var links = NAV_ITEMS.map(function (it) {
      var cls = (it.key === activeKey) ? ' class="active"' : '';
      return '<a href="' + base + it.href + '"' + cls + '>' + esc(it.label) + '</a>';
    }).join('');
    var cta = '<a href="' + base + 'admin/login.html" class="nav-cta">后台登录</a>';
    return '<nav class="nav">' + links + cta + '</nav>';
  }

  function getConfig() {
    // config.js 用 const 声明 SITE_CONFIG（经典脚本中 const 不挂到 window），
    // 这里优先取全局词法绑定，再退而取 window，最后返回 null。
    try { if (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG) return SITE_CONFIG; } catch (e) {}
    try { if (window.SITE_CONFIG) return window.SITE_CONFIG; } catch (e) {}
    return null;
  }

  function renderFooter(base) {
    var cfg = getConfig();
    var logo = (cfg && cfg.logo) || 'assets/images/logo.png';
    var year = new Date().getFullYear();

    var navLinks = NAV_ITEMS.map(function (it) {
      return '<a href="' + base + it.href + '">' + esc(it.label) + '</a>';
    }).join('');

    var serviceLinks = FOOTER_SERVICES.map(function (it) {
      return '<a href="' + base + it.href + '">' + esc(it.label) + '</a>';
    }).join('');

    var contactLinks = FOOTER_CONTACT.map(function (it) {
      if (it.email) {
        return '<a href="' + it.href + '" data-site-email>' + esc(it.label) + '</a>';
      }
      return '<a href="' + base + it.href + '">' + esc(it.label) + '</a>';
    }).join('');

    return '' +
      '<footer class="footer">' +
        '<div class="container">' +
          '<div class="footer-grid">' +
            '<div class="footer-brand">' +
              '<img src="' + base + logo + '" alt="烽审榜">' +
              '<p class="footer-tagline">兴义市烽审榜技术咨询服务行<br>专业企业品牌运营 · 口腔GEO优化 · AI落地赋能</p>' +
            '</div>' +
            '<div class="footer-col"><h4>导航</h4>' + navLinks + '</div>' +
            '<div class="footer-col"><h4>服务</h4>' + serviceLinks + '</div>' +
            '<div class="footer-col"><h4>联系</h4>' + contactLinks + '</div>' +
          '</div>' +
          '<div class="footer-friendlinks" id="footer-friendlinks"></div>' +
          '<div class="footer-bottom">' +
            '<p>© ' + year + ' 兴义市烽审榜技术咨询服务行 · 烽审榜®注册商标 · All Rights Reserved</p>' +
            '<p class="footer-icp"><a class="footer-icp-link" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">黔ICP备2026013377号</a></p>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  // 异步加载友情链接并注入页脚（数据来自 data/friendlinks.json，后台可管理增删）
  function loadFriendLinks(base) {
    fetch(base + 'data/friendlinks.json')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        var mount = document.getElementById('footer-friendlinks');
        if (!mount || !list || !list.length) return;
        var items = list.map(function (l) {
          return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.name) + '</a>';
        }).join('');
        mount.innerHTML = '<details class="fl-details"><summary>友情链接</summary><div class="fl-list">' + items + '</div></details>';
      })
      .catch(function () {});
  }

  function init() {
    var activeKey = (document.body && document.body.dataset && document.body.dataset.nav) || '';
    var base = getBase();

    var navMount = document.getElementById('site-nav');
    if (navMount) navMount.outerHTML = renderNav(activeKey, base);

    var footerMount = document.getElementById('site-footer');
    if (footerMount) footerMount.outerHTML = renderFooter(base);
    loadFriendLinks(base); // 异步注入友情链接（后台 friendlinks.json 管理）

    // 注入后刷新邮箱链接（复用 config.js 的远程配置覆盖逻辑，保证后台改邮箱全站生效）
    if (window.applyContactEmail) window.applyContactEmail();
    else if (window.updateContactEmailLinks) window.updateContactEmailLinks();
  }

  // 立即执行：本文件在 </body> 前引入，占位符此时已解析，
  // 同步注入可保证 main.js（紧随其后）能正确拿到 .nav 做移动端菜单绑定。
  function boot() {
    if (document.getElementById('site-nav') || document.getElementById('site-footer')) {
      init();
    }
  }
  boot();
  // 兜底：若因加载顺序导致占位符尚未就绪，DOMContentLoaded 再补一次
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
