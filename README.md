# 烽审榜工作室网站

> **兴义市烽审榜技术咨询服务行** 官方企业网站  
> 涵盖：企业品牌运营 · 口腔内外运营 · 传统企业策划 · YouTuBer · 口腔GEO优化 · AI落地赋能

## ✨ 项目特点

- 🎨 **高端黑金** 商务权威视觉风格
- 📱 **响应式设计** 手机/平板/桌面通吃
- 🔍 **SEO全可控** 每页每篇内容独立 SEO 配置 + 评分
- 🛠 **完整后台CMS** 8大管理模块 + 数据导出/导入
- 🌐 **域名参数化** 后台配置域名，全站URL自动替换
- ⚡ **纯静态** 无后端依赖，部署简单

## 📁 目录结构

```
fengshenbang/
├── index.html              # 首页
├── services.html           # 主营业务页
├── blog.html               # 博客文章页
├── cases.html              # 客户案例页
├── admin/                  # 后台管理
│   ├── login.html          # 登录页
│   ├── dashboard.html      # 仪表盘
│   ├── profile.html        # 关于我
│   ├── services.html       # 业务管理
│   ├── blog.html           # 博客管理
│   ├── cases.html          # 案例管理
│   ├── ads.html            # 广告位
│   ├── seo.html            # 全局SEO
│   └── settings.html       # 站点设置
├── assets/
│   ├── css/                # 样式
│   ├── js/                 # 脚本
│   └── images/             # 图片
└── data/                   # JSON 数据
```

## 🚀 本地预览

### 方法1：直接打开
直接双击 `index.html` 即可在浏览器查看。

### 方法2：本地服务器（推荐）
```bash
# 进入项目目录
cd fengshenbang

# Python 3
python3 -m http.server 8000

# Node.js
npx serve .
```

访问：http://localhost:8000

## 🔐 后台登录

- 地址：http://localhost:8000/admin/login.html
- 默认账号：`admin`
- 默认密码：`admin123`

> ⚠️ 演示版账号密码硬编码，生产环境请接入后端鉴权。

## 🎨 配色方案

| 用途 | 色值 |
|------|------|
| 主背景 | `#0a0a0a` |
| 次背景 | `#1a1a1a` |
| 主金色 | `#b8924a` |
| 玫瑰金 | `#d4af6a` |
| 香槟金 | `#e8c896` |

## 🛠 部署方案

### 免费方案（推荐先期）
- **Vercel** - 一键部署，自动HTTPS
- **Netlify** - 拖拽部署，自带CDN
- **GitHub Pages** - 配合 GitHub Actions

### 付费方案（后期）
- 腾讯云 / 阿里云 OSS静态托管
- 国内服务器（需备案）

## 📞 联系

- 主体：兴义市烽审榜技术咨询服务行
- 商标：烽审榜®（注册商标）
- 业务范围：贵州·全国
