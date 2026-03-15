/**
 * Tax Calculator — Australian Income Tax (FY2024-25)
 * Pure calculation, no external APIs
 */

// FY2024-25 Resident Tax Brackets
const TAX_BRACKETS = [
  { min: 0, max: 18200, rate: 0, base: 0 },
  { min: 18201, max: 45000, rate: 0.16, base: 0 },
  { min: 45001, max: 135000, rate: 0.30, base: 4288 },
  { min: 135001, max: 190000, rate: 0.37, base: 31288 },
  { min: 190001, max: Infinity, rate: 0.45, base: 51638 }
];

// Non-resident brackets
const NON_RESIDENT_BRACKETS = [
  { min: 0, max: 135000, rate: 0.30, base: 0 },
  { min: 135001, max: 190000, rate: 0.37, base: 40500 },
  { min: 190001, max: Infinity, rate: 0.45, base: 60850 }
];

// LITO (Low Income Tax Offset)
function calculateLITO(income) {
  if (income <= 37500) return 700;
  if (income <= 45000) return 700 - ((income - 37500) * 0.05);
  if (income <= 66667) return 325 - ((income - 45000) * 0.015);
  return 0;
}

// Medicare Levy
function calculateMedicare(income) {
  if (income <= 26000) return 0;
  if (income <= 32500) return (income - 26000) * 0.10;
  return income * 0.02;
}

// HELP/HECS repayment rates
const HELP_RATES = [
  { min: 0, max: 54435, rate: 0 },
  { min: 54435, max: 62850, rate: 0.01 },
  { min: 62850, max: 66620, rate: 0.02 },
  { min: 66620, max: 70618, rate: 0.025 },
  { min: 70618, max: 74855, rate: 0.03 },
  { min: 74855, max: 79346, rate: 0.035 },
  { min: 79346, max: 84107, rate: 0.04 },
  { min: 84107, max: 89154, rate: 0.045 },
  { min: 89154, max: 94503, rate: 0.05 },
  { min: 94503, max: 100174, rate: 0.055 },
  { min: 100174, max: 106185, rate: 0.06 },
  { min: 106185, max: 112556, rate: 0.065 },
  { min: 112556, max: 119309, rate: 0.07 },
  { min: 119309, max: 126467, rate: 0.075 },
  { min: 126467, max: 134056, rate: 0.08 },
  { min: 134056, max: 142100, rate: 0.085 },
  { min: 142100, max: 150626, rate: 0.09 },
  { min: 150626, max: 159663, rate: 0.095 },
  { min: 159663, max: Infinity, rate: 0.10 }
];

function calcBaseTax(income, brackets) {
  for (const b of brackets) {
    if (income >= b.min && income <= b.max) {
      return b.base + (income - b.min + (b.min === 0 ? 0 : 1)) * b.rate;
    }
  }
  return 0;
}

export function calculateTax(args) {
  const income = parseFloat(args.gross_income || args.income || 0);
  const isResident = args.resident !== false;
  const includeSuper = args.include_super !== false;

  if (income <= 0) return { error: 'Invalid income amount' };

  const brackets = isResident ? TAX_BRACKETS : NON_RESIDENT_BRACKETS;
  let baseTax = calcBaseTax(income, brackets);
  const lito = isResident ? calculateLITO(income) : 0;
  const medicare = isResident ? calculateMedicare(income) : 0;
  const totalTax = Math.max(0, baseTax - lito) + medicare;
  const netIncome = income - totalTax;
  const effectiveRate = (totalTax / income * 100).toFixed(1);

  const superAmount = includeSuper ? income * 0.115 : 0;

  const result = {
    financial_year: 'FY2024-25',
    gross_income: income,
    resident: isResident,
    base_tax: Math.round(baseTax),
    lito_offset: Math.round(lito),
    medicare_levy: Math.round(medicare),
    total_tax: Math.round(totalTax),
    net_income: Math.round(netIncome),
    effective_tax_rate: `${effectiveRate}%`,
    weekly_net: Math.round(netIncome / 52),
    fortnightly_net: Math.round(netIncome / 26),
    monthly_net: Math.round(netIncome / 12)
  };

  if (includeSuper) {
    result.super_guarantee = {
      rate: '11.5%',
      annual: Math.round(superAmount),
      total_package: Math.round(income + superAmount)
    };
  }

  return result;
}

export function getTaxBrackets() {
  return {
    financial_year: 'FY2024-25',
    resident_brackets: TAX_BRACKETS.map(b => ({
      range: b.max === Infinity ? `$${b.min.toLocaleString()}+` : `$${b.min.toLocaleString()} – $${b.max.toLocaleString()}`,
      rate: `${(b.rate * 100)}%`
    })),
    medicare_levy: '2%',
    super_rate: '11.5%'
  };
}

export function calculateHelpRepayment(args) {
  const income = parseFloat(args.income || args.gross_income || 0);
  if (income <= 0) return { error: 'Invalid income' };

  for (const h of HELP_RATES) {
    if (income >= h.min && income < h.max) {
      const repayment = Math.round(income * h.rate);
      return {
        income,
        repayment_rate: `${(h.rate * 100)}%`,
        annual_repayment: repayment,
        monthly_repayment: Math.round(repayment / 12),
        threshold: `$${h.min.toLocaleString()}`
      };
    }
  }
  return { income, repayment_rate: '0%', annual_repayment: 0 };
}
