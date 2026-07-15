# 烽审榜后台「免服务器实时更新」B 方案 · 部署说明

> 目标：不用任何云服务器、纯免费，在后台改完内容后，前台约 1-2 分钟内自动更新。

## 一、方案原理

```
后台编辑 (admin/*.html)
   │  POST /api/save  （带登录 Token）
   ▼
EdgeOne Pages Functions  (functions/api/save.js，免费边缘函数)
   │  把数据 PUT 回 GitHub 仓库的 data/{type}.json
   ▼
GitHub 仓库 zzoe110/fengshenbang  （相当于"数据库"）
   │  push 触发
   ▼
EdgeOne 自动重新部署  （约 1-2 分钟）
   │
   ▼
前台页面 fetch /data/{type}.json  →  展示最新内容
```

- **读**：前台/后台都 `fetch('/data/*.json')`（静态文件，重新部署后就是新内容）。
- **写**：后台保存时调用 `/api/save` 边缘函数，由函数把 JSON 写回 GitHub，再触发重新部署。
- **鉴权**：`/api/login` 校验密码签发 Token，`/api/save` 校验 Token 后才允许写入。
- **成本**：EdgeOne Pages Functions + GitHub 均免费（免费版含边缘函数 300 万次/月、Pages 函数 100 万次/月）。

## 二、必须在 EdgeOne 控制台配置的环境变量

进入 **EdgeOne 控制台 → 你的 Pages 项目 → 环境变量（或"函数/环境变量"）**，添加以下 5 项：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `ADMIN_PWD` | 后台登录密码 | `zouyinde@1314` |
| `JWT_SECRET` | Token 签名密钥，改成随机长字符串 | `openssl rand -hex 32` 的结果 |
| `GITHUB_REPO` | 仓库名（owner/repo） | `zzoe110/fengshenbang` |
| `GITHUB_BRANCH` | 分支 | `main` |
| `GITHUB_TOKEN` | GitHub 个人访问令牌（见下方获取方式） | `ghp_xxx...` |

> ⚠️ 这些变量只在 EdgeOne 后台配置，绝不要写进代码或提交到 Git 仓库。
> 本地调试可复制 `.dev.vars.example` 为 `.dev.vars` 填写（已被 .gitignore 忽略）。

### 获取 GitHub Token
1. GitHub → 右上角头像 → **Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. **Generate new token (classic)**，勾选 `repo`（或细化为该仓库的 `contents:write`）
3. 生成后复制 `ghp_xxx...`，填到 EdgeOne 的 `GITHUB_TOKEN`
4. 该 Token 已存在于你本地 Git remote 配置中（`zzoe110:ghp_...@github.com`），可直接复用

## 三、后台使用方式

1. 访问 `你的域名/admin/login.html`，账号随意（仅校验密码），密码为 `ADMIN_PWD`
2. 进入「业务 / 博客 / 案例」管理页，增删改后点「保存」
3. 保存成功提示："已写入仓库，约 1-2 分钟后全站更新"
4. 稍等 1-2 分钟（EdgeOne 重新部署），前台即展示新内容

> 保存后后台表格会**立即**显示新数据（本次会话内本地缓存），前台需等重新部署完成。

## 四、本次改动文件清单

**新增（后端 / 数据）**
- `functions/_shared.js` —— Token 签发校验 + GitHub 写入 + 工具
- `functions/api/login.js` —— `POST /api/login`
- `functions/api/save.js` —— `POST /api/save`
- `functions/api/health.js` —— `GET /api/health`（部署后验证用）
- `data/blog.json`、`data/cases.json` —— 静态数据源（services.json 已存在）
- `.dev.vars.example` —— 环境变量模板

**修改（前端 / 后台）**
- `assets/js/api.js` —— 改为调用边缘函数 + 读取静态 JSON
- `assets/js/main.js`、`page-services.js`、`page-blog.js`、`page-cases.js`、`blog-detail.html` —— 改为优先 `fetch('/data/*.json')`，失败回退内置数据
- `admin/admin.js` —— `DataStore` 改走 API 写回 GitHub，会话内即时生效 + localStorage 兜底
- `admin/login.html` —— 改服务端登录（密码不再写死在前端）
- `admin/login.html`、`services.html`、`blog.html`、`cases.html` —— 补引入 `api.js`
- `.gitignore` —— 忽略 `.dev.vars`

## 五、常见问题

- **前台没更新？** 保存后等 1-2 分钟（重新部署）。可用 `GET /api/health` 确认函数已生效；用 GitHub 仓库的提交记录确认是否成功 push。
- **保存报错 401？** 登录已过期，重新登录；或 `ADMIN_PWD` 与登录密码不一致。
- **保存报错"写入 GitHub 失败"？** 检查 `GITHUB_TOKEN` 是否有该仓库写权限、`GITHUB_REPO`/`GITHUB_BRANCH` 是否正确。
- **`tool/` 工具页** 的客户端防护保持不变，不受本次改动影响。
