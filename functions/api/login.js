// ============================================
// POST /api/login
// 校验后台登录密码，返回签名 Token
// ============================================
import { jsonResponse, safeEqual, signToken, resolveContext } from '../_shared.js';

export async function onRequestPost(request, context) {
  const { request: req, env } = resolveContext(request, context);
  try {
    const body = await req.json().catch(() => ({}));
    const username = (body.username || '').toString();
    const password = (body.password || '').toString();

    const adminPwd = env.ADMIN_PWD || '';
    if (!adminPwd || !safeEqual(password, adminPwd)) {
      return jsonResponse({ error: '账号或密码错误' }, 401);
    }

    const token = await signToken(env);
    return jsonResponse({ token, username: username || 'admin', expireMinutes: 30 });
  } catch (e) {
    return jsonResponse({ error: '登录异常：' + (e && e.message ? e.message : e) }, 500);
  }
}
