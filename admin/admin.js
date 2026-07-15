// 后台通用脚本 - 加固版

// ============================================
// 1. 登录检查 + 会话过期
// ============================================
function checkAuth() {
  if (sessionStorage.getItem('fsb_admin_logged_in') !== '1') {
    window.location.href = 'login.html';
    return;
  }

  // 检查会话是否过期
  const expire = parseInt(sessionStorage.getItem('fsb_session_expire') || '0');
  if (Date.now() > expire) {
    Security.log('SESSION_EXPIRED');
    sessionStorage.clear();
    alert('⏰ 会话已过期，请重新登录');
    window.location.href = 'login.html';
  }

  // 每次操作刷新过期时间
  sessionStorage.setItem('fsb_session_expire', (Date.now() + 30 * 60 * 1000).toString());
}

// ============================================
// 2. 退出登录
// ============================================
function logout() {
  Security.log('LOGOUT');
  sessionStorage.clear();
  window.location.href = 'login.html';
}

// ============================================
// 3. Toast 提示（XSS 安全版）
// ============================================
function showToast(message, type = 'success') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${type}`;
  toast.textContent = message; // textContent 自动 XSS 安全
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============================================
// 4. 安全的数据存储（加密 + 审计）
// ============================================
const DataStore = {
  KEY_SERVICES: 'fsb_services',
  KEY_BLOG: 'fsb_blog',
  KEY_CASES: 'fsb_cases',
  KEY_PROFILE: 'fsb_profile',
  KEY_AD: 'fsb_ad_slot',
  KEY_SEO: 'fsb_seo',

  // 本次会话内刚保存的数据，立即生效（不等 GitHub 重新部署）
  _localCache: {},

  // 业务：优先读静态 JSON（全站统一数据源），失败回退本地
  async getServices() {
    if (this._localCache.services) return this._localCache.services;
    try { return await API.getRemote('services'); }
    catch (e) { return this.getDecrypted(this.KEY_SERVICES, 'services'); }
  },

  async saveServices(data) {
    await API.saveData('services', data);
    this._localCache.services = data;          // 本会话立即生效
    this._saveSync(this.KEY_SERVICES, data);   // 本地兜底缓存
    if (window.FSB_DATA) window.FSB_DATA.services = data;
  },

  // 博客
  async getBlog() {
    if (this._localCache.blog) return this._localCache.blog;
    try { return await API.getRemote('blog'); }
    catch (e) { return this.getDecrypted(this.KEY_BLOG, 'blog'); }
  },

  async saveBlog(data) {
    await API.saveData('blog', data);
    this._localCache.blog = data;
    this._saveSync(this.KEY_BLOG, data);
    if (window.FSB_DATA) window.FSB_DATA.blog = data;
  },

  // 案例
  async getCases() {
    if (this._localCache.cases) return this._localCache.cases;
    try { return await API.getRemote('cases'); }
    catch (e) { return this.getDecrypted(this.KEY_CASES, 'cases'); }
  },

  async saveCases(data) {
    await API.saveData('cases', data);
    this._localCache.cases = data;
    this._saveSync(this.KEY_CASES, data);
    if (window.FSB_DATA) window.FSB_DATA.cases = data;
  },

  getProfile() {
    try {
      const saved = localStorage.getItem(this.KEY_PROFILE);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.data || parsed; // 兼容加密/明文两种格式
      }
    } catch {}
    return {
      name: '程序烽',
      title: '企业战略顾问 · AI落地专家',
      desc: '兴义市烽审榜技术咨询服务行创始人。深耕企业品牌运营、口腔行业、AI落地三大领域，服务过传统制造、连锁口腔、消费品、跨境内容等数十个行业客户。',
      stats: [
        { num: 6, label: '业务领域' },
        { num: 150, label: '服务客户' },
        { num: 100, label: '交付达成%' }
      ]
    };
  },

  saveProfile(data) {
    localStorage.setItem(this.KEY_PROFILE, JSON.stringify({ data, updatedAt: Date.now() }));
    Security.log('PROFILE_UPDATE');
  },

  getAd() {
    try {
      const saved = localStorage.getItem(this.KEY_AD);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.data || parsed;
      }
    } catch {
      return null;
    }
    return null;
  },

  saveAd(data) {
    localStorage.setItem(this.KEY_AD, JSON.stringify({ data, updatedAt: Date.now() }));
    Security.log('AD_UPDATE');
  },

  getSEO(key) {
    try {
      const all = JSON.parse(localStorage.getItem(this.KEY_SEO) || '{}');
      const entry = all[key];
      return entry?.data || entry || null;
    } catch {
      return null;
    }
  },

  saveSEO(key, data) {
    try {
      const all = JSON.parse(localStorage.getItem(this.KEY_SEO) || '{}');
      all[key] = { data, updatedAt: Date.now() };
      localStorage.setItem(this.KEY_SEO, JSON.stringify(all));
      Security.log('SEO_UPDATE', { key });
    } catch (e) {
      console.error('保存SEO失败', e);
    }
  },

  getAllSEO() {
    try {
      const all = JSON.parse(localStorage.getItem(this.KEY_SEO) || '{}');
      const result = {};
      Object.keys(all).forEach(k => {
        result[k] = all[k]?.data || all[k];
      });
      return result;
    } catch {
      return {};
    }
  },

  // 站点配置：读 /data/config.json（经 API），失败回退本地 + 默认值
  async getConfig() {
    try {
      const data = await API.getRemote('config');
      if (data && typeof data === 'object') {
        this._localCache = this._localCache || {};
        this._localCache.config = data;
        try { localStorage.setItem('fsb_site_config', JSON.stringify({ data, updatedAt: Date.now() })); } catch (e) {}
        return data;
      }
    } catch (e) { /* 回退本地 */ }
    try {
      const saved = localStorage.getItem('fsb_site_config');
      if (saved) return JSON.parse(saved).data || JSON.parse(saved);
    } catch (e) {}
    return { ...DEFAULT_CONFIG };
  },

  // 保存站点配置：写回 GitHub（经 /api/save），本地兜底
  async saveConfig(cfg) {
    try {
      await API.saveData('config', cfg);
    } catch (e) {
      console.error('保存站点配置失败', e);
    }
    this._localCache = this._localCache || {};
    this._localCache.config = cfg;
    try { localStorage.setItem('fsb_site_config', JSON.stringify({ data: cfg, updatedAt: Date.now() })); } catch (e) {}
    if (window.SITE_CONFIG) Object.assign(window.SITE_CONFIG, cfg);
  },

  // ============================================
  // 内部方法：兼容旧数据 + 加密选项
  // ============================================
  _getSync(key, fallbackName) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return window.FSB_DATA?.[fallbackName] || [];
      const parsed = JSON.parse(saved);
      return parsed.data || parsed; // 优先取 data 字段
    } catch {
      return window.FSB_DATA?.[fallbackName] || [];
    }
  },

  _saveSync(key, data) {
    const payload = {
      data,
      updatedAt: Date.now(),
      updatedBy: sessionStorage.getItem('fsb_admin_user') || 'system'
    };
    localStorage.setItem(key, JSON.stringify(payload));
    Security.log('DATA_UPDATE', { key, count: Array.isArray(data) ? data.length : 1 });
  },

  // ============================================
  // 加密版存储（AES-GCM）
  // ============================================
  async saveEncrypted(key, data) {
    const payload = {
      data,
      updatedAt: Date.now(),
      updatedBy: sessionStorage.getItem('fsb_admin_user') || 'system'
    };
    const encrypted = await Security.encryptData(payload);
    localStorage.setItem(key, JSON.stringify(encrypted));
    Security.log('DATA_ENCRYPTED', { key, count: Array.isArray(data) ? data.length : 1 });
  },

  async getDecrypted(key, fallbackName) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return window.FSB_DATA?.[fallbackName] || [];
      const parsed = JSON.parse(saved);
      // 检测是否是加密格式
      if (parsed && parsed.iv && parsed.ct) {
        const decrypted = await Security.decryptData(parsed);
        return decrypted?.data || decrypted || [];
      }
      // 兼容未加密的旧数据
      return parsed.data || parsed || [];
    } catch {
      return window.FSB_DATA?.[fallbackName] || [];
    }
  }
};

// ============================================
// 5. 加载站点配置
// ============================================
function getSiteConfig() {
  try {
    const saved = localStorage.getItem('fsb_site_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.data || parsed;
    }
  } catch {}
  return {};
}

function saveSiteConfig(cfg) {
  const payload = {
    data: cfg,
    updatedAt: Date.now(),
    updatedBy: sessionStorage.getItem('fsb_admin_user') || 'system'
  };
  localStorage.setItem('fsb_site_config', JSON.stringify(payload));
  Security.log('CONFIG_UPDATE');
  showToast('站点配置已保存', 'success');
}

// ============================================
// 6. SEO 评分函数
// ============================================
function calculateSEOScore(seo) {
  let score = 0;
  if (seo?.title && seo.title.length >= 10 && seo.title.length <= 60) score += 30;
  else if (seo?.title) score += 15;
  if (seo?.description && seo.description.length >= 50 && seo.description.length <= 160) score += 30;
  else if (seo?.description) score += 15;
  if (seo?.keywords && seo.keywords.length > 0) score += 20;
  if (seo?.ogImage) score += 20;
  return score;
}

// ============================================
// 7. 安全渲染：防止 XSS
// ============================================
function safeSetHTML(element, html) {
  // 白名单过滤（仅允许简单标签）
  const clean = Security.sanitizeHTML(html);
  element.textContent = clean; // 双重保险：用 textContent
}

// ============================================
// 8. 检测异常行为
// ============================================
window.addEventListener('error', function (e) {
  Security.log('JS_ERROR', {
    message: e.message,
    filename: e.filename,
    line: e.lineno
  });
});

window.addEventListener('unhandledrejection', function (e) {
  Security.log('PROMISE_REJECTION', {
    reason: String(e.reason).substring(0, 200)
  });
});

// 检测开发者工具开启（生产环境可选）
// if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
//   setInterval(() => {
//     const threshold = 160;
//     if (window.outerHeight - window.innerHeight > threshold ||
//         window.outerWidth - window.innerWidth > threshold) {
//       Security.log('DEVTOOLS_OPENED');
//     }
//   }, 3000);
// }
