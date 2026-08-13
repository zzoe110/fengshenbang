// ============================================
// POST /api/save
// 鉴权后将数据写回 GitHub 仓库对应 JSON 文件，触发重新部署
// body: { type: 'services'|'blog'|'cases'|'seo'|'config', data: [...] }
// ============================================
import { jsonResponse, verifyToken, githubWrite, resolveContext } from '../_shared.js';

const TYPE_FILE = {
  services: 'data/services.json',
  blog: 'data/blog.json',
  cases: 'data/cases.json',
  seo: 'data/seo.json',
  // 站点设置：扁平对象直接写入（与 config.js 读取 /data/config.json 保持一致）
  config: 'data/config.json'
};

export async function onRequestPost(request, context) {
  const { request: req, env } = resolveContext(request, context);
  try {
    // 1. 鉴权
    const auth = req.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!(await verifyToken(token, env))) {
      return jsonResponse({ error: '未授权或登录已过期，请重新登录' }, 401);
    }

    // 2. 解析参数
    const body = await req.json().catch(() => ({}));
    const type = body.type;
    const data = body.data;
    if (!type || !TYPE_FILE[type]) {
      return jsonResponse({ error: '无效的 type（支持：services / blog / cases / seo / config）' }, 400);
    }
    // seo、config 为对象（非数组），其余类型必须为数组
    if (!Array.isArray(data) && type !== 'seo' && type !== 'config') {
      return jsonResponse({ error: 'data 必须是数组' }, 400);
    }

    // 3. 写回 GitHub
    // config 为扁平对象，直接写入 /data/config.json（不包 {config:...} 外壳，与前台读取一致）
    // 其余类型结构为 { [type]: data }，与前台读取保持一致
    const contentStr = (type === 'config')
      ? JSON.stringify(data, null, 2)
      : JSON.stringify({ [type]: data }, null, 2);
    await githubWrite(env, TYPE_FILE[type], contentStr);

    return jsonResponse({
      ok: true,
      type,
      count: Array.isArray(data) ? data.length : 1,
      note: '已写入仓库，EdgeOne 将在约 1-2 分钟后自动重新部署，全站更新。'
    });
  } catch (e) {
    return jsonResponse({ error: '保存失败：' + (e && e.message ? e.message : e) }, 500);
  }
}
