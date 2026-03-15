/**
 * Telco Plan Comparison — 电信套餐比价
 * 帮用户选择最合适的手机/宽带套餐
 * 数据来源：Finder.com.au / 官网 (2026年3月更新) + Tavily 实时搜索
 *
 * 🔍 API 调研结论（2026-03）：
 *   - Telstra Developer (dev.telstra.com): 仅企业API（Messaging/IoT/SIM Swap），无套餐查询API
 *   - Optus: 无公开Developer Portal / API
 *   - Vodafone AU: 无公开API
 *   - Lebara/Boost/amaysim/MVNOs: 无API
 *   - WhistleOut/Finder: 无公开比价API
 *   结论：所有运营商均不提供套餐查询公开API，只能内置数据 + Tavily搜索补充
 */

import { tavilySearch } from './web-search.js';
import { searchRAG } from '../rag.js';

// ── 内置数据更新时间（用于判断是否需要 RAG/Tavily 补充）──────────────
const BUILTIN_DATA_DATE = '2026-03-10';  // 上次手动更新日期，格式 YYYY-MM-DD
const DATA_STALE_DAYS = 45;              // 超过45天视为过期

// ── 三大运营商网络说明 ──────────────────────────────────────────────

const NETWORKS = {
  telstra: { name: 'Telstra', coverage: '99.7%人口覆盖', gen: '4G/5G', strength: '信号最好，郊区/偏远地区首选，自驾游必备' },
  optus:   { name: 'Optus',   coverage: '~98.5%人口覆盖', gen: '4G/5G', strength: '城市覆盖好，华人区信号强，性价比高' },
  vodafone:{ name: 'Vodafone',coverage: '~98.4%人口覆盖', gen: '4G/5G', strength: '城市信号好，国际通话方案多' },
};

// ── MVNO 网络归属 ──────────────────────────────────────────────────

const MVNO_NETWORK = {
  'Boost':       'telstra', // Telstra 全网
  'Belong':      'telstra', // Telstra 批发
  'amaysim':     'optus',
  'Dodo':        'optus',
  'SpinTel':     'optus',
  'Lebara':      'vodafone',
  'felix':       'vodafone',
  'Kogan Mobile':'vodafone',
  'Lycamobile':  'vodafone',
  'Southern Phone':'optus',
};

// ── 预付费手机套餐（Prepaid）── Finder 2026年3月 数据 ───────────────

const PREPAID_PLANS = [
  // --- 轻度/入门 ---
  { provider: 'SpinTel', name: '25GB Postpaid', data: '25GB', calls: '无限澳洲', international: '$50国际通话额度', validity: '月付', price: 22, promo: '前6个月$14/月', network: 'Optus 4G/5G', tip: '2026 Finder最佳性价比奖' },
  { provider: 'Lebara', name: 'Extra Small 30天', data: '10GB', calls: '无限澳洲', international: '含国际通话（26国）', validity: '30天', price: 19.90, promo: '首充$9', network: 'Vodafone 4G', tip: '最便宜国际通话方案' },
  // --- 中档（$25-35） ---
  { provider: 'Lebara', name: 'Small 30天', data: '25GB', calls: '无限澳洲', international: '含无限国际通话（26国）', validity: '30天', price: 24.90, promo: null, network: 'Vodafone 4G', tip: '打中国无限免费门槛最低' },
  { provider: 'Lebara', name: 'Medium 30天', data: '35GB', calls: '无限澳洲', international: '含无限国际通话（60国）', validity: '30天', price: 29.90, promo: '首充$12', network: 'Vodafone 4G/5G', tip: '打中国/HK/台湾/东南亚全免费！留学生首选 ✅✅' },
  { provider: 'amaysim', name: '32GB Plan', data: '32GB', calls: '无限澳洲', international: '含无限28国通话短信', validity: '28天', price: 30, promo: '首充$12', network: 'Optus 4G/5G', tip: '含无限国际通话（美英加法德日韩等），Finder国际通话推荐 ✅' },
  { provider: 'Dodo', name: '$30 Plan', data: '40GB', calls: '无限澳洲', international: '无', validity: '月付', price: 30, promo: '前4个月$15/月', network: 'Optus 4G/5G', tip: '2026 Finder学生套餐第一名，用完不断网(256Kbps)' },
  { provider: 'Belong', name: '40GB Plan', data: '40GB', calls: '无限澳洲', international: '无', validity: '月付', price: 35, promo: '前12个月80GB/月', network: 'Telstra 4G/5G(批发)', tip: 'Telstra网络+便宜价格，偏远地区/校区首选 ✅' },
  { provider: 'Boost', name: '$30 Prepaid', data: '35GB', calls: '无限澳洲', international: '无', validity: '28天', price: 30, promo: null, network: 'Telstra全网', tip: 'Telstra全网覆盖=信号最好，自驾游首选' },
  { provider: 'Telstra', name: '$35 Prepaid', data: '40GB', calls: '无限澳洲', international: '含少量国际短信', validity: '28天', price: 35, promo: null, network: 'Telstra 4G/5G', tip: '信号最好，郊区/偏远地区首选' },
  // --- 大流量（$40-50） ---
  { provider: 'Optus', name: 'Flex Plus $39 Prepaid', data: '数据未公开(含周末无限)', calls: '无限澳洲', international: '无', validity: '28天', price: 39, promo: '首充$13(截至22/3/26)', network: 'Optus 4G/5G', tip: 'AutoRecharge享周末无限流量，可存200GB Data Rollover' },
  { provider: 'Lebara', name: 'Large 30天', data: '50GB', calls: '无限澳洲', international: '含无限国际通话（60国）', validity: '30天', price: 39.90, promo: '前3充100GB/月', network: 'Vodafone 4G/5G', tip: '大流量+打中国免费' },
  { provider: 'felix', name: 'Unlimited', data: '无限(限速40Mbps)', calls: '无限澳洲', international: '无', validity: '月付', price: 40, promo: '前6个月$20/月（码UNL6）', network: 'Vodafone 4G/5G', tip: '唯一真无限流量！2026 Finder无限流量奖 ✅✅' },
  { provider: 'amaysim', name: '120GB Plan', data: '120GB', calls: '无限澳洲', international: '含无限28国通话', validity: '28天', price: 50, promo: '前12充$35/次', network: 'Optus 4G/5G', tip: '超大流量性价比王，Finder 9.6高分 ✅' },
  { provider: 'Lebara', name: 'Extra Large 30天', data: '100GB', calls: '无限澳洲', international: '含无限国际通话（60国）', validity: '30天', price: 49.90, promo: '首充$19 / 前3充200GB', network: 'Vodafone 4G/5G', tip: '100GB+打国际无限' },
];

// ── 后付费手机套餐（Postpaid SIM Only）───────────────────────────────

const POSTPAID_PLANS = [
  // --- Optus Choice Plus（官网 optus.com.au/mobile/plans/shop 2026-03） ---
  { provider: 'Optus', name: 'Small Choice Plus', data: '50GB', calls: '无限澳洲', international: '无', validity: '月付', price: 55, promo: null, network: 'Optus 4G/5G', tip: '无超额费用，$5/天5GB漫游，支持eSIM' },
  { provider: 'Optus', name: 'Medium Choice Plus', data: '200GB', calls: '无限澳洲', international: '含无限35国国际通话短信', validity: '月付', price: 65, promo: null, network: 'Optus 4G/5G', tip: '200GB+35国国际通话，主力套餐 ✅' },
  { provider: 'Optus', name: 'Promo Plan', data: '360GB', calls: '无限澳洲', international: '含无限35国国际通话短信', validity: '月付', price: 69, promo: '前12月$69(含$10/月SubHub订阅额度)，之后$79', network: 'Optus 4G/5G', tip: '超大流量+SubHub(Netflix/Amazon/Kayo等)额度 ✅✅' },
  { provider: 'Optus', name: 'Large Choice Plus', data: '400GB', calls: '无限澳洲', international: '含无限35国国际通话短信', validity: '月付', price: 85, promo: '含$20/月SubHub订阅额度', network: 'Optus 4G/5G', tip: '最大流量+最多订阅额度' },
  { provider: 'Optus', name: 'Student Plan', data: '200GB', calls: '无限澳洲', international: '含无限35国国际通话短信', validity: '月付', price: 39, promo: '前12个月$39/月（需学生身份）', network: 'Optus 4G/5G', tip: 'Optus学生专属！200GB $39 via studenthub ✅✅', student: true },
  { provider: 'Optus', name: 'Geo-offer(部分邮编)', data: '100GB(含50GB Bonus)', calls: '无限澳洲', international: '无', validity: '月付', price: 40, promo: '前12月$40(原$55)，仅限特定邮编', network: 'Optus 4G/5G', tip: '邮编限定优惠，sales.optus.com.au/geo-offer查资格' },
  // --- Vodafone ---
  { provider: 'Vodafone', name: 'Student Small SIM', data: '200GB (含140GB Bonus)', calls: '无限澳洲', international: '含无限标准国际通话', validity: '月付', price: 53, promo: '前12个月$39/月（学生优惠）省$168', network: 'Vodafone 4G/5G', tip: 'Vodafone学生套餐！200GB+国际通话 ✅✅', student: true },
  { provider: 'Vodafone', name: '$45 SIM Only', data: '100GB', calls: '无限澳洲', international: '含无限国际通话', validity: '月付', price: 45, promo: null, network: 'Vodafone 4G/5G', tip: '含国际通话+100GB，便宜 ✅' },
  // --- Telstra ---
  { provider: 'Telstra', name: '$55 SIM Only', data: '80GB', calls: '无限澳洲', international: '含国际短信', validity: '月付', price: 55, promo: null, network: 'Telstra 4G/5G', tip: '信号最好，有5G' },
];

// ── 年卡/长期预付费（Long-expiry）──────────────────────────────────

const LONG_EXPIRY_PLANS = [
  { provider: 'Kogan Mobile', name: 'Large 365天 Flex', data: '300GB (≈25GB/月)', calls: '无限澳洲', international: '无', validity: '365天', price: 240, promo: '首充$179+400GB', network: 'Vodafone 4G', tip: '年均≈$15/月，Finder 9.5高分 ✅' },
  { provider: 'Lebara', name: 'Extra Small 360天', data: '120GB (≈10GB/月)', calls: '无限澳洲', international: '含国际通话', validity: '360天', price: 160, promo: null, network: 'Vodafone 4G', tip: '年卡+国际通话' },
  { provider: 'Lebara', name: 'Medium 360天', data: '260GB (≈22GB/月)', calls: '无限澳洲', international: '含无限国际通话（60国）', validity: '360天', price: 250, promo: '首充$189', network: 'Vodafone 4G/5G', tip: '年卡+打中国免费！长期最佳 ✅✅' },
  { provider: 'Lebara', name: 'Large 360天', data: '425GB (≈35GB/月)', calls: '无限澳洲', international: '含无限国际通话（60国）', validity: '360天', price: 300, promo: null, network: 'Vodafone 4G/5G', tip: '大流量年卡+打中国免费' },
  { provider: 'Boost', name: '$300 12-month', data: '290GB', calls: '无限', international: '无', validity: '365天', price: 250, promo: '首充$250+290GB', network: 'Telstra全网', tip: 'Telstra信号年卡，自驾/偏远首选' },
];

// ── 旅客专用 ──────────────────────────────────────────────────────

const TOURIST_PLANS = {
  title: '旅客专用（Tourist SIM / Short-term）',
  plans: [
    { provider: 'Optus Tourist', name: 'Tourist SIM', data: '60GB', calls: '无限澳洲', international: '含300分钟国际', validity: '28天', price: 40, network: 'Optus 4G/5G', tip: '机场/7-Eleven可买，即买即用' },
    { provider: 'Telstra Tourist', name: 'Tourist SIM', data: '40GB', calls: '无限澳洲', international: '含国际通话', validity: '28天', price: 40, network: 'Telstra 4G/5G', tip: '信号最好，适合自驾游' },
    { provider: 'Vodafone Tourist', name: 'Tourist SIM', data: '40GB', calls: '无限澳洲', international: '含500分钟国际', validity: '28天', price: 40, network: 'Vodafone 4G/5G', tip: '国际通话多，性价比高' },
  ],
  buy_at: [
    '机场到达大厅的运营商柜台（Telstra/Optus/Vodafone均有）',
    '7-Eleven、Woolworths、Coles、BIG W、Australia Post',
    '运营商官网预订寄酒店',
    'eSIM: 在国内就能买 — Airalo、Holafly、eSIM.me',
  ],
  esim_tip: '如果手机支持eSIM，推荐在国内就买好Airalo/Holafly的澳洲eSIM，落地直接能用，不用排队买卡。',
};

// ── 学生优惠专区 ──────────────────────────────────────────────────

const STUDENT_GUIDE = {
  title: '留学生/学生手机套餐指南',
  key_finding: 'Optus和Vodafone各有学生套餐：200GB $39/月（前12个月）。Optus via studenthub，Vodafone via UNiDAYS',
  dedicated_student_plans: [
    {
      provider: 'Optus',
      name: 'Student Plan',
      data: '200GB',
      price: '$39/月（前12个月）',
      savings: '具体节省金额取决于升级后价格',
      international: '含无限35国国际通话短信',
      network: 'Optus 4G/5G',
      how: '通过 optus.com.au/studenthub 申请，需Eligible tertiary student身份验证',
      tip: 'Optus学生专属套餐！200GB+35国国际通话 ✅✅',
    },
    {
      provider: 'Vodafone',
      name: 'Student Small SIM-only',
      data: '200GB（含140GB bonus data）',
      price: '$53/月 → 前12个月$39/月',
      savings: '12个月省$168',
      international: '含无限标准国际通话',
      network: 'Vodafone 4G/5G',
      how: '通过 vodafone.com.au/plans/student 申请，需.edu.au邮箱或UNiDAYS验证',
      tip: 'Vodafone学生套餐，200GB超大流量 ✅✅',
    },
  ],
  optus_student_hub: {
    description: 'Optus Student Hub — 200GB $39/月学生专属套餐',
    url: 'optus.com.au/studenthub',
    tip: '需Eligible tertiary student身份验证，含5G+35国国际通话',
  },
  budget_recommendations: [
    { plan: 'Dodo $30 (40GB)', why: 'Finder学生套餐第一名，前4个月$15/月', network: 'Optus' },
    { plan: 'felix Unlimited $40', why: '无限流量$20/月(前6月)，追剧/视频不限', network: 'Vodafone' },
    { plan: 'amaysim 120GB $50', why: '超大流量$35(前12充)，含28国国际通话', network: 'Optus' },
    { plan: 'Belong 40GB $35', why: 'Telstra网络便宜选，前12月80GB', network: 'Telstra批发' },
    { plan: 'Lebara Medium $29.90', why: '打中国/东南亚免费！国际留学生首选', network: 'Vodafone' },
  ],
  international_student_tips: [
    '打国内电话多 → Lebara（60国无限）或 amaysim（28国无限）',
    '需要视频通话用流量 → felix无限流量 或 amaysim 120GB',
    '在偏远地区上学(如Armidale/Bathurst) → Belong或Boost(Telstra网络)',
    '预算紧 → Dodo $15/月(前4月) 或 SpinTel $14/月(前6月)',
    '一次付清省钱 → Kogan年卡$179/年(≈$15/月) 或 Lebara年卡$189/年',
  ],
  unidays_tip: '注册 UNiDAYS（myunidays.com）可获得部分运营商学生优惠码',
};

// ── NBN 家庭宽带 ── Finder 2026年3月 数据 ──────────────────────────

const NBN_PLANS = {
  title: '家庭宽带 NBN — 2026年3月最新',
  speed_tiers: {
    '25':   { name: 'Basic (NBN 25)',     speed: '25/4 Mbps',     suitable: '1-2人轻度使用/预算有限', price_range: '$55-65/月' },
    '50':   { name: 'Standard (NBN 50)',  speed: '50/17 Mbps',    suitable: '2-3人/WFH/在线课程 ✅推荐', price_range: '$60-86/月' },
    '100':  { name: 'Fast (NBN 100)',     speed: '100/17 Mbps',   suitable: '3-4人/多设备/游戏/4K ✅推荐', price_range: '$64-90/月' },
    '250':  { name: 'Superfast (NBN 250)',speed: '250/22 Mbps',   suitable: '已被NBN 500取代', price_range: '逐步淘汰' },
    '500':  { name: 'Fast (NBN 500)',     speed: '500/42.5 Mbps', suitable: '4+人/重度流媒体/游戏', price_range: '$59-95/月' },
    '750':  { name: 'Superfast (NBN 750)',speed: '750/40 Mbps',   suitable: '大家庭/4K多设备/WFH+游戏', price_range: '$74-109/月' },
    '1000': { name: 'Ultrafast (NBN 1000)',speed:'900/82 Mbps',   suitable: '极致速度/科技爱好者', price_range: '$89-130/月' },
  },
  recommended_providers: [
    { name: 'Southern Phone', price: '$59/月', speed: 'NBN 25', tip: '最便宜NBN，无隐藏费，Finder高分 9.9', rating: '⭐⭐⭐⭐⭐' },
    { name: 'Dodo', price: '$66/月(促$86)', speed: 'NBN 50', tip: '2025 Finder日常使用奖，可与手机捆绑省$5', rating: '⭐⭐⭐⭐⭐' },
    { name: 'Tangerine', price: '$64/月(促$89)', speed: 'NBN 100', tip: '前6个月大幅折扣，NBN100/500同价', rating: '⭐⭐⭐⭐⭐' },
    { name: 'Superloop', price: '$74/月(促$104)', speed: 'NBN 750', tip: '性价比王，含My Speed Boost，Finder常客', rating: '⭐⭐⭐⭐⭐' },
    { name: 'SpinTel', price: '$89/月(促$100)', speed: 'NBN 1000', tip: '最便宜千兆，Finder 9.9分', rating: '⭐⭐⭐⭐⭐' },
    { name: 'Aussie Broadband', price: '$89/月', speed: 'NBN 100', tip: '客服口碑最好，澳洲本地团队', rating: '⭐⭐⭐⭐' },
    { name: 'TPG', price: '$69.99/月', speed: 'NBN 50', tip: '便宜稳定，华人熟知品牌', rating: '⭐⭐⭐⭐' },
    { name: 'Optus', price: '$85/月', speed: 'NBN 100', tip: '可与手机Plan捆绑打折', rating: '⭐⭐⭐⭐' },
    { name: 'Telstra', price: '$95/月', speed: 'NBN 100', tip: '最贵但服务最全', rating: '⭐⭐⭐' },
  ],
  tips: [
    '搬家前在 nbnco.com.au 查你家地址是否有NBN接入以及连接类型',
    '推荐选无合约(No lock-in)的Plan，灵活换运营商',
    'BYO Modem省钱 — 买个兼容TP-Link/NetGear路由器即可',
    'NBN 500为新速率层级，如果你的连接是FTTP/HFC，可享与NBN100相似价格',
    '合租推荐NBN 100+，5G Home Wireless也是选项（如无NBN接入）',
  ],
};

// ── Lebara 特别专区（打中国专用）──────────────────────────────────

const LEBARA_CHINA_GUIDE = {
  title: 'Lebara — 打中国电话免费指南',
  description: 'Lebara是澳洲留学生/华人最受欢迎的运营商之一，主打国际通话免费',
  network: 'Vodafone 4G/5G (TPG Telecom旗下)',
  coverage: '~98.4%人口覆盖，城市信号好',
  international_countries: '60+国家免费通话短信（含中国大陆、香港、台湾、新加坡、马来西亚、日本、韩国等）',
  plans_for_china: [
    { name: 'Small 30天', data: '25GB', price: '$24.90', free_china: '无限通话26国', tip: '最便宜打中国免费方案' },
    { name: 'Medium 30天', data: '35GB', price: '$29.90', free_china: '无限通话60国', tip: '最推荐！60国含中港台+东南亚 ✅' },
    { name: 'Large 30天', data: '50GB', price: '$39.90', free_china: '无限通话60国', tip: '大流量版' },
    { name: 'Extra Large 30天', data: '100GB', price: '$49.90', free_china: '无限通话60国', tip: '超大流量+国际通话全包' },
    { name: 'Medium 360天', data: '260GB/年', price: '$250/年(≈$21/月)', free_china: '无限通话60国', tip: '长期最划算！✅✅' },
  ],
  bonus_features: [
    'Data Banking: 未用流量可存入数据银行（最多200GB），下个月继续用',
    'Data Gifting: 可分享最多10GB给其他Lebara用户',
    'Auto Recharge: 自动充值享90%折扣（$24.90+的套餐）',
    'eSIM: 支持',
  ],
  where_to_buy: [
    'lebara.com.au 官网下单',
    'Woolworths、BIG W、加油站',
    'eSIM可直接在线激活',
  ],
  tips: [
    '26国套餐（Extra Small/Small）主要包含：中国大陆、HK、UK、USA、加拿大、NZ等',
    '60国套餐（Medium及以上）额外包含：台湾、新加坡、马来西亚、日本、韩国、泰国、印尼等',
    '打中国手机和座机都免费，不限分钟数',
    '国际漫游很贵（$15/2天），出国建议买当地SIM',
    'WeChat语音/视频通话不消耗国际通话额度，只消耗流量',
  ],
};

// ── 主函数 ──────────────────────────────────────────────────────────

export async function compareTelco(args, env) {
  const type = (args.type || args.mode || 'mobile').toLowerCase();
  const budget = Number(args.budget) || 0;
  const needs = (args.needs || args.query || '').toLowerCase();

  // ── 判断内置数据是否过期 ──
  const now = new Date();
  const builtinDate = new Date(BUILTIN_DATA_DATE);
  const daysSinceUpdate = Math.floor((now - builtinDate) / (1000 * 60 * 60 * 24));
  const isDataStale = daysSinceUpdate > DATA_STALE_DAYS;

  // ── RAG 查询（优先获取最新抓取的套餐数据）──
  let ragData = [];
  const ragQuery = args.query || needs || type;
  if (env?.VECTORIZE && env?.DB && ragQuery) {
    try {
      const ragSearchTerms = {
        mobile: 'best SIM only mobile plan Australia prepaid postpaid',
        nbn: 'best NBN broadband plan Australia speed price',
        broadband: 'best NBN broadband plan Australia speed price',
        tourist: 'tourist SIM card Australia visitor prepaid',
        student: 'best mobile plan student Australia university discount',
        lebara: 'Lebara Australia plan international calls China free',
        annual: 'long expiry 365 day prepaid plan Australia annual',
      };
      const searchQ = `${ragQuery} ${ragSearchTerms[type] || ragSearchTerms.mobile}`;
      const results = await searchRAG(searchQ, 5, ['living/telco'], env);
      if (results && results.length > 0) {
        ragData = results.map(r => ({
          title: r.title || '',
          section: r.section || '',
          content: (r.content || '').substring(0, 800),
          source_url: r.source_url || '',
          last_updated: r.last_updated || '',
          score: r.score || 0,
        })).filter(r => r.score >= 0.4);
      }
    } catch (e) {
      console.log('[Telco] RAG search error:', e.message);
    }
  }

  // ── Tavily 实时搜索（RAG 无结果或数据过期时使用）──
  let latestDeals = [];
  const tavilyKey = env?.TAVILY_API_KEY;
  const searchQuery = args.query || needs;
  const shouldSearchTavily = isDataStale || ragData.length === 0 || (searchQuery && searchQuery.length > 2);
  if (tavilyKey && shouldSearchTavily && searchQuery && searchQuery.length > 2) {
    try {
      const searchTerms = {
        mobile: 'best mobile SIM plan Australia deal',
        nbn: 'best NBN broadband plan Australia deal',
        broadband: 'best NBN broadband plan Australia deal',
        tourist: 'tourist SIM card Australia airport',
        student: 'best mobile plan student Australia university',
        lebara: 'Lebara Australia plan international calls China',
      };
      const searchQ = `${searchQuery} ${searchTerms[type] || searchTerms.mobile} 2026`;
      const data = await tavilySearch(searchQ, tavilyKey, {
        maxResults: 5,
        depth: 'basic',
        rawContent: false,
        answer: false,
        includeDomains: ['whistleout.com.au', 'finder.com.au', 'canstarblue.com.au'],
      });
      latestDeals = (data.results || []).map(r => ({
        title: r.title,
        url: r.url,
        snippet: (r.snippet || '').substring(0, 200),
      })).slice(0, 4);
    } catch { /* Tavily optional */ }
  }

  // ── 数据来源说明 ──
  const sources = [];
  sources.push(`内置数据(${BUILTIN_DATA_DATE}更新)`);
  if (ragData.length > 0) sources.push(`RAG知识库(${ragData.length}条相关结果)`);
  if (latestDeals.length > 0) sources.push('Tavily实时搜索');
  const source = sources.join(' + ');

  const freshness = {
    builtin_data_date: BUILTIN_DATA_DATE,
    days_since_update: daysSinceUpdate,
    is_stale: isDataStale,
    rag_results: ragData.length,
    tip: isDataStale
      ? `⚠️ 内置数据已${daysSinceUpdate}天未更新，以下信息可能不是最新。建议运行 scrape-telco-plans.py 更新RAG数据。`
      : `✅ 内置数据${daysSinceUpdate}天前更新，较为新鲜。`,
  };

  // ── NBN ──
  if (type === 'nbn' || type === 'broadband') {
    return { ...NBN_PLANS, rag_knowledge: ragData, latest_deals: latestDeals, data_freshness: freshness, source };
  }

  // ── Tourist ──
  if (type === 'tourist') {
    return { ...TOURIST_PLANS, rag_knowledge: ragData, latest_deals: latestDeals, data_freshness: freshness, source };
  }

  // ── Student ──
  if (type === 'student') {
    return { ...STUDENT_GUIDE, rag_knowledge: ragData, latest_deals: latestDeals, data_freshness: freshness, source };
  }

  // ── Lebara / 打中国 ──
  if (type === 'lebara' || needs.includes('中国') || needs.includes('china') || needs.includes('lebara') || needs.includes('国际')) {
    return { ...LEBARA_CHINA_GUIDE, rag_knowledge: ragData, latest_deals: latestDeals, data_freshness: freshness, source };
  }

  // ── Long-expiry 年卡 ──
  if (type === 'annual' || type === 'yearly' || type === '年卡' || needs.includes('年卡') || needs.includes('365') || needs.includes('long')) {
    let plans = [...LONG_EXPIRY_PLANS];
    if (budget > 0) plans = plans.filter(p => p.price <= budget);
    return {
      title: '年卡/长期预付费套餐 — 一次付清更省钱',
      plans,
      tip: '年卡一次付清，折合月均$13-25，比月付便宜30-50%。但中途不能退款。',
      rag_knowledge: ragData,
      latest_deals: latestDeals,
      data_freshness: freshness,
      source,
    };
  }

  // ── 默认：全部手机套餐 ──
  let prepaid = [...PREPAID_PLANS];
  let postpaid = [...POSTPAID_PLANS];

  if (budget > 0) {
    prepaid = prepaid.filter(p => p.price <= budget);
    postpaid = postpaid.filter(p => p.price <= budget);
  }

  // 按需求排序
  if (needs.includes('coverage') || needs.includes('信号') || needs.includes('偏远')) {
    const telstraFirst = (a, b) => {
      const aT = (a.network || '').toLowerCase().includes('telstra') ? 1 : 0;
      const bT = (b.network || '').toLowerCase().includes('telstra') ? 1 : 0;
      return bT - aT;
    };
    prepaid.sort(telstraFirst);
    postpaid.sort(telstraFirst);
  }

  return {
    prepaid: { title: '预付费（Prepaid）— 无合约，灵活', plans: prepaid },
    postpaid: { title: '后付费（Postpaid SIM Only）— 月付，有5G', plans: postpaid },
    long_expiry_highlight: '💡 年卡更省钱 — 用 type:"annual" 查看365天长期套餐',
    recommendation: {
      打中国免费: 'Lebara Medium $29.90 — 60国无限国际通话（含中港台）✅✅',
      学生首选: 'Optus Student $39/月 或 Vodafone Student $39/月 — 都是200GB 学生专属 ✅',
      极致性价比: 'Dodo $15/月(前4月) 40GB 或 SpinTel $14/月(前6月)',
      无限流量: 'felix $20/月(前6月) — 真无限流量 ✅',
      最大流量: 'amaysim 120GB $35(前12充) — 超大流量+国际通话',
      信号最好: 'Boost $30 或 Belong $35 — Telstra网络覆盖最广',
      年卡省钱: 'Lebara 360天 $189 或 Kogan 365天 $179',
    },
    networks: NETWORKS,
    rag_knowledge: ragData,
    latest_deals: latestDeals,
    data_freshness: freshness,
    tip: isDataStale
      ? '⚠️ 套餐数据可能已过期，请参考 rag_knowledge 和 latest_deals 中的最新信息'
      : '⚠️ 套餐价格可能随时变动。查看最新 → whistleout.com.au 或 finder.com.au/mobile-plans',
    source,
  };
}
