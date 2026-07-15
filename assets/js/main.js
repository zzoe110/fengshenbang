// ============================================
// 烽审榜主交互脚本
// ============================================

document.addEventListener('DOMContentLoaded', function () {

  // ============================================
  // 1. 滚动时头部样式
  // ============================================
  const header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // ============================================
  // 2. 移动端菜单
  // ============================================
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('open');
      nav.classList.toggle('open');
    });

    // 点击菜单项后自动关闭
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('open');
        nav.classList.remove('open');
      });
    });
  }

  // ============================================
  // 3. 滚动出现动画
  // ============================================
  const fadeEls = document.querySelectorAll('.fade-in');
  if (fadeEls.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    fadeEls.forEach(el => observer.observe(el));
  }

  // ============================================
  // 4. 加载业务数据
  // ============================================
  loadServices();
  loadSiteMeta();

  // ============================================
  // 5. 平滑滚动到锚点
  // ============================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const headerHeight = header ? header.offsetHeight : 0;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 20;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ============================================
  // 6. 数字滚动动画
  // ============================================
  animateNumbers();
});

// ============================================
// 动态注入站点 meta + JSON-LD（后台 config.json 可改，无需改代码）
// ============================================
async function loadSiteMeta() {
  let cfg = null;
  try {
    const res = await fetch('/data/config.json', { cache: 'no-store' });
    if (res.ok) cfg = await res.json();
  } catch (e) { /* 使用兜底默认值 */ }

  if (cfg && typeof cfg === 'object') {
    try { Object.assign(SITE_CONFIG, cfg); } catch (e) {}
  }

  const home = {
    title: SITE_CONFIG.homeTitle || (SITE_CONFIG.siteName + ' - ' + SITE_CONFIG.siteFullName),
    description: SITE_CONFIG.homeDescription || SITE_CONFIG.description,
    keywords: SITE_CONFIG.homeKeywords || SITE_CONFIG.keywords,
    ogTitle: SITE_CONFIG.homeTitle || (SITE_CONFIG.siteName + ' - ' + SITE_CONFIG.siteFullName),
    ogDescription: SITE_CONFIG.homeDescription || SITE_CONFIG.description,
    ogImage: SITE_CONFIG.homeOgImage || SITE_CONFIG.logo
  };
  updateSEO(home);
  injectJSONLD();
}

// 动态生成 Organization 结构化数据（GEO 核心载体：业务实体词典硬编码，文本字段来自 config）
function injectJSONLD() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': SITE_CONFIG.siteFullName || SITE_CONFIG.siteName,
    'alternateName': SITE_CONFIG.siteName,
    'url': '/',
    'logo': SITE_CONFIG.logo,
    'description': SITE_CONFIG.homeDescription || SITE_CONFIG.description,
    'slogan': '从品牌到AI，助力企业破局增长',
    'foundingLocation': { '@type': 'Place', 'name': (SITE_CONFIG.contact && SITE_CONFIG.contact.address) || '贵州省兴义市' },
    'areaServed': [
      { '@type': 'AdministrativeArea', 'name': '贵州省' },
      { '@type': 'AdministrativeArea', 'name': '兴义市' },
      { '@type': 'Country', 'name': '中国' }
    ],
    'address': { '@type': 'PostalAddress', 'addressRegion': '贵州省', 'addressLocality': '兴义市', 'addressCountry': 'CN' },
    'knowsAbout': [
      '企业品牌运营','品牌策划','品牌定位','VI视觉设计','新媒体矩阵运营','口腔GEO优化','生成式引擎优化','GEO优化','AI搜索优化','口腔内外运营','口腔门诊运营','口腔机构获客','AI落地赋能','企业AI应用','智能体开发','员工AI培训','传统企业策划','企业数字化转型','传统企业转型','YouTuber运营','YouTube频道出海运营'
    ]
  };
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(ld);
  document.head.appendChild(s);
}

// ============================================
// 加载业务数据
// ============================================
async function loadServices() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  try {
    // 优先从静态 JSON 加载（后台保存后约 1-2 分钟全站更新）
    let services = null;
    try {
      const res = await fetch('/data/services.json', { cache: 'no-store' });
      const data = await res.json();
      services = data.services;
    } catch (e) {
      // 兜底：使用 data.js 内置数据
      services = window.FSB_DATA?.services;
    }

    // 按发布日期倒序，取最新
    services.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

    grid.innerHTML = services.map((svc, i) => `
      <article class="service-card fade-in fade-in-delay-${(i % 6) + 1}" data-id="${svc.id}">
        <div class="service-icon">${svc.icon}</div>
        <h3 class="service-title">${svc.title}</h3>
        <div class="service-subtitle">${svc.subtitle}</div>
        <p class="service-summary">${svc.summary}</p>
        <ul class="service-features">
          ${svc.features.map(f => `<li>${f}</li>`).join('')}
        </ul>
        <div class="service-meta">
          <span>📊 ${svc.caseCount} 个案例</span>
          <a href="services.html#${svc.id}" class="service-link">了解详情</a>
        </div>
      </article>
    `).join('');

    // 触发滚动动画观察
    setTimeout(() => {
      const newFadeEls = grid.querySelectorAll('.fade-in');
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      newFadeEls.forEach(el => observer.observe(el));
    }, 50);
  } catch (err) {
    console.error('加载业务数据失败', err);
    grid.innerHTML = '<p style="text-align:center;color:#a0a0a0;grid-column:1/-1;">业务数据加载中...</p>';
  }
}

// ============================================
// 数字滚动动画
// ============================================
function animateNumbers() {
  const numbers = document.querySelectorAll('[data-count]');
  if (numbers.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const duration = 2000;
        const start = performance.now();
        const step = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.floor(target * easeOut);
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            el.textContent = target;
          }
        };
        requestAnimationFrame(step);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  numbers.forEach(n => observer.observe(n));
}
