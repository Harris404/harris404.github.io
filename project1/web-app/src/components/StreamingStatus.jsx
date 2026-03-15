import { memo } from 'react';

const TOOL_NAMES = {
  get_weather: '天气查询 🌤️',
  convert_currency: '汇率换算 💱',
  supermarket_assistant: '超市特价 🛒',
  get_departures: '交通查询 🚂',
  search_nearby: '附近搜索 📍',
  maps_assistant: '地图导航 🗺️',
  calculate_tax: '税务计算 🧮',
  search_properties: '房产搜索 🏠',
  get_bank_rates: '银行利率 🏦',
  search_jobs: '求职搜索 💼',
  search_courses: '课程搜索 🎓',
  search_oshc: 'OSHC保险 🏥',
  search_medicine: '药品查询 💊',
  web_search: '网络搜索 🌐',
  vehicle: '车辆查询 🚗',
  visa_info: '签证查询 🛂',
  events: '活动搜索 🎉',
  emergency_info: '紧急信息 🚨',
  get_energy_plans: '能源比价 ⚡',
  get_fuel_prices: '油价查询 ⛽',
  search_schools: '学校搜索 🏫',
  mobile_plan: '手机卡比较 📱',
  scam_check: '防诈骗检测 🛡️',
  rental_data: '租金查询 🏠',
  abn_lookup: 'ABN查询 🏢',
  economic_data: '经济数据 📊',
  air_quality: '空气质量 🌫️',
  trs_calculator: 'TRS退税 🧳',
  cn_forums: '华人论坛 💬',
  crawl_page: '网页抓取 🕸️',
};

function StreamingStatus({ status, activeTools, hasContent }) {
  if (!status && activeTools.length === 0) return null;
  if (hasContent) return null; // Hide once content starts flowing

  return (
    <div className="streaming-status">
      <div className="streaming-dot" />
      <span>{status || `正在调用 ${TOOL_NAMES[activeTools[0]] || activeTools[0]}...`}</span>
    </div>
  );
}

export default memo(StreamingStatus);
