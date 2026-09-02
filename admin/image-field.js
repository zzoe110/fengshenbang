// ============================================
// admin/image-field.js
// 通用图片上传字段组件（烽审榜后台）
// 用法：把任意 <input type="text" id="xxx"> 包进一个容器即可获得
//   <div class="fsb-img" data-input="xxx">
//     <div class="fsb-img-prev"></div>
//     <div class="fsb-img-row">
//       <button type="button" class="fsb-img-btn">📤 上传图片</button>
//       <button type="button" class="fsb-img-clear">清除</button>
//       <span class="fsb-img-name"></span>
//     </div>
//     <input type="file" accept="image/*" class="fsb-img-file" hidden>
//     <input type="text" class="form-input" id="xxx" placeholder="…">
//   </div>
// 特性：
//   · 点击「上传图片」→ 选文件 → POST /api/upload → 回填线上 URL
//   · 缩略图实时预览（兼容 https / 相对路径 / Emoji 图标）
//   · 仍可直接手填图片 URL（兼容外链与历史数据）
//   · 与原存储格式完全兼容（值仍是 URL 字符串或 Emoji 字符串）
// ============================================
(function () {
  'use strict';

  function getAdminToken() {
    try { return sessionStorage.getItem('fsb_admin_token') || ''; } catch (e) { return ''; }
  }

  function toast(msg, isErr) {
    var t = document.createElement('div');
    t.className = 'fsb-toast' + (isErr ? ' err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 2200);
  }

  function resolveUrl(j) {
    if (j && j.url && /^https?:/i.test(j.url)) return j.url;
    if (j && j.url && j.url.charAt(0) === '/') return j.url;
    if (j && j.fileName) return '/assets/uploads/' + j.fileName;
    return '';
  }

  function uploadOne(file, done) {
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
          var url = resolveUrl(j);
          if (j && j.ok && url) { toast('上传成功'); done(url); }
          else { toast('上传失败：' + ((j && (j.error || j.msg)) || '未知错误'), true); }
        })
        .catch(function () { toast('上传失败，请检查网络', true); });
    };
    fr.onerror = function () { toast('读取文件失败', true); };
    fr.readAsDataURL(file);
  }

  // 是否「链接」（http 或相对路径开头）→ 当图片渲染；否则当 Emoji 文本渲染
  function isLink(v) {
    return /^https?:\/\//i.test(v) || v.charAt(0) === '/';
  }

  function renderPrev(box) {
    var input = box._input;
    var prev = box._prev;
    var name = box._name;
    var v = (input.value || '').trim();
    if (!v) {
      prev.classList.remove('has');
      prev.innerHTML = '<span class="fsb-img-ph">暂无图片</span>';
      if (name) name.textContent = '';
      return;
    }
    if (!isLink(v)) {
      // Emoji / 文字图标模式
      prev.classList.add('has');
      prev.innerHTML = '<span class="fsb-img-emoji">' + v.replace(/</g, '&lt;') + '</span>';
      if (name) name.textContent = '（Emoji 图标）';
      return;
    }
    prev.classList.add('has');
    prev.innerHTML = '<img src="' + v.replace(/"/g, '%22') + '" alt="预览">';
    if (name) name.textContent = v;
  }

  function bind(box) {
    if (box._bound) return;
    var inputId = box.getAttribute('data-input');
    var input = document.getElementById(inputId);
    if (!input) return;
    var fileInput = box.querySelector('.fsb-img-file');
    var btn = box.querySelector('.fsb-img-btn');
    var clearBtn = box.querySelector('.fsb-img-clear');
    var prev = box.querySelector('.fsb-img-prev');
    var name = box.querySelector('.fsb-img-name');
    if (!fileInput || !btn || !prev) return;
    box._input = input; box._prev = prev; box._name = name;
    box._bound = true;

    btn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) {
        uploadOne(fileInput.files[0], function (u) { input.value = u; renderPrev(box); fileInput.value = ''; });
      }
    });
    if (clearBtn) clearBtn.addEventListener('click', function () { input.value = ''; renderPrev(box); });
    input.addEventListener('input', function () { renderPrev(box); });
    renderPrev(box);
  }

  function init() {
    document.querySelectorAll('.fsb-img').forEach(bind);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // 暴露给各页面：弹窗动态打开后如有新节点可再调用一次
  window.FsImageField = { init: init };
})();
