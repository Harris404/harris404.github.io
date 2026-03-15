-- Minimal test seed for local dev validation
-- Covers all 5 domains used in cross-domain test suite

INSERT OR IGNORE INTO rag_documents (id, title, section, content, category, source_url) VALUES
-- Life domain
('life-001', '澳洲超市特价', '购物指南', 'Woolworths和Coles每周都有特价商品。使用会员卡可以获得额外折扣。常见特价品包括肉类、蔬菜和零食。', 'living', 'https://example.com'),
('life-002', '悉尼公共交通', '交通指南', '悉尼有火车、公交和渡轮。使用Opal卡可以享受折扣。从市中心到各主要区域约20-40分钟。', 'living', 'https://example.com'),
('life-003', '附近设施查询', '生活服务', '澳洲各城市均有完善的社区设施，包括超市、药房、诊所、图书馆等。可通过Google Maps查找附近设施。', 'living', 'https://example.com'),

-- Finance domain
('fin-001', '澳洲租房指南', '财务规划', '澳洲租房通常需要支付4周押金。租金根据地区不同差异较大，悉尼CBD约$400-600/周，郊区约$250-400/周。', 'finance', 'https://example.com'),
('fin-002', '澳洲税务申报', '税务指南', '澳洲财政年从7月1日到次年6月30日。需在10月31日前提交税务申报。工薪阶层适用累进税率，收入越高税率越高。', 'finance', 'https://example.com'),
('fin-003', '汇率与换汇', '财务工具', '澳元汇率受多种因素影响。可在银行、汇款公司或在线平台兑换外币。通常在线平台汇率更优惠。', 'finance', 'https://example.com'),

-- Education domain
('edu-001', '悉尼大学课程', '高等教育', '悉尼大学（USYD）提供本科和研究生课程。计算机科学、商科和医学是热门专业。国际学生学费约$35,000-50,000/年。', 'education', 'https://example.com'),
('edu-002', 'UNSW课程介绍', '高等教育', 'UNSW悉尼是澳洲顶尖大学之一，工程和商科闻名。国际学生比例约35%。校园位于肯辛顿，距市中心约7公里。', 'education', 'https://example.com'),
('edu-003', '澳洲学生签证', '留学指南', '澳洲学生签证（子类500）要求提供录取通知书、经济证明和英语成绩。申请费约$710 AUD。', 'education', 'https://example.com'),

-- Healthcare domain
('health-001', 'Medicare医疗保险', '医疗指南', 'Medicare是澳洲全民医疗保险。永久居民和公民可免费享受基本医疗服务。持有互惠医疗协议国家护照者也可申请。', 'healthcare', 'https://example.com'),
('health-002', 'GP全科医生', '医疗服务', 'GP（全科医生）是澳洲医疗体系的第一入口。通过Medicare可以bulk bill（免费看诊）。建议提前预约，候诊时间约1-2周。', 'healthcare', 'https://example.com'),
('health-003', '药品PBS补贴', '医疗费用', 'PBS（药品补贴计划）让澳洲居民以优惠价格获得处方药。大多数常用药每次仅需约$31.60 AUD（持卡者更低）。', 'healthcare', 'https://example.com'),

-- Wellness domain
('well-001', '蓝山国家公园', '旅游景点', '蓝山国家公园距悉尼约80公里，是世界遗产地。著名景点包括三姐妹岩。可从Central Station乘火车约2小时到达Katoomba站。', 'wellness', 'https://example.com'),
('well-002', '墨尔本旅游指南', '旅游景点', '墨尔本是澳洲文化之都，有众多咖啡馆、艺术馆和体育场馆。推荐景点：菲利普岛企鹅、大洋路、亚拉河谷酒庄。', 'wellness', 'https://example.com'),
('well-003', '澳洲户外活动', '休闲运动', '澳洲有丰富的户外活动，包括爬山、徒步、冲浪、潜水等。蓝山是徒步爱好者的天堂，有100多条步道。', 'wellness', 'https://example.com');
