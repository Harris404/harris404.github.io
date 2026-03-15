/**
 * Emergency Info Tool — 澳洲紧急联系信息 (纯内置数据，无需 API)
 *
 * 涵盖紧急服务、心理健康热线、领事馆、翻译服务等
 * 专为身在澳洲的华人留学生/新移民设计
 */

const EMERGENCY_DATA = {
    emergency_services: {
        '000': {
            name: 'Emergency (Police / Fire / Ambulance)',
            name_zh: '紧急服务（警察/消防/救护车）',
            number: '000',
            when_to_call: 'Life-threatening emergency, crime in progress, fire, medical emergency',
            when_to_call_zh: '生命受威胁、正在发生的犯罪、火灾、急救',
            free: true,
            note: 'Available 24/7. If unsure whether it is an emergency, call anyway.'
        },
        '131444': {
            name: 'Police Assistance Line (Non-Emergency)',
            name_zh: '非紧急警察热线',
            number: '131 444',
            when_to_call: 'Report non-urgent crimes, theft, property damage, noise complaints',
            when_to_call_zh: '报告非紧急犯罪、被盗、财产损失、噪音投诉',
            free: true
        },
        '112': {
            name: 'Emergency (Mobile phones — GSM standard)',
            name_zh: '手机紧急电话（GSM 标准）',
            number: '112',
            when_to_call: 'Same as 000 but works from any mobile phone, even without SIM',
            when_to_call_zh: '和000一样，但即使没有SIM卡的手机也可以拨打',
            free: true
        },
        '106': {
            name: 'Text Emergency (TTY)',
            name_zh: '文字紧急服务（听障人士）',
            number: '106',
            when_to_call: 'Deaf, hearing impaired, or speech impaired emergency calls',
            when_to_call_zh: '听力障碍或语言障碍人士的紧急呼叫',
            free: true
        }
    },

    health_helplines: {
        healthdirect: {
            name: 'Healthdirect Australia',
            name_zh: '澳洲健康直通车',
            number: '1800 022 222',
            hours: '24/7',
            description: 'Free health advice from registered nurses. Available in 150+ languages via interpreter.',
            description_zh: '注册护士提供的免费健康建议。通过口译服务支持150+种语言。',
            free: true,
            url: 'https://www.healthdirect.gov.au'
        },
        poisons: {
            name: 'Poisons Information Centre',
            name_zh: '中毒信息中心',
            number: '13 11 26',
            hours: '24/7',
            description: 'Advice on poisoning, overdose, bites and stings',
            free: true
        }
    },

    mental_health: {
        lifeline: {
            name: 'Lifeline',
            name_zh: '生命热线',
            number: '13 11 14',
            text: '0477 13 11 14 (text)',
            hours: '24/7',
            description: 'Crisis support and suicide prevention',
            description_zh: '心理危机支持和自杀预防',
            free: true,
            url: 'https://www.lifeline.org.au'
        },
        beyondblue: {
            name: 'Beyond Blue',
            name_zh: '超越蓝色（心理健康）',
            number: '1300 22 4636',
            hours: '24/7',
            description: 'Anxiety, depression and suicide prevention support',
            description_zh: '焦虑、抑郁和自杀预防支持',
            free: true,
            url: 'https://www.beyondblue.org.au'
        },
        kids_helpline: {
            name: 'Kids Helpline',
            number: '1800 55 1800',
            hours: '24/7',
            description: 'Free counselling for young people 5-25 years',
            free: true
        },
        '1800respect': {
            name: '1800RESPECT (Family & sexual violence)',
            name_zh: '家暴/性暴力求助热线',
            number: '1800 737 732',
            hours: '24/7',
            description: 'Support for people experiencing domestic, family or sexual violence',
            description_zh: '家庭暴力或性暴力受害者支持',
            free: true
        }
    },

    translation_services: {
        tis: {
            name: 'Translating and Interpreting Service (TIS National)',
            name_zh: '国家翻译和口译服务',
            number: '131 450',
            hours: '24/7',
            description: 'Free phone interpreter for over 160 languages. Most government services will use TIS for you.',
            description_zh: '免费电话口译服务，支持160+种语言。大部分政府服务会自动使用TIS。',
            free: true,
            tip: 'When calling any Australian service, ask for "Mandarin interpreter" or "Cantonese interpreter"'
        }
    },

    chinese_consulates: {
        sydney: {
            name: 'Chinese Consulate-General in Sydney',
            name_zh: '中华人民共和国驻悉尼总领事馆',
            address: '39 Dunblane Street, Camperdown NSW 2050',
            phone: '(02) 8595 8002',
            emergency_24h: '(02) 8595 8001',
            website: 'http://sydney.china-consulate.gov.cn',
            jurisdiction: 'NSW, QLD'
        },
        melbourne: {
            name: 'Chinese Consulate-General in Melbourne',
            name_zh: '中华人民共和国驻墨尔本总领事馆',
            address: '534 Toorak Road, Toorak VIC 3142',
            phone: '(03) 9822 0604',
            emergency_24h: '0413 168 414',
            website: 'http://melbourne.china-consulate.gov.cn',
            jurisdiction: 'VIC, SA, TAS'
        },
        brisbane: {
            name: 'Chinese Consulate-General in Brisbane',
            name_zh: '中华人民共和国驻布里斯班总领事馆',
            address: '79 Adelaide Street, Brisbane QLD 4000',
            phone: '(07) 3012 8090',
            website: 'http://brisbane.china-consulate.gov.cn',
            jurisdiction: 'QLD (shared with Sydney)'
        },
        perth: {
            name: 'Chinese Consulate-General in Perth',
            name_zh: '中华人民共和国驻珀斯总领事馆',
            address: '45 Brown Street, East Perth WA 6004',
            phone: '(08) 9222 0300',
            website: 'http://perth.china-consulate.gov.cn',
            jurisdiction: 'WA, NT'
        },
        canberra: {
            name: 'Embassy of China in Australia',
            name_zh: '中华人民共和国驻澳大利亚大使馆',
            address: '15 Coronation Drive, Yarralumla ACT 2600',
            phone: '(02) 6228 3999',
            emergency_24h: '(02) 6228 3948',
            website: 'http://au.china-embassy.gov.cn',
            jurisdiction: 'ACT'
        },
        global_hotline: {
            name: '12308 Global Consular Protection Hotline',
            name_zh: '12308 全球领事保护热线',
            number: '+86-10-12308 or +86-10-65612308',
            description: '24/7 Chinese consular assistance for Chinese citizens overseas',
            description_zh: '24小时全球领事保护与服务热线',
            wechat: '12308 微信小程序可在线求助'
        }
    },

    other_useful: {
        state_emergency: {
            name: 'State Emergency Service (SES)',
            number: '132 500',
            when_to_call: 'Flood, storm damage, fallen trees — non-life-threatening',
            when_to_call_zh: '洪水、风暴损害、树倒 — 非生命威胁'
        },
        bushfire: {
            name: 'Bushfire Information Line',
            number: '1800 NSW RFS (1800 679 737) — varies by state',
            when_to_call: 'Bushfire alerts and information'
        },
        crime_stoppers: {
            name: 'Crime Stoppers',
            number: '1800 333 000',
            description: 'Anonymous crime reporting',
            description_zh: '匿名举报犯罪线索'
        },
        fair_trading: {
            name: 'Fair Trading (Consumer complaints)',
            number: '13 32 20 (NSW) — varies by state',
            description: 'Scams, consumer rights, rental disputes',
            description_zh: '诈骗、消费者权益、租房纠纷'
        }
    }
};

/**
 * Get emergency/help information
 * @param {Object} args - { category: "emergency"|"health"|"mental"|"consulate"|"translation"|"all", state: "NSW" }
 */
export function getEmergencyInfo(args = {}) {
    const category = (args.category || 'all').toLowerCase();
    const state = (args.state || '').toUpperCase();

    let result = {
        query: args.query || category,
        source: 'built-in emergency data (verified 2026-Q1)'
    };

    if (category === 'all' || category === 'emergency') {
        result.emergency_services = EMERGENCY_DATA.emergency_services;
        result.critical_reminder = '⚠️ 生命危险请拨 000！If in danger, call 000 immediately!';
    }

    if (category === 'all' || category === 'health') {
        result.health_helplines = EMERGENCY_DATA.health_helplines;
    }

    if (category === 'all' || category === 'mental' || category === 'mental_health') {
        result.mental_health = EMERGENCY_DATA.mental_health;
    }

    if (category === 'all' || category === 'consulate' || category === 'embassy') {
        if (state) {
            // Find the right consulate by jurisdiction
            const match = Object.values(EMERGENCY_DATA.chinese_consulates).find(c =>
                c.jurisdiction && c.jurisdiction.includes(state)
            );
            result.chinese_consulate = match || EMERGENCY_DATA.chinese_consulates.canberra;
        } else {
            result.chinese_consulates = EMERGENCY_DATA.chinese_consulates;
        }
        result.global_hotline = EMERGENCY_DATA.chinese_consulates.global_hotline;
    }

    if (category === 'all' || category === 'translation' || category === 'interpreter') {
        result.translation_services = EMERGENCY_DATA.translation_services;
    }

    if (category === 'other' || category === 'all') {
        result.other_useful = EMERGENCY_DATA.other_useful;
    }

    return result;
}
