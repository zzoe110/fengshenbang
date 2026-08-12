/**
 * 公共 Markdown 编辑器模块（烽审榜 CMS）
 * 基于自托管的 EasyMDE + marked + turndown，提供：
 *  - 与博客同款的编辑器（Markdown 语法、实时预览、分屏、全屏、emoji 插入）
 *  - 存储时把 Markdown 转成 HTML（前端 innerHTML 渲染不变）
 *  - 打开时把 HTML 转回 Markdown 再编辑（纯文本/已是 MD 则原样返回）
 * 依赖（需在各后台页先用 <script> 引入）：
 *  - assets/vendor/easymde.min.js
 *  - assets/vendor/marked.min.js
 *  - assets/vendor/turndown.min.js
 * 用法：
 *  const editor = MarkdownEditor.create('f_summary', { minHeight: '240px' });
 *  editor.value(MarkdownEditor.toMd(existingHtml));   // 打开填充
 *  const html = MarkdownEditor.toHtml(editor.value()); // 保存
 */
(function () {
  'use strict';

  const EMOJIS = ['😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤩', '🤔', '🙏',
    '👍', '👏', '💪', '🔥', '✨', '⭐', '💡', '📈', '📉', '🎯',
    '✅', '❌', '❓', '💰', '🚀', '🎉', '❤️', '🦷', '📝', '⏰',
    '🤝', '😅', '🥳', '💯', '🌟', '👀', '📌', '📚', '🏆', '🌈'];

  let turndownService = null;
  function getTurndown() {
    if (!turndownService && typeof TurndownService !== 'undefined') {
      turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-'
      });
    }
    return turndownService;
  }

  // 存储的是 HTML；编辑时转回 Markdown（纯文本/已是 Markdown 则原样返回）
  function toMarkdown(html) {
    if (typeof html !== 'string') return '';
    if (/<[a-z][\s\S]*>/i.test(html)) {
      const td = getTurndown();
      if (td) {
        try { return td.turndown(html); } catch (e) { return html; }
      }
    }
    return html;
  }

  // Markdown → HTML（供前端渲染）
  function toHtml(md) {
    if (typeof marked !== 'undefined') {
      try { return marked.parse(md || ''); } catch (e) { return md || ''; }
    }
    return md || '';
  }

  // 工具栏按钮图标（用文字/emoji 直接标注，不依赖 Font Awesome）
  function labelToolbarIcons(editor) {
    const map = {
      'tb-bold': 'B', 'tb-italic': 'I', 'tb-h': 'H', 'tb-quote': '❝',
      'tb-code': '</>', 'tb-ul': '•≡', 'tb-ol': '1.', 'tb-link': '🔗',
      'tb-image': '🖼', 'tb-preview': '👁', 'tb-side': '▏▕', 'tb-full': '⛶', 'tb-emoji': '😀'
    };
    const container = editor.codemirror.getWrapperElement().closest('.EasyMDE_container');
    if (!container) return;
    container.querySelectorAll('.editor-toolbar button').forEach(function (btn) {
      Object.keys(map).forEach(function (cls) {
        if (btn.classList.contains(cls)) btn.textContent = map[cls];
      });
    });
  }

  // 自定义工具栏（不依赖 Font Awesome）
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
      { name: 'emoji', action: toggleEmoji, className: 'tb-ico tb-emoji', title: '插入表情' }
    ];
  }

  // 每个编辑器绑定自己的 emoji 浮动面板 + 外部点击关闭
  function attachEmojiPanel(editor) {
    const panel = document.createElement('div');
    panel.className = 'emoji-panel';
    panel.style.display = 'none';

    EMOJIS.forEach(function (e) {
      const span = document.createElement('span');
      span.className = 'emoji-item';
      span.textContent = e;
      span.addEventListener('click', function () {
        if (editor) editor.codemirror.replaceSelection(e);
        panel.style.display = 'none';
        editor.codemirror.focus();
      });
      panel.appendChild(span);
    });

    document.body.appendChild(panel);

    function togglePanel() {
      if (panel.style.display === 'none') {
        const rect = editor.codemirror.getWrapperElement().getBoundingClientRect();
        panel.style.top = (rect.bottom + 6) + 'px';
        panel.style.left = rect.left + 'px';
        panel.style.display = 'grid';
      } else {
        panel.style.display = 'none';
      }
    }
    editor._toggleEmoji = togglePanel;

    document.addEventListener('click', function (ev) {
      if (panel.style.display !== 'none' &&
        !panel.contains(ev.target) &&
        !(ev.target.closest && ev.target.closest('.tb-emoji'))) {
        panel.style.display = 'none';
      }
    });
  }

  // EasyMDE 工具栏 emoji 动作回调（接收 editor 实例）
  function toggleEmoji(editor) {
    if (editor && editor._toggleEmoji) editor._toggleEmoji();
  }

  /**
   * 创建编辑器实例
   * @param {string} textareaId 目标 textarea 的 id
   * @param {object} opts { minHeight, placeholder }
   * @returns {EasyMDE|null}
   */
  function create(textareaId, opts) {
    opts = opts || {};
    if (typeof EasyMDE === 'undefined') {
      console.warn('EasyMDE 未加载，无法初始化 Markdown 编辑器');
      return null;
    }
    const editor = new EasyMDE({
      element: document.getElementById(textareaId),
      autoDownloadFontAwesome: false,
      spellChecker: false,
      minHeight: opts.minHeight || '260px',
      toolbar: buildToolbar(),
      status: false,
      placeholder: opts.placeholder || '支持 Markdown 语法，可实时预览；也可直接书写 HTML。点击 😀 插入表情。'
    });
    labelToolbarIcons(editor);
    attachEmojiPanel(editor);
    return editor;
  }

  window.MarkdownEditor = {
    create: create,
    toHtml: toHtml,
    toMd: toMarkdown
  };
})();
