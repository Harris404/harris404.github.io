#!/usr/bin/env node
/**
 * Generate RAG documents for 4 missing living categories:
 * - living/driving (驾照/路考指南)
 * - living/citizenship (入籍考试指南)
 * - living/pets (宠物入境/疫苗)
 * - living/insurance (车险/房险指南)
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'rag-data');

// ── 1. living/driving ──────────────────────────────────────
const drivingDir = path.join(BASE, 'driving');
fs.mkdirSync(drivingDir, { recursive: true });

fs.writeFileSync(path.join(drivingDir, 'australian-licence-guide.md'), `# 澳洲驾照全攻略 / Australian Driver's Licence Guide

**Source**: https://www.service.nsw.gov.au/transaction/get-nsw-driver-licence
**Topic**: Living - Driving
**Last Updated**: 2026-03-11

## 海外驾照在澳洲使用规则

### 临时访客 (Temporary Visitor)
- 持有效海外驾照 + 英文翻译件 (NAATI 认证) 可在澳洲驾车
- 如驾照非英文，必须携带 NAATI 翻译件或国际驾照 (IDP)
- 各州允许使用时限不同：NSW 最长5年、VIC 6个月、QLD 3个月

### 永久居民 / 学生签证
- NSW: 到达后3个月内需转换为 NSW 驾照
- VIC: 到达后6个月内需转换
- QLD: 到达后3个月内需转换
- 转换条件因国家而异，中国驾照通常需要路考

## 各州驾照转换流程

### NSW (新南威尔士)
1. 预约 Service NSW 中心
2. 带材料：护照 + 签证 + 海外驾照 + NAATI翻译 + 地址证明 (银行对账单/水电费)
3. 通过视力测试 (Eyesight Test)
4. 中国驾照持有者：需通过 DKT (Driver Knowledge Test) + 路考 (Driving Test)
5. 费用：约 $195 (5年驾照)

### VIC (维多利亚)
1. 预约 VicRoads
2. 材料同上
3. 中国驾照：需通过 Hazard Perception Test + 路考
4. 费用：约 $90 (3年)

### QLD (昆士兰)
1. 去 Transport and Main Roads
2. 中国驾照：需通过 Written Test + 路考
3. 费用：约 $180 (5年)

## 从零考驾照 (Learner → Provisional → Full)

### NSW 流程
1. **Learner (L牌)**: 通过 DKT (45题选择题，中文可选) → 获得 L 牌
2. **Provisional 1 (P1/红P)**: 持 L 牌 120小时练车 → 通过路考 → P1 (1年)
3. **Provisional 2 (P2/绿P)**: P1 满1年 → 通过 HPT → P2 (2年)
4. **Full Licence**: P2 满2年 → Full (无限制)

### DKT 考试
- 45道选择题 (15题通用 + 30题车辆类别)
- 及格线：至少答对12/15通用题 + 24/30类别题
- **支持中文考试**（Mandarin）
- 考试费：$51
- 可网上预约：service.nsw.gov.au

### 路考 (Driving Test)
- 时长约30分钟
- 包括：倒车入库、平行停车、U-turn、变道、环岛、限速区
- 常见挂科原因：没看盲点 (head check)、环岛让右、路口未完全停车 (Stop sign)
- 费用：$60-70

## 华人考驾照常见问题

### 中国驾照翻译
- 必须使用 NAATI 三级认证翻译
- 不接受公证处翻译
- 费用：约 $50-80
- 推荐在 NAATI 官网 (naati.com.au) 查找翻译师

### 路考注意事项
- 澳洲靠左行驶！与中国相反
- 环岛 (Roundabout)：让右方来车
- Stop sign：必须完全停车 (车轮不动)，不是减速
- 校区限速：上下学时间 40km/h
- 盲点检查 (Head Check)：每次变道/转弯前必须看肩后

### 学车推荐
- 找华人教练：方便沟通，理解中国驾驶习惯差异
- 每小时约 $50-80
- 需至少 120 小时练车 (NSW L牌要求)
- 推荐App：Learner Log Book (NSW)
`.trim());

fs.writeFileSync(path.join(drivingDir, 'road-rules-tips.md'), `# 澳洲交通规则速查 / Australian Road Rules Quick Reference

**Source**: https://www.nsw.gov.au/driving-boating-and-transport/roads-safety-and-rules
**Topic**: Living - Driving
**Last Updated**: 2026-03-11

## 核心规则（与中国不同）

### 靠左行驶
- 澳洲和中国方向相反，靠左行驶
- 右转需要给对面直行车让路
- 方向盘在右侧

### 环岛 (Roundabout)
- 进入环岛前必须让右方来车
- 顺时针方向行驶
- 出环岛打左转灯
- 不要在环岛内停车

### 让路规则
- **Give Way (让路标志)**: 减速，如果有车需停车让路
- **Stop (停车标志)**: 必须完全停车至少2秒，即使没有车
- **行人优先**: 斑马线上行人永远优先
- **紧急车辆**: 听到警笛必须靠边停车让行

### 限速
- 住宅区: 50 km/h (无标志时默认)
- 学校区: 40 km/h (上下学时间 8:00-9:30, 14:30-16:00)
- 郊区主路: 60-80 km/h
- 高速公路: 100-110 km/h
- 超速罚款: $274起 + 扣分

### 酒驾
- Full licence: 0.05 BAC
- L/P牌: **0.00 BAC (零容忍)**
- 罚款：$2,200起 + 吊销驾照3个月起
- 可能坐牢

### 手机
- 开车时**禁止**手持手机
- L/P牌：禁止任何方式使用手机（包括免提/蓝牙）
- Full licence: 仅允许蓝牙/免提，但不能触摸手机
- 罚款：$362 + 扣5分

## 停车规则
- 路边停车看标志牌：P = 限时停车，时间+天数
- No Stopping = 不能停
- No Parking = 可以临时上下客但驾驶员不能离开
- 消防通道/残疾人车位/公交车道 = 高额罚款
- 路边停车方向必须与行驶方向一致

## 违规罚分制度
- L牌: 4分吊销
- P1: 4分吊销
- P2: 7分吊销
- Full: 13分吊销
- 常见扣分：超速(1-6分)、闯红灯(3分)、手机(5分)
`.trim());

console.log('✅ living/driving: 2 files');

// ── 2. living/citizenship ──────────────────────────────────
const citizenDir = path.join(BASE, 'citizenship');
fs.mkdirSync(citizenDir, { recursive: true });

fs.writeFileSync(path.join(citizenDir, 'citizenship-test-guide.md'), `# 澳洲入籍考试完全指南 / Australian Citizenship Test Guide

**Source**: https://immi.homeaffairs.gov.au/citizenship/test-and-interview/our-common-bond
**Topic**: Living - Citizenship
**Last Updated**: 2026-03-11

## 入籍条件

### 基本资格
1. 年满18岁
2. 持永居签证 (PR) 满12个月
3. 过去4年在澳洲居住满3年（含出境天数不超过12个月，且最后12个月出境不超过90天）
4. 品行良好（无犯罪记录）
5. 通过入籍考试（Citizenship Test）
6. 打算继续在澳洲居住或与澳洲保持密切联系

### 免考试人群
- 60岁以上
- 18岁以下
- 有严重听力/视力/语言障碍者

## 入籍考试详情

### 考试形式
- **20道选择题**（4选1）
- 时间限制：**45分钟**
- 通过分数：**75%（即至少答对15题）**
- 其中有5道关于澳洲价值观的必答题，**必须全部答对**
- 考试语言：**仅英文**
- 可以多次参加（考试日期之间需间隔2天）

### 考试内容来源
- 官方教材：**Our Common Bond** (可从 Home Affairs 网站免费下载)
- 内容4大部分：
  1. Australia and its people (澳洲和它的人民)
  2. Australia's democratic beliefs, rights and liberties (民主信念、权利和自由)
  3. Government and the law (政府和法律)
  4. Australian values (澳洲价值观) ← **5道必答题出自这里**

### 关键知识点

#### 澳洲价值观 (必答题范围)
- Parliamentary democracy (议会民主)
- Rule of law (法治)
- Freedom of speech and association (言论和结社自由)
- Freedom of religion (宗教自由)
- Equality of men and women (男女平等)
- Mutual respect and tolerance (相互尊重和包容)
- Compassion for those in need (对弱势群体的同情)
- Fair go for all (公平机会)

#### 政府结构
- 三级政府：联邦 (Federal)、州 (State)、地方 (Local/Council)
- 国王/女王代表：总督 (Governor-General)
- 总理 (Prime Minister)：联邦政府首脑
- 两院：参议院 (Senate) + 众议院 (House of Representatives)
- 投票是义务！(Compulsory voting) 不投票会被罚款

#### 国旗和国歌
- 国旗：Union Jack + 南十字星 + 联邦之星
- 国歌：Advance Australia Fair
- 原住民旗 (Aboriginal Flag)：黑红黄
- 澳洲日 (Australia Day): 1月26日
- 纪念日 (Anzac Day): 4月25日

## 考试预约
1. 在线申请入籍 → Home Affairs 会安排考试时间
2. 考试在指定政府办公室进行
3. 需要带：身份证明文件 + 预约确认邮件
4. 考试结果当场出
5. 通过后安排入籍仪式 (Citizenship Ceremony)

## 备考资源
- 官方教材：Our Common Bond (immi.homeaffairs.gov.au 免费下载)
- 官方模拟题：immi.homeaffairs.gov.au/citizenship/test-and-interview/practice-test
- 推荐 App：Australian Citizenship Test (App Store/Google Play)
`.trim());

console.log('✅ living/citizenship: 1 file');

// ── 3. living/pets ──────────────────────────────────────────
const petsDir = path.join(BASE, 'pets');
fs.mkdirSync(petsDir, { recursive: true });

fs.writeFileSync(path.join(petsDir, 'pets-australia-guide.md'), `# 澳洲宠物指南 / Pets in Australia Guide

**Source**: https://www.agriculture.gov.au/biosecurity-trade/import/goods/live-animals-and-reproductive-material/cats-dogs
**Topic**: Living - Pets
**Last Updated**: 2026-03-11

## 从中国带宠物到澳洲

### ⚠️ 核心事实
- **中国被列为 Group 3 国家** — 最严格的进口类别
- 宠物必须先在**认可的第三国**（如新加坡、日本、新西兰、加拿大）居住至少6个月
- **不能从中国直接进口猫狗到澳洲**
- 整个流程通常需要 **8-12个月**
- 费用：约 **$5,000-15,000 AUD**

### 流程概述
1. 在中国做完所有疫苗和检测
2. 将宠物送到认可的第三国（如新加坡）
3. 在第三国待满至少6个月 + 完成所有检测
4. 申请澳洲进口许可 (Import Permit)
5. 宠物到达澳洲后需要在检疫站隔离至少10天
6. 检疫费由主人承担 (~$2,000)

### 必需文件和疫苗
- Rabies vaccination (狂犬疫苗) x2 次，间隔至少30天
- Rabies Antibody Titre Test (RNAT) ≥ 0.5 IU/ml
- 微芯片 (Microchip) — 必须在所有疫苗接种前植入
- 内外寄生虫治疗
- 官方兽医健康证书
- 澳洲进口许可 (Import Permit from DAFF)

### 推荐宠物搬运公司
- Jetpets (jetpets.com.au) — 澳洲最大
- PetAir (petairuk.com) — 国际
- iPATA 认证公司优先

## 在澳洲养宠物

### 注册 (Registration)
- 所有猫狗都必须在当地 Council 注册
- 需要植入微芯片 (Microchip) — 强制
- 费用：$30-200/年（绝育宠物通常更便宜）
- 不注册可被罚款

### 日常费用
| 项目 | 费用 |
|------|------|
| 绝育手术 | $200-500 |
| 年度检查 | $80-150 |
| 疫苗 (年度) | $80-150 |
| 宠物保险 | $30-80/月 |
| 狗粮 (优质) | $80-150/月 |
| 寄养 (Boarding) | $30-80/天 |

### 租房养宠物
- 2024年起 VIC 默认允许租客养宠物（房东需"合理理由"才能拒绝）
- NSW/QLD: 房东仍可拒绝，但越来越多房东接受
- 租房时主动提供：宠物简历 + 疫苗记录 + 之前房东推荐信
- 可能需要额外 bond 或 pet deposit

### 遛狗规则
- 公共场所必须牵绳 (On-leash)
- 指定的 Off-leash 区域可以放开
- 清理狗粪便是法律义务 — 随身携带袋子
- 不清理可被罚款 $200+

### 宠物友好服务
- 兽医急诊：搜索 "emergency vet near me"
- Royal Society for the Prevention of Cruelty to Animals (RSPCA)
- Pet Circle (petcircle.com.au) — 在线宠物用品
- Mad Paws (madpaws.com.au) — 宠物寄养平台
`.trim());

console.log('✅ living/pets: 1 file');

// ── 4. living/insurance ──────────────────────────────────────
const insDir = path.join(BASE, 'insurance');
fs.mkdirSync(insDir, { recursive: true });

fs.writeFileSync(path.join(insDir, 'insurance-guide.md'), `# 澳洲保险指南 / Insurance in Australia Guide

**Source**: https://moneysmart.gov.au/how-insurance-works
**Topic**: Living - Insurance
**Last Updated**: 2026-03-11

## 必须有的保险

### 1. 车险 (Car Insurance)

#### 强制车险 (CTP / Compulsory Third Party)
- **注册车辆时自动包含** — 与 rego 绑定
- 覆盖：你撞伤了别人的人身伤害赔偿
- **不覆盖**：车辆损坏、财产损失
- 各州提供商不同：
  - NSW: Allianz, GIO, NRMA, QBE, AAMI, Youi
  - VIC: TAC (Transport Accident Commission) — 统一由 TAC 管理
  - QLD: Suncorp, RACQ, Allianz, QBE

#### 自愿车险 (Voluntary Car Insurance)
| 类型 | 覆盖 | 价格/年 |
|------|------|---------|
| Third Party Property | 你撞了别人的车/财产 | $300-500 |
| Third Party Fire & Theft | 上面 + 你的车被偷/着火 | $400-600 |
| Comprehensive (全险) | 所有意外损坏（含自己的车） | $600-2,000+ |

#### 推荐
- 新车/贷款车 → Comprehensive 全险
- 老车 (价值<$5,000) → Third Party Property 就够
- 比价网站：comparethemarket.com.au, iSelect.com.au, Budget Direct

### 2. 房屋/租房保险

#### 房东/业主保险 (Home & Contents)
- Home Insurance: 房屋结构（火灾、风暴、水灾）
- Contents Insurance: 家里的物品（电器、家具、衣物）
- 费用：$500-2,000/年 取决于地区和保额

#### 租客保险 (Renters Insurance / Contents Insurance)
- 只保你自己的物品（不保房屋结构，那是房东的事）
- 覆盖：盗窃、火灾、水灾损坏你的私人物品
- 费用：$15-30/月
- 推荐：NRMA, RAC, Budget Direct, Youi

### 3. 私人健康保险 (Private Health Insurance)

#### Medicare Levy Surcharge 避税
- 收入超过 $93,000 (单身) 且没有私保 → 额外缴纳 1-1.5% 附加税
- 买最基本的 hospital cover 可以避免这个附加税
- 比较网站：privatehealth.gov.au (政府官方比价)

#### Lifetime Health Cover (LHC)
- 31岁生日后每迟买1年 → 保费永久增加2%
- 最高加30%（41岁以后买 = 永久贵30%）
- 建议31岁前至少买基本 hospital cover

#### 留学生必须买 OSHC
- 学生签证 (500) 强制要求
- 不是 Medicare — 是专门的海外学生健康保险
- 5个授权提供商：Bupa, Medibank, nib, Allianz Care, OSHC Worldcare

## 不太必要但推荐的

### 收入保护保险 (Income Protection)
- 受伤/生病无法工作时替代收入（最高75-85%）
- 等待期 30/60/90 天可选
- 可以抵税 (Tax Deductible)

### 旅行保险 (Travel Insurance)
- 出境旅行强烈推荐
- 覆盖：医疗急救、航班取消、行李丢失
- 推荐：Cover-More, World Nomads, Allianz

## 理赔流程
1. 事故发生后尽快联系保险公司
2. 收集证据（照片、警察报告编号、目击者联系方式）
3. 在线或电话提交 Claim
4. 保险公司评估 → 批准 → 赔偿
5. 注意 Excess (免赔额)：通常 $500-1,000，你自己先付这部分
`.trim());

console.log('✅ living/insurance: 1 file');

console.log('\n📁 生成的文件:');
['driving', 'citizenship', 'pets', 'insurance'].forEach(dir => {
  const d = path.join(BASE, dir);
  const files = fs.readdirSync(d);
  files.forEach(f => {
    const stat = fs.statSync(path.join(d, f));
    console.log(`  rag-data/${dir}/${f} (${(stat.size/1024).toFixed(1)} KB)`);
  });
});
