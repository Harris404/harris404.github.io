/**
 * Tourist Refund Scheme (TRS) — 旅客退税助手
 * 帮助离澳游客/留学生了解退税规则和操作
 * 数据来源：Australian Border Force 官方规则 (abf.gov.au) — 2026-01-08 更新
 * 无公开 API，规则为静态政策数据
 */

export async function trsAssistant(args, _env) {
  const amount = Number(args.amount) || 0;
  const mode = args.mode || 'guide';

  // Mode 1: Calculate refund
  if (mode === 'calculate' && amount > 0) {
    const gstRefund = Math.round((amount / 11) * 100) / 100; // GST = price / 11
    const isWine = args.category === 'wine';
    const wetRefund = isWine ? Math.round((amount * 0.29 / 1.29) * 100) / 100 : 0;
    const eligible = amount >= 300;

    return {
      purchase_amount: amount,
      gst_refund: eligible ? gstRefund : 0,
      wet_refund: eligible ? wetRefund : 0,
      total_refund: eligible ? +(gstRefund + wetRefund).toFixed(2) : 0,
      eligible,
      eligibility_note: eligible
        ? `✅ 符合退税条件（超过$300最低消费）。GST退税 $${gstRefund}`
        : `❌ 不符合。需要在同一家店（同一ABN）消费满$300（含GST）。当前$${amount}，还差$${300 - amount}。`,
      formula: `GST退税 = 购物金额 ÷ 11 = $${amount} ÷ 11 = $${gstRefund}`,
      refund_method: '信用卡退款（5-60天到账）或澳洲银行账户。不支持现金退款。',
    };
  }

  // Mode 2: Full TRS guide
  return {
    what_is_trs: {
      name: 'Tourist Refund Scheme (TRS) — 旅客退税计划',
      description: '离开澳洲时，可以在机场/港口退回购物时支付的10% GST（商品和服务税）和 WET（葡萄酒平衡税）。',
      who_can_claim: '所有离澳旅客（包括澳洲公民和PR），只要商品带出境。',
    },
    eligibility: {
      minimum_spend: '$300（含GST），必须在同一零售商处（同一ABN）',
      time_limit: '商品必须在出发前60天内购买（可多次购买累计）',
      invoice_required: [
        '必须是原始Tax Invoice（纸质），不接受照片/复印件/重打',
        '电子发票需提前打印纸质版',
        '发票$1000以上必须有买家姓名（与护照一致）',
        '发票需显示：ABN、商家名称地址、日期、商品描述数量价格、GST金额',
      ],
      must_carry: '商品必须随身携带或穿戴。不能放在托运行李中 ⚠️',
      oversized_exception: '超大/受限物品（液体>100ml、酒类等）→ 先去值机大厅的ABF柜台验证盖章，再托运',
    },
    how_to_claim: [
      '1️⃣ 购物时保留所有原始Tax Invoice',
      '2️⃣ 推荐：提前在TRS App录入发票信息（生成二维码加速）',
      '3️⃣ 超大/液体商品 → 值机前先到ABF Client Services柜台验证',
      '4️⃣ 航班出发前至少30分钟，到安检后的TRS柜台',
      '5️⃣ 出示：护照 + 登机牌 + 原始Tax Invoice + 商品实物',
      '6️⃣ 退款到信用卡（5-60天）或澳洲银行账户',
    ],
    trs_app: {
      name: 'TRS - Tourist Refund Scheme',
      description: '提前录入发票→到柜台扫二维码→加速处理。强烈推荐！',
      ios: 'App Store 搜索 "TRS - Tourist Refund Scheme"',
      android: 'Google Play 搜索 "TRS - Tourist Refund Scheme"',
    },
    trs_locations: {
      airports: {
        sydney: 'SYD T1 International — 过安检后',
        melbourne: 'MEL T2 International — Level 1 出发大厅，过安检后',
        brisbane: 'BNE International Terminal — 过安检后',
        perth: 'PER T1 International — 过安检后',
        adelaide: 'ADL International — 过安检后',
        cairns: 'CNS International — 过安检后',
        gold_coast: 'OOL International — 过安检后',
        darwin: 'DRW International — 过安检后',
        canberra: 'CBR International — 过安检后',
        hobart: 'HBA International — 过安检后',
      },
      seaports: '所有主要港口均设TRS柜台（在出境检查后），在最后一个离澳港口办理',
      hours: '所有国际航班/邮轮离港前开放',
    },
    cannot_claim: [
      '❌ 酒精饮料（葡萄酒除外，且酒精度<22%）',
      '❌ 烟草和烟草制品',
      '❌ 已消耗的商品（食品、饮料、香水、保健品等已用/吃/喝过的）',
      '❌ 服务类（住宿、出租车、旅游、课程、运费、信用卡附加费）',
      '❌ 合约购买的商品（如手机合约机，未付清全款）',
      '❌ GST-free商品（处方药、婴儿食品、医疗器械等）',
      '❌ 礼品卡和代金券本身（但用礼品卡买的商品可以退）',
      '❌ 在免税店(DFS)买的商品（本身不含GST）',
      '❌ 永久性美容项目（植发、牙科种植、隆胸等）',
      '❌ 海外购买后进口到澳洲的商品',
    ],
    common_mistakes: [
      '❌ 多张小额发票凑$300 → 必须同一ABN商家消费满$300',
      '❌ 商品放托运行李 → 必须手提或穿戴（超大件需提前验证）',
      '❌ 发票上没有ABN → 不是有效Tax Invoice',
      '❌ 带了照片/复印件 → 必须原始发票',
      '❌ 发票≥$1000没写名字 → 会被拒',
      '❌ 出发前不到30分钟才去 → 来不及处理',
    ],
    tips: [
      '💡 Apple Store 买 iPhone/MacBook/iPad → 可退10% GST ✅',
      '💡 退税金额 = 价格 ÷ 11（不是 ×10%）',
      '💡 多件商品可以凑齐$300在同一家店一次结账',
      '💡 衣服穿在身上过安检 → 算"随身携带"',
      '💡 化妆品/酒类超100ml → 先到值机大厅ABF柜台盖章，再托运',
      '💡 保留发票复印件（原件可能被ABF收走）',
      '💡 回澳时带回退税商品需在入境卡Q3申报，超免税额需补缴GST',
    ],
    contact: {
      phone_australia: '1300 555 043',
      phone_international: '+61 2 6245 5499',
      hours: '周一至周五 09:00-16:00 AEST/AEDT',
      online: 'abf.gov.au/entering-and-leaving-australia/tourist-refund-scheme/enquiry-form',
    },
    calculator_hint: '使用 mode: "calculate", amount: 购物金额 来计算退税',
    source: 'Australian Border Force — abf.gov.au (Last updated: 2026-01-08)',
  };
}
