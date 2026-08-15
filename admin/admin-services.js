// 业务管理
let editingId = null;
let services = [];
let serviceEditor = null;
let serviceSnapshot = '';

document.addEventListener('DOMContentLoaded', async function () {
  checkAuth();
  bindEvents();
  // 编辑器改为懒初始化：首次 openModal 时才创建（避免 display:none 隐藏初始化塌陷）
  await DataStore.hydrateSEO();
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

  // 新增模式：普通字段输入即自动存草稿（编辑器内容变化已在 initServiceEditor 内监听）
  ['f_id', 'f_title', 'f_subtitle', 'f_icon', 'f_summary', 'f_features', 'f_caseCount', 'f_publishDate', 'f_seo_title', 'f_seo_description', 'f_seo_keywords', 'f_seo_ogImage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', autoSaveServiceDraft);
  });
}

async function loadData() {
  services = await DataStore.getServices();
  renderTable();
}

function renderTable() {
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

  tbody.innerHTML = filtered.map(svc => {
    const seo = DataStore.getSEO('service_' + svc.id);
    const score = calculateSEOScore(seo);
    const seoBadge = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error';
    const seoText = score >= 80 ? `${score} 优` : score >= 50 ? `${score} 良` : score > 0 ? `${score} 差` : '未设置';

    return `
      <tr>
        <td style="font-size:1.5rem;">${svc.icon}</td>
        <td><strong style="color:var(--color-text-primary);">${svc.title}</strong></td>
        <td>${svc.subtitle}</td>
        <td>${svc.caseCount}</td>
        <td>${svc.publishDate}</td>
        <td><span class="seo-badge ${seoBadge}">${seoText}</span></td>
        <td class="list-actions">
          <a class="btn btn-sm btn-outline" href="../services.html#${encodeURIComponent(svc.id)}" target="_blank" rel="noopener">🔗 查看</a>
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

  // 1) 先回填普通字段（含 f_summary textarea 兜底值，供编辑器创建前读取）
  if (id) {
    title.textContent = '编辑业务';
    const svc = services.find(s => s.id === id);
    if (svc) {
      document.getElementById('f_id').value = svc.id;
      document.getElementById('f_id').disabled = true;
      document.getElementById('f_title').value = svc.title;
      document.getElementById('f_subtitle').value = svc.subtitle;
      document.getElementById('f_icon').value = svc.icon;
      document.getElementById('f_summary').value = svc.summary || '';
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
  // 2) 关键：先显示弹窗，让编辑器在「可见状态」下创建（避免 display:none 隐藏初始化塌陷）
  modal.classList.add('show');

  // 3) 弹窗已可见，懒初始化编辑器（首次打开才创建）
  if (!serviceEditor) {
    serviceEditor = MarkdownEditor.create('f_summary', {
      minHeight: '240px',
      placeholder: '业务简介，支持 Markdown 语法，可实时预览，点击工具栏 😀 插入表情。'
    });
    if (serviceEditor && serviceEditor.codemirror) {
      serviceEditor.codemirror.on('change', autoSaveServiceDraft);
    }
  }

  // 4) 编辑器就绪后填充正文
  if (id) {
    const svc = services.find(s => s.id === id);
    if (svc && serviceEditor) serviceEditor.value(MarkdownEditor.toMd(svc.summary || ''));
  } else {
    if (serviceEditor) serviceEditor.value('');
    // 新增：自动恢复上次未保存的草稿（防误关/刷新清零）
    const d = loadDraft('service', null);
    if (d && draftHasContent(d)) {
      fillServiceDraft(d);
      showToast('已自动恢复上次未保存的草稿', 'info', 3000);
    }
  }

  // 安全网：创建后强制刷新一次 CodeMirror 布局（此时弹窗已可见）
  if (serviceEditor) refreshEditor(serviceEditor);
  serviceSnapshot = collectServiceForm(); // 记录初始快照（填充+恢复草稿后），用于"未保存确认"脏检测
}

// 等弹窗显示并完成布局后再刷新 CodeMirror（安全网，懒初始化后一般不需要）
function refreshEditor(editor) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try { editor.codemirror.refresh(); } catch (e) {}
    });
  });
}

function closeModal(skipConfirm) {
  // 有未保存改动时先确认，避免误点遮罩/取消导致内容清零；
  // 真正保存成功时由 saveService 传 true 跳过确认直接关闭。
  if (!skipConfirm && isServiceDirty()) {
    if (!confirm('当前内容尚未保存，确定要放弃吗？\n（未保存的内容将丢失）')) {
      return; // 用户取消 -> 保住内容，不关闭
    }
  }
  clearDraft('service', null); // 关闭即清除草稿（无论放弃还是保存完成）
  document.getElementById('editModal').classList.remove('show');
  editingId = null;
  serviceSnapshot = '';
}

async function saveService() {
  const saveBtn = document.getElementById('saveBtn');
  const originalText = saveBtn ? saveBtn.textContent : '保存';
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中...'; }
  try {
  const data = {
    id: document.getElementById('f_id').value.trim(),
    title: document.getElementById('f_title').value.trim(),
    subtitle: document.getElementById('f_subtitle').value.trim(),
    icon: document.getElementById('f_icon').value.trim() || '🎯',
    summary: MarkdownEditor.toHtml(serviceEditor ? serviceEditor.value() : document.getElementById('f_summary').value),
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
  await DataStore.saveSEO('service_' + data.id, seo);

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
  closeModal(true);
  await loadData();
  } catch (e) {
    console.error('业务保存失败', e);
    showToast('保存失败：' + (e && e.message ? e.message : e) + '（本地可能已缓存，请重试）', 'error', 6000);
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText; }
  }
}

async function deleteService(id) {
  if (!confirm('确定删除这个业务？相关数据将无法恢复。')) return;
  try {
    services = services.filter(s => s.id !== id);
    await DataStore.saveServices(services);
    showToast('已删除', 'success');
    await loadData();
  } catch (e) {
    console.error('业务删除失败', e);
    showToast('删除失败：' + (e && e.message ? e.message : e) + '（请重试）', 'error', 6000);
  }
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

// 收集业务表单数据（用于脏检测与草稿）
function collectServiceData() {
  return {
    id: val('f_id'),
    title: val('f_title'),
    subtitle: val('f_subtitle'),
    icon: val('f_icon'),
    summary: serviceEditor ? serviceEditor.value() : val('f_summary'),
    features: val('f_features'),
    caseCount: val('f_caseCount'),
    publishDate: val('f_publishDate'),
    seoTitle: val('f_seo_title'),
    seoDesc: val('f_seo_description'),
    seoKeywords: val('f_seo_keywords'),
    seoOg: val('f_seo_ogImage')
  };
}
function collectServiceForm() { return JSON.stringify(collectServiceData()); }
function isServiceDirty() { return collectServiceForm() !== serviceSnapshot; }

// 把草稿对象填回表单（含 Markdown 编辑器）
function fillServiceDraft(d) {
  document.getElementById('f_id').value = d.id || '';
  document.getElementById('f_title').value = d.title || '';
  document.getElementById('f_subtitle').value = d.subtitle || '';
  document.getElementById('f_icon').value = d.icon || '';
  if (serviceEditor) serviceEditor.value(d.summary || '');
  else document.getElementById('f_summary').value = d.summary || '';
  document.getElementById('f_features').value = d.features || '';
  document.getElementById('f_caseCount').value = d.caseCount || '';
  document.getElementById('f_publishDate').value = d.publishDate || new Date().toISOString().split('T')[0];
  document.getElementById('f_seo_title').value = d.seoTitle || '';
  document.getElementById('f_seo_description').value = d.seoDesc || '';
  document.getElementById('f_seo_keywords').value = d.seoKeywords || '';
  document.getElementById('f_seo_ogImage').value = d.seoOg || '';
}

// 新增模式自动存草稿；编辑模式不存（数据已在，靠确认保护）
function autoSaveServiceDraft() {
  if (editingId) return;
  const d = collectServiceData();
  if (draftHasContent(d)) saveDraft('service', null, d);
  else clearDraft('service', null);
}
