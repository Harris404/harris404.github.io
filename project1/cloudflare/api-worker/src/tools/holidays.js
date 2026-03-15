/**
 * Public Holidays Tool — Australian public holidays
 * Built-in data + date-nager.at API fallback
 */

// Australian public holidays 2025-2026 (nationwide + state-specific)
const HOLIDAYS = {
  2025: {
    national: [
      { date: '2025-01-01', name: "New Year's Day", name_cn: '元旦' },
      { date: '2025-01-27', name: 'Australia Day', name_cn: '澳大利亚国庆日' },
      { date: '2025-04-18', name: 'Good Friday', name_cn: '耶稣受难日' },
      { date: '2025-04-19', name: 'Saturday before Easter Sunday', name_cn: '复活节前周六' },
      { date: '2025-04-20', name: 'Easter Sunday', name_cn: '复活节周日' },
      { date: '2025-04-21', name: 'Easter Monday', name_cn: '复活节周一' },
      { date: '2025-04-25', name: 'Anzac Day', name_cn: '澳新军团日' },
      { date: '2025-06-09', name: "Queen's Birthday", name_cn: '女王生日 (各州不同)', note: 'Varies by state' },
      { date: '2025-12-25', name: 'Christmas Day', name_cn: '圣诞节' },
      { date: '2025-12-26', name: 'Boxing Day', name_cn: '节礼日' }
    ],
    state: {
      NSW: [
        { date: '2025-03-03', name: 'Bank Holiday (NSW)', name_cn: '银行假日' },
        { date: '2025-06-09', name: "Queen's Birthday (NSW)", name_cn: '女王生日' }
      ],
      VIC: [
        { date: '2025-03-11', name: 'Melbourne Cup Day (Metro)', name_cn: '墨尔本杯赛马日', note: 'Metro Melbourne only' },
        { date: '2025-06-09', name: "Queen's Birthday (VIC)", name_cn: '女王生日' }
      ],
      QLD: [
        { date: '2025-05-05', name: 'Labour Day (QLD)', name_cn: '劳动节' },
        { date: '2025-06-09', name: "Queen's Birthday (QLD)", name_cn: '女王生日' },
        { date: '2025-08-13', name: 'Royal Queensland Show (Brisbane)', name_cn: '皇家昆士兰展(仅布里斯班)' }
      ],
      SA: [
        { date: '2025-03-10', name: 'Adelaide Cup', name_cn: '阿德莱德杯' },
        { date: '2025-06-09', name: "Queen's Birthday (SA)", name_cn: '女王生日' },
        { date: '2025-12-24', name: 'Christmas Eve (SA, from 7pm)', name_cn: '平安夜(下午7点起)' },
        { date: '2025-12-31', name: "New Year's Eve (SA, from 7pm)", name_cn: '除夕夜(下午7点起)' }
      ],
      WA: [
        { date: '2025-03-03', name: 'Labour Day (WA)', name_cn: '劳动节' },
        { date: '2025-06-02', name: 'Western Australia Day', name_cn: '西澳日' },
        { date: '2025-09-29', name: "Queen's Birthday (WA)", name_cn: '女王生日' }
      ],
      TAS: [
        { date: '2025-02-10', name: 'Royal Hobart Regatta (South only)', name_cn: '皇家霍巴特帆船赛' },
        { date: '2025-06-09', name: "Queen's Birthday (TAS)", name_cn: '女王生日' }
      ],
      NT: [
        { date: '2025-05-05', name: 'May Day (NT)', name_cn: '五一节' },
        { date: '2025-06-09', name: "Queen's Birthday (NT)", name_cn: '女王生日' },
        { date: '2025-08-04', name: 'Picnic Day (NT)', name_cn: '野餐日' }
      ],
      ACT: [
        { date: '2025-03-10', name: 'Canberra Day', name_cn: '堪培拉日' },
        { date: '2025-05-26', name: 'Reconciliation Day (ACT)', name_cn: '和解日' },
        { date: '2025-06-09', name: "Queen's Birthday (ACT)", name_cn: '女王生日' },
        { date: '2025-10-06', name: 'Family & Community Day (ACT)', name_cn: '家庭社区日' }
      ]
    }
  },
  2026: {
    national: [
      { date: '2026-01-01', name: "New Year's Day", name_cn: '元旦' },
      { date: '2026-01-26', name: 'Australia Day', name_cn: '澳大利亚国庆日' },
      { date: '2026-04-03', name: 'Good Friday', name_cn: '耶稣受难日' },
      { date: '2026-04-04', name: 'Saturday before Easter Sunday', name_cn: '复活节前周六' },
      { date: '2026-04-05', name: 'Easter Sunday', name_cn: '复活节周日' },
      { date: '2026-04-06', name: 'Easter Monday', name_cn: '复活节周一' },
      { date: '2026-04-25', name: 'Anzac Day', name_cn: '澳新军团日' },
      { date: '2026-06-08', name: "Queen's Birthday", name_cn: '女王生日' },
      { date: '2026-12-25', name: 'Christmas Day', name_cn: '圣诞节' },
      { date: '2026-12-26', name: 'Boxing Day (Saturday → Monday 28th observed)', name_cn: '节礼日' }
    ],
    state: {}
  }
};

export async function getHolidays(args) {
  const year = parseInt(args.year) || new Date().getFullYear();
  const state = (args.state || '').toUpperCase();

  // Use built-in data if available
  const yearData = HOLIDAYS[year];

  if (yearData) {
    let holidays = [...yearData.national];
    if (state && yearData.state?.[state]) {
      holidays = holidays.concat(yearData.state[state]);
    }
    holidays.sort((a, b) => a.date.localeCompare(b.date));

    // Mark upcoming
    const today = new Date().toISOString().split('T')[0];
    const upcoming = holidays.filter(h => h.date >= today).slice(0, 3);

    return {
      year,
      state: state || 'National',
      holidays,
      count: holidays.length,
      next_holiday: upcoming[0] || null,
      upcoming: upcoming.length > 0 ? upcoming : undefined,
      source: 'built-in'
    };
  }

  // Fallback: date-nager.at API
  try {
    const resp = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/AU`, {
      headers: { 'User-Agent': 'AustralianAssistant/1.0' }
    });
    if (resp.ok) {
      const data = await resp.json();
      const holidays = data.map(h => ({
        date: h.date,
        name: h.localName || h.name,
        name_cn: h.name,
        counties: h.counties || []
      }));
      return { year, state: state || 'National', holidays, count: holidays.length, source: 'date.nager.at' };
    }
  } catch (e) {
    // date.nager.at fallback API unavailable, return generic message
  }

  return {
    year,
    message: `Holiday data for ${year} not available.`,
    tip: 'Check https://www.fairwork.gov.au/employment-conditions/public-holidays for official holiday dates.'
  };
}
