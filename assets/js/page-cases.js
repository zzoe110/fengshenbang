// 案例页脚本
document.addEventListener('DOMContentLoaded', function () {
  renderCases();
});

// 去掉 HTML 标签并截取前 N 个字符作为卡片预览
function makePreview(html, max) {
  max = max || 160;
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  let text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length > max) text = text.slice(0, max);
  return text;
}

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

  grid.innerHTML = cases.map((c, i) => {
    const detailUrl = 'case.html?id=' + encodeURIComponent(c.id);
    const metricsHtml = (c.metrics && c.metrics.length)
      ? `<div class="case-card-metrics">${c.metrics.map(m => `
          <div class="case-metric">
            <div class="case-metric-value">${m.value}</div>
            <div class="case-metric-label">${m.label}</div>
          </div>
        `).join('')}</div>`
      : '';
    return `
    <article class="case-card fade-in fade-in-delay-${(i % 6) + 1}" id="${c.id}" onclick="location.href='${detailUrl}'" style="cursor:pointer;">
      <div class="case-card-header">
        <span class="case-card-industry">${c.industry}</span>
        <h3 class="case-card-title">${c.title}</h3>
        <p class="case-card-client">🏢 ${c.client}</p>
      </div>
      <div class="case-card-body">
        <p class="case-card-summary">${makePreview(c.summary)}</p>
      </div>
      ${metricsHtml}
      <div class="case-card-footer">
        <span>📅 ${c.publishDate}</span>
        <a href="${detailUrl}" class="service-link" onclick="event.stopPropagation()">查看详情 →</a>
      </div>
    </article>`;
  }).join('');

  // 旧 hash 深链（cases.html#id）平滑迁移到独立详情页，避免长列表滚动
  if (location.hash) {
    const id = decodeURIComponent(location.hash.slice(1));
    if (cases.some(c => c.id === id)) {
      window.location.replace('case.html?id=' + encodeURIComponent(id));
      return;
    }
  }

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
