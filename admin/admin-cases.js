// 案例管理
let editingId = null;
let cases = [];
let caseEditor = null;
let caseSnapshot = '';

document.addEventListener('DOMContentLoaded', async function () {
  checkAuth();
  bindEvents();
  initCaseEditor();
  await DataStore.hydrateSEO();
  await loadData();
});

function initCaseEditor() {
  if (typeof MarkdownEditor === 'undefined') return;
  caseEditor = MarkdownEditor.create('f_summary', {
    minHeight: '240px',
    placeholder: '案例简介，支持 Markdown 语法，可实时预览，点击工具栏 😀 插入表情。'
  });
  // 编辑器内容变化即自动存草稿（防误关/刷新丢失）
  if (caseEditor && caseEditor.codemirror) {
    caseEditor.codemirror.on('change', autoSaveCaseDraft);
  }
}

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

  // 新增模式：普通字段输入即自动存草稿（编辑器内容变化已在 initCaseEditor 内监听）
  ['f_id', 'f_title', 'f_client', 'f_industry', 'f_serviceId', 'f_summary', 'f_metrics', 'f_publishDate', 'f_seo_title', 'f_seo_description', 'f_seo_keywords', 'f_seo_ogImage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', autoSaveCaseDraft);
  });
}

async function loadData() {
  cases = await DataStore.getCases();
  renderTable();
}

function renderTable() {
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

  tbody.innerHTML = filtered.map(c => {
    const seo = DataStore.getSEO('case_' + c.id);
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
        <td><strong style="color:var(--color-text-primary);">${c.title}</strong></td>
        <td>${c.client}</td>
        <td>${c.industry}</td>
        <td>${serviceMap[c.serviceId] || '-'}</td>
        <td>${c.publishDate}</td>
        <td><span class="seo-badge ${seoBadge}">${seoText}</span></td>
        <td class="list-actions">
          <a class="btn btn-sm btn-outline" href="../cases.html#${encodeURIComponent(c.id)}" target="_blank" rel="noopener">🔗 查看</a>
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
      if (caseEditor) caseEditor.value(MarkdownEditor.toMd(c.summary || ''));
      else document.getElementById('f_summary').value = c.summary || '';
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
    if (caseEditor) caseEditor.value('');
    document.getElementById('f_publishDate').value = new Date().toISOString().split('T')[0];
    // 新增：自动恢复上次未保存的草稿（防误关/刷新清零）
    const d = loadDraft('case', null);
    if (d && draftHasContent(d)) {
      fillCaseDraft(d);
      showToast('已自动恢复上次未保存的草稿', 'info', 3000);
    }
  }

  updateSeoScore();
  modal.classList.add('show');
  // 弹窗由隐藏变显示后，CodeMirror 必须等浏览器完成布局再 refresh，
  // 否则会量到 0 高度导致编辑区塌陷（表现为"编辑器加载不全"）。用双 rAF 确保布局已落地。
  if (caseEditor) refreshEditor(caseEditor);
  caseSnapshot = collectCaseForm(); // 记录初始快照（填充+恢复草稿后），用于"未保存确认"脏检测
}

// 等弹窗显示并完成布局后再刷新 CodeMirror，修复隐藏初始化导致的编辑区塌陷
function refreshEditor(editor) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try { editor.codemirror.refresh(); } catch (e) {}
    });
  });
}

// 收集案例表单数据（用于脏检测与草稿）
function collectCaseData() {
  return {
    id: val('f_id'),
    title: val('f_title'),
    client: val('f_client'),
    industry: val('f_industry'),
    serviceId: val('f_serviceId'),
    summary: caseEditor ? caseEditor.value() : val('f_summary'),
    metrics: val('f_metrics'),
    publishDate: val('f_publishDate'),
    seoTitle: val('f_seo_title'),
    seoDesc: val('f_seo_description'),
    seoKeywords: val('f_seo_keywords'),
    seoOg: val('f_seo_ogImage')
  };
}
function collectCaseForm() { return JSON.stringify(collectCaseData()); }
function isCaseDirty() { return collectCaseForm() !== caseSnapshot; }

// 把草稿对象填回表单（含 Markdown 编辑器）
function fillCaseDraft(d) {
  document.getElementById('f_id').value = d.id || '';
  document.getElementById('f_title').value = d.title || '';
  document.getElementById('f_client').value = d.client || '';
  document.getElementById('f_industry').value = d.industry || '';
  document.getElementById('f_serviceId').value = d.serviceId || '';
  if (caseEditor) caseEditor.value(d.summary || '');
  else document.getElementById('f_summary').value = d.summary || '';
  document.getElementById('f_metrics').value = d.metrics || '';
  document.getElementById('f_publishDate').value = d.publishDate || new Date().toISOString().split('T')[0];
  document.getElementById('f_seo_title').value = d.seoTitle || '';
  document.getElementById('f_seo_description').value = d.seoDesc || '';
  document.getElementById('f_seo_keywords').value = d.seoKeywords || '';
  document.getElementById('f_seo_ogImage').value = d.seoOg || '';
}

// 新增模式自动存草稿；编辑模式不存（数据已在，靠确认保护）
function autoSaveCaseDraft() {
  if (editingId) return;
  const d = collectCaseData();
  if (draftHasContent(d)) saveDraft('case', null, d);
  else clearDraft('case', null);
}

function closeModal(skipConfirm) {
  // 有未保存改动时先确认，避免误点遮罩/取消导致内容清零；
  // 真正保存成功时由 saveCase 传 true 跳过确认直接关闭。
  if (!skipConfirm && isCaseDirty()) {
    if (!confirm('当前内容尚未保存，确定要放弃吗？\n（未保存的内容将丢失）')) {
      return; // 用户取消 -> 保住内容，不关闭
    }
  }
  clearDraft('case', null); // 关闭即清除草稿（无论放弃还是保存完成）
  document.getElementById('editModal').classList.remove('show');
  editingId = null;
  caseSnapshot = '';
}

async function saveCase() {
  const saveBtn = document.getElementById('saveBtn');
  const originalText = saveBtn ? saveBtn.textContent : '保存';
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中...'; }
  try {
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
    summary: MarkdownEditor.toHtml(caseEditor ? caseEditor.value() : document.getElementById('f_summary').value),
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
  await DataStore.saveSEO('case_' + data.id, seo);

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
  closeModal(true);
  await loadData();
  } catch (e) {
    console.error('案例保存失败', e);
    showToast('保存失败：' + (e && e.message ? e.message : e) + '（本地可能已缓存，请重试）', 'error', 6000);
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText; }
  }
}

async function deleteCase(id) {
  if (!confirm('确定删除此案例？')) return;
  try {
    cases = cases.filter(c => c.id !== id);
    await DataStore.saveCases(cases);
    showToast('已删除', 'success');
    await loadData();
  } catch (e) {
    console.error('案例删除失败', e);
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
