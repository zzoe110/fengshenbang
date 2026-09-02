/**
 * FsEditor —— 烽审榜后台双模式富文本编辑器
 *
 * 设计目标（融合三方优点）：
 *  A. 学万盈 WYEditor：所见即所得（文职零门槛）、粘贴截图/拖拽上传、字数统计、
 *     表格弹窗、清除格式、服务端之外的客户端消毒。
 *  B. 保留烽审榜原有优势：Markdown 源码模式（对 GEO/SEO 更干净可控）、emoji 面板
 *     （口腔科普常用）、草稿自动保存回调、走现有 /api/upload。
 *  C. 零新增外部依赖：复用页面已加载的 marked / turndown，不引任何 CDN。
 *
 * 两种存储格式都支持，且与原数据完全兼容：
 *  - format: 'markdown' → 源码是 Markdown（博客正文沿用，原样兼容）
 *  - format: 'html'     → 源码是 HTML（服务/案例 summary 沿用，原样兼容）
 *
 * 用法：
 *  const ed = FsEditor.create('f_content', { format: 'markdown', minHeight: '340px' });
 *  ed.value(existingSource);      // 填充（传 Markdown 或 HTML，取决于 format）
 *  const src = ed.value();        // 取出（与 format 一致，可直接落库）
 *  const html = ed.getHTML();     // 需要预览/渲染时取 HTML
 */
(function (global) {
  'use strict';

  var uid = 0;

  /* ================= 工具 ================= */
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) { for (var k in attrs) n.setAttribute(k, attrs[k]); }
    if (html != null) n.innerHTML = html;
    return n;
  }

  function toast(msg, isErr) {
    var t = document.getElementById('fsb-toast');
    if (!t) {
      t = el('div', { id: 'fsb-toast', class: 'fsb-toast' });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'fsb-toast show' + (isErr ? ' err' : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = 'fsb-toast'; }, 2600);
  }

  /* ================= 客户端消毒 =================
   * 说明：这是第一道防线（让界面不出现危险内容）。
   * 真正的防线在服务端 —— functions/_shared.js 的 sanitizeHtml，落库前会再消毒一次。
   */
  var ALLOWED_TAGS = ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'strong', 'b', 'em', 'i', 'u', 's',
    'strike', 'del', 'ul', 'ol', 'li', 'a', 'img', 'span', 'div', 'blockquote', 'pre', 'code',
    'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'figure', 'figcaption'];

  function sanitize(html) {
    var d = document.createElement('div');
    d.innerHTML = String(html == null ? '' : html);
    (function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        if (c.nodeType === 1) {
          var tag = c.tagName.toLowerCase();
          if (ALLOWED_TAGS.indexOf(tag) === -1) {
            // 不在白名单：保留文字内容，丢掉标签本身
            var frag = document.createDocumentFragment();
            while (c.firstChild) frag.appendChild(c.firstChild);
            node.replaceChild(frag, c);
            continue;
          }
          // script / iframe 若因故混入，直接移除整个节点
          if (tag === 'script' || tag === 'iframe' || tag === 'style' || tag === 'object' || tag === 'embed') {
            node.removeChild(c);
            continue;
          }
          var at = Array.prototype.slice.call(c.attributes);
          for (var j = 0; j < at.length; j++) {
            var name = at[j].name.toLowerCase();
            var val = at[j].value;
            var keep = false;
            if (name.indexOf('on') === 0) keep = false;                        // 事件属性一律删
            else if (name === 'href' && tag === 'a') keep = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(val);
            else if (name === 'src' && tag === 'img') keep = /^(https?:\/\/|\/|data:image\/)/i.test(val);
            else if (name === 'style' || name === 'alt' || name === 'title' ||
                     name === 'width' || name === 'height' || name === 'target' ||
                     name === 'rel' || name === 'colspan' || name === 'rowspan' ||
                     name === 'class') keep = true;
            if (!keep) c.removeAttribute(at[j].name);
          }
          if (tag === 'a') {
            var rel = c.getAttribute('target') === '_blank' ? 'noopener noreferrer' : 'noopener';
            c.setAttribute('rel', rel);
          }
          walk(c);
        } else if (c.nodeType !== 3) {
          node.removeChild(c); // 注释等
        }
      }
    })(d);
    return d.innerHTML;
  }

  /* ================= 图片上传（走烽审榜现有 /api/upload） ================= */
  function getAdminToken() {
    try { return sessionStorage.getItem('fsb_admin_token') || ''; } catch (e) { return ''; }
  }

  function resolveUploadUrl(j) {
    if (j && j.url && /^https?:/i.test(j.url)) return j.url;
    if (j && j.url && j.url.charAt(0) === '/') return j.url;
    if (j && j.fileName) return '/assets/uploads/' + j.fileName;
    return '';
  }

  function uploadImage(file, done) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('只能上传图片文件', true); return; }
    if (file.size > 2 * 1024 * 1024) { toast('图片不能超过 2MB，请先压缩', true); return; }
    toast('正在上传图片…');
    var fr = new FileReader();
    fr.onload = function () {
      var base64 = String(fr.result).split(',')[1];
      fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAdminToken() },
        body: JSON.stringify({ mime: file.type, data: base64, name: file.name })
      })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (j) {
          var url = resolveUploadUrl(j);
          if (j && j.ok && url) { toast('图片已插入'); done(url); }
          else toast('上传失败：' + ((j && (j.error || j.msg)) || '未知错误'), true);
        })
        .catch(function () { toast('上传失败，请检查网络', true); });
    };
    fr.onerror = function () { toast('读取文件失败', true); };
    fr.readAsDataURL(file);
  }

  /* ================= 源码 ⇄ HTML 互转 ================= */
  function mdToHtml(md) {
    if (typeof marked !== 'undefined') {
      try { return marked.parse(md || ''); } catch (e) { return '<p>' + String(md || '') + '</p>'; }
    }
    return '<p>' + String(md || '').replace(/\n/g, '<br>') + '</p>';
  }

  var _td = null;
  function htmlToMd(html) {
    if (typeof TurndownService !== 'undefined') {
      try {
        if (!_td) {
          _td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
        }
        return _td.turndown(html || '');
      } catch (e) { return String(html || ''); }
    }
    return String(html || '');
  }

  // 旧数据是纯文本（无任何标签）时，自动包成段落，避免整段挤成一行
  function plainToHtml(text) {
    var parts = String(text).split(/\n{2,}/);
    var out = parts.map(function (p) {
      var t = p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
    }).join('');
    return out || '<p><br></p>';
  }

  var EMOJIS = ['😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤩', '🤔', '🙏',
    '👍', '👏', '💪', '🔥', '✨', '⭐', '💡', '📈', '📉', '🎯',
    '✅', '❌', '❓', '💰', '🚀', '🎉', '❤️', '🦷', '📝', '⏰',
    '🤝', '😅', '🥳', '💯', '🌟', '👀', '📌', '📚', '🏆', '🌈'];

  /* ================= 编辑器主体 ================= */
  function FsEditor(textareaId, options) {
    options = options || {};
    var self = this;

    this.id = 'fsb-ed-' + (++uid);
    this.format = options.format === 'html' ? 'html' : 'markdown'; // 源码模式下的文本格式
    this.onChange = options.onChange || function () {};
    this.placeholder = options.placeholder || '在这里输入内容…';
    this.minHeight = options.minHeight || '300px';
    this.mode = 'wysiwyg';
    this._source = '';

    var host = document.getElementById(textareaId);
    if (!host) { console.warn('FsEditor: 找不到 #' + textareaId); return; }

    // 保留原始 textarea（表单兜底 + 数据回填前读取），但隐藏它
    host.style.display = 'none';
    this.host = host;

    var wrap = el('div', { class: 'fsb-ed' });
    var toolbar = el('div', { class: 'fsb-ed-toolbar' });
    var body = el('div', {
      class: 'fsb-ed-body', contenteditable: 'true', role: 'textbox',
      'aria-multiline': 'true', 'data-placeholder': this.placeholder
    });
    body.style.minHeight = this.minHeight;
    var code = el('textarea', { class: 'fsb-ed-code', spellcheck: 'false' });
    code.style.minHeight = this.minHeight;
    var status = el('div', { class: 'fsb-ed-status' });
    var counter = el('span', { class: 'fsb-ed-count' }, '0 字');
    var tip = el('span', { class: 'fsb-ed-tip' }, '所见即所得');
    status.appendChild(counter);
    status.appendChild(tip);

    var dropTip = el('div', { class: 'fsb-ed-drop' }, '松开鼠标即可上传图片');

    wrap.appendChild(toolbar);
    wrap.appendChild(body);
    wrap.appendChild(code);
    wrap.appendChild(status);
    wrap.appendChild(dropTip);
    host.parentNode.insertBefore(wrap, host.nextSibling);

    this.wrap = wrap; this.body = body; this.code = code;
    this.toolbar = toolbar; this.counter = counter; this.tip = tip;

    this._buildToolbar();
    this.value(options.value != null ? options.value : host.value);
    this._bindEvents();
  }

  /* ---------- 工具栏 ---------- */
  FsEditor.prototype._btn = function (html, title, cmd, val, isState) {
    var self = this;
    var b = el('button', { type: 'button', class: 'fsb-ed-btn', title: title, 'aria-label': title }, html);
    b.addEventListener('mousedown', function (e) { e.preventDefault(); }); // 保住选区
    b.addEventListener('click', function () { self._exec(cmd, val); });
    this.toolbar.appendChild(b);
    if (isState) b._state = cmd;
    return b;
  };

  FsEditor.prototype._sep = function () { this.toolbar.appendChild(el('span', { class: 'fsb-ed-sep' })); };

  FsEditor.prototype._buildToolbar = function () {
    var self = this;

    this._btn('↶', '撤销 (Ctrl+Z)', 'undo');
    this._btn('↷', '重做 (Ctrl+Shift+Z)', 'redo');
    this._sep();

    this._btn('<b>B</b>', '加粗 (Ctrl+B)', 'bold', null, true);
    this._btn('<i>I</i>', '斜体 (Ctrl+I)', 'italic', null, true);
    this._btn('<u>U</u>', '下划线 (Ctrl+U)', 'underline', null, true);
    this._btn('<s>S</s>', '删除线', 'strikeThrough', null, true);
    this._sep();

    // 字号
    var sizes = el('select', { class: 'fsb-ed-select', title: '字号' });
    [['', '字号'], ['1', '很小'], ['2', '小'], ['3', '正常'], ['4', '大'], ['5', '较大'], ['6', '很大'], ['7', '特大']]
      .forEach(function (p) { sizes.appendChild(el('option', { value: p[0] }, p[1])); });
    sizes.addEventListener('change', function () {
      if (!sizes.value) return;
      self._exec('fontSize', sizes.value);
      sizes.value = '';
    });
    this.toolbar.appendChild(sizes);

    // 文字色 / 背景色
    var fg = el('input', { type: 'color', class: 'fsb-ed-color', title: '文字颜色', value: '#1a1a1a' });
    fg.addEventListener('input', function () { self._exec('foreColor', fg.value); });
    this.toolbar.appendChild(fg);

    var bg = el('input', { type: 'color', class: 'fsb-ed-color', title: '文字背景色', value: '#ffffff' });
    bg.addEventListener('input', function () { self._exec('hiliteColor', bg.value); });
    this.toolbar.appendChild(bg);
    this._sep();

    // 段落格式
    var fmt = el('select', { class: 'fsb-ed-select', title: '段落格式' });
    [['p', '正文'], ['h2', '大标题'], ['h3', '中标题'], ['h4', '小标题'], ['blockquote', '引用']]
      .forEach(function (p) { fmt.appendChild(el('option', { value: p[0] }, p[1])); });
    fmt.addEventListener('change', function () { self._exec('formatBlock', fmt.value); });
    this.toolbar.appendChild(fmt);
    this._sep();

    this._btn('⇤', '左对齐', 'justifyLeft', null, true);
    this._btn('≡', '居中', 'justifyCenter', null, true);
    this._btn('⇥', '右对齐', 'justifyRight', null, true);
    this._sep();

    this._btn('•—', '项目符号', 'insertUnorderedList', null, true);
    this._btn('1.', '编号列表', 'insertOrderedList', null, true);
    this._btn('→|', '增加缩进', 'indent');
    this._btn('|←', '减少缩进', 'outdent');
    this._sep();

    var linkBtn = el('button', { type: 'button', class: 'fsb-ed-btn', title: '插入 / 编辑链接' }, '🔗');
    linkBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    linkBtn.addEventListener('click', function () { self._linkDialog(); });
    this.toolbar.appendChild(linkBtn);

    this._btn('⊘', '取消链接', 'unlink');

    var imgBtn = el('button', { type: 'button', class: 'fsb-ed-btn', title: '插入图片（上传 / 粘贴 / 拖拽 / 外链）' }, '🖼');
    imgBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    imgBtn.addEventListener('click', function () { self._imageDialog(); });
    this.toolbar.appendChild(imgBtn);
    this._sep();

    this._btn('—', '分割线', 'insertHorizontalRule');
    this._btn('🧹', '清除格式', 'removeFormat');
    this._sep();

    var tblBtn = el('button', { type: 'button', class: 'fsb-ed-btn', title: '插入表格' }, '▦');
    tblBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    tblBtn.addEventListener('click', function () { self._tableDialog(); });
    this.toolbar.appendChild(tblBtn);

    // emoji（烽审榜原有特色，保留）
    var emoBtn = el('button', { type: 'button', class: 'fsb-ed-btn', title: '插入表情' }, '😀');
    emoBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    emoBtn.addEventListener('click', function (e) { e.stopPropagation(); self._toggleEmoji(emoBtn); });
    this.toolbar.appendChild(emoBtn);
    this._sep();

    var codeBtn = el('button', { type: 'button', class: 'fsb-ed-btn', title: '切换到源码模式' }, '&lt;/&gt;');
    codeBtn.addEventListener('click', function () { self.toggleMode(); });
    this.toolbar.appendChild(codeBtn);
    this._codeBtn = codeBtn;
  };

  /* ---------- 命令执行 ---------- */
  FsEditor.prototype._exec = function (cmd, val) {
    if (this.mode === 'source') { toast('请先退出源码模式', true); return; }
    this.body.focus();
    try {
      document.execCommand(cmd, false, val == null ? null : val);
    } catch (e) {
      if (cmd === 'formatBlock') this._formatBlockFallback(val);
    }
    this._sync();
    this._updateToolbarState();
  };

  // execCommand 万一失效时的兜底（新浏览器仍全平台可用，此处仅保险）
  FsEditor.prototype._formatBlockFallback = function (tag) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var node = sel.getRangeAt(0).startContainer;
    var p = node.nodeType === 3 ? node.parentNode : node;
    while (p && p !== this.body && !/^(P|H2|H3|H4|BLOCKQUOTE|DIV|LI)$/.test(p.tagName || '')) p = p.parentNode;
    if (!p || p === this.body) return;
    var n = document.createElement(tag === 'blockquote' ? 'blockquote' : tag);
    n.innerHTML = p.innerHTML;
    p.parentNode.replaceChild(n, p);
  };

  FsEditor.prototype._updateToolbarState = function () {
    if (this.mode === 'source') return;
    var kids = this.toolbar.querySelectorAll('.fsb-ed-btn');
    for (var i = 0; i < kids.length; i++) {
      var b = kids[i];
      if (!b._state) continue;
      var on = false;
      try { on = document.queryCommandState(b._state); } catch (e) { on = false; }
      b.classList.toggle('on', !!on);
    }
  };

  /* ---------- 通用弹窗 ---------- */
  FsEditor.prototype._promptBox = function (title, fields, onOk) {
    var modal = el('div', { class: 'fsb-ed-modal show' });
    var box = el('div', { class: 'fsb-ed-modal-box' });
    box.appendChild(el('h3', {}, title));
    var inputs = {};
    fields.forEach(function (f) {
      var w = el('div', { class: 'fsb-ed-field' });
      w.appendChild(el('label', {}, f.label));
      var inp = el('input', { type: 'text', value: f.value || '', placeholder: f.placeholder || '' });
      w.appendChild(inp);
      box.appendChild(w);
      inputs[f.name] = inp;
    });
    var actions = el('div', { class: 'fsb-ed-actions' });
    var cancel = el('button', { type: 'button', class: 'fsb-ed-btn-ghost' }, '取消');
    var ok = el('button', { type: 'button', class: 'fsb-ed-btn-main' }, '确定');
    actions.appendChild(cancel);
    actions.appendChild(ok);
    box.appendChild(actions);
    modal.appendChild(box);
    document.body.appendChild(modal);
    if (fields[0]) inputs[fields[0].name].focus();

    function close() { modal.remove(); }
    cancel.addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    ok.addEventListener('click', function () {
      var vals = {};
      for (var k in inputs) vals[k] = inputs[k].value.trim();
      close();
      onOk(vals);
    });
  };

  /* ---------- 链接 / 图片 / 表格 ---------- */
  FsEditor.prototype._linkDialog = function () {
    var self = this;
    var sel = window.getSelection();
    var text = sel && sel.toString().trim();
    var href = '';
    if (sel && sel.anchorNode) {
      var n = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
      while (n && n.tagName !== 'A' && n !== this.body) n = n.parentNode;
      if (n && n.tagName === 'A') href = n.getAttribute('href') || '';
    }
    this._promptBox('插入 / 编辑链接', [
      { name: 'text', label: '显示的文字', value: text || '' },
      { name: 'href', label: '链接地址', value: href, placeholder: 'https://…  或 /blog/xxx' }
    ], function (v) {
      if (!v.href) { self._exec('unlink'); return; }
      self._insertHTML('<a href="' + v.href.replace(/"/g, '%22') + '" rel="noopener">' +
        (v.text || v.href) + '</a>');
    });
  };

  FsEditor.prototype._imageDialog = function () {
    var self = this;
    var modal = el('div', { class: 'fsb-ed-modal show' });
    var box = el('div', { class: 'fsb-ed-modal-box' });
    box.appendChild(el('h3', {}, '插入图片'));

    var f1 = el('div', { class: 'fsb-ed-field' });
    f1.appendChild(el('label', {}, '方式一：从电脑选择（也可直接粘贴截图 / 拖拽到编辑区）'));
    var file = el('input', { type: 'file', accept: 'image/*' });
    f1.appendChild(file);
    box.appendChild(f1);

    var f2 = el('div', { class: 'fsb-ed-field' });
    f2.appendChild(el('label', {}, '方式二：填写图片地址'));
    var url = el('input', { type: 'text', placeholder: 'https://… 或 /assets/uploads/xxx.jpg' });
    f2.appendChild(url);
    box.appendChild(f2);

    var f3 = el('div', { class: 'fsb-ed-field' });
    f3.appendChild(el('label', {}, '图片说明（利于 SEO，建议填写）'));
    var alt = el('input', { type: 'text', placeholder: '例如：京州口腔门诊前台实景' });
    f3.appendChild(alt);
    box.appendChild(f3);

    var actions = el('div', { class: 'fsb-ed-actions' });
    var cancel = el('button', { type: 'button', class: 'fsb-ed-btn-ghost' }, '取消');
    var ok = el('button', { type: 'button', class: 'fsb-ed-btn-main' }, '插入');
    actions.appendChild(cancel);
    actions.appendChild(ok);
    box.appendChild(actions);
    modal.appendChild(box);
    document.body.appendChild(modal);

    function close() { modal.remove(); }
    cancel.addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });

    file.addEventListener('change', function () {
      if (file.files && file.files[0]) {
        uploadImage(file.files[0], function (u) { close(); self._insertImage(u, alt.value); });
      }
    });
    ok.addEventListener('click', function () {
      if (!url.value.trim()) { toast('请填写图片地址或选择文件', true); return; }
      close();
      self._insertImage(url.value.trim(), alt.value);
    });
  };

  FsEditor.prototype._tableDialog = function () {
    var self = this;
    this._promptBox('插入表格', [
      { name: 'rows', label: '行数', value: '3' },
      { name: 'cols', label: '列数', value: '2' }
    ], function (v) {
      var r = Math.max(1, Math.min(20, parseInt(v.rows, 10) || 3));
      var c = Math.max(1, Math.min(10, parseInt(v.cols, 10) || 2));
      var html = '<table><tbody>';
      for (var i = 0; i < r; i++) {
        html += '<tr>';
        for (var j = 0; j < c; j++) html += '<td>' + (i === 0 ? '标题' : '') + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table><p><br></p>';
      self._insertHTML(html);
    });
  };

  FsEditor.prototype._insertHTML = function (html) {
    if (this.mode === 'source') {
      this.code.focus();
      var s = this.code.selectionStart;
      var v = this.code.value;
      this.code.value = v.slice(0, s) + html + v.slice(this.code.selectionEnd);
      this._source = this.code.value;
      this._sync();
      return;
    }
    this.body.focus();
    this._exec('insertHTML', html);
  };

  FsEditor.prototype._insertImage = function (url, alt) {
    var safe = String(url).replace(/"/g, '%22');
    var altTxt = String(alt || '').replace(/"/g, '&quot;');
    if (this.mode === 'source') {
      var line = this.format === 'markdown'
        ? '![' + (alt || '') + '](' + safe + ')\n'
        : '<img src="' + safe + '" alt="' + altTxt + '" />';
      this._insertHTML(line);
      return;
    }
    this._exec('insertHTML', '<img src="' + safe + '" alt="' + altTxt + '" />');
  };

  /* ---------- emoji 面板 ---------- */
  FsEditor.prototype._toggleEmoji = function (anchorBtn) {
    var self = this;
    var panel = this._emoPanel;
    if (!panel) {
      panel = el('div', { class: 'fsb-ed-emoji' });
      EMOJIS.forEach(function (e) {
        var s = el('span', {}, e);
        s.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
        s.addEventListener('click', function () {
          panel.style.display = 'none';
          if (self.mode === 'source') {
            var c = self.code;
            var sv = c.value, ss = c.selectionStart;
            c.value = sv.slice(0, ss) + e + sv.slice(c.selectionEnd);
            self._source = c.value;
            self._sync();
            c.focus();
          } else {
            self.body.focus();
            self._exec('insertHTML', e);
          }
        });
        panel.appendChild(s);
      });
      document.body.appendChild(panel);
      this._emoPanel = panel;
      document.addEventListener('click', function () { panel.style.display = 'none'; });
    }
    if (panel.style.display === 'grid') { panel.style.display = 'none'; return; }
    var rect = anchorBtn.getBoundingClientRect();
    panel.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    panel.style.left = Math.max(8, rect.left + window.scrollX) + 'px';
    panel.style.display = 'grid';
  };

  /* ---------- 模式切换 ---------- */
  FsEditor.prototype.toggleMode = function (force) {
    var want = (force == null) ? (this.mode === 'wysiwyg' ? 'source' : 'wysiwyg') : force;
    if (want === this.mode) return;

    if (want === 'source') {
      // 所见即所得 → 源码
      this._source = this._toSource(this.body.innerHTML);
      this.code.value = this._source;
    } else {
      // 源码 → 所见即所得
      this._source = this.code.value;
      this.body.innerHTML = this._toHtml(this._source);
    }
    this.mode = want;
    this.wrap.classList.toggle('is-source', this.mode === 'source');
    this.tip.textContent = this.mode === 'source'
      ? (this.format === 'markdown' ? 'Markdown 源码模式' : 'HTML 源码模式')
      : '所见即所得';
    if (this._codeBtn) this._codeBtn.classList.toggle('on', this.mode === 'source');
    this._sync(true);
  };

  /* ---------- 取值 / 赋值 ---------- */
  FsEditor.prototype._toHtml = function (src) {
    if (this.format === 'markdown') return sanitize(mdToHtml(src));
    var s = String(src == null ? '' : src);
    if (s !== '' && !/<[a-z][\s\S]*>/i.test(s)) return plainToHtml(s); // 纯文本旧数据
    return sanitize(s);
  };

  FsEditor.prototype._toSource = function (html) {
    var clean = sanitize(html);
    if (this.format === 'markdown') return htmlToMd(clean);
    return clean;
  };

  // value()：取源码；value(v)：设置源码
  FsEditor.prototype.value = function (v) {
    if (v == null) {
      if (this.mode === 'source') {
        this._source = this.code.value;
      } else {
        this._source = this._toSource(this.body.innerHTML);
      }
      if (this.host) this.host.value = this._source; // 同步回 textarea，保证表单兜底读到最新值
      return this._source;
    }
    this._source = String(v);
    this.body.innerHTML = this._toHtml(this._source);
    this.code.value = this._source;
    if (this.host) this.host.value = this._source;
    this._sync(true);
    return this;
  };

  // 取渲染后的 HTML（预览 / 需要直接渲染时用）
  FsEditor.prototype.getHTML = function () {
    if (this.mode === 'source') return this._toHtml(this.code.value);
    return sanitize(this.body.innerHTML);
  };

  FsEditor.prototype._sync = function (silent) {
    var plain = this.mode === 'source'
      ? this.code.value
      : this.body.innerText || this.body.textContent || '';
    var txt = String(plain).replace(/\s+/g, ' ').trim();
    this.counter.textContent = txt.length + ' 字';
    if (!silent) {
      if (this.host) this.host.value = this.mode === 'source' ? this.code.value : this._toSource(this.body.innerHTML);
      this.onChange(this.value());
    }
  };

  /* ---------- 事件绑定 ---------- */
  FsEditor.prototype._bindEvents = function () {
    var self = this;

    this.body.addEventListener('input', function () { self._sync(); });
    this.body.addEventListener('keyup', function () { self._updateToolbarState(); });
    this.body.addEventListener('mouseup', function () { self._updateToolbarState(); });
    this.code.addEventListener('input', function () { self._sync(); });

    // 快捷键
    this.body.addEventListener('keydown', function (e) {
      if (!(e.metaKey || e.ctrlKey)) return;
      var k = e.key.toLowerCase();
      if (k === 'b' || k === 'i' || k === 'u') {
        e.preventDefault();
        self._exec(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline');
      } else if (k === 'z') {
        e.preventDefault();
        self._exec(e.shiftKey ? 'redo' : 'undo');
      }
    });

    // 粘贴：图片直接上传；普通文字清掉外来样式
    this.body.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      var imgItem = null;
      if (items) {
        for (var i = 0; i < items.length; i++) {
          if (items[i].type && items[i].type.indexOf('image/') === 0) { imgItem = items[i]; break; }
        }
      }
      if (imgItem) {
        e.preventDefault();
        uploadImage(imgItem.getAsFile(), function (url) { self._insertImage(url); });
        return;
      }
      e.preventDefault();
      var text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
      self._exec('insertHTML', plainToHtml(text));
    });

    // 拖拽上传
    ['dragenter', 'dragover'].forEach(function (ev) {
      self.wrap.addEventListener(ev, function (e) { e.preventDefault(); self.wrap.classList.add('dragging'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      self.wrap.addEventListener(ev, function (e) { e.preventDefault(); self.wrap.classList.remove('dragging'); });
    });
    this.wrap.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      for (var i = 0; i < files.length; i++) {
        (function (f) { uploadImage(f, function (url) { self._insertImage(url); }); })(files[i]);
      }
    });

    document.addEventListener('selectionchange', function () {
      if (document.activeElement === self.body) self._updateToolbarState();
    });
  };

  FsEditor.prototype.destroy = function () {
    if (this.wrap) this.wrap.remove();
    if (this._emoPanel) this._emoPanel.remove();
    if (this.host) this.host.style.display = '';
  };

  /* ================= 对外接口 ================= */
  global.FsEditor = {
    create: function (textareaId, opts) {
      try { return new FsEditor(textareaId, opts); }
      catch (e) { console.error('FsEditor 初始化失败', e); return null; }
    },
    sanitize: sanitize,
    toast: toast,
    mdToHtml: mdToHtml,
    htmlToMd: htmlToMd
  };
})(window);
