// ============================================
// 前端 API 客户端（EdgeOne Pages Functions）
// - 登录 / 保存：走 /api/* 边缘函数（免服务器）
// - 读取：走静态 /data/*.json（保存后经重新部署约 1-2 分钟全站生效）
// ============================================
function getToken() {
  return sessionStorage.getItem('fsb_admin_token');
}

async function apiGet(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function apiSend(path, method, body) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers['Authorization'] = 'Bearer ' + t;
  const r = await fetch(path, { method, headers, body: JSON.stringify(body) });
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try {
      const j = await r.json();
      if (j && j.error) msg = j.error;
    } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  return r.json();
}

const API = {
  // 鉴权：返回 { token, username, expireMinutes }
  login: (username, password) => apiSend('/api/login', 'POST', { username, password }),

  // 远程读取静态 JSON。type: services | blog | cases
  getRemote: async (type) => {
    const fileMap = { services: 'services.json', blog: 'blog.json', cases: 'cases.json' };
    const file = fileMap[type];
    if (!file) throw new Error('未知数据类型: ' + type);
    const r = await apiGet('/data/' + file);
    return r[type] || (Array.isArray(r) ? r : []);
  },

  // 保存：需登录 token。type + data 数组
  saveData: (type, data) => apiSend('/api/save', 'POST', { type, data })
};

window.API = API;
