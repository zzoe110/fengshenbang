// 博客管理
let editingId = null;
let blogs = [];

document.addEventListener('DOMContentLoaded', async function () {
  checkAuth();
  bindEvents();
  await loadData();
});

function bindEvents() {
  document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout(); });
  document.getElementById('addBtn').addEventListener('click', () => openModal(null));
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', async function() { await saveBlog(); });
  document.getElementById('searchInput').addEventListener('input', renderTable);

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.tab-content[data-tab="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  ['f_seo_title', 'f_seo_description', 'f_seo_keywords', 'f_seo_ogImage'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateSeoScore);
  });

  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') closeModal();
  });
}

async function loadData() {
  blogs = await DataStore.getBlog();
  renderTable();
}

function renderTable() {
  const keyword = document.getElementById('searchInput').value.toLowerCase();
  const filtered = blogs.filter(b =>
    b.title.toLowerCase().includes(keyword) ||
    (b.summary || '').toLowerCase().includes(keyword)
  ).sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

  const tbody = document.getElementById('blogTbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#707070;">暂无文章</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(blog => {
    const seo = DataStore.getSEO('blog_' + blog.id);
    const score = calculateSEOScore(seo);
    const seoBadge = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error';
    const seoText = score >= 80 ? `${score} 优` : score >= 50 ? `${score} 良` : score > 0 ? `${score} 差` : '未设置';
    const catLabel = blog.category === 'tech' ? '💻 技术' : '📈 业务';

    return `
      <tr>
        <td><strong style="color:#fff;">${blog.title}</strong></td>
        <td>${catLabel}</td>
        <td>${blog.author}</td>
        <td>${blog.publishDate}</td>
        <td>${blog.readTime} 分钟</td>
        <td><span class="seo-badge ${seoBadge}">${seoText}</span></td>
        <td class="list-actions">
          <button class="btn btn-sm btn-secondary" onclick="openModal('${blog.id}')">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteBlog('${blog.id}')">删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openModal(id) {
  editingId = id;
  const modal = document.getElementById('editModal');
  const title = document.getElementById('modalTitle');

  if (id) {
    title.textContent = '编辑文章';
    const blog = blogs.find(b => b.id === id);
    if (blog) {
      document.getElementById('f_id').value = blog.id;
      document.getElementById('f_id').disabled = true;
      document.getElementById('f_title').value = blog.title;
      document.getElementById('f_category').value = blog.category;
      document.getElementById('f_author').value = blog.author;
      document.getElementById('f_readTime').value = blog.readTime;
      document.getElementById('f_tags').value = (blog.tags || []).join(',');
      document.getElementById('f_summary').value = blog.summary || '';
      document.getElementById('f_content').value = blog.content || '';
      document.getElementById('f_coverImage').value = blog.coverImage || '';
      document.getElementById('f_publishDate').value = blog.publishDate;

      const seo = DataStore.getSEO('blog_' + blog.id) || {};
      document.getElementById('f_seo_title').value = seo.title || '';
      document.getElementById('f_seo_description').value = seo.description || '';
      document.getElementById('f_seo_keywords').value = seo.keywords || '';
      document.getElementById('f_seo_ogImage').value = seo.ogImage || '';
    }
  } else {
    title.textContent = '新增文章';
    document.getElementById('f_id').disabled = false;
    document.querySelectorAll('.modal input, .modal textarea').forEach(el => {
      if (el.id !== 'f_author' && el.id !== 'f_readTime') el.value = '';
    });
    document.getElementById('f_publishDate').value = new Date().toISOString().split('T')[0];
  }

  updateSeoScore();
  modal.classList.add('show');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('show');
  editingId = null;
}

async function saveBlog() {
  const data = {
    id: document.getElementById('f_id').value.trim(),
    title: document.getElementById('f_title').value.trim(),
    category: document.getElementById('f_category').value,
    author: document.getElementById('f_author').value.trim(),
    readTime: parseInt(document.getElementById('f_readTime').value) || 5,
    tags: document.getElementById('f_tags').value.split(',').map(s => s.trim()).filter(Boolean),
    summary: document.getElementById('f_summary').value.trim(),
    content: document.getElementById('f_content').value,
    coverImage: document.getElementById('f_coverImage').value.trim(),
    publishDate: document.getElementById('f_publishDate').value || new Date().toISOString().split('T')[0]
  };

  if (!data.id || !data.title) {
    showToast('请填写 ID 和标题', 'error');
    return;
  }

  const seo = {
    title: document.getElementById('f_seo_title').value.trim(),
    description: document.getElementById('f_seo_description').value.trim(),
    keywords: document.getElementById('f_seo_keywords').value.trim(),
    ogImage: document.getElementById('f_seo_ogImage').value.trim()
  };
  DataStore.saveSEO('blog_' + data.id, seo);

  if (editingId) {
    const idx = blogs.findIndex(b => b.id === editingId);
    if (idx >= 0) blogs[idx] = data;
  } else {
    if (blogs.find(b => b.id === data.id)) {
      showToast('文章 ID 已存在', 'error');
      return;
    }
    blogs.push(data);
  }

  await DataStore.saveBlog(blogs);
  showToast('已保存', 'success');
  closeModal();
  await loadData();
}

async function deleteBlog(id) {
  if (!confirm('确定删除这篇文章？')) return;
  blogs = blogs.filter(b => b.id !== id);
  await DataStore.saveBlog(blogs);
  showToast('已删除', 'success');
  await loadData();
}

function updateSeoScore() {
  const title = document.getElementById('f_seo_title').value;
  const desc = document.getElementById('f_seo_description').value;
  const keywords = document.getElementById('f_seo_keywords').value;
  const ogImage = document.getElementById('f_seo_ogImage').value;

  document.getElementById('seoTitleLen').textContent = title.length;
  document.getElementById('seoDescLen').textContent = desc.length;

  const score = calculateSEOScore({ title, description: desc, keywords, ogImage });
  const badge = document.getElementById('seoScoreBadge');
  badge.textContent = `SEO 评分: ${score} / 100`;
  badge.className = 'seo-badge ' + (score >= 80 ? '' : score >= 50 ? 'warning' : 'error');
}
