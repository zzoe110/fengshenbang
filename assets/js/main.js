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
