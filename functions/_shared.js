// ============================================
// EdgeOne Pages Functions - 共享工具模块
// 1. UTF-8 安全的 Base64 编码
// 2. JSON 响应
// 3. 常量时间字符串比较（防时序攻击）
// 4. Token 签发 / 校验（HMAC-SHA256，base64url）
// 5. GitHub Contents API 写入（把数据写回仓库，触发重新部署）
// ============================================

// UTF-8 字符串 -> Base64（兼容中文）
export function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

// 常量时间字符串比较
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let r = 0;
  for (let i = 0; i < ea.length; i++) r |= ea[i] ^ eb[i];
  return r === 0;
}

// HMAC-SHA256 -> base64url
async function hmacBase64Url(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeObj(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 签发登录 Token（30 分钟有效）
export async function signToken(env) {
  const payload = { p: 1, exp: Date.now() + 30 * 60 * 1000 };
  const p = base64UrlEncodeObj(payload);
  const s = await hmacBase64Url(env.JWT_SECRET || 'dev-secret-change-me', p);
  return p + '.' + s;
}

// 校验登录 Token
export async function verifyToken(token, env) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [p, s] = parts;
  const expected = await hmacBase64Url(env.JWT_SECRET || 'dev-secret-change-me', p);
  if (!safeEqual(s, expected)) return false;
  try {
    const json = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    if (!json.exp || Date.now() > json.exp) return false;
    return true;
  } catch {
    return false;
  }
}

// 把文件写回 GitHub 仓库（创建或更新），EdgeOne 检测到 push 后自动重新部署
export async function githubWrite(env, filePath, contentStr) {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || 'main';
  if (!token || !repo) {
    throw new Error('服务端未配置 GITHUB_TOKEN / GITHUB_REPO 环境变量');
  }
  const apiBase = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'fsb-cms',
    Accept: 'application/vnd.github+json'
  };

  // 先取当前 sha（存在则更新，不存在则新建）
  let sha = null;
  try {
    const getRes = await fetch(`${apiBase}?ref=${branch}`, { headers });
    if (getRes.status === 200) {
      const j = await getRes.json();
      sha = j.sha || null;
    } else if (getRes.status !== 404) {
      const txt = await getRes.text();
      throw new Error(`读取文件失败 ${getRes.status}: ${txt}`);
    }
  } catch (e) {
    if (e && String(e.message).startsWith('读取文件失败')) throw e;
    // 其他网络错误：继续尝试写入（当作新建）
  }

  const body = {
    message: `CMS 更新 ${filePath} @ ${new Date().toISOString()}`,
    content: utf8ToBase64(contentStr),
    branch
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiBase, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });
  if (!putRes.ok) {
    const txt = await putRes.text();
    throw new Error(`写入 GitHub 失败 ${putRes.status}: ${txt}`);
  }
  return putRes.json();
}

// 兼容多种 Pages Functions 调用约定，尽可能拿到 request 与 env：
//   - 单参数 context 风格（Cloudflare/EdgeOne 推荐）：onRequest(context) -> context.request / context.env
//   - 双参数风格：onRequest(request, envOrContext)，第二参可能是 env 对象本身，也可能是 { env }
//   - Node Cloud Functions：环境变量在全局 process.env
export function resolveContext(arg1, arg2) {
  let request = null;
  let env = {};

  if (arg1 && typeof arg1 === 'object') {
    if (arg1.request) {
      // 单参数 context 风格（或第一参本身就是 context）
      request = arg1.request;
      env = arg1.env || {};
    } else if (typeof Request !== 'undefined' && arg1 instanceof Request) {
      // 第一参是 Request（双参数情况）
      request = arg1;
    } else {
      // 兜底：第一参既不是 context 也不是 Request
      request = arg1;
    }
  } else if (typeof Request !== 'undefined' && arg1 instanceof Request) {
    request = arg1;
  }

  // 双参数：第二参可能是 env 对象本身，或包含 { env } 的 context
  if (arg2 && typeof arg2 === 'object') {
    env = (arg2.env && typeof arg2.env === 'object') ? arg2.env : arg2;
  }

  // 兜底：Node 运行时全局 process.env（某些 Cloud Functions 环境）
  if (typeof process !== 'undefined' && process.env && Object.keys(process.env).length) {
    env = Object.assign({}, process.env, env);
  }

  return { request, env };
}
