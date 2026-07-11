// 后台通用脚本 - API 驱动版

// ============================================
// 1. 登录检查 + 会话过期（基于 JWT）
// ============================================
function checkAuth() {
  const token = sessionStorage.getItem('fsb_admin_token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp < Date.now()) {
      throw new Error('expired');
    }
  } catch (e) {
    sessionStorage.clear();
    alert('⏰ 会话已过期，请重新登录');
    window.location.href = 'login.html';
  }
}

// ============================================
// 2. 退出登录
// ============================================
function logout() {
  sessionStorage.clear();
  window.location.href = 'login.html';
}

// ============================================
// 3. Toast 提示
// ============================================
function showToast(message, type = 'success') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============================================
// 4. 数据层（全部走后端 API，实时读写数据库）
// ============================================
const DEFAULT_PROFILE = {
  name: '程序烽',
  title: '企业战略顾问 · AI落地专家',
  desc: '兴义市烽审榜技术咨询服务行创始人。深耕企业品牌运营、口腔行业、AI落地三大领域，服务过传统制造、连锁口腔、消费品、跨境内容等数十个行业客户。',
  stats: [
    { num: 6, label: '业务领域' },
    { num: 150, label: '服务客户' },
    { num: 100, label: '交付达成%' }
  ]
};

const DataStore = {
  // ---- 博客 ----
  async getBlog() {
    try {
      return await API.getBlog();
    } catch (e) {
      console.warn('API 获取博客失败，使用内置数据', e);
      return window.FSB_DATA?.blog || [];
    }
  },
  async saveBlog(data) {
    await API.saveBlog(data);
  },

  // ---- 案例 ----
  async getCases() {
    try {
      return await API.getCases();
    } catch (e) {
      console.warn('API 获取案例失败，使用内置数据', e);
      return window.FSB_DATA?.cases || [];
    }
  },
  async saveCases(data) {
    await API.saveCases(data);
  },

  // ---- 业务 ----
  async getServices() {
    try {
      return await API.getServices();
    } catch (e) {
      console.warn('API 获取业务失败，使用内置数据', e);
      return window.FSB_DATA?.services || [];
    }
  },
  async saveServices(data) {
    await API.saveServices(data);
  },

  // ---- SEO（按 key 存于 meta 表）----
  async getSEO(key) {
    return await API.getMeta(key);
  },
  async saveSEO(key, data) {
    await API.saveMeta(key, data);
  },
  async getAllSEO() {
    try {
      return await API.getAllMeta() || {};
    } catch (e) {
      return {};
    }
  },

  // ---- 个人简介 ----
  getProfile() {
    // 同步接口保持兼容；实际值来自 API，由调用方 await
    return DEFAULT_PROFILE;
  },
  async fetchProfile() {
    try {
      return (await API.getMeta('profile')) || DEFAULT_PROFILE;
    } catch (e) {
      return DEFAULT_PROFILE;
    }
  },
  async saveProfile(data) {
    await API.saveMeta('profile', data);
  },

  // ---- 广告位 ----
  getAd() {
    return null;
  },
  async fetchAd() {
    try {
      return await API.getMeta('ad');
    } catch (e) {
      return null;
    }
  },
  async saveAd(data) {
    await API.saveMeta('ad', data);
  },

  // ---- 站点配置 ----
  getSiteConfig() {
    return {};
  },
  async fetchSiteConfig() {
    try {
      return (await API.getMeta('site_config')) || {};
    } catch (e) {
      return {};
    }
  },
  async saveSiteConfig(cfg) {
    await API.saveMeta('site_config', cfg);
    showToast('站点配置已保存', 'success');
  }
};

// ============================================
// 5. SEO 评分函数
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
// 6. 安全渲染：防止 XSS
// ============================================
function safeSetHTML(element, html) {
  const clean = (window.Security && Security.sanitizeHTML) ? Security.sanitizeHTML(html) : html;
  element.textContent = clean;
}

// ============================================
// 7. 检测异常行为（仅记录，不再写 localStorage）
// ============================================
window.addEventListener('error', function (e) {
  console.error('[error]', e.message);
});
window.addEventListener('unhandledrejection', function (e) {
  console.error('[promise]', String(e.reason).substring(0, 200));
});
