// API Configuration
export const API_BASE = 'https://australian-assistant-api.wjunhao02.workers.dev';
export const MAX_CONTEXT = 20;

export const WELCOME_MESSAGE = {
  role: 'assistant',
  content: `👋 你好！我是澳知AI，专为澳洲华人打造的智能助手。

我可以帮你：
🚆 查实时交通、🏠 查租金、💰 算税、📱 选手机卡
🏫 查学校排名、🛡️ 识别诈骗、💊 查药品、📋 Medicare报销
🎫 签证信息、🧳 TRS退税、🗺️ 旅游攻略、🏢 ABN查询、📊 经济数据、🌫️ 空气质量 等52项服务

📷 你也可以发图片给我，比如拍下超市价签、药品标签、政府信件等，我帮你解读。

试试问我任何关于澳洲生活的问题！`,
};

export const QUICK_ASKS = [
  { emoji: '🌤️', label: '悉尼天气', text: '悉尼今天天气怎么样？' },
  { emoji: '🏫', label: '学区搜索', text: 'Chatswood附近有什么好的小学？' },
  { emoji: '🏠', label: '租金查询', text: 'Sunnybank两房租金大概多少？' },
  { emoji: '📱', label: '手机卡推荐', text: '什么手机卡打中国免费？' },
  { emoji: '🛡️', label: '防诈骗', text: '收到一条短信说我的toll没付，是诈骗吗？' },
  { emoji: '💰', label: '税务计算', text: '年收入10万澳币要交多少税？' },
];

export const TOOL_CATEGORIES = [
  {
    icon: '🚆',
    title: '出行交通',
    tools: ['实时交通 (全澳8州)', '路线规划', '油价查询', '车辆查询'],
  },
  {
    icon: '🏠',
    title: '租房买房',
    tools: ['政府中位租金', 'Domain找房', '租客权利', '房贷计算'],
  },
  {
    icon: '💰',
    title: '财务税务',
    tools: ['税务计算', '汇率换算', '银行利率', 'Centrelink', 'ABN查询', 'TRS退税', 'Super养老金'],
  },
  {
    icon: '🏥',
    title: '医疗健康',
    tools: ['HotDoc预约', '医疗设施', 'Medicare报销', 'OSHC保险', '药品查询', '中文GP'],
  },
  {
    icon: '🎓',
    title: '教育学校',
    tools: ['9,755所学校', 'CRICOS课程', 'AQF学历', '选校指南'],
  },
  {
    icon: '🛡️',
    title: '安全生活',
    tools: ['防诈骗检测', '紧急联系', '签证信息', '天气预警', '空气质量'],
  },
  {
    icon: '🛒',
    title: '消费购物',
    tools: ['超市特价', '手机卡对比', '电费对比', '保险比较'],
  },
  {
    icon: '🗺️',
    title: '探索发现',
    tools: ['附近搜索', '活动搜索', '旅游攻略', '网络搜索', '天气预报'],
  },
];

export const FEATURES = [
  { icon: '🇦🇺', title: '52项澳洲专属工具', desc: '实时交通（全澳8州）、政府中位租金、9755所学校数据、Medicare费率、华人防诈骗——ChatGPT做不到的，我们都有。' },
  { icon: '🧠', title: '上下文理解·中英双语', desc: '自动识别问题意图，调用最合适的工具组合。中英文自由切换，回复自然流畅。' },
  { icon: '⚡', title: '实时数据·秒级响应', desc: '直连政府API和权威数据源。交通实时更新、租金季度刷新、汇率分钟级变化。' },
  { icon: '🔒', title: '数据安全·隐私保护', desc: 'Cloudflare澳洲节点处理，不经美国。对话不存储、不训练。符合澳洲隐私法。' },
];
