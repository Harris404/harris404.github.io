/**
 * Generate telco RAG documents from built-in data
 * Outputs markdown suitable for D1 RAG ingestion
 */
const fs = require('fs');
const path = require('path');

const RAG_DIR = path.join(__dirname, '..', 'rag-data', 'telco');
fs.mkdirSync(RAG_DIR, { recursive: true });

// ── Document 1: Mobile Plan Overview ──
const mobilePlanDoc = `# 澳洲手机套餐选购指南 (2026年3月)

## 三大运营商网络

| 运营商 | 覆盖率 | 信号特点 | 适合 |
|--------|--------|---------|------|
| Telstra | 99.7%人口 | 最好，郊区偏远首选 | 自驾游、偏远地区 |
| Optus | ~98.5%人口 | 城市好，华人区强 | 城市用户、性价比 |
| Vodafone | ~98.4%人口 | 城市好，国际方案多 | 国际通话需求 |

## MVNO 虚拟运营商（便宜选择）

| 品牌 | 使用网络 | 特点 |
|------|---------|------|
| Boost | Telstra全网 | 信号=Telstra，价格更低 |
| Belong | Telstra批发 | Telstra网络便宜版 |
| amaysim | Optus | 28国免费国际通话 |
| Dodo | Optus | 学生套餐第一名 |
| Lebara | Vodafone | 60国免费国际通话（含中国） |
| felix | Vodafone | 唯一真无限流量 |
| Kogan Mobile | Vodafone | 年卡最便宜 |

## 预算推荐

### $20以下/月
- SpinTel 25GB $14/月(前6月) — Optus网络
- Lebara 10GB $9(首充) — 含国际通话

### $25-35/月
- Lebara Medium 35GB $29.90 — **打中国免费！留学生首选** ✅
- amaysim 32GB $30 — 含28国国际通话
- Dodo 40GB $15/月(前4月) — Finder学生套餐第一名
- Boost 35GB $30 — Telstra全网信号最好
- Belong 40GB $35 — Telstra网络便宜选

### $40-50/月
- felix 无限流量 $20/月(前6月) — **真无限流量** ✅
- amaysim 120GB $35(前12充) — 超大流量
- Lebara 100GB $49.90 — 国际通话全包

## 打中国电话免费方案
1. **Lebara Medium** $29.90/月 — 60国无限（含中港台+东南亚）✅ 最推荐
2. **amaysim 32GB** $30/月 — 28国无限（含中国大陆）
3. **Lebara年卡** $189-250/年 — 长期最划算

## 学生优惠
- Optus Student: 200GB $39/月 via studenthub
- Vodafone Student: 200GB $39/月(前12月)，需UNiDAYS
- Dodo $30: 40GB 前4月$15/月，Finder学生奖

数据来源: Finder.com.au, WhistleOut.com.au (2026年3月)
`;

// ── Document 2: NBN Guide ──
const nbnDoc = `# 澳洲家庭宽带 NBN 选购指南 (2026年3月)

## 速度等级选择

| 等级 | 速度 | 适合 | 价格范围 |
|------|------|------|---------|
| NBN 25 | 25/4 Mbps | 1-2人轻度 | $55-65/月 |
| NBN 50 | 50/17 Mbps | 2-3人/WFH ✅推荐 | $60-86/月 |
| NBN 100 | 100/17 Mbps | 3-4人/游戏/4K ✅推荐 | $64-90/月 |
| NBN 500 | 500/42.5 Mbps | 4+人/重度流媒体 | $59-95/月 |
| NBN 750 | 750/40 Mbps | 大家庭/多4K | $74-109/月 |
| NBN 1000 | 900/82 Mbps | 极致速度 | $89-130/月 |

## 推荐运营商

| 运营商 | 价格 | 速度 | 推荐理由 |
|--------|------|------|---------|
| Southern Phone | $59/月 | NBN 25 | 最便宜 |
| Dodo | $66/月 | NBN 50 | 日常使用奖 |
| Tangerine | $64/月(促) | NBN 100 | 大折扣 |
| Superloop | $74/月(促) | NBN 750 | 性价比王 |
| SpinTel | $89/月(促) | NBN 1000 | 最便宜千兆 |
| Aussie Broadband | $89/月 | NBN 100 | 客服最好 |
| TPG | $69.99/月 | NBN 50 | 华人熟知 |

## 选购建议
- 搬家前在 nbnco.com.au 查地址是否有NBN
- 推荐选无合约(No lock-in)的Plan
- BYO Modem省钱（买TP-Link/NetGear路由器）
- 合租推荐NBN 100+

数据来源: Finder.com.au (2026年3月)
`;

// ── Document 3: Tourist SIM ──
const touristDoc = `# 澳洲旅客 SIM 卡攻略

## 三大运营商 Tourist SIM

| 运营商 | 流量 | 国际通话 | 价格 | 有效期 |
|--------|------|---------|------|--------|
| Optus Tourist | 60GB | 300分钟国际 | $40 | 28天 |
| Telstra Tourist | 40GB | 含国际通话 | $40 | 28天 |
| Vodafone Tourist | 40GB | 500分钟国际 | $40 | 28天 |

## 购买地点
- 机场到达大厅的运营商柜台（Telstra/Optus/Vodafone均有）
- 7-Eleven、Woolworths、Coles、BIG W、Australia Post
- eSIM: Airalo、Holafly、eSIM.me（国内就能买）

## eSIM 推荐
如果手机支持eSIM，推荐在国内就买好Airalo/Holafly的澳洲eSIM，落地直接能用，不用排队买卡。

## 旅客 vs 普通 SIM
- 旅客SIM通常28天到期后不能续费，需要买新的
- 如果停留超过1个月，建议买普通预付费SIM（Lebara/amaysim更划算）
`;

// ── Document 4: Lebara China Calls ──
const lebaraDoc = `# Lebara 打中国电话免费完全指南

## 为什么推荐 Lebara
Lebara是澳洲留学生和华人最受欢迎的运营商之一，主打国际通话免费。使用Vodafone 4G/5G网络。

## 套餐一览

| 套餐 | 流量 | 价格 | 国际通话 |
|------|------|------|---------|
| Small 30天 | 25GB | $24.90 | 26国无限 |
| Medium 30天 | 35GB | $29.90 | 60国无限 ✅最推荐 |
| Large 30天 | 50GB | $39.90 | 60国无限 |
| Extra Large | 100GB | $49.90 | 60国无限 |
| Medium 360天 | 260GB/年 | $250/年(≈$21/月) | 60国无限 ✅长期最划算 |

## 覆盖国家
- 26国套餐：中国大陆、HK、UK、USA、加拿大、NZ等
- 60国套餐（Medium+）：增加台湾、新加坡、马来西亚、日本、韩国、泰国、印尼等

## 重要提示
- 打中国手机和座机都免费，不限分钟数
- WeChat语音/视频通话只消耗流量，不消耗国际通话额度
- Data Banking：未用流量可存入数据银行（最多200GB）
- 支持eSIM
- 国际漫游很贵（$15/2天），出国建议买当地SIM

## 购买方式
- lebara.com.au 官网
- Woolworths、BIG W、加油站
- eSIM在线激活
`;

// Write files
const docs = {
  'mobile-plan-guide.md': mobilePlanDoc,
  'nbn-broadband-guide.md': nbnDoc,
  'tourist-sim-guide.md': touristDoc,
  'lebara-china-calls.md': lebaraDoc,
};

for (const [name, content] of Object.entries(docs)) {
  fs.writeFileSync(path.join(RAG_DIR, name), content.trim());
  console.log(`📝 ${name} (${content.length} chars)`);
}

console.log(`\n✅ Generated ${Object.keys(docs).length} telco RAG docs in ${RAG_DIR}`);
