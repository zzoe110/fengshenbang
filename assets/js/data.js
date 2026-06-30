// ============================================
// 全局数据加载器 - 优先使用 window.FSB_DATA
// 在静态演示环境下，所有 JSON 数据内嵌到这里
// ============================================

window.FSB_DATA = {
  services: [
    {
      id: "brand-operations",
      title: "企业品牌运营",
      subtitle: "Brand Operations",
      summary: "从品牌定位到全网运营，让你的品牌从0到1，被看见、被记住、被选择。",
      icon: "🏛️",
      color: "#b8924a",
      features: ["品牌战略定位", "VI视觉系统设计", "新媒体矩阵运营", "公关传播策划"],
      caseCount: 38,
      publishDate: "2026-06-28"
    },
    {
      id: "dental-operations",
      title: "口腔内外运营",
      subtitle: "Dental Operations",
      summary: "口腔机构内运营+外运营双轮驱动，门诊量、复购率、转介绍率全面提升。",
      icon: "🦷",
      color: "#d4af6a",
      features: ["门诊SOP标准化", "客户生命周期管理", "医生IP打造", "渠道获客体系"],
      caseCount: 26,
      publishDate: "2026-06-25"
    },
    {
      id: "traditional-planning",
      title: "传统企业策划",
      subtitle: "Traditional Enterprise",
      summary: "传统企业转型策划，存量市场盘活，增量市场破局，让老树发新枝。",
      icon: "📊",
      color: "#e8c896",
      features: ["商业模式重塑", "数字化转型咨询", "组织架构优化", "渠道战略升级"],
      caseCount: 19,
      publishDate: "2026-06-20"
    },
    {
      id: "youtuber",
      title: "YouTuBer",
      subtitle: "YouTuBer",
      summary: "YouTube频道全案运营，从内容策划到流量变现，让中国故事走向全球。",
      icon: "🎬",
      color: "#b8924a",
      features: ["频道定位策划", "内容脚本创作", "视频拍摄制作", "海外流量变现"],
      caseCount: 12,
      publishDate: "2026-06-15"
    },
    {
      id: "dental-geo",
      title: "口腔GEO优化",
      subtitle: "Dental GEO",
      summary: "AI搜索时代，口腔机构如何在DeepSeek、豆包、文心一言里被推荐？我们有答案。",
      icon: "🎯",
      color: "#d4af6a",
      features: ["AI搜索排名优化", "GEO内容矩阵", "口碑舆情管理", "精准客户导流"],
      caseCount: 31,
      publishDate: "2026-06-29"
    },
    {
      id: "ai-empowerment",
      title: "AI落地赋能",
      subtitle: "AI Empowerment",
      summary: "AI不是噱头，是生产力。我们帮企业把AI工具真正落到业务流程里，降本增效。",
      icon: "🤖",
      color: "#e8c896",
      features: ["AI应用场景诊断", "智能体定制开发", "员工AI培训", "业务流程AI化"],
      caseCount: 24,
      publishDate: "2026-06-29"
    }
  ],
  blog: [
    {
      id: "geo-ai-search-2026",
      title: "AI搜索时代，口腔机构如何抢占GEO红利？",
      category: "tech",
      tags: ["GEO", "AI搜索", "口腔"],
      summary: "DeepSeek、豆包、文心一言正在重塑用户搜索习惯。本文拆解口腔机构GEO优化的3个核心动作。",
      content: "完整内容（后台编辑）",
      coverImage: "",
      author: "烽审榜",
      publishDate: "2026-06-29",
      readTime: 8
    },
    {
      id: "ai-empowerment-3steps",
      title: "AI落地三步走：让企业真正用起来",
      category: "business",
      tags: ["AI", "企业转型", "落地"],
      summary: "90%企业的AI转型死在第一步。本文给出可执行的三步走框架。",
      content: "完整内容（后台编辑）",
      coverImage: "",
      author: "烽审榜",
      publishDate: "2026-06-27",
      readTime: 12
    },
    {
      id: "dental-marketing-new",
      title: "口腔营销新范式：从投流量到养用户",
      category: "business",
      tags: ["口腔", "私域", "用户运营"],
      summary: "流量越来越贵，口腔机构必须从'拉新'转向'养用户'。",
      content: "完整内容（后台编辑）",
      coverImage: "",
      author: "烽审榜",
      publishDate: "2026-06-24",
      readTime: 10
    }
  ],
  cases: [
    {
      id: "case-dental-guizhou",
      title: "贵州某连锁口腔GEO优化案例：3个月AI搜索曝光提升400%",
      serviceId: "dental-geo",
      client: "贵州XX口腔连锁",
      industry: "口腔医疗",
      summary: "通过GEO内容矩阵+AI搜索优化，3个月实现DeepSeek、豆包、文心一言搜索结果首页占位。",
      metrics: [
        { label: "AI搜索曝光", value: "+400%" },
        { label: "到店咨询", value: "+180%" },
        { label: "成交转化", value: "+95%" }
      ],
      publishDate: "2026-06-29"
    },
    {
      id: "case-brand-tea",
      title: "传统茶企品牌焕新：从区域品牌到全国连锁",
      serviceId: "brand-operations",
      client: "黔西南XX茶业",
      industry: "传统食品",
      summary: "品牌定位重塑+新媒体矩阵运营，6个月新开23家加盟店。",
      metrics: [
        { label: "新增加盟店", value: "23家" },
        { label: "品牌搜索量", value: "+520%" },
        { label: "客单价", value: "+65%" }
      ],
      publishDate: "2026-06-26"
    },
    {
      id: "case-ai-manufacturing",
      title: "制造企业AI落地：质检效率提升300%",
      serviceId: "ai-empowerment",
      client: "广东XX电子制造",
      industry: "智能制造",
      summary: "定制AI质检系统+员工培训，3个月实现质检自动化。",
      metrics: [
        { label: "质检效率", value: "+300%" },
        { label: "人力成本", value: "-60%" },
        { label: "漏检率", value: "-85%" }
      ],
      publishDate: "2026-06-22"
    }
  ]
};
