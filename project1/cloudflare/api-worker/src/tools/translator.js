/**
 * Translator Tool — 中英双语翻译助手
 * 
 * 专为澳洲华人设计的翻译工具：
 * - 中→英：帮助去政府机构/看病/银行时用英文沟通
 * - 英→中：帮助理解收到的英文信件/邮件/通知
 * - 场景翻译：预设常用场景（看GP/银行/房东/警察等）
 */

// 常用场景预设
const SCENARIOS = {
  gp: {
    name: '看GP/医生',
    phrases: [
      { zh: '我想预约看医生', en: "I'd like to make an appointment to see a doctor" },
      { zh: '你们接受 walk-in 吗？', en: 'Do you accept walk-in appointments?' },
      { zh: '你们 bulk bill 吗？', en: 'Do you bulk bill?' },
      { zh: '我需要看中文医生', en: "I'd like to see a Mandarin-speaking doctor" },
      { zh: '我肚子/头/喉咙痛', en: 'I have a stomachache / headache / sore throat' },
      { zh: '我需要验血', en: 'I need a blood test' },
      { zh: '可以帮我开处方药吗？', en: 'Can you prescribe me some medication?' },
      { zh: '我需要一封 referral letter', en: 'I need a referral letter to see a specialist' },
      { zh: '我需要 Medical Certificate（病假条）', en: 'I need a medical certificate for work/school' },
      { zh: '这个药有什么副作用？', en: 'What are the side effects of this medication?' },
    ],
  },
  pharmacy: {
    name: '药房',
    phrases: [
      { zh: '我需要买 Panadol（止痛药）', en: "I'd like to buy some Panadol, please" },
      { zh: '这个药需要处方吗？', en: 'Do I need a prescription for this?' },
      { zh: '有中文说明书吗？', en: 'Is there a Chinese instruction leaflet available?' },
      { zh: '我对青霉素过敏', en: "I'm allergic to penicillin" },
    ],
  },
  bank: {
    name: '银行',
    phrases: [
      { zh: '我想开一个银行账户', en: "I'd like to open a bank account" },
      { zh: '我需要一张借记卡', en: 'I need a debit card' },
      { zh: '怎么设置网上银行？', en: 'How do I set up internet banking?' },
      { zh: '我想汇款到中国', en: 'I want to make an international transfer to China' },
      { zh: '可以帮我打印一份对账单吗？', en: 'Can I get a printed bank statement?' },
      { zh: '我需要 BSB 和 Account Number', en: 'I need my BSB and account number' },
    ],
  },
  rental: {
    name: '租房/房东',
    phrases: [
      { zh: '我想看房', en: "I'd like to inspect the property" },
      { zh: '每周租金多少？', en: 'How much is the weekly rent?' },
      { zh: '包水电煤气吗？', en: 'Are utilities (water, electricity, gas) included?' },
      { zh: '押金（Bond）多少？', en: 'How much is the bond/security deposit?' },
      { zh: '热水器/空调坏了', en: 'The hot water system / air conditioning is broken' },
      { zh: '有虫害问题', en: 'There is a pest problem (cockroaches/ants)' },
      { zh: '我要退租', en: "I'd like to give notice to vacate" },
      { zh: '请退还我的押金', en: 'I would like my bond refunded' },
    ],
  },
  police: {
    name: '警察/报警',
    phrases: [
      { zh: '我需要报警', en: 'I need to report an incident to the police' },
      { zh: '我的钱包/手机被偷了', en: 'My wallet / phone has been stolen' },
      { zh: '我被诈骗了', en: "I've been scammed" },
      { zh: '我需要翻译服务', en: 'I need a translator / interpreter (call TIS 131 450)' },
      { zh: '这是我的护照/签证', en: 'This is my passport / visa' },
    ],
  },
  government: {
    name: '政府机构 (Centrelink/Medicare/Service NSW)',
    phrases: [
      { zh: '我需要翻译（免费）', en: 'I need an interpreter — please call TIS National: 131 450 (free)' },
      { zh: '我来申请 Medicare 卡', en: "I'm here to apply for a Medicare card" },
      { zh: '我需要更新我的地址', en: 'I need to update my address' },
      { zh: '我想申请 JobSeeker/Youth Allowance', en: "I'd like to apply for JobSeeker / Youth Allowance" },
      { zh: '我需要一份 Income Statement', en: 'I need an income statement for tax purposes' },
    ],
  },
  emergency: {
    name: '紧急情况',
    phrases: [
      { zh: '请帮帮我！', en: 'Please help me!' },
      { zh: '请叫救护车', en: 'Please call an ambulance' },
      { zh: '我需要看急诊', en: 'I need to go to the Emergency Department (ED)' },
      { zh: '我不会说英文，请打 131 450 翻译热线', en: "I don't speak English well. Please call the Translating and Interpreting Service: 131 450" },
    ],
  },
  shopping: {
    name: '超市/购物',
    phrases: [
      { zh: '请问这个多少钱？', en: 'How much is this, please?' },
      { zh: '可以退货吗？', en: 'Can I return this?' },
      { zh: '收据在这里', en: 'Here is the receipt' },
      { zh: '可以用支付宝/微信支付吗？', en: 'Do you accept Alipay / WeChat Pay?' },
    ],
  },
};

export async function translate(args, env) {
  const text = args.text || args.query || '';
  const mode = args.mode || 'auto';
  const scenario = args.scenario || '';

  // Mode: scenario — 返回预设场景短语
  if (mode === 'scenario' || scenario) {
    const key = scenario.toLowerCase().replace(/\s+/g, '_');
    const matched = SCENARIOS[key];
    if (matched) {
      return {
        scenario: matched.name,
        phrases: matched.phrases,
        tip: '💡 澳洲政府机构提供免费翻译服务，打 131 450 (TIS National) 即可获得中文翻译。',
      };
    }
    // List all scenarios
    return {
      available_scenarios: Object.entries(SCENARIOS).map(([k, v]) => ({
        key: k,
        name: v.name,
        phrase_count: v.phrases.length,
      })),
      tip: '选择一个场景获取实用短语。或直接输入要翻译的文字。',
    };
  }

  if (!text) {
    return {
      available_scenarios: Object.entries(SCENARIOS).map(([k, v]) => ({
        key: k,
        name: v.name,
        phrase_count: v.phrases.length,
      })),
      usage: '发送要翻译的文字，或选择场景获取常用短语',
      tip: '💡 翻译热线 TIS National: 131 450（免费，支持中文）',
    };
  }

  // Auto-detect language and translate direction
  const isChinese = /[\u4e00-\u9fff]/.test(text);
  const direction = mode === 'zh2en' ? 'zh2en' : mode === 'en2zh' ? 'en2zh' : (isChinese ? 'zh2en' : 'en2zh');

  // Use LLM to translate with Australian context
  const { LLMService } = await import('../llm.js');
  const llm = new LLMService(env);

  const systemPrompt = direction === 'zh2en'
    ? `You are a Chinese-to-English translator specializing in Australian English.
Translate the user's Chinese text to natural Australian English.
- Use Australian terminology (e.g., 'chemist' not 'pharmacy', 'uni' not 'college', 'rego' not 'registration')
- If the text is about a specific scenario (medical, legal, gov), use appropriate formal register
- Provide both a formal and casual version if appropriate
- Add pronunciation hints for difficult words in brackets
Output format: JSON {"formal":"...", "casual":"...", "notes":"any cultural tips"}`
    : `You are an English-to-Chinese translator for Chinese people in Australia.
Translate the English text to Simplified Chinese.
- Explain Australian slang/abbreviations if present (e.g., 'arvo' = afternoon, 'brekky' = breakfast)
- If it's an official document/letter, explain what action is needed
- Flag any important deadlines or actions required
Output format: JSON {"translation":"...", "explanation":"context explanation if needed", "action_needed":"any action required"}`;

  try {
    const result = await llm.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ], { temperature: 0.3 });

    let parsed;
    try {
      const jsonStr = result.match(/\{[\s\S]*\}/)?.[0];
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = direction === 'zh2en'
        ? { formal: result, casual: null, notes: null }
        : { translation: result, explanation: null, action_needed: null };
    }

    return {
      direction: direction === 'zh2en' ? '中文 → English' : 'English → 中文',
      original: text,
      ...parsed,
      tip: '💡 澳洲免费翻译热线 TIS National: 131 450（政府/医院/银行都可以要求免费翻译）',
    };
  } catch (err) {
    return {
      error: `翻译失败: ${err.message}`,
      tip: '临时方案：拨打 131 450 获取免费电话翻译服务',
    };
  }
}
