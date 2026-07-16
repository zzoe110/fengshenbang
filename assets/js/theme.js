/* ============================================
   烽审榜 主题切换 (黑金 / 日间)
   - 同步阶段：读取 localStorage 立即设置 data-theme，避免闪烁
   - DOMContentLoaded：注入悬浮切换按钮
   - 持久化：localStorage('fsb-theme')，前台后台共享同一状态
   ============================================ */
(function () {
  'use strict';

  var KEY = 'fsb-theme';

  // 图标（内联 SVG，用 currentColor 跟随主题色）
  var ICON_SUN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4.6"/>' +
    '<line x1="12" y1="2" x2="12" y2="4.2"/>' +
    '<line x1="12" y1="19.8" x2="12" y2="22"/>' +
    '<line x1="4.2" y1="4.2" x2="5.8" y2="5.8"/>' +
    '<line x1="18.2" y1="18.2" x2="19.8" y2="19.8"/>' +
    '<line x1="2" y1="12" x2="4.2" y2="12"/>' +
    '<line x1="19.8" y1="12" x2="22" y2="12"/>' +
    '<line x1="4.2" y1="19.8" x2="5.8" y2="18.2"/>' +
    '<line x1="18.2" y1="5.8" x2="19.8" y2="4.2"/>' +
    '</svg>';
  var ICON_MOON =
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 12.79A8.5 8.5 0 0 1 11.21 3 6.5 6.5 0 1 0 21 12.79z"/>' +
    '</svg>';

  function isLight() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  // 应用主题：light 设属性，其他（含 dark）移除属性 → 默认黑金
  function apply(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function render(btn) {
    var light = isLight();
    // 显示「将要切换到的目标」图标：当前黑金→显示太阳(去日间)，当前日间→显示月亮(去黑金)
    btn.innerHTML = light ? ICON_MOON : ICON_SUN;
    var label = light ? '切换为黑金主题' : '切换为日间主题';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  function setTheme(theme) {
    apply(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch (e) {
      /* 隐私模式可能不可用，忽略 */
    }
    if (window.FSBTheme && window.FSBTheme._btn) {
      render(window.FSBTheme._btn);
    }
  }

  function toggle() {
    setTheme(isLight() ? 'dark' : 'light');
  }

  // —— 同步阶段：尽早应用，避免页面闪烁（此脚本置于 <head> 内）——
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') {
      apply(saved);
    }
  } catch (e) {
    /* ignore */
  }

  // —— 注入切换按钮（支持挂载点；兼容 DOMContentLoaded 已触发的情况）——
  function inject() {
    if (document.querySelector('.fsb-theme-toggle')) return; // 防重复注入

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fsb-theme-toggle';
    render(btn);
    btn.addEventListener('click', toggle);

    // 若页面指定了挂载容器（如后台登录页要固定放边上），则插入容器内并改为内联样式
    var mount = document.getElementById('theme-toggle-mount');
    if (mount) {
      btn.classList.add('fsb-theme-toggle--inline');
      mount.appendChild(btn);
    } else {
      document.body.appendChild(btn);
    }

    window.FSBTheme = {
      get: function () {
        return isLight() ? 'light' : 'dark';
      },
      set: setTheme,
      toggle: toggle,
      _btn: btn,
    };
  }

  // 防止脚本在 DOMContentLoaded 之后才执行（如缓存/异步加载）导致按钮不注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
