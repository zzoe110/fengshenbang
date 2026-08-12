// 博客管理
let editingId = null;
let blogs = [];

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
      if (el.id !== 'f_author' && el.id !== 'f_readTime') el.value = '';
    });
    document.getElementById('f_publishDate').value = new Date().toISOString().split('T')[0];
    contentEditor.value('');
  }

  updateSeoScore();
  modal.classList.add('show');
  // 模态框由隐藏变显示后，CodeMirror 需 refresh 以正确计算高度
  if (contentEditor) contentEditor.codemirror.refresh();
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
    content: marked.parse(contentEditor.value()),
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
