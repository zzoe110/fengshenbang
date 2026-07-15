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
    const password = (body.password || '').toString().trim();

    const adminPwd = (env.ADMIN_PWD || '').trim();
    if (!adminPwd) {
      // 明确区分：服务端根本没拿到密码配置
      return jsonResponse({
        error: '服务端未配置 ADMIN_PWD 环境变量（请到 EdgeOne 控制台检查运行时环境变量：是否配到生产环境、KEY 名是否大写 ADMIN_PWD）'
      }, 500);
    }
    if (!safeEqual(password, adminPwd)) {
      return jsonResponse({ error: '账号或密码错误' }, 401);
    }

    const token = await signToken(env);
    return jsonResponse({ token, username: username || 'admin', expireMinutes: 30 });
  } catch (e) {
    return jsonResponse({ error: '登录异常：' + (e && e.message ? e.message : e) }, 500);
  }
}
