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

// 极短退避（环境不支持 setTimeout 时立即 resolve，不影响重试）
function sleep(ms) {
  return new Promise(resolve => {
    try { setTimeout(resolve, ms); } catch { resolve(); }
  });
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

  // 读取文件当前 sha（存在则更新，不存在则新建）
  const getSha = async () => {
    try {
      const getRes = await fetch(`${apiBase}?ref=${branch}`, { headers });
      if (getRes.status === 200) {
        const j = await getRes.json();
        return j.sha || null;
      } else if (getRes.status === 404) {
        return null; // 文件不存在 → 新建
      }
      const txt = await getRes.text();
      throw new Error(`读取文件失败 ${getRes.status}: ${txt}`);
    } catch (e) {
      if (e && String(e.message).startsWith('读取文件失败')) throw e;
      return null; // 网络错误时当作新建，交由 PUT 决定
    }
  };

  let lastErr = null;
  // 写入可能因 sha 冲突(409)失败：文件在 GET 与 PUT 之间被改动（高频连续写入 / CDN 缓存 /
  // GitHub 最终一致性延迟）。遇到 409 重新拉取最新 sha 并重试，最多 3 次。
  for (let attempt = 0; attempt < 3; attempt++) {
    const sha = await getSha();
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
    if (putRes.ok) return putRes.json();

    const txt = await putRes.text();
    if (putRes.status === 409) {
      // sha 冲突：退避后重新 GET 最新 sha 再试
      lastErr = new Error(`写入 GitHub 失败 409: ${txt}`);
      await sleep(250 * (attempt + 1));
      continue;
    }
    throw new Error(`写入 GitHub 失败 ${putRes.status}: ${txt}`);
  }
  throw lastErr || new Error('写入 GitHub 失败：重试后仍冲突');
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
