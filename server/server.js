// ============================================
// 烽审榜 CMS 后端 API
// Express + MariaDB
// ============================================
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ---------- 加载 .env ----------
function loadEnv() {
  try {
    const f = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    f.split('\n').forEach(line => {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch (e) {
    console.warn('[warn] 未找到 .env，使用环境变量默认值');
  }
}
loadEnv();

const pool = require('./db');
const SEED = require('./seed-data');
const CLEAN = require('./clean-rules');

// 工具页访问密码（数据清洗工具的门禁，仅存于服务端，前端零硬编码）
const TOOL_PASSWORD = process.env.TOOL_ACCESS_CODE || '1688';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// ---------- 中间件 ----------
app.use(express.json({ limit: '8mb' }));

// CORS（同源部署无需，但保留以便本地调试 / 跨域 CDN）
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.header('Access-Control-Allow-Origin', origin);
  else res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------- 工具函数 ----------
function jsonOr(v, d) {
  if (v === null || v === undefined) return d;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch (e) { return d; }
  }
  return v;
}

function rowToBlog(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    tags: jsonOr(r.tags, []),
    summary: r.summary || '',
    content: r.content || '',
    coverImage: r.cover_image || '',
    author: r.author,
    publishDate: r.publish_date ? String(r.publish_date).slice(0, 10) : '',
    readTime: r.read_time,
    seo: jsonOr(r.seo, null)
  };
}
function blogToRow(b) {
  return [
    b.id, b.title, b.category || 'tech', JSON.stringify(b.tags || []),
    b.summary || '', b.content || '', b.coverImage || '', b.author || '烽审榜',
    b.publishDate || null, parseInt(b.readTime || 5, 10), JSON.stringify(b.seo || null)
  ];
}

function rowToCase(r) {
  return {
    id: r.id, title: r.title, client: r.client, industry: r.industry,
    serviceId: r.service_id, summary: r.summary || '',
    metrics: jsonOr(r.metrics, []), publishDate: r.publish_date ? String(r.publish_date).slice(0, 10) : '',
    seo: jsonOr(r.seo, null)
  };
}
function caseToRow(c) {
  return [
    c.id, c.title, c.client || '', c.industry || '', c.serviceId || '',
    c.summary || '', JSON.stringify(c.metrics || []), c.publishDate || null, JSON.stringify(c.seo || null)
  ];
}

function rowToService(r) {
  return {
    id: r.id, title: r.title, subtitle: r.subtitle, icon: r.icon,
    color: r.color, summary: r.summary || '', features: jsonOr(r.features, []),
    caseCount: r.case_count, publishDate: r.publish_date ? String(r.publish_date).slice(0, 10) : '',
    seo: jsonOr(r.seo, null)
  };
}
function serviceToRow(s) {
  return [
    s.id, s.title, s.subtitle || '', s.icon || '🎯', s.color || '#b8924a',
    s.summary || '', JSON.stringify(s.features || []), parseInt(s.caseCount || 0, 10),
    s.publishDate || null, JSON.stringify(s.seo || null)
  ];
}

// ---------- JWT ----------
function signJWT(payload) {
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = enc({ alg: 'HS256', typ: 'JWT' }) + '.' + enc(payload);
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return data + '.' + sig;
}
function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const data = parts[0] + '.' + parts[1];
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    if (sig !== parts[2]) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (e) { return null; }
}

// ---------- 登录凭据（与前端 security.js 一致）----------
const ADMIN = {
  username: 'admin',
  hash: 'fy96EZ5WXWbIDs/o4fwhQ6wqMeceGg5sXbLEi5qwqxE=',
  salt: 'BeQiHJtCIiX+bsQcIJQ53A=='
};

// 登录限流（内存版：每 IP 5 次/15 分钟）
const loginAttempts = {};
function checkLock(ip) {
  const a = loginAttempts[ip];
  if (a && a.lockUntil && Date.now() < a.lockUntil) {
    return Math.ceil((a.lockUntil - Date.now()) / 60000);
  }
  return 0;
}
function recordFail(ip) {
  const a = loginAttempts[ip] || { count: 0 };
  a.count += 1;
  if (a.count >= 5) a.lockUntil = Date.now() + 15 * 60 * 1000;
  loginAttempts[ip] = a;
}
function resetFail(ip) { delete loginAttempts[ip]; }

// ---------- 鉴权中间件 ----------
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/);
  if (!m) return res.status(401).json({ error: '未授权' });
  const p = verifyJWT(m[1]);
  if (!p) return res.status(401).json({ error: '令牌无效或已过期' });
  req.user = p;
  next();
}

// 异步封装
async function q(sql, params) {
  let conn;
  try {
    conn = await pool.getConnection();
    return await conn.query(sql, params);
  } finally {
    if (conn) conn.release();
  }
}

// ============================================
// 路由：数据清洗工具（服务端执行，前端零逻辑）
// ============================================
// 校验工具门禁密码，返回短时 token（2小时），避免明文密码反复传输
app.post('/api/clean/auth', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== TOOL_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const token = signJWT({ sub: 'tool', iat: Date.now(), exp: Date.now() + 2 * 3600 * 1000 });
  res.json({ ok: true, token });
});

// 执行清洗：支持 { password } 或 { token } 鉴权；raw 可为 JSON 字符串或已解析对象
app.post('/api/clean/:type', (req, res) => {
  const { type } = req.params;
  const body = req.body || {};
  let authed = false;
  if (body.token) {
    const p = verifyJWT(body.token);
    if (p && p.sub === 'tool') authed = true;
  }
  if (!authed && body.password && body.password === TOOL_PASSWORD) authed = true;
  if (!authed) return res.status(401).json({ error: '未授权：密码错误或已失效，请重新输入' });

  try {
    const result = CLEAN.clean(type, body.raw);
    res.json(result);
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

// ============================================
// 路由：健康检查
// ============================================
app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// ============================================
// 路由：登录
// ============================================
app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const remain = checkLock(ip);
  if (remain > 0) {
    return res.status(429).json({ error: `登录已锁定，请 ${remain} 分钟后再试` });
  }
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }
  if (username !== ADMIN.username) {
    recordFail(ip);
    return res.status(401).json({ error: '账号或密码错误' });
  }
  crypto.pbkdf2(password, Buffer.from(ADMIN.salt, 'base64'), 100000, 32, 'sha256', (err, dk) => {
    if (err) return res.status(500).json({ error: '服务器错误' });
    let valid = false;
    try {
      valid = crypto.timingSafeEqual(dk, Buffer.from(ADMIN.hash, 'base64'));
    } catch (e) { valid = false; }
    if (valid) {
      resetFail(ip);
      const token = signJWT({
        sub: ADMIN.username,
        iat: Date.now(),
        exp: Date.now() + 2 * 3600 * 1000 // 2 小时
      });
      return res.json({ token, user: ADMIN.username });
    } else {
      recordFail(ip);
      return res.status(401).json({ error: '账号或密码错误' });
    }
  });
});

// ============================================
// 路由：博客（公开读 / 鉴权写）
// ============================================
app.get('/api/blog', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM blogs ORDER BY publish_date DESC');
    res.json(rows.map(rowToBlog));
  } catch (e) {
    res.status(500).json({ error: '数据库错误', detail: e.message });
  }
});
app.get('/api/blog/:id', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM blogs WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '文章不存在' });
    res.json(rowToBlog(rows[0]));
  } catch (e) {
    res.status(500).json({ error: '数据库错误', detail: e.message });
  }
});
// 批量替换（后台保存整个数组）
app.put('/api/blog', auth, async (req, res) => {
  try {
    const arr = Array.isArray(req.body) ? req.body : [];
    await q('DELETE FROM blogs');
    for (const b of arr) {
      if (!b.id) continue;
      await q(`INSERT INTO blogs (id,title,category,tags,summary,content,cover_image,author,publish_date,read_time,seo)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE title=VALUES(title),category=VALUES(category),tags=VALUES(tags),
               summary=VALUES(summary),content=VALUES(content),cover_image=VALUES(cover_image),
               author=VALUES(author),publish_date=VALUES(publish_date),read_time=VALUES(read_time),seo=VALUES(seo)`,
        blogToRow(b));
    }
    res.json({ ok: true, count: arr.length });
  } catch (e) {
    res.status(500).json({ error: '保存失败', detail: e.message });
  }
});

// ============================================
// 路由：案例
// ============================================
app.get('/api/cases', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM cases ORDER BY publish_date DESC');
    res.json(rows.map(rowToCase));
  } catch (e) { res.status(500).json({ error: '数据库错误', detail: e.message }); }
});
app.get('/api/cases/:id', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM cases WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '案例不存在' });
    res.json(rowToCase(rows[0]));
  } catch (e) { res.status(500).json({ error: '数据库错误', detail: e.message }); }
});
app.put('/api/cases', auth, async (req, res) => {
  try {
    const arr = Array.isArray(req.body) ? req.body : [];
    await q('DELETE FROM cases');
    for (const c of arr) {
      if (!c.id) continue;
      await q(`INSERT INTO cases (id,title,client,industry,service_id,summary,metrics,publish_date,seo)
               VALUES (?,?,?,?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE title=VALUES(title),client=VALUES(client),industry=VALUES(industry),
               service_id=VALUES(service_id),summary=VALUES(summary),metrics=VALUES(metrics),
               publish_date=VALUES(publish_date),seo=VALUES(seo)`,
        caseToRow(c));
    }
    res.json({ ok: true, count: arr.length });
  } catch (e) { res.status(500).json({ error: '保存失败', detail: e.message }); }
});

// ============================================
// 路由：业务
// ============================================
app.get('/api/services', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM services ORDER BY publish_date DESC');
    res.json(rows.map(rowToService));
  } catch (e) { res.status(500).json({ error: '数据库错误', detail: e.message }); }
});
app.get('/api/services/:id', async (req, res) => {
  try {
    const rows = await q('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '业务不存在' });
    res.json(rowToService(rows[0]));
  } catch (e) { res.status(500).json({ error: '数据库错误', detail: e.message }); }
});
app.put('/api/services', auth, async (req, res) => {
  try {
    const arr = Array.isArray(req.body) ? req.body : [];
    await q('DELETE FROM services');
    for (const s of arr) {
      if (!s.id) continue;
      await q(`INSERT INTO services (id,title,subtitle,icon,color,summary,features,case_count,publish_date,seo)
               VALUES (?,?,?,?,?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE title=VALUES(title),subtitle=VALUES(subtitle),icon=VALUES(icon),
               color=VALUES(color),summary=VALUES(summary),features=VALUES(features),
               case_count=VALUES(case_count),publish_date=VALUES(publish_date),seo=VALUES(seo)`,
        serviceToRow(s));
    }
    res.json({ ok: true, count: arr.length });
  } catch (e) { res.status(500).json({ error: '保存失败', detail: e.message }); }
});

// ============================================
// 路由：meta（SEO / profile / ad / site_config）
// ============================================
app.get('/api/meta', async (req, res) => {
  try {
    const rows = await q('SELECT `key`, value FROM meta');
    const map = {};
    rows.forEach(r => { map[r.key] = jsonOr(r.value, null); });
    res.json(map);
  } catch (e) { res.status(500).json({ error: '数据库错误', detail: e.message }); }
});
app.get('/api/meta/:key', async (req, res) => {
  try {
    const rows = await q('SELECT value FROM meta WHERE `key` = ?', [req.params.key]);
    if (!rows.length) return res.status(404).json({ error: '不存在' });
    res.json(jsonOr(rows[0].value, null));
  } catch (e) { res.status(500).json({ error: '数据库错误', detail: e.message }); }
});
app.put('/api/meta/:key', auth, async (req, res) => {
  try {
    const value = req.body && req.body.value !== undefined ? req.body.value : req.body;
    await q('INSERT INTO meta (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      [req.params.key, JSON.stringify(value)]);
    res.json({ ok: true, key: req.params.key, value });
  } catch (e) { res.status(500).json({ error: '保存失败', detail: e.message }); }
});
app.delete('/api/meta/:key', auth, async (req, res) => {
  try {
    await q('DELETE FROM meta WHERE `key` = ?', [req.params.key]);
    res.json({ ok: true, key: req.params.key });
  } catch (e) { res.status(500).json({ error: '删除失败', detail: e.message }); }
});

// ============================================
// 自动种子（数据库为空时写入默认数据）
// ============================================
async function seedIfEmpty() {
  try {
    const b = await q('SELECT COUNT(*) AS c FROM blogs');
    if (b[0].c > 0) { console.log('[seed] 已有数据，跳过'); return; }
    console.log('[seed] 正在写入默认数据...');

    for (const s of SEED.services) await q(`INSERT INTO services (id,title,subtitle,icon,color,summary,features,case_count,publish_date,seo)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id`, serviceToRow(s));
    for (const bl of SEED.blog) await q(`INSERT INTO blogs (id,title,category,tags,summary,content,cover_image,author,publish_date,read_time,seo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id`, blogToRow(bl));
    for (const c of SEED.cases) await q(`INSERT INTO cases (id,title,client,industry,service_id,summary,metrics,publish_date,seo)
      VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id`, caseToRow(c));

    await q('INSERT INTO meta (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', ['profile', JSON.stringify(SEED.profile)]);
    await q('INSERT INTO meta (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', ['site_config', JSON.stringify(SEED.siteConfig)]);
    console.log('[seed] 默认数据写入完成');
  } catch (e) {
    console.error('[seed] 失败:', e.message);
  }
}

// ============================================
// 启动
// ============================================
app.listen(PORT, async () => {
  console.log(`[server] 烽审榜 API 已启动: http://localhost:${PORT}`);
  try {
    await pool.query('SELECT 1');
    console.log('[server] 数据库连接正常');
    await seedIfEmpty();
  } catch (e) {
    console.error('[server] 数据库连接有问题:', e.message);
  }
});
