// 业务详情页渲染
document.addEventListener('DOMContentLoaded', function () {
  renderServicesDetail();
  loadAdSlot();
});

async function renderServicesDetail() {
  const list = document.getElementById('servicesList');
  if (!list) return;

  let services;
  try {
    services = await API.getServices();
  } catch (e) {
    console.warn('API 获取业务失败，使用内置数据', e);
    services = (window.FSB_DATA && window.FSB_DATA.services) || [];
  }
  list.innerHTML = services.map((svc, i) => `
    <article class="service-detail fade-in fade-in-delay-${(i % 6) + 1}" id="${svc.id}">
      <div class="service-detail-header">
        <div class="service-detail-icon">${svc.icon}</div>
        <div class="service-detail-info">
          <h2 class="service-detail-title">${svc.title}</h2>
          <div class="service-detail-subtitle">${svc.subtitle}</div>
        </div>
      </div>
      <p class="service-detail-summary">${svc.summary}</p>
      <div class="service-detail-features">
        ${svc.features.map(f => `<div class="service-detail-feature">${f}</div>`).join('')}
      </div>
      <div class="service-detail-meta">
        <span class="service-detail-meta-item">📊 ${svc.caseCount} 个成功案例</span>
        <span class="service-detail-meta-item">📅 ${svc.publishDate}</span>
        <a href="cases.html" class="service-link">查看相关案例 →</a>
      </div>
    </article>
  `).join('');

  // 触发滚动动画
  setTimeout(() => {
    const els = list.querySelectorAll('.fade-in');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    els.forEach(el => obs.observe(el));
  }, 50);
}

async function loadAdSlot() {
  let ad = null;
  try {
    ad = await API.getMeta('ad');
  } catch (e) {
    // 兜底：localStorage
    try {
      const saved = localStorage.getItem('fsb_ad_slot');
      if (saved) ad = JSON.parse(saved);
    } catch (_) {}
  }
  if (ad) {
    if (ad.title) document.getElementById('adTitle').textContent = ad.title;
    if (ad.desc) document.getElementById('adDesc').textContent = ad.desc;
    if (ad.btn) document.getElementById('adBtn').textContent = ad.btn;
    if (ad.link) document.getElementById('adBtn').href = ad.link;
  }
}
