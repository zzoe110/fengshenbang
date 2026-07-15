// 案例页脚本
document.addEventListener('DOMContentLoaded', function () {
  renderCases();
});

async function renderCases() {
  const grid = document.getElementById('casesGrid');
  if (!grid) return;

  let cases = null;
  try {
    const res = await fetch('/data/cases.json', { cache: 'no-store' });
    const data = await res.json();
    cases = data.cases;
  } catch (e) {
    cases = window.FSB_DATA?.cases;
  }
  if (!cases) return;

  cases = [...cases];
  cases.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

  grid.innerHTML = cases.map((c, i) => `
    <article class="case-card fade-in fade-in-delay-${(i % 6) + 1}">
      <div class="case-card-header">
        <span class="case-card-industry">${c.industry}</span>
        <h3 class="case-card-title">${c.title}</h3>
        <p class="case-card-client">🏢 ${c.client}</p>
      </div>
      <div class="case-card-body">
        <p class="case-card-summary">${c.summary}</p>
      </div>
      <div class="case-card-metrics">
        ${c.metrics.map(m => `
          <div class="case-metric">
            <div class="case-metric-value">${m.value}</div>
            <div class="case-metric-label">${m.label}</div>
          </div>
        `).join('')}
      </div>
      <div class="case-card-footer">
        <span>📅 ${c.publishDate}</span>
        <a href="services.html#${c.serviceId}" class="service-link">了解相关业务 →</a>
      </div>
    </article>
  `).join('');

  // 触发滚动动画
  setTimeout(() => {
    const els = grid.querySelectorAll('.fade-in');
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
