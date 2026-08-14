// 博客管理
let editingId = null;
let blogs = [];
let blogSnapshot = '';

// Markdown 编辑器相关
let contentEditor = null;
let emojiPanel = null;
let turndownService = null;

const EMOJIS = ['😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤩', '🤔', '🙏',
  '👍', '👏', '💪', '🔥', '✨', '⭐', '💡', '📈', '📉', '🎯',
  '✅', '❌', '❓', '💰', '🚀', '🎉', '❤️', '🦷', '📝', '⏰',
  '🤝', '😅', '🥳', '💯', '🌟', '👀', '📌', '📚', '🏆', '🌈'];

document.addEventListener('DOMContentLoaded', async function () {
  checkAuth();
  bindEvents();
  initEditor();
  await DataStore.hydrateSEO();
  await loadData();
});

// 初始化 Markdown 编辑器（EasyMDE）+ HTML→MD 转换器 + emoji 面板
function initEditor() {
  turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  });

  contentEditor = new EasyMDE({
    element: document.getElementById('f_content'),
    autoDownloadFontAwesome: false,
    spellChecker: false,
    minHeight: '340px',
    toolbar: buildToolbar(),
    status: false,
    placeholder: '支持 Markdown 语法，可实时预览；也可直接书写 HTML。点击 😀 插入表情。'
  });

  labelToolbarIcons();
  initEmojiPanel();
  // 编辑器内容变化即自动存草稿（防误关/刷新丢失）
  if (contentEditor && contentEditor.codemirror) {
    contentEditor.codemirror.on('change', autoSaveBlogDraft);
  }
}

// 用文字/emoji 直接标注工具栏按钮（不依赖 Font Awesome）
function labelToolbarIcons() {
  const map = {
    'tb-bold': 'B', 'tb-italic': 'I', 'tb-h': 'H', 'tb-quote': '❝',
    'tb-code': '</>', 'tb-ul': '•≡', 'tb-ol': '1.', 'tb-link': '🔗',
    'tb-image': '🖼', 'tb-preview': '👁', 'tb-side': '▏▕', 'tb-full': '⛶', 'tb-emoji': '😀'
  };
  document.querySelectorAll('.editor-toolbar button').forEach(function (btn) {
    Object.keys(map).forEach(function (cls) {
      if (btn.classList.contains(cls)) btn.textContent = map[cls];
    });
  });
}

// 自定义工具栏（不依赖 Font Awesome，图标用文字/emoji 渲染）
function buildToolbar() {
  return [
    { name: 'bold', action: EasyMDE.toggleBold, className: 'tb-ico tb-bold', title: '加粗' },
    { name: 'italic', action: EasyMDE.toggleItalic, className: 'tb-ico tb-italic', title: '斜体' },
    { name: 'heading', action: EasyMDE.toggleHeadingSmaller, className: 'tb-ico tb-h', title: '标题' },
    '|',
    { name: 'quote', action: EasyMDE.toggleBlockquote, className: 'tb-ico tb-quote', title: '引用' },
    { name: 'code', action: EasyMDE.toggleCodeBlock, className: 'tb-ico tb-code', title: '代码块' },
    '|',
    { name: 'unordered-list', action: EasyMDE.toggleUnorderedList, className: 'tb-ico tb-ul', title: '无序列表' },
    { name: 'ordered-list', action: EasyMDE.toggleOrderedList, className: 'tb-ico tb-ol', title: '有序列表' },
    '|',
    { name: 'link', action: EasyMDE.drawLink, className: 'tb-ico tb-link', title: '链接' },
    { name: 'image', action: EasyMDE.drawImage, className: 'tb-ico tb-image', title: '图片' },
    '|',
    { name: 'preview', action: EasyMDE.togglePreview, className: 'tb-ico tb-preview', title: '预览' },
    { name: 'side-by-side', action: EasyMDE.toggleSideBySide, className: 'tb-ico tb-side', title: '分屏' },
    { name: 'fullscreen', action: EasyMDE.toggleFullScreen, className: 'tb-ico tb-full', title: '全屏' },
    '|',
    { name: 'emoji', action: toggleEmojiPanel, className: 'tb-ico tb-emoji', title: '插入表情' }
  ];
}

// emoji 浮动面板
function initEmojiPanel() {
  emojiPanel = document.createElement('div');
  emojiPanel.className = 'emoji-panel';
  emojiPanel.style.display = 'none';

  EMOJIS.forEach(function (e) {
    const span = document.createElement('span');
    span.className = 'emoji-item';
    span.textContent = e;
    span.addEventListener('click', function () {
      if (contentEditor) contentEditor.codemirror.replaceSelection(e);
      emojiPanel.style.display = 'none';
      contentEditor.codemirror.focus();
    });
    emojiPanel.appendChild(span);
  });

  document.body.appendChild(emojiPanel);

  document.addEventListener('click', function (ev) {
    if (emojiPanel.style.display !== 'none' &&
      !emojiPanel.contains(ev.target) &&
      !(ev.target.closest && ev.target.closest('.tb-emoji'))) {
      emojiPanel.style.display = 'none';
    }
  });
}

function toggleEmojiPanel(editor) {
  if (!emojiPanel) return;
  if (emojiPanel.style.display === 'none') {
    const rect = editor.codemirror.getWrapperElement().getBoundingClientRect();
    emojiPanel.style.top = (rect.bottom + 6) + 'px';
    emojiPanel.style.left = rect.left + 'px';
    emojiPanel.style.display = 'grid';
  } else {
    emojiPanel.style.display = 'none';
  }
}

// 存储的是 HTML；编辑时转回 Markdown（纯文本/已是 Markdown 则原样返回）
function toMarkdown(html) {
  if (/<[a-z][\s\S]*>/i.test(html)) {
    try { return turndownService.turndown(html); } catch (e) { return html; }
  }
  return html;
}

function bindEvents() {
  document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout(); });
  document.getElementById('addBtn').addEventListener('click', () => openModal(null));
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', async function () { await saveBlog(); });
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

  // 新增模式：普通字段输入即自动存草稿（正文编辑器变化已在 initEditor 内监听）
  ['f_id', 'f_title', 'f_category', 'f_author', 'f_tags', 'f_summary', 'f_content', 'f_coverImage', 'f_publishDate', 'f_seo_title', 'f_seo_description', 'f_seo_keywords', 'f_seo_ogImage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', autoSaveBlogDraft);
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
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--color-text-muted);">暂无文章</td></tr>';
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
        <td><strong style="color:var(--color-text-primary);">${blog.title}</strong></td>
        <td>${catLabel}</td>
        <td>${blog.author}</td>
        <td>${blog.publishDate}</td>
        <td>${blog.readTime} 分钟</td>
        <td><span class="seo-badge ${seoBadge}">${seoText}</span></td>
        <td class="list-actions">
          <a class="btn btn-sm btn-outline" href="../blog-detail.html?id=${encodeURIComponent(blog.id)}" target="_blank" rel="noopener">🔗 查看</a>
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
      document.getElementById('f_tags').value = (blog.tags || []).join(',');
      document.getElementById('f_summary').value = blog.summary || '';
      contentEditor.value(toMarkdown(blog.content || ''));
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
      if (el.id !== 'f_author') el.value = '';
    });
    document.getElementById('f_publishDate').value = new Date().toISOString().split('T')[0];
    contentEditor.value('');
    // 新增：自动恢复上次未保存的草稿（防误关/刷新清零）
    const d = loadDraft('blog', null);
    if (d && draftHasContent(d)) {
      fillBlogDraft(d);
      showToast('已自动恢复上次未保存的草稿', 'info', 3000);
    }
  }

  updateSeoScore();
  modal.classList.add('show');
  // 弹窗由隐藏变显示后，CodeMirror 必须等浏览器完成布局再 refresh，否则编辑区塌陷
  if (contentEditor) refreshEditor(contentEditor);
  blogSnapshot = collectBlogForm(); // 记录初始快照（填充+恢复草稿后），用于"未保存确认"脏检测
}

// 等弹窗显示并完成布局后再刷新 CodeMirror，修复隐藏初始化导致的编辑区塌陷
function refreshEditor(editor) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try { editor.codemirror.refresh(); } catch (e) {}
    });
  });
}

// 收集博客表单数据（用于脏检测与草稿）
function collectBlogData() {
  return {
    id: val('f_id'),
    title: val('f_title'),
    category: val('f_category'),
    author: val('f_author'),
    tags: val('f_tags'),
    summary: val('f_summary'),
    content: contentEditor ? contentEditor.value() : val('f_content'),
    coverImage: val('f_coverImage'),
    publishDate: val('f_publishDate'),
    seoTitle: val('f_seo_title'),
    seoDesc: val('f_seo_description'),
    seoKeywords: val('f_seo_keywords'),
    seoOg: val('f_seo_ogImage')
  };
}
function collectBlogForm() { return JSON.stringify(collectBlogData()); }
function isBlogDirty() { return collectBlogForm() !== blogSnapshot; }

// 把草稿对象填回表单（含 Markdown 编辑器）
function fillBlogDraft(d) {
  document.getElementById('f_id').value = d.id || '';
  document.getElementById('f_title').value = d.title || '';
  document.getElementById('f_category').value = d.category || '';
  document.getElementById('f_author').value = d.author || '';
  document.getElementById('f_tags').value = d.tags || '';
  document.getElementById('f_summary').value = d.summary || '';
  if (contentEditor) contentEditor.value(d.content || '');
  else document.getElementById('f_content').value = d.content || '';
  document.getElementById('f_coverImage').value = d.coverImage || '';
  document.getElementById('f_publishDate').value = d.publishDate || new Date().toISOString().split('T')[0];
  document.getElementById('f_seo_title').value = d.seoTitle || '';
  document.getElementById('f_seo_description').value = d.seoDesc || '';
  document.getElementById('f_seo_keywords').value = d.seoKeywords || '';
  document.getElementById('f_seo_ogImage').value = d.seoOg || '';
}

// 新增模式自动存草稿；编辑模式不存（数据已在，靠确认保护）
function autoSaveBlogDraft() {
  if (editingId) return;
  const d = collectBlogData();
  if (draftHasContent(d)) saveDraft('blog', null, d);
  else clearDraft('blog', null);
}

function closeModal(skipConfirm) {
  // 有未保存改动时先确认，避免误点遮罩/取消导致内容清零；
  // 真正保存成功时由 saveBlog 传 true 跳过确认直接关闭。
  if (!skipConfirm && isBlogDirty()) {
    if (!confirm('当前内容尚未保存，确定要放弃吗？\n（未保存的内容将丢失）')) {
      return; // 用户取消 -> 保住内容，不关闭
    }
  }
  clearDraft('blog', null); // 关闭即清除草稿（无论放弃还是保存完成）
  document.getElementById('editModal').classList.remove('show');
  editingId = null;
  blogSnapshot = '';
}

// 根据正文内容自动估算阅读时长：中文约 400 字/分钟，英文约 200 词/分钟，向上取整，最少 1 分钟
function calcReadTime(html) {
  if (!html) return 1;
  const text = String(html)
    .replace(/<[^>]+>/g, ' ')        // 去除 HTML 标签
    .replace(/[#>*_`~\[\]()]/g, ' ') // 去除常见 Markdown 符号
    .replace(/\s+/g, ' ')
    .trim();
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
  const en = (text.match(/[A-Za-z0-9]+/g) || []).length;
  const minutes = cjk / 400 + en / 200;
  return Math.max(1, Math.ceil(minutes || 0));
}

async function saveBlog() {
  const saveBtn = document.getElementById('saveBtn');
  const originalText = saveBtn ? saveBtn.textContent : '保存';
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中...'; }
  try {
  const contentHtml = marked.parse(contentEditor.value());
  const data = {
    id: document.getElementById('f_id').value.trim(),
    title: document.getElementById('f_title').value.trim(),
    category: document.getElementById('f_category').value,
    author: document.getElementById('f_author').value.trim(),
    readTime: calcReadTime(contentHtml),
    tags: document.getElementById('f_tags').value.split(',').map(s => s.trim()).filter(Boolean),
    summary: document.getElementById('f_summary').value.trim(),
    content: contentHtml,
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
  await DataStore.saveSEO('blog_' + data.id, seo);

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
  closeModal(true);
  await loadData();
  } catch (e) {
    console.error('文章保存失败', e);
    showToast('保存失败：' + (e && e.message ? e.message : e) + '（本地可能已缓存，请重试）', 'error', 6000);
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText; }
  }
}

async function deleteBlog(id) {
  if (!confirm('确定删除这篇文章？')) return;
  try {
    blogs = blogs.filter(b => b.id !== id);
    await DataStore.saveBlog(blogs);
    showToast('已删除', 'success');
    await loadData();
  } catch (e) {
    console.error('文章删除失败', e);
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
