/**
 * Image Understanding Tool — 图片/文件识别
 * 
 * 支持识别：
 * - 信件/通知（政府/银行/保险公司来信）
 * - 账单（电费/燃气/水费/电话费）
 * - 合同/租约（红旗条款识别）
 * - 路标/标识（澳洲特色标志）
 * - 产品标签（药品/食品）
 * 
 * 使用 DashScope Qwen-VL (Vision-Language) 模型
 */

export async function understandImage(args, env) {
  const imageUrl = args.image_url || args.url || '';
  const imageBase64 = args.image_base64 || args.base64 || '';
  const question = args.question || args.query || '请识别并解释这张图片的内容';
  const mode = args.mode || 'auto';

  if (!imageUrl && !imageBase64) {
    return {
      usage: '请提供图片 URL 或 Base64 编码的图片',
      supported_types: [
        '📬 政府/银行来信 → 翻译+解释+提醒需要做什么',
        '💰 账单 → 识别金额/到期日/如何支付',
        '📝 租约/合同 → 发现红旗条款+权益提醒',
        '🚧 路标/标识 → 解释含义+澳洲交规提醒',
        '💊 药品标签 → 翻译用法+注意事项',
        '🧾 收据 → 识别内容/金额/退税项目',
      ],
      tip: '在手机上拍照后发送图片链接，或让前端将图片转为 base64',
    };
  }

  // 构建 system prompt 基于识别模式
  const systemPrompts = {
    auto: `你是一位在澳洲生活的华人 AI 助手。请识别图片内容并用中文详细解释。
如果是：
- 信件/文件：翻译关键内容，说明需要采取什么行动，标注截止日期
- 账单：识别金额、到期日、付款方式
- 合同：标出可能不利的条款（红旗🚩）
- 路标：解释含义和相关澳洲交规
- 药品：翻译药品名称、用法用量、注意事项
- 食品：翻译配料、过敏原警告
请用简洁的中文回答。`,
    letter: `你是澳洲华人的信件翻译助手。请翻译这封信件的关键内容：
1. 谁发的？（政府/银行/保险/房东等）
2. 主要内容是什么？
3. 需要我做什么？
4. 有没有截止日期？
5. 如果需要回复/付款，怎么操作？
用 ⚠️ 标注紧急事项。`,
    bill: `你是账单识别助手。请从这张账单中提取：
1. 💰 应付金额
2. 📅 到期日
3. 🏢 账单来源（电力/燃气/水/电信等）
4. 💳 付款方式
5. ⚡ 用量数据
6. 💡 是否有省钱建议`,
    contract: `你是澳洲租约/合同审查助手。请检查这份文件：
1. 识别合同类型
2. 🚩 标出可能不利于租客/消费者的条款
3. ✅ 确认关键条款是否合规（参照对应州的法律）
4. 💡 提供建议
注意澳洲各州租赁法律差异。`,
    sign: `你是澳洲路标/标识翻译助手。请解释这个标志：
1. 标志含义
2. 相关交规/法律
3. 违反会有什么处罚
4. 中国交规中有没有类似的`,
  };

  const systemPrompt = systemPrompts[mode] || systemPrompts.auto;

  // 构建 Vision API 请求
  const apiKey = env?.DASHSCOPE_API_KEY;
  const baseUrl = env?.DASHSCOPE_BASE_URL || 'https://dashscope-us.aliyuncs.com/compatible-mode/v1';

  if (!apiKey) {
    return { error: 'Image understanding requires DASHSCOPE_API_KEY' };
  }

  try {
    // 构建 message content with image
    const userContent = [];
    
    if (imageUrl) {
      userContent.push({ type: 'image_url', image_url: { url: imageUrl } });
    } else if (imageBase64) {
      userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });
    }
    
    userContent.push({ type: 'text', text: question });

    const requestBody = {
      model: 'qwen2.5-vl-72b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    };

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { error: `Vision API returned ${res.status}: ${errText.substring(0, 200)}` };
    }

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || '';

    return {
      mode,
      question,
      analysis: answer,
      tips: [
        '💡 不确定信件内容？可拨打 131 450 (TIS) 获取免费翻译',
        '💡 账单问题？可联系 Ombudsman（各州投诉机构）',
        '💡 合同问题？可寻求免费法律援助 Legal Aid',
      ],
      source: 'Qwen VL (Vision Language Model)',
    };
  } catch (err) {
    return { error: `图片识别失败: ${err.message}` };
  }
}
