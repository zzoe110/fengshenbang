// ============================================
// 数据清洗规则引擎（服务端）
// 京州口腔两套日报表格式的清洗逻辑，全部在服务端执行，
// 浏览器不持有任何映射表 / 字段规则 / 密码。
// ============================================

// ---------- 诊所名称简写映射：电商部（23列） ----------
const CLINIC_MAP_ECOMMERCE = {
  '黔西南州京州口腔医院有限责任公司1': '神奇总院',
  '黔西南州京州口腔医院有限责任公司': '神奇总院',
  '兴义市京州天森口腔门诊部有限公司': '天森',
  '兴义市京州口腔门诊部有限公司': '兴义分院',
  '兴义市京州盘江口腔门诊部有限责任公司': '盘江',
  '兴义市京州生态城口腔门诊部有限公司': '生态城',
  '兴义市京州梦乐城口腔门诊部有限公司': '梦乐城',
  '六盘水钟山区新京州口腔门诊部有限公司': '凉都',
  '六盘水钟山区铭杨京州口腔门诊部有限公司': '铭杨',
  '六盘水钟山区爱民京州口腔门诊部有限公司': '六盘水爱民',
  '六盘水钟山区明湖京州口腔门诊部有限公司': '明湖',
  '六盘水钟山区国贸京州口腔门诊部有限公司': '六盘水国贸',
  '毕节京州口腔门诊部有限公司': '毕节',
  '毕节市京州招商口腔门诊部有限公司': '毕节招商',
  '毕节市京州爱民口腔门诊部有限公司': '毕节爱民',
  '凯里市京州惠民口腔门诊部有限公司': '凯里惠民',
  '凯里市京州口腔门诊部有限公司': '凯里分院',
  '凯里市京州大十字口腔门诊有限公司': '凯里大十字',
  '凯里市京州未来城口腔门诊部有限公司': '凯里未来城',
  '遵义市京州国贸口腔门诊部有限公司': '遵义国贸',
  '北京惠欣京州口腔门诊部有限公司': '北京惠欣',
  '兴仁京州口腔门诊部有限公司': '兴仁',
  '威宁京州口腔诊所有限公司': '威宁',
  '贞丰县京州口腔门诊部有限责任公司': '贞丰',
  '瓮安京州口腔门诊部有限公司': '瓮安',
  '镇雄京州口腔门诊部有限公司': '镇雄',
};

// ---------- 诊所名称简写映射：网电客服（25列，带"分院"） ----------
const CLINIC_MAP_TELCALL = {
  '黔西南州京州口腔医院有限责任公司1': '神奇总院',
  '黔西南州京州口腔医院有限责任公司': '神奇总院',
  '兴义市京州天森口腔门诊部有限公司': '天森',
  '兴义市京州口腔门诊部有限公司': '兴义分院',
  '兴义市京州盘江口腔门诊部有限责任公司': '盘江',
  '兴义市京州生态城口腔门诊部有限公司': '生态城分院',
  '兴义市京州梦乐城口腔门诊部有限公司': '梦乐城分院',
  '六盘水钟山区新京州口腔门诊部有限公司': '凉都分院',
  '六盘水钟山区铭杨京州口腔门诊部有限公司': '铭杨分院',
  '六盘水钟山区爱民京州口腔门诊部有限公司': '六盘水爱民',
  '六盘水钟山区明湖京州口腔门诊部有限公司': '明湖分院',
  '六盘水钟山区国贸京州口腔门诊部有限公司': '六盘水国贸',
  '毕节京州口腔门诊部有限公司': '毕节分院',
  '毕节市京州招商口腔门诊部有限公司': '毕节招商',
  '毕节市京州爱民口腔门诊部有限公司': '毕节爱民',
  '凯里市京州惠民口腔门诊部有限公司': '凯里惠民',
  '凯里市京州口腔门诊部有限公司': '凯里分院',
  '凯里市京州大十字口腔门诊有限公司': '凯里大十字',
  '凯里市京州未来城口腔门诊部有限公司': '凯里未来城',
  '遵义市京州国贸口腔门诊部有限公司': '遵义国贸',
  '北京惠欣京州口腔门诊部有限公司': '北京惠欣',
  '兴仁京州口腔门诊部有限公司': '兴仁分院',
  '威宁京州口腔诊所有限公司': '威宁分院',
  '贞丰县京州口腔门诊部有限责任公司': '贞丰分院',
  '瓮安京州口腔门诊部有限公司': '瓮安分院',
  '镇雄京州口腔门诊部有限公司': '镇雄分院',
};

function shortenClinic(map, fullName) {
  if (!fullName) return '';
  return map[fullName] || fullName;
}

function mapCheckInType(type) {
  if (!type) return '';
  if (type === '初诊') return '初';
  if (type === '复诊') return '复';
  return type;
}

function formatDate(datetimeStr) {
  if (!datetimeStr) return '';
  return String(datetimeStr).substring(0, 10);
}

// ---------- 电商部日报表模板7.10（23列） ----------
const HEADERS_ECOMMERCE = [
  '最后沟通日期', '网电客服', '初复诊', '病例id', '姓名', '年龄',
  '电话', '三级来源', '创建预约日期', '预约日期', '预约项目',
  '到诊日期', '主诉', '潜在需求', '应收', '欠费',
  '实收', '收费门店', '接诊医生', '方案价', '未成交原因', '未按时到院原因', '备注'
];

function extractRowsEcommerce(items) {
  if (!items || !items.length) return [];
  return items.map(item => [
    formatDate(item.recordCreatedTime),                       // 1 最后沟通日期
    item.onlineConsultantName || '',                          // 2 网电客服
    mapCheckInType(item.checkInType),                         // 3 初复诊
    item.patientId !== undefined && item.patientId !== null ? String(item.patientId) : '', // 4 病例id
    item.patientName || '',                                   // 5 姓名
    item.age !== undefined && item.age !== null ? String(item.age) : '', // 6 年龄
    item.mobile || '',                                        // 7 电话
    item.patientRefereeName || '',                            // 8 三级来源
    formatDate(item.recordCreatedTime),                       // 9 创建预约日期
    formatDate(item.startTime),                               // 10 预约日期
    item.transactionNames || '',                              // 11 预约项目
    formatDate(item.checkInTime),                             // 12 到诊日期
    '',                                                       // 13 主诉（JSON无字段）
    '',                                                       // 14 潜在需求
    '',                                                       // 15 应收
    '',                                                       // 16 欠费
    '',                                                       // 17 实收
    shortenClinic(CLINIC_MAP_ECOMMERCE, item.officeName),     // 18 收费门店
    item.doctorName || '',                                    // 19 接诊医生
    '',                                                       // 20 方案价
    '',                                                       // 21 未成交原因
    '',                                                       // 22 未按时到院原因
    item.notes || ''                                          // 23 备注
  ]);
}

// ---------- 工作簿2.xlsx（25列） ----------
const HEADERS_TELCALL = [
  '最后沟通时间', '初诊/复诊', '性别', '姓名', '电话',
  '病例ID', '主诉', '来源', '创建预约日期', '预约日期',
  '到诊日期', '应收', '欠费', '实收', '预约门店',
  '接诊医生', '接诊咨询', '网电客服', '潜在需求', '方案价',
  '未成交原因', '未按时到院原因', '备注', '明湖院内反馈', '是否电话客服二次跟进成交'
];

function extractRowsTelcall(items) {
  if (!items || !items.length) return [];
  return items.map(item => [
    formatDate(item.recordCreatedTime),                       // 1 最后沟通时间
    mapCheckInType(item.checkInType),                         // 2 初诊/复诊
    '',                                                       // 3 性别（JSON无字段）
    item.patientName || '',                                   // 4 姓名
    item.mobile || '',                                        // 5 电话
    item.patientId !== undefined && item.patientId !== null ? String(item.patientId) : '', // 6 病例ID
    item.transactionNames || '',                              // 7 主诉
    item.patientRefereeName || '',                            // 8 来源
    formatDate(item.recordCreatedTime),                       // 9 创建预约日期
    formatDate(item.startTime),                               // 10 预约日期
    formatDate(item.checkInTime),                             // 11 到诊日期
    '',                                                       // 12 应收
    '',                                                       // 13 欠费
    '',                                                       // 14 实收
    shortenClinic(CLINIC_MAP_TELCALL, item.officeName),       // 15 预约门店
    item.doctorName || '',                                    // 16 接诊医生
    item.consultantName || '',                                // 17 接诊咨询
    item.onlineConsultantName || '',                          // 18 网电客服
    '',                                                       // 19 潜在需求
    '',                                                       // 20 方案价
    '',                                                       // 21 未成交原因
    '',                                                       // 22 未按时到院原因
    item.notes || '',                                         // 23 备注
    '',                                                       // 24 明湖院内反馈
    ''                                                        // 25 是否电话客服二次跟进成交
  ]);
}

function generateTSV(rows) {
  return rows.map(row => row.join('\t')).join('\n');
}

// ---------- 统一入口 ----------
const ENGINES = {
  ecommerce: { headers: HEADERS_ECOMMERCE, extract: extractRowsEcommerce },
  telcall: { headers: HEADERS_TELCALL, extract: extractRowsTelcall }
};

function clean(type, rawPayload) {
  const engine = ENGINES[type];
  if (!engine) {
    const err = new Error('未知的清洗类型: ' + type);
    err.status = 400;
    throw err;
  }
  // rawPayload 可能是字符串（前端原文）或已解析对象
  let parsed = rawPayload;
  if (typeof rawPayload === 'string') {
    parsed = JSON.parse(rawPayload);
  }
  let items = parsed;
  if (parsed && Array.isArray(parsed.items)) items = parsed.items;
  if (!Array.isArray(items)) {
    const err = new Error('未找到可解析的记录数组（期望 items 字段或直接数组）');
    err.status = 400;
    throw err;
  }
  const rows = engine.extract(items);
  return {
    ok: true,
    type,
    headers: engine.headers,
    rows,
    tsv: generateTSV(rows),
    count: rows.length
  };
}

module.exports = { clean, HEADERS_ECOMMERCE, HEADERS_TELCALL };
