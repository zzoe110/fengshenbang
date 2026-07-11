// 业务管理
let editingId = null;
let services = [];

document.addEventListener('DOMContentLoaded', async function () {
  checkAuth();
  bindEvents();
  await loadData();
});

function bindEvents() {
  document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout(); });
  document.getElementById('addBtn').addEventListener('click', () => openModal(null));
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', async function() { await saveService(); });
  document.getElementById('searchInput').addEventListener('input', renderTable);

  // Tab 切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.tab-content[data-tab="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  // SEO 字符计数
  ['f_seo_title', 'f_seo_description'].forEach((id, idx) => {
    document.getElementById(id).addEventListener('input', updateSeoScore);
  });
  document.getElementById('f_seo_keywords').addEventListener('input', updateSeoScore);
  document.getElementById('f_seo_ogImage').addEventListener('input', updateSeoScore);

  // 点击模态框背景关闭
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') closeModal();
  });
}

async function loadData() {
  services = await DataStore.getServices();
  renderTable();
}

async function renderTable() {
  const keyword = document.getElementById('searchInput').value.toLowerCase();
  const filtered = services.filter(s =>
    s.title.toLowerCase().includes(keyword) ||
    s.subtitle.toLowerCase().includes(keyword)
  );

  const tbody = document.getElementById('servicesTbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#707070;">暂无数据</td></tr>';
    return;
  }

  await Promise.all(filtered.map(async svc => {
    svc.__seo = await DataStore.getSEO('service_' + svc.id);
  }));

  tbody.innerHTML = filtered.map(svc => {
    const seo = svc.__seo;
    const score = calculateSEOScore(seo);
    const seoBadge = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error';
    const seoText = score >= 80 ? `${score} 优` : score >= 50 ? `${score} 良` : score > 0 ? `${score} 差` : '未设置';

    return `
      <tr>
        <td style="font-size:1.5rem;">${svc.icon}</td>
        <td><strong style="color:#fff;">${svc.title}</strong></td>
        <td>${svc.subtitle}</td>
        <td>${svc.caseCount}</td>
        <td>${svc.publishDate}</td>
        <td><span class="seo-badge ${seoBadge}">${seoText}</span></td>
        <td class="list-actions">
          <button class="btn btn-sm btn-secondary" onclick="openModal('${svc.id}')">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteService('${svc.id}')">删除</button>
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
    title.textContent = '编辑业务';
    const svc = services.find(s => s.id === id);
    if (svc) {
      document.getElementById('f_id').value = svc.id;
      document.getElementById('f_id').disabled = true;
      document.getElementById('f_title').value = svc.title;
      document.getElementById('f_subtitle').value = svc.subtitle;
      document.getElementById('f_icon').value = svc.icon;
      document.getElementById('f_summary').value = svc.summary;
      document.getElementById('f_features').value = (svc.features || []).join('\n');
      document.getElementById('f_caseCount').value = svc.caseCount;
      document.getElementById('f_publishDate').value = svc.publishDate;

      // 加载 SEO
      const seo = DataStore.getSEO('service_' + svc.id) || {};
      document.getElementById('f_seo_title').value = seo.title || '';
      document.getElementById('f_seo_description').value = seo.description || '';
      document.getElementById('f_seo_keywords').value = seo.keywords || '';
      document.getElementById('f_seo_ogImage').value = seo.ogImage || '';
    }
  } else {
    title.textContent = '新增业务';
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

async function saveService() {
  const data = {
    id: document.getElementById('f_id').value.trim(),
    title: document.getElementById('f_title').value.trim(),
    subtitle: document.getElementById('f_subtitle').value.trim(),
    icon: document.getElementById('f_icon').value.trim() || '🎯',
    summary: document.getElementById('f_summary').value.trim(),
    features: document.getElementById('f_features').value.split('\n').map(s => s.trim()).filter(Boolean),
    caseCount: parseInt(document.getElementById('f_caseCount').value) || 0,
    publishDate: document.getElementById('f_publishDate').value || new Date().toISOString().split('T')[0]
  };

  if (!data.id || !data.title) {
    showToast('请填写 ID 和标题', 'error');
    return;
  }

  // SEO 数据
  const seo = {
    title: document.getElementById('f_seo_title').value.trim(),
    description: document.getElementById('f_seo_description').value.trim(),
    keywords: document.getElementById('f_seo_keywords').value.trim(),
    ogImage: document.getElementById('f_seo_ogImage').value.trim()
  };
  DataStore.saveSEO('service_' + data.id, seo);

  if (editingId) {
    const idx = services.findIndex(s => s.id === editingId);
    if (idx >= 0) services[idx] = data;
  } else {
    if (services.find(s => s.id === data.id)) {
      showToast('业务 ID 已存在', 'error');
      return;
    }
    services.push(data);
  }

  await DataStore.saveServices(services);
  showToast('已保存', 'success');
  closeModal();
  await loadData();
}

async function deleteService(id) {
  if (!confirm('确定删除这个业务？相关数据将无法恢复。')) return;
  services = services.filter(s => s.id !== id);
  await DataStore.saveServices(services);
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
