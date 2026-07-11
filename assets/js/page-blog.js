// 博客页脚本
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', function () {
  renderBlog();
  bindFilter();
});

async function renderBlog() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  let blogs;
  try {
    blogs = await API.getBlog();
  } catch (e) {
    console.warn('API 获取博客失败，使用内置数据', e);
    blogs = (window.FSB_DATA && window.FSB_DATA.blog) || [];
  }
  if (currentFilter !== 'all') {
    blogs = blogs.filter(b => b.category === currentFilter);
  }

  blogs.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

  if (blogs.length === 0) {
    grid.innerHTML = '<p style="text-align:center;color:#a0a0a0;grid-column:1/-1;padding:3rem 0;">暂无相关文章</p>';
    return;
  }

  const catIcons = {
    tech: '💻',
    business: '📈'
  };

  grid.innerHTML = blogs.map((blog, i) => `
    <article class="blog-card fade-in fade-in-delay-${(i % 6) + 1}" data-id="${blog.id}" onclick="location.href='blog-detail.html?id=${blog.id}'" style="cursor:pointer;">
      <div class="blog-card-cover">${catIcons[blog.category] || '📝'}</div>
      <div class="blog-card-body">
        <div class="blog-card-meta">
          <span class="blog-card-cat ${blog.category}">${blog.category === 'tech' ? '技术' : '业务'}</span>
          <span>${blog.publishDate}</span>
          <span>· ${blog.readTime}分钟</span>
        </div>
        <h3 class="blog-card-title">${blog.title}</h3>
        <p class="blog-card-summary">${blog.summary}</p>
        <div class="blog-card-footer">
          <span>✍️ ${blog.author}</span>
          <span class="service-link">阅读全文 →</span>
        </div>
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

function bindFilter() {
  const btns = document.querySelectorAll('.filter-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderBlog();
    });
  });
}
