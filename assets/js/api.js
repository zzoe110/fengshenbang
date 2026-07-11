// ============================================
// 前端 API 客户端
// 所有数据请求走 /api（由 Nginx 反代到 Node 后端）
// ============================================
const API_BASE = '/api';

function getToken() {
  return sessionStorage.getItem('fsb_admin_token');
}

async function apiGet(path) {
  const r = await fetch(API_BASE + path, { headers: {} });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function apiSend(path, method, body, needAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (needAuth) {
    const t = getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
  }
  const r = await fetch(API_BASE + path, {
    method,
    headers,
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

const API = {
  // 鉴权
  login: (username, password) => apiSend('/auth/login', 'POST', { username, password }, false),

  // 博客
  getBlog: () => apiGet('/blog'),
  saveBlog: (arr) => apiSend('/blog', 'PUT', arr),

  // 案例
  getCases: () => apiGet('/cases'),
  saveCases: (arr) => apiSend('/cases', 'PUT', arr),

  // 业务
  getServices: () => apiGet('/services'),
  saveServices: (arr) => apiSend('/services', 'PUT', arr),

  // meta（SEO / profile / ad / site_config）
  getMeta: async (key) => {
    try {
      const v = await apiGet('/meta/' + encodeURIComponent(key));
      return v;
    } catch (e) {
      return null;
    }
  },
  saveMeta: (key, value) => apiSend('/meta/' + encodeURIComponent(key), 'PUT', { value }),
  getAllMeta: () => apiGet('/meta')
};

window.API = API;
