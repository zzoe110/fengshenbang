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
  description: '兴义市烽审榜技术咨询服务行（商标「烽审榜」）提供企业品牌运营、口腔内外运营、口腔GEO优化、AI落地赋能、传统企业策划与YouTuber出海服务，覆盖品牌定位、AI搜索优化、智能体开发全链路，已服务150+客户、满意度98%。',
  keywords: '企业品牌运营,品牌策划,品牌定位,VI设计,新媒体矩阵运营,口腔GEO优化,生成式引擎优化,GEO优化,AI搜索优化,口腔AI搜索排名,口腔内外运营,口腔门诊运营,口腔机构获客,AI落地赋能,企业AI应用,智能体开发,AI培训,传统企业策划,企业数字化转型,传统企业转型,YouTuber运营,YouTube频道运营,出海内容创作,贵州企业服务,兴义品牌策划,黔西南企业咨询,烽审榜,兴义市烽审榜技术咨询服务行',
  author: '烽审榜',
  homeTitle: '烽审榜 - 企业品牌运营·口腔GEO优化·AI落地赋能 | 贵州兴义技术咨询服务行',
  homeDescription: '兴义市烽审榜技术咨询服务行（商标「烽审榜」）提供企业品牌运营、口腔内外运营、口腔GEO优化、AI落地赋能、传统企业策划与YouTuber出海服务，覆盖品牌定位、AI搜索优化、智能体开发全链路，已服务150+客户、满意度98%。',
  homeKeywords: '企业品牌运营,品牌策划,品牌定位,VI设计,新媒体矩阵运营,口腔GEO优化,生成式引擎优化,GEO优化,AI搜索优化,口腔AI搜索排名,口腔内外运营,口腔门诊运营,口腔机构获客,AI落地赋能,企业AI应用,智能体开发,AI培训,传统企业策划,企业数字化转型,传统企业转型,YouTuber运营,YouTube频道运营,出海内容创作,贵州企业服务,兴义品牌策划,黔西南企业咨询,烽审榜,兴义市烽审榜技术咨询服务行',
  homeOgImage: '',
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
