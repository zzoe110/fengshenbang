// ============================================
// 域名参数化配置系统
// 后台设置 siteUrl 后，全站自动替换
// ============================================

// 默认配置（生产环境从 config.json 加载）
const DEFAULT_CONFIG = {
  siteUrl: '', // 留空时使用 window.location.origin
  siteName: '烽审榜',
  siteFullName: '兴义市烽审榜技术咨询服务行',
  logo: 'assets/images/logo.png',
  description: '专业企业品牌运营、口腔GEO优化、AI落地赋能',
  keywords: '企业品牌运营,口腔GEO优化,AI落地,YouTuBer,传统企业策划',
  author: '烽审榜',
  contact: {
    email: 'contact@fengshenbang.com',
    phone: '',
    address: '贵州省兴义市'
  }
};

// 站点配置（运行时会从 localStorage / config.json 覆盖）
const SITE_CONFIG = { ...DEFAULT_CONFIG };

// 工具函数：获取站点基础URL
function getSiteBaseUrl() {
  if (SITE_CONFIG.siteUrl) {
    return SITE_CONFIG.siteUrl.replace(/\/$/, '');
  }
  return window.location.origin;
}

// 工具函数：生成完整URL
function siteUrl(path = '') {
  return getSiteBaseUrl() + (path.startsWith('/') ? path : '/' + path);
}

// 工具函数：动态更新 SEO meta
function updateSEO(meta) {
  if (meta.title) document.title = meta.title;
  if (meta.description) {
    let tag = document.querySelector('meta[name="description"]');
    if (tag) tag.content = meta.description;
  }
  if (meta.keywords) {
    let tag = document.querySelector('meta[name="keywords"]');
    if (tag) tag.content = meta.keywords;
  }
  if (meta.ogTitle) {
    let tag = document.querySelector('meta[property="og:title"]');
    if (tag) tag.content = meta.ogTitle;
  }
  if (meta.ogDescription) {
    let tag = document.querySelector('meta[property="og:description"]');
    if (tag) tag.content = meta.ogDescription;
  }
  if (meta.ogImage) {
    let tag = document.querySelector('meta[property="og:image"]');
    if (tag) tag.content = siteUrl(meta.ogImage);
  }
  if (meta.canonical) {
    let tag = document.querySelector('link[rel="canonical"]');
    if (tag) tag.href = siteUrl(meta.canonical);
  }
}

// 启动时从 localStorage 加载用户配置
(function loadConfig() {
  try {
    const saved = localStorage.getItem('fsb_site_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(SITE_CONFIG, parsed);
    }
  } catch (e) {
    console.warn('配置加载失败，使用默认配置', e);
  }
})();
