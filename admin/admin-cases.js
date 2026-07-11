// 案例管理
let editingId = null;
let cases = [];

document.addEventListener('DOMContentLoaded', async function () {
  checkAuth();
  bindEvents();
  await loadData();
});

function bindEvents() {
  document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout(); });
  document.getElementById('addBtn').addEventListener('click', () => openModal(null));
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', async function() { await saveCase(); });
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
  cases = await DataStore.getCases();
  renderTable();
}

async function renderTable() {
  const keyword = document.getElementById('searchInput').value.toLowerCase();
  const filtered = cases.filter(c =>
    c.title.toLowerCase().includes(keyword) ||
    (c.client || '').toLowerCase().includes(keyword) ||
    (c.industry || '').toLowerCase().includes(keyword)
  ).sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

  const tbody = document.getElementById('casesTbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#707070;">暂无案例</td></tr>';
    return;
  }

  await Promise.all(filtered.map(async c => {
    c.__seo = await DataStore.getSEO('case_' + c.id);
  }));

  tbody.innerHTML = filtered.map(c => {
    const seo = c.__seo;
    const score = calculateSEOScore(seo);
    const seoBadge = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error';
    const seoText = score >= 80 ? `${score} 优` : score >= 50 ? `${score} 良` : score > 0 ? `${score} 差` : '未设置';
    const serviceMap = {
      'brand-operations': '品牌运营',
      'dental-operations': '口腔运营',
      'traditional-planning': '传统企业',
      'youtuber': 'YouTuBer',
      'dental-geo': '口腔GEO',
      'ai-empowerment': 'AI落地'
    };

    return `
      <tr>
        <td><strong style="color:#fff;">${c.title}</strong></td>
        <td>${c.client}</td>
        <td>${c.industry}</td>
        <td>${serviceMap[c.serviceId] || '-'}</td>
        <td>${c.publishDate}</td>
        <td><span class="seo-badge ${seoBadge}">${seoText}</span></td>
        <td class="list-actions">
          <button class="btn btn-sm btn-secondary" onclick="openModal('${c.id}')">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCase('${c.id}')">删除</button>
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
    title.textContent = '编辑案例';
    const c = cases.find(x => x.id === id);
    if (c) {
      document.getElementById('f_id').value = c.id;
      document.getElementById('f_id').disabled = true;
      document.getElementById('f_title').value = c.title;
      document.getElementById('f_client').value = c.client || '';
      document.getElementById('f_industry').value = c.industry || '';
      document.getElementById('f_serviceId').value = c.serviceId || '';
      document.getElementById('f_summary').value = c.summary || '';
      document.getElementById('f_metrics').value = (c.metrics || []).map(m => `${m.label}|${m.value}`).join('\n');
      document.getElementById('f_publishDate').value = c.publishDate;

      const seo = DataStore.getSEO('case_' + c.id) || {};
      document.getElementById('f_seo_title').value = seo.title || '';
      document.getElementById('f_seo_description').value = seo.description || '';
      document.getElementById('f_seo_keywords').value = seo.keywords || '';
      document.getElementById('f_seo_ogImage').value = seo.ogImage || '';
    }
  } else {
    title.textContent = '新增案例';
    document.getElementById('f_id').disabled = false;
    document.querySelectorAll('.modal input, .modal textarea').forEach(el => el.value = '');
    document.getElementById('f_publishDate').value = new Date().toISOString().split('T')[0];
  }

  updateSeoScore();
  modal.classList.add('show');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('show');
  editingId = null;
}

async function saveCase() {
  const metricsText = document.getElementById('f_metrics').value;
  const metrics = metricsText.split('\n').map(line => {
    const [label, value] = line.split('|').map(s => s.trim());
    return label && value ? { label, value } : null;
  }).filter(Boolean);

  const data = {
    id: document.getElementById('f_id').value.trim(),
    title: document.getElementById('f_title').value.trim(),
    client: document.getElementById('f_client').value.trim(),
    industry: document.getElementById('f_industry').value.trim(),
    serviceId: document.getElementById('f_serviceId').value,
    summary: document.getElementById('f_summary').value.trim(),
    metrics,
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
  DataStore.saveSEO('case_' + data.id, seo);

  if (editingId) {
    const idx = cases.findIndex(c => c.id === editingId);
    if (idx >= 0) cases[idx] = data;
  } else {
    if (cases.find(c => c.id === data.id)) {
      showToast('案例 ID 已存在', 'error');
      return;
    }
    cases.push(data);
  }

  await DataStore.saveCases(cases);
  showToast('已保存', 'success');
  closeModal();
  await loadData();
}

async function deleteCase(id) {
  if (!confirm('确定删除此案例？')) return;
  cases = cases.filter(c => c.id !== id);
  await DataStore.saveCases(cases);
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
