# 烽审榜 域名与 SEO 配置指引

> 适用站点：https://www.fsbtop.top （EdgeOne Pages 托管）
> 更新日期：2026-08-04

---

## 一、已完成的代码改动（无需你操作，已上线）

| 改动 | 文件 | 说明 |
|------|------|------|
| ✅ 页脚备案号 | 5 个前台页 footer | 底部新增「黔ICP备2026013377号」，链接到 https://beian.miit.gov.cn/ （工信部备案查询，法律要求） |
| ✅ 备案号后台可改 | `data/config.json` + `assets/js/main.js` | `config.json` 的 `icp` 字段已填该号；`main.js` 会在加载后自动用后台值覆盖页脚（后台「站点设置」改 ICP 后全站生效） |
| ✅ canonical 统一 www | 5 个前台页 `<head>` | 由相对路径 `/`、`/blog.html` 改为绝对 `https://www.fsbtop.top/...`，避免 www/非www/旧域名重复收录 |
| ✅ sitemap 绝对化 | `sitemap.xml` | 5 个页面 `<loc>` 全部改为 `https://www.fsbtop.top/...`，并加 `lastmod` |
| ✅ robots 绝对化 | `robots.txt` | `Sitemap:` 改为完整 URL；保留 `Disallow: /admin/` |
| ✅ JSON-LD url 修正 | `assets/js/main.js` | Organization 结构化数据 `url` 改为绝对 www 地址（GEO 实体词典更规范） |
| ✅ 站点基础域名 | `data/config.json` | `siteUrl` 设为 `https://www.fsbtop.top`，og:image 等统一走 www |

> 部署状态：已 commit `478b897` 并推送到 GitHub，EdgeOne 自动部署（约 1–2 分钟）。上线后请硬刷新（Cmd/Ctrl+Shift+R）查看页脚备案号。

---

## 二、EdgeOne 控制台配置（必须你手动做）

代码改不了「域名解析」和「HTTPS 强制跳转」，这两样在 EdgeOne 控制台。

### 2.1 开启「强制 HTTPS」（防 HTTP 下后台登录失效 + 利于 SEO）

1. 登录 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)
2. 左侧 **站点管理** → 选择站点 **fsbtop.top**
3. 进入站点后，左侧菜单找 **「HTTPS」**（或「TLS / 证书」）→ **「HTTPS 配置」**
4. 找到 **「强制 HTTPS / 自动将 HTTP 重定向到 HTTPS」** 开关 → 开启
5. 保存。生效后访问 `http://www.fsbtop.top` 会自动 301 跳到 `https://www.fsbtop.top`

> 代码里 `theme.js` / `security.js` 已加了 JS 兜底跳转，但控制台开启才最规范、对搜索引擎最友好。

### 2.2 修复 apex 域名 502（关键！别人直接输 `fsbtop.top` 会报错）

问题根因：你目前只把 `www.fsbtop.top` 接入了 EdgeOne，顶级域名 `fsbtop.top`（apex / @）没接入，所以直接访问 `fsbtop.top` 返回 502。

**两种接入方式对应两种修法，先确认你是哪种：**

#### 情况 A：NS 接入（你的域名 NS 已指向 EdgeOne）
- 如果站点 zone 就是 `fsbtop.top` 且 NS 已托管给 EdgeOne，apex 默认已归 EdgeOne 管。
- 只需在 **域名管理** 里确认 `fsbtop.top`（主机记录留空 / @）已存在且状态正常；若没有，点「添加域名 / 添加子域名」填入 `@` 或留空，指向站点自身即可。
- 然后做下方「重定向规则」，把 apex 跳到 www。

#### 情况 B：CNAME 接入（你只在 DNS 里加了 `www` 的 CNAME）
- 很多 DNS 服务商**不允许 apex（@）用 CNAME**。此时有两条路：
  - **路 1（推荐）**：改用 NS 接入——把域名注册商的 NS 改为 EdgeOne 提供的 NS，apex 自动归 EdgeOne 管。
  - **路 2**：在 DNS 服务商处为 `@` 添加 **A 记录**，指向 EdgeOne 给你的**任意播 IP**（控制台「域名管理」里站点详情会显示接入 IP）；或用 DNS 服务商的「CNAME 扁平化 / ANAME」功能。
- 改完后，回 EdgeOne **域名管理** 确认 `fsbtop.top` 已添加并解析正常。

#### 重定向规则（apex → www，301）
无论 A/B，最后都加一条重定向，让 `fsbtop.top` 统一跳到 `www.fsbtop.top`：
1. 站点内左侧 **「规则引擎」**（Rules Engine）→ **「规则」** → **「添加规则」**
2. 匹配条件：**主机名（Host）** `等于` `fsbtop.top`
3. 执行操作：**重定向（Redirect）**
   - 重定向类型：301 永久
   - 目标 URL：`https://www.fsbtop.top${uri}` （`${uri}` 保留原路径，如 `/blog.html`）
4. 保存并发布。

> 验证：浏览器访问 `http://fsbtop.top` 和 `https://fsbtop.top` 都应 301 跳到 `https://www.fsbtop.top/`。

---

## 三、向搜索引擎提交 sitemap（GEO / SEO 收录）

sitemap 地址：`https://www.fsbtop.top/sitemap.xml`（已绝对化、已含 5 个前台页）

### 3.1 百度搜索资源平台（必做，国内流量主入口）
1. 打开 https://ziyuan.baidu.com/site/index → 登录百度账号
2. **添加网站** → 输入 `https://www.fsbtop.top` → 选择「主域名」或「子域名」均可
3. **验证网站**（三选一）：
   - **CNAME 验证（推荐）**：在 DNS 加一条 CNAME 记录（平台会给你具体值）
   - 或 **HTML 标签验证**：把平台给的 `<meta>` 标签加进首页 `<head>`（可让我帮你加）
   - 或 **文件验证**：下载验证文件放到站点根目录（可让我帮你放）
4. 验证通过后，左侧 **「数据引入」→「链接提交」→「sitemap」**
5. 粘贴 `https://www.fsbtop.top/sitemap.xml` → **提交**
6. 左侧 **「优化与维护」→「官网保护 / 站点属性」** 补充站点名称、业务类型（选「企业服务 / 咨询服务」），利于品牌词展示

### 3.2 必应 Webmaster Tools（必做，国际 + Copilot/AI 搜索入口）
1. 打开 https://www.bing.com/webmasters → 登录微软账号
2. **Add a site** → `https://www.fsbtop.top` → 验证（同样支持 CNAME / meta / XML 文件）
3. 左侧 **「Sitemaps」** → 输入 `https://www.fsbtop.top/sitemap.xml` → **Submit**
4. 必应会自动同步给 **ChatGPT / Copilot / 国内部分 AI 搜索**，是 GEO 收录的关键一环

### 3.3 （可选）Google Search Console
- 虽国内访问受限，但 Google 是多数海外 AI 搜索 / 爬虫的数据源。步骤同上：https://search.google.com/search-console → 添加站点 → 提交 sitemap。

---

## 四、上线后验证清单

| 检查项 | 方法 | 期望结果 |
|--------|------|----------|
| 备案号显示 | 硬刷新前台任意页，看页脚 | 显示「黔ICP备2026013377号」且可点开工信部 |
| canonical | 查看页面源码 `<head>` | `https://www.fsbtop.top/...` 绝对地址 |
| 强制 HTTPS | 访问 `http://www.fsbtop.top` | 自动跳 `https://` |
| apex 重定向 | 访问 `http://fsbtop.top` / `https://fsbtop.top` | 301 跳到 `https://www.fsbtop.top/` |
| sitemap | 浏览器打开 `https://www.fsbtop.top/sitemap.xml` | 5 条 www 绝对地址 |
| 收录 | 百度/必应提交后，搜索 `site:fsbtop.top` | 逐步出现首页与各页 |

---

## 五、备注
- 后台「站点设置」里的 **ICP 备案号** 字段现已与页脚联动：在那改了，前台 4 个加载了 main.js 的页面会自动更新（blog-detail 页为静态兜底，同样显示该号）。
- 若后续增删页面，记得同步更新 `sitemap.xml` 与 `data/config.json` 的 `siteUrl`（如有需要）。
