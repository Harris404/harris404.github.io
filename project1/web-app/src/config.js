// API Configuration
export const API_BASE = 'https://australian-assistant-api.wjunhao02.workers.dev';
export const MAX_CONTEXT = 20;

// 5 Australian Animal Pokémon → 5 Agents
export const ANIMAL_AGENTS = {
  life:       { emoji: '🐦', name: 'Kookie',  animal: '笑翠鸟', personality: '话痨万事通' },
  healthcare: { emoji: '🦎', name: 'Spike',   animal: '松狮蜥', personality: '沉稳守护者' },
  education:  { emoji: '🐨', name: 'Koko',    animal: '考拉',   personality: '慵懒博学家' },
  wellness:   { emoji: '🐹', name: 'Quokka',  animal: '短尾矮袋鼠', personality: '阳光社交达人' },
  finance:    { emoji: '🦆', name: 'Platty',  animal: '鸭嘴兽', personality: '神秘理财大师' },
};

export const WELCOME_MESSAGE = {
  role: 'assistant',
  content: `🦘 你好！欢迎来到澳知AI——你的澳洲生活助手！

我有5位动物伙伴随时为你服务：
🐦 Kookie 笑翠鸟 — 生活百事通（交通·租房·天气·翻译）
🦎 Spike 松狮蜥 — 医疗守护者（Medicare·医生·药品·保险）
🐨 Koko 考拉 — 教育专家（学校·签证·课程·学历）
🐹 Quokka 短尾矮袋鼠 — 休闲向导（活动·旅游·超市·能源）
🦆 Platty 鸭嘴兽 — 财务大师（税务·汇率·ABN·理财）

📷 你也可以发图片给我，比如拍下超市价签、药品标签、政府信件等，我帮你解读。

试试问我任何关于澳洲生活的问题吧！`,
};

export const QUICK_ASKS = [
  { emoji: '🐦', label: '悉尼天气', text: '悉尼今天天气怎么样？' },
  { emoji: '🐨', label: '学区搜索', text: 'Chatswood附近有什么好的小学？' },
  { emoji: '🐦', label: '租金查询', text: 'Sunnybank两房租金大概多少？' },
  { emoji: '🐹', label: '手机卡推荐', text: '什么手机卡打中国免费？' },
  { emoji: '🐦', label: '防诈骗', text: '收到一条短信说我的toll没付，是诈骗吗？' },
  { emoji: '🦆', label: '税务计算', text: '年收入10万澳币要交多少税？' },
];

export const TOOL_CATEGORIES = [
  {
    icon: '🐦',
    title: 'Kookie 笑翠鸟 · 生活',
    agent: 'life',
    tools: ['实时交通 (全澳8州)', '路线规划', '油价查询', '车辆查询', '政府中位租金', 'Domain找房', '租客权利', '天气预报', '天气预警', '防诈骗检测', '紧急联系', '空气质量', '翻译助手', '邮编查询', '公共假日'],
  },
  {
    icon: '🦎',
    title: 'Spike 松狮蜥 · 医疗',
    agent: 'healthcare',
    tools: ['HotDoc预约', '医疗设施', 'Medicare报销', 'OSHC保险', '药品查询', '中文GP', '药物互作用', '心理健康'],
  },
  {
    icon: '🐨',
    title: 'Koko 考拉 · 教育',
    agent: 'education',
    tools: ['9,755所学校', 'CRICOS课程', 'AQF学历', '签证信息', 'YouTube学习'],
  },
  {
    icon: '🐹',
    title: 'Quokka 短尾矮袋鼠 · 休闲',
    agent: 'wellness',
    tools: ['活动搜索', '旅游攻略', '超市特价', '手机卡对比', '电费对比', '保险比较', '附近搜索', '网络搜索'],
  },
  {
    icon: '🦆',
    title: 'Platty 鸭嘴兽 · 财务',
    agent: 'finance',
    tools: ['税务计算', '汇率换算', '银行利率', 'Centrelink', 'ABN查询', 'TRS退税', 'Super养老金', '房贷计算', '首套房优惠', '最低工资', '经济数据', '政府数据', '求职搜索'],
  },
];

export const FEATURES = [
  { icon: '🦘', title: '5只澳洲动物伙伴', desc: '笑翠鸟·松狮蜥·考拉·短尾矮袋鼠·鸭嘴兽——5位AI伙伴各司其职，陪你搞定澳洲生活方方面面。' },
  { icon: '🧠', title: '52项专属工具', desc: '实时交通（全澳8州）、政府租金、9755所学校、Medicare、防诈骗——ChatGPT做不到的，我们都有。' },
  { icon: '⚡', title: '实时数据·秒级响应', desc: '直连政府API和权威数据源。交通实时更新、租金季度刷新、汇率分钟级变化。' },
  { icon: '🔒', title: '数据安全·隐私保护', desc: 'Cloudflare澳洲节点处理，对话不存储、不训练。符合澳洲隐私法。' },
];
