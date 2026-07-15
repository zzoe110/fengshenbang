// ============================================
// GET /api/health
// 部署后可访问该地址验证函数是否正常工作
// ============================================
import { jsonResponse, resolveContext } from '../_shared.js';

export async function onRequestGet(request, context) {
  const { env } = resolveContext(request, context);
  // 仅返回环境变量 KEY 是否已配置（不返回值本身，避免泄露敏感信息）
  const envStatus = {
    ADMIN_PWD: Boolean(env.ADMIN_PWD),
    JWT_SECRET: Boolean(env.JWT_SECRET),
    GITHUB_REPO: Boolean(env.GITHUB_REPO),
    GITHUB_TOKEN: Boolean(env.GITHUB_TOKEN)
  };
  return jsonResponse({ ok: true, ts: Date.now(), service: 'fsb-cms', envStatus });
}
