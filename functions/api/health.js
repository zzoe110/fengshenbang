// ============================================
// GET /api/health
// 部署后可访问该地址验证函数是否正常工作
// ============================================
import { jsonResponse, resolveContext } from '../_shared.js';

export async function onRequestGet(request, context) {
  resolveContext(request, context); // 兼容调用约定
  return jsonResponse({ ok: true, ts: Date.now(), service: 'fsb-cms' });
}
