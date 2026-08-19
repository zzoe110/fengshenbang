// ============================================
// POST /api/upload
// 鉴权后将图片写入 GitHub 仓库 assets/uploads/，返回线上可访问 URL
// body(JSON): { mime: 'image/png'..., data: '<base64 不含 data: 前缀>', name?: 'xxx.png' }
// 限制：仅 PNG/JPEG/WebP/GIF，解码后 ≤ 2MB
// ============================================
import { jsonResponse, verifyToken, githubPut, bytesToBase64, resolveContext } from '../_shared.js';

const ALLOWED = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

function genName(ext) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}.${ext}`;
}

export async function onRequestPost(request, context) {
  const { request: req, env } = resolveContext(request, context);
  try {
    // 1. 鉴权
    const auth = req.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!(await verifyToken(token, env))) {
      return jsonResponse({ error: '未授权或登录已过期，请重新登录' }, 401);
    }

    // 2. 解析 JSON Base64 图片
    const ct = req.headers.get('Content-Type') || '';
    if (!ct.includes('application/json')) {
      return jsonResponse({ error: '请使用 JSON Base64 方式上传' }, 400);
    }
    const body = await req.json().catch(() => ({}));
    const mime = body.mime;
    if (!mime || !ALLOWED[mime]) {
      return jsonResponse({ error: '仅支持 PNG / JPEG / WebP / GIF 图片' }, 400);
    }
    if (typeof body.data !== 'string') {
      return jsonResponse({ error: '缺少图片数据（data 字段）' }, 400);
    }
    let bin;
    try {
      bin = atob(body.data);
    } catch (e) {
      return jsonResponse({ error: '图片数据不是合法 Base64' }, 400);
    }
    if (bin.length > MAX_BYTES) {
      return jsonResponse({ error: '图片超过 2MB 限制，请压缩后再传' }, 400);
    }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = ALLOWED[mime];

    // 3. 写入仓库 assets/uploads/
    const fileName = genName(ext);
    const filePath = `assets/uploads/${fileName}`;
    await githubPut(env, filePath, bytesToBase64(bytes));

    // 4. 返回线上 URL（优先用环境变量 SITE_URL，否则回退默认域名）
    const base = (env.SITE_URL || 'https://www.fsbtop.top').replace(/\/$/, '');
    const url = `${base}/assets/uploads/${fileName}`;

    return jsonResponse({ ok: true, fileName, url });
  } catch (e) {
    return jsonResponse({ error: '上传失败：' + (e && e.message ? e.message : e) }, 500);
  }
}
