/**
 * RAG Data Source Registry — Expanded
 * 
 * Defines all RAG categories, update schedules, and core source URLs.
 * Used by rag-updater.js for automatic incremental updates.
 *
 * Core URLs are selected as the MOST IMPORTANT pages that change frequently
 * and represent canonical sources. Deep crawl (crawl-rag-data.mjs) covers
 * the full 399 URLs; this file covers ~120 key pages for auto-update.
 */

export const RAG_SOURCES = {

  // ═══════════════════════════════════════════════════════════════
  //  WEEKLY UPDATE — High-frequency changes
  // ═══════════════════════════════════════════════════════════════

  scams: {
    category: 'government/scams',
    schedule: 'weekly',
    title: '诈骗预警',
    sources: [
      { url: 'https://www.scamwatch.gov.au/news-alerts', type: 'crawl', label: '最新预警' },
      { url: 'https://www.scamwatch.gov.au/types-of-scams', type: 'crawl', label: '诈骗类型总览' },
      { url: 'https://www.scamwatch.gov.au/types-of-scams/phishing-scams', type: 'crawl', label: '钓鱼诈骗' },
      { url: 'https://www.scamwatch.gov.au/types-of-scams/investment-scams', type: 'crawl', label: '投资诈骗' },
      { url: 'https://www.scamwatch.gov.au/types-of-scams/jobs-and-employment-scams', type: 'crawl', label: '求职诈骗' },
      { url: 'https://www.scamwatch.gov.au/protect-yourself/how-to-spot-a-scam', type: 'crawl', label: '识别诈骗' },
      { url: 'https://www.scamwatch.gov.au/get-help/if-youve-been-scammed', type: 'crawl', label: '受骗后怎么办' },
      { url: 'https://www.cyber.gov.au/protect-yourself', type: 'crawl', label: '网络安全' },
      { url: 'https://moneysmart.gov.au/check-and-report-scams', type: 'crawl', label: 'MoneySmart 反诈' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  MONTHLY UPDATE — Moderate-frequency changes
  // ═══════════════════════════════════════════════════════════════

  student: {
    category: 'living/student',
    schedule: 'monthly',
    title: '留学生指南',
    sources: [
      { url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500', type: 'crawl', label: '500 学生签' },
      { url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-graduate-485', type: 'crawl', label: '485 毕业签' },
      { url: 'https://www.studyaustralia.gov.au/en/plan-your-studies/how-to-apply', type: 'crawl', label: '申请流程' },
      { url: 'https://www.studyaustralia.gov.au/en/life-in-australia/cost-of-living', type: 'crawl', label: '生活费用' },
      { url: 'https://www.studyaustralia.gov.au/en/life-in-australia/work', type: 'crawl', label: '学生打工' },
    ],
  },

  telco: {
    category: 'living/telco',
    schedule: 'monthly',
    title: '手机卡与宽带',
    sources: [
      { url: 'https://www.finder.com.au/mobile-plans/best-sim-only-plans', type: 'crawl', label: 'SIM卡比较' },
      { url: 'https://www.finder.com.au/mobile-plans/best-prepaid-plans', type: 'crawl', label: 'Prepaid 比较' },
      { url: 'https://www.finder.com.au/mobile-plans/cheap-mobile-plans', type: 'crawl', label: '便宜套餐' },
      { url: 'https://www.finder.com.au/nbn/best-nbn-plans', type: 'crawl', label: 'NBN 比较' },
      { url: 'https://www.finder.com.au/mobile-plans/best-mobile-plans-international-calling', type: 'crawl', label: '国际通话' },
      { url: 'https://www.finder.com.au/mobile-plans/best-tourist-sim-cards-australia', type: 'crawl', label: '旅客SIM' },
    ],
  },

  visa: {
    category: 'government/visa',
    schedule: 'monthly',
    title: '签证与移民',
    sources: [
      { url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500', type: 'crawl', label: '500 学生签' },
      { url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-graduate-485', type: 'crawl', label: '485 毕业签' },
      { url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189', type: 'crawl', label: '189 技术移民' },
      { url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-nominated-190', type: 'crawl', label: '190 州担保' },
      { url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/working-holiday-417', type: 'crawl', label: '417 打工度假' },
      { url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/partner-onshore-801-820', type: 'crawl', label: '配偶签' },
      { url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times', type: 'crawl', label: '审批时间' },
      { url: 'https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list', type: 'crawl', label: '职业清单' },
    ],
  },

  mentalhealth: {
    category: 'government/mental-health',
    schedule: 'monthly',
    title: '心理健康',
    sources: [
      { url: 'https://www.beyondblue.org.au/get-support', type: 'crawl', label: 'Beyond Blue 支持' },
      { url: 'https://www.healthdirect.gov.au/mental-health-helplines', type: 'crawl', label: '心理热线' },
      { url: 'https://www.healthdirect.gov.au/mental-health-treatment-plan', type: 'crawl', label: '心理治疗计划' },
      { url: 'https://www.servicesaustralia.gov.au/mental-health-care-and-medicare', type: 'crawl', label: 'Medicare 心理报销' },
      { url: 'https://headspace.org.au/services/headspace-centres/', type: 'crawl', label: 'Headspace 中心' },
    ],
  },

  centrelink: {
    category: 'government/centrelink',
    schedule: 'monthly',
    title: 'Centrelink 福利',
    sources: [
      { url: 'https://www.servicesaustralia.gov.au/jobseeker-payment', type: 'crawl', label: 'JobSeeker' },
      { url: 'https://www.servicesaustralia.gov.au/family-tax-benefit', type: 'crawl', label: 'Family Tax' },
      { url: 'https://www.servicesaustralia.gov.au/rent-assistance', type: 'crawl', label: '租房补贴' },
      { url: 'https://www.servicesaustralia.gov.au/youth-allowance', type: 'crawl', label: 'Youth Allowance' },
      { url: 'https://www.servicesaustralia.gov.au/child-care-subsidy', type: 'crawl', label: '儿童看护补贴' },
      { url: 'https://www.servicesaustralia.gov.au/disability-support-pension', type: 'crawl', label: '残疾人补贴' },
    ],
  },

  finance: {
    category: 'government/banking',
    schedule: 'monthly',
    title: '银行与理财',
    sources: [
      { url: 'https://moneysmart.gov.au/banking/savings-accounts', type: 'crawl', label: '储蓄账户' },
      { url: 'https://moneysmart.gov.au/banking/transaction-accounts-and-debit-cards', type: 'crawl', label: '交易账户' },
      { url: 'https://moneysmart.gov.au/banking/sending-money-overseas', type: 'crawl', label: '海外汇款' },
      { url: 'https://moneysmart.gov.au/credit-cards', type: 'crawl', label: '信用卡' },
      { url: 'https://moneysmart.gov.au/budgeting/manage-the-cost-of-living', type: 'crawl', label: '生活成本' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  QUARTERLY UPDATE — Moderate-frequency changes
  // ═══════════════════════════════════════════════════════════════

  rental: {
    category: 'government/rental',
    schedule: 'quarterly',
    title: '租房',
    sources: [
      { url: 'https://www.fairtrading.nsw.gov.au/housing-and-property/renting', type: 'crawl', label: 'NSW 租房总览' },
      { url: 'https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/rent-increases', type: 'crawl', label: 'NSW 涨租' },
      { url: 'https://www.consumer.vic.gov.au/housing/renting', type: 'crawl', label: 'VIC 租房' },
      { url: 'https://www.rta.qld.gov.au/starting-a-tenancy', type: 'crawl', label: 'QLD 开始租房' },
      { url: 'https://www.rta.qld.gov.au/ending-a-tenancy', type: 'crawl', label: 'QLD 退租' },
    ],
  },

  insurance: {
    category: 'living/insurance',
    schedule: 'quarterly',
    title: '保险指南',
    sources: [
      { url: 'https://moneysmart.gov.au/insurance/car-insurance', type: 'crawl', label: '车险' },
      { url: 'https://moneysmart.gov.au/insurance/health-insurance', type: 'crawl', label: '健康保险' },
      { url: 'https://www.privatehealth.gov.au/health_insurance/what_is_covered/privatehealth.htm', type: 'crawl', label: '私立健康保险覆盖' },
    ],
  },

  travel: {
    category: 'living/travel',
    schedule: 'quarterly',
    title: '旅游攻略',
    sources: [
      { url: 'https://www.australia.com/en/things-to-do/nature-and-wildlife.html', type: 'crawl', label: '自然野生动物' },
      { url: 'https://www.australia.com/en/facts-and-planning/getting-around.html', type: 'crawl', label: '交通指南' },
      { url: 'https://www.timeout.com/sydney/things-to-do/free-things-to-do-in-sydney', type: 'crawl', label: '悉尼免费活动' },
      { url: 'https://www.timeout.com/melbourne/things-to-do/free-things-to-do-in-melbourne', type: 'crawl', label: '墨尔本免费活动' },
    ],
  },

  consumer: {
    category: 'government/consumer',
    schedule: 'quarterly',
    title: '消费者权利',
    sources: [
      { url: 'https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees', type: 'crawl', label: '消费者权利' },
      { url: 'https://www.accc.gov.au/consumers/problem-with-a-product-or-service-you-bought', type: 'crawl', label: '维权' },
      { url: 'https://www.accc.gov.au/consumers/buying-products-and-services/buying-online', type: 'crawl', label: '网购权益' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  ANNUAL UPDATE — Low-frequency changes
  // ═══════════════════════════════════════════════════════════════

  tax: {
    category: 'government/ato',
    schedule: 'annual',
    title: '税务与报税',
    sources: [
      { url: 'https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents', type: 'crawl', label: '税率表' },
      { url: 'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim', type: 'crawl', label: '税务减免' },
      { url: 'https://www.ato.gov.au/individuals-and-families/lodging-your-tax-return', type: 'crawl', label: '报税步骤' },
      { url: 'https://www.ato.gov.au/individuals-and-families/paying-your-tax-or-getting-a-refund/tax-file-numbers', type: 'crawl', label: 'TFN 税号' },
      { url: 'https://www.ato.gov.au/individuals-and-families/working/working-as-an-employee', type: 'crawl', label: '雇员报税' },
      { url: 'https://www.ato.gov.au/individuals-and-families/working/working-as-a-contractor', type: 'crawl', label: '个体户报税' },
    ],
  },

  super: {
    category: 'government/super',
    schedule: 'annual',
    title: 'Super 养老金',
    sources: [
      { url: 'https://moneysmart.gov.au/how-super-works', type: 'crawl', label: 'Super 入门' },
      { url: 'https://moneysmart.gov.au/how-super-works/choosing-a-super-fund', type: 'crawl', label: '选择基金' },
      { url: 'https://moneysmart.gov.au/how-super-works/when-you-can-access-your-super-early', type: 'crawl', label: '提前取出' },
      { url: 'https://moneysmart.gov.au/how-super-works/find-lost-super', type: 'crawl', label: '找回丢失的Super' },
    ],
  },

  fairwork: {
    category: 'government/fair-work',
    schedule: 'annual',
    title: '工作权利',
    sources: [
      { url: 'https://www.fairwork.gov.au/pay-and-wages/minimum-wages', type: 'crawl', label: '最低工资' },
      { url: 'https://www.fairwork.gov.au/tools-and-resources/fact-sheets/rights-and-obligations/international-students', type: 'crawl', label: '留学生权利' },
      { url: 'https://www.fairwork.gov.au/leave/annual-leave', type: 'crawl', label: '年假' },
      { url: 'https://www.fairwork.gov.au/ending-employment/unfair-dismissal', type: 'crawl', label: '不公正解雇' },
      { url: 'https://www.fairwork.gov.au/starting-employment/casual-employees', type: 'crawl', label: '临时工权利' },
      { url: 'https://www.fairwork.gov.au/find-help-for/visa-holders-migrants', type: 'crawl', label: '签证持有人权利' },
    ],
  },

  housing: {
    category: 'government/housing',
    schedule: 'annual',
    title: '买房与补贴',
    sources: [
      { url: 'https://moneysmart.gov.au/home-loans/buying-a-home', type: 'crawl', label: '买房指南' },
      { url: 'https://moneysmart.gov.au/loans/home-loans', type: 'crawl', label: '房贷比较' },
      { url: 'https://www.nhfic.gov.au/support-buy-home', type: 'crawl', label: 'Home Guarantee' },
      { url: 'https://www.revenue.nsw.gov.au/grants-schemes/first-home-buyer', type: 'crawl', label: 'NSW 首套房' },
    ],
  },

  medicare: {
    category: 'government/medicare',
    schedule: 'annual',
    title: 'Medicare 与 PBS',
    sources: [
      { url: 'https://www.servicesaustralia.gov.au/about-medicare', type: 'crawl', label: 'Medicare 简介' },
      { url: 'https://www.servicesaustralia.gov.au/enrolling-medicare', type: 'crawl', label: 'Medicare 注册' },
      { url: 'https://www.servicesaustralia.gov.au/medicare-claims', type: 'crawl', label: 'Medicare 报销' },
      { url: 'https://www.servicesaustralia.gov.au/bulk-billing', type: 'crawl', label: 'Bulk Billing' },
      { url: 'https://www.servicesaustralia.gov.au/medicare-safety-net', type: 'crawl', label: '安全网' },
    ],
  },

  healthcare: {
    category: 'government/healthcare',
    schedule: 'annual',
    title: '医疗服务',
    sources: [
      { url: 'https://www.healthdirect.gov.au/seeing-a-doctor', type: 'crawl', label: '看GP' },
      { url: 'https://www.healthdirect.gov.au/emergency-departments', type: 'crawl', label: '急诊' },
      { url: 'https://www.healthdirect.gov.au/dental-care', type: 'crawl', label: '牙科' },
      { url: 'https://www.healthdirect.gov.au/telehealth', type: 'crawl', label: '远程医疗' },
      { url: 'https://www.healthdirect.gov.au/prescriptions-and-medication', type: 'crawl', label: '处方药' },
    ],
  },

  schools: {
    category: 'government/education',
    schedule: 'annual',
    title: '学校与排名',
    sources: [
      { url: 'https://www.myschool.edu.au/', type: 'crawl', label: 'ACARA MySchool' },
    ],
  },

  education: {
    category: 'government/education',
    schedule: 'annual',
    title: '大学与教育',
    sources: [
      { url: 'https://www.studyaustralia.gov.au/en/study-options/universities-and-higher-education', type: 'crawl', label: '大学总览' },
      { url: 'https://www.studyaustralia.gov.au/en/plan-your-studies/scholarships-and-funding', type: 'crawl', label: '奖学金' },
      { url: 'https://www.studyassist.gov.au/help-loans/hecs-help', type: 'crawl', label: 'HECS-HELP' },
      { url: 'https://www.tafensw.edu.au/courses', type: 'crawl', label: 'TAFE 课程' },
    ],
  },

  driving: {
    category: 'living/driving',
    schedule: 'annual',
    title: '驾照与路规',
    sources: [
      { url: 'https://www.nsw.gov.au/driving-boating-and-transport/driver-and-rider-licences/visiting-or-moving-to-nsw', type: 'crawl', label: 'NSW 海外驾照' },
      { url: 'https://www.vicroads.vic.gov.au/licences/renew-replace-or-update/new-to-victoria', type: 'crawl', label: 'VIC 海外驾照' },
      { url: 'https://www.vicroads.vic.gov.au/safety-and-road-rules/road-rules', type: 'crawl', label: 'VIC 路规' },
    ],
  },

  citizenship: {
    category: 'living/citizenship',
    schedule: 'annual',
    title: '公民入籍',
    sources: [
      { url: 'https://immi.homeaffairs.gov.au/visas/becoming-a-citizen', type: 'crawl', label: '入籍流程' },
      { url: 'https://immi.homeaffairs.gov.au/visas/becoming-a-citizen/citizenship-test', type: 'crawl', label: '入籍考试' },
    ],
  },

  transport: {
    category: 'government/transport',
    schedule: 'annual',
    title: '公共交通',
    sources: [
      { url: 'https://transportnsw.info/tickets-opal/opal', type: 'crawl', label: 'Opal 卡' },
      { url: 'https://www.ptv.vic.gov.au/tickets/myki', type: 'crawl', label: 'Myki 卡' },
      { url: 'https://translink.com.au/tickets-and-fares/go-card', type: 'crawl', label: 'Go Card' },
    ],
  },
};

/** Get sources by schedule type */
export function getSourcesBySchedule(schedule) {
  return Object.entries(RAG_SOURCES)
    .filter(([, cfg]) => cfg.schedule === schedule)
    .map(([key, cfg]) => ({ key, ...cfg }));
}

/** Get all categories */
export function getAllCategories() {
  return Object.entries(RAG_SOURCES).map(([key, cfg]) => ({
    key, category: cfg.category, title: cfg.title,
    schedule: cfg.schedule, sourceCount: cfg.sources.length,
  }));
}
