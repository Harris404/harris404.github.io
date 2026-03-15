#!/usr/bin/env python3
"""
Australian Agent RAG Data Scraper — powered by Jina Reader API
Converts real government web pages into clean Markdown for RAG ingestion.

Usage:
    python3 scripts/scrape-with-jina.py              # scrape all topics
    python3 scripts/scrape-with-jina.py --force       # re-scrape even if file exists
    python3 scripts/scrape-with-jina.py --topic tax   # scrape only matching topic
"""

import os
import sys
import time
import json
import argparse
import requests
from pathlib import Path
from urllib.parse import urlparse

# ── Config ────────────────────────────────────────────────────
JINA_API_KEY = os.environ.get("JINA_API_KEY", "jina_1fc5bda4a5cc436cb464efbd3aa37226B4Hg2372EfyP0LUBzl2wkYKORr20")
JINA_BASE = "https://r.jina.ai/"
BASE_DIR = Path(__file__).parent.parent
RAG_DIR = BASE_DIR / "data" / "rag-sources" / "government"
MIN_CONTENT_LENGTH = 500          # bytes – skip pages shorter than this
REQUEST_DELAY = 1.5               # seconds between requests (respect rate limit)
TIMEOUT = 45                      # seconds per request

# ── URL Registry ──────────────────────────────────────────────
# Each entry: (topic_key, output_subdir, display_name, [urls])

TOPICS = [
    # ══════════════════════════════════════════════════════════
    #  EDUCATION — 大学课程、学费、院系、TAFE、留学
    # ══════════════════════════════════════════════════════════
    ("education", "education", "Education & Study", [
        # ── Study in Australia (official) ──
        "https://www.studyaustralia.gov.au/en/plan-your-studies/how-to-apply",
        "https://www.studyaustralia.gov.au/en/plan-your-studies/scholarships-and-funding",
        "https://www.studyaustralia.gov.au/en/study-options/universities-and-higher-education",
        "https://www.studyaustralia.gov.au/en/study-options/vocational-education-and-training",
        "https://www.studyaustralia.gov.au/en/life-in-australia/work",
        "https://www.studyaustralia.gov.au/en/life-in-australia/accommodation",
        "https://www.studyaustralia.gov.au/en/life-in-australia/cost-of-living",
        "https://www.studyaustralia.gov.au/en/plan-your-studies/english-language-requirements",
        # ── HECS / HELP loans ──
        "https://www.studyassist.gov.au/help-loans",
        "https://www.studyassist.gov.au/help-loans/hecs-help",
        "https://www.studyassist.gov.au/help-loans/fee-help",
        "https://www.studyassist.gov.au/help-loans/sa-help",
        # ── TEQSA ──
        "https://www.teqsa.gov.au/students",
        # ── UNSW ──
        "https://www.unsw.edu.au/study",
        "https://www.unsw.edu.au/engineering",
        "https://www.unsw.edu.au/business",
        "https://www.unsw.edu.au/science",
        "https://www.unsw.edu.au/arts-design-architecture",
        "https://www.unsw.edu.au/study/undergraduate",
        "https://www.unsw.edu.au/study/postgraduate",
        "https://www.unsw.edu.au/study/international-students",
        "https://www.unsw.edu.au/study/international-students/fees",
        "https://www.unsw.edu.au/study/how-to-apply",
        # ── University of Sydney ──
        "https://www.sydney.edu.au/study.html",
        "https://www.sydney.edu.au/courses/courses/uc/bachelor-of-computer-science.html",
        "https://www.sydney.edu.au/courses/courses/uc/bachelor-of-commerce.html",
        "https://www.sydney.edu.au/courses/courses/uc/bachelor-of-engineering-honours-and-bachelor-of-science.html",
        "https://www.sydney.edu.au/study/how-to-apply.html",
        "https://www.sydney.edu.au/study/admissions/fees-and-costs.html",
        "https://www.sydney.edu.au/study/international-students.html",
        # ── University of Melbourne ──
        "https://study.unimelb.edu.au",
        "https://study.unimelb.edu.au/find/courses/undergraduate/bachelor-of-science/",
        "https://study.unimelb.edu.au/find/courses/undergraduate/bachelor-of-commerce/",
        "https://study.unimelb.edu.au/find/courses/undergraduate/bachelor-of-design/",
        "https://study.unimelb.edu.au/find/courses/graduate/master-of-information-technology/",
        "https://study.unimelb.edu.au/find/courses/graduate/master-of-engineering/",
        "https://study.unimelb.edu.au/how-to-apply",
        "https://study.unimelb.edu.au/how-to-apply/international-applications",
        "https://study.unimelb.edu.au/find/fees",
        # ── ANU ──
        "https://www.anu.edu.au/study",
        "https://www.anu.edu.au/study/apply",
        "https://programsandcourses.anu.edu.au/program/BIT",
        "https://programsandcourses.anu.edu.au/program/BCOMM",
        "https://programsandcourses.anu.edu.au/program/BSCI",
        "https://programsandcourses.anu.edu.au/program/MCOMP",
        # ── UQ ──
        "https://www.uq.edu.au/study",
        "https://study.uq.edu.au/study-options/programs/bachelor-of-computer-science-2451",
        "https://study.uq.edu.au/study-options/programs/bachelor-of-commerce-2040",
        "https://study.uq.edu.au/study-options/programs/bachelor-of-engineering-honours-2455",
        "https://study.uq.edu.au/study-options/find-a-program",
        "https://study.uq.edu.au/admissions/undergraduate/fees-and-costs",
        # ── Monash ──
        "https://www.monash.edu/study",
        "https://www.monash.edu/study/courses/find-a-course",
        "https://www.monash.edu/engineering",
        "https://www.monash.edu/it",
        "https://www.monash.edu/business",
        "https://www.monash.edu/study/fees-scholarships",
        "https://www.monash.edu/study/how-to-apply",
        # ── UTS ──
        "https://www.uts.edu.au/study",
        "https://www.uts.edu.au/study/find-a-course",
        "https://www.uts.edu.au/about/faculty-engineering-and-information-technology",
        "https://www.uts.edu.au/about/uts-business-school",
        "https://www.uts.edu.au/study/international",
        "https://www.uts.edu.au/study/international/fees-and-scholarships",
        # ── RMIT ──
        "https://www.rmit.edu.au/study-with-us",
        "https://www.rmit.edu.au/study-with-us/levels-of-study/undergraduate-study",
        "https://www.rmit.edu.au/study-with-us/levels-of-study/postgraduate-study",
        "https://www.rmit.edu.au/study-with-us/international-students",
        "https://www.rmit.edu.au/study-with-us/international-students/fees-and-scholarships",
        # ── Macquarie ──
        "https://www.mq.edu.au/study",
        "https://www.mq.edu.au/study/find-a-course",
        "https://www.mq.edu.au/study/international-students",
        # ── Deakin ──
        "https://www.deakin.edu.au/study",
        "https://www.deakin.edu.au/courses/find-a-course",
        "https://www.deakin.edu.au/study/fees-and-scholarships",
        # ── University of Adelaide ──
        "https://www.adelaide.edu.au/study",
        "https://www.adelaide.edu.au/study/undergraduate",
        "https://www.adelaide.edu.au/study/postgraduate",
        "https://www.adelaide.edu.au/study/international",
        # ── TAFE ──
        "https://www.tafensw.edu.au/courses",
        "https://www.tafensw.edu.au/international",
        # ── Admissions ──
        "https://www.uac.edu.au/future-applicants/how-to-apply",
        "https://www.vtac.edu.au/applying",
        "https://www.tisc.edu.au/static/guide/applying-tisc.tisc",
    ]),

    # ══════════════════════════════════════════════════════════
    #  VISA & IMMIGRATION — 各类签证详细子页面
    # ══════════════════════════════════════════════════════════
    ("visa", "visa", "Visa & Immigration", [
        # Student visa
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500/length-of-stay",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500/how-to-apply",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500/your-obligations",
        # Temporary Graduate
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-graduate-485",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-graduate-485/graduate-work-stream",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-graduate-485/post-study-work-stream",
        # Skilled visas
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-nominated-190",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-work-regional-provisional-491",
        # WHV
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/working-holiday-417",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-and-holiday-462",
        # Partner / Family
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/partner-onshore-801-820",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/partner-offshore-309-100",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/parent-103",
        # Visitor
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/evisitor-651",
        # Employer-sponsored
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/employer-nomination-scheme-186",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-skill-shortage-482",
        # Citizenship
        "https://immi.homeaffairs.gov.au/visas/becoming-a-citizen",
        "https://immi.homeaffairs.gov.au/visas/becoming-a-citizen/citizenship-test",
        # General info
        "https://immi.homeaffairs.gov.au/visas/working-in-australia",
        "https://immi.homeaffairs.gov.au/visas/permanent-resident",
        "https://immi.homeaffairs.gov.au/visas/already-have-a-visa/check-visa-details-and-conditions/see-your-visa-conditions",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times",
        "https://immi.homeaffairs.gov.au/help-support/applying-online-or-on-paper/online-applications",
        # Skilled occupation lists
        "https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list",
    ]),

    # ══════════════════════════════════════════════════════════
    #  RENTING / TENANCY — 各州租房详细（押金、租金、维修、通知期）
    # ══════════════════════════════════════════════════════════
    ("renting", "housing", "Renting & Tenancy", [
        # ── NSW ──
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy/bond",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy/before-you-sign",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/rent-increases",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/repairs-and-maintenance",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy/breaking-a-lease",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/strata-and-community-living",
        # ── VIC ──
        "https://www.consumer.vic.gov.au/housing/renting/starting-and-changing-rental-agreements",
        "https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports",
        "https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/bond",
        "https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/rent",
        "https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets",
        "https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions",
        "https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions/notice-to-vacate",
        # ── QLD ──
        "https://www.rta.qld.gov.au/starting-a-tenancy",
        "https://www.rta.qld.gov.au/starting-a-tenancy/rental-bond",
        "https://www.rta.qld.gov.au/starting-a-tenancy/rent-payments",
        "https://www.rta.qld.gov.au/starting-a-tenancy/signing-a-tenancy-agreement",
        "https://www.rta.qld.gov.au/during-a-tenancy",
        "https://www.rta.qld.gov.au/during-a-tenancy/repairs-and-maintenance",
        "https://www.rta.qld.gov.au/ending-a-tenancy",
        "https://www.rta.qld.gov.au/ending-a-tenancy/ending-a-tenancy-agreement",
        # ── SA ──
        "https://www.sa.gov.au/topics/housing/renting-and-letting",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/bonds-and-deposits",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/repairs-and-maintenance",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/ending-a-tenancy",
        # ── WA ──
        "https://www.commerce.wa.gov.au/consumer-protection/renting-home",
        "https://www.commerce.wa.gov.au/consumer-protection/bond",
        "https://www.commerce.wa.gov.au/consumer-protection/rent",
        "https://www.commerce.wa.gov.au/consumer-protection/repairs-and-maintenance",
        # ── ACT ──
        "https://www.accesscanberra.act.gov.au/s/article/renting-a-property",
        "https://www.justice.act.gov.au/rental-bonds",
        # ── TAS ──
        "https://www.cbos.tas.gov.au/topics/housing/renting",
        # ── NT ──
        "https://nt.gov.au/property/renters/rent-a-home-or-unit",
    ]),

    # ══════════════════════════════════════════════════════════
    #  HEALTHCARE — Medicare、GP、医院、保险、药房、心理健康
    # ══════════════════════════════════════════════════════════
    ("healthcare", "healthcare", "Healthcare Services", [
        # HealthDirect
        "https://www.healthdirect.gov.au/seeing-a-doctor",
        "https://www.healthdirect.gov.au/emergency-departments",
        "https://www.healthdirect.gov.au/medicare",
        "https://www.healthdirect.gov.au/mental-health-helplines",
        "https://www.healthdirect.gov.au/dental-care",
        "https://www.healthdirect.gov.au/ambulance",
        "https://www.healthdirect.gov.au/hospital-care",
        "https://www.healthdirect.gov.au/health-insurance",
        "https://www.healthdirect.gov.au/ndis",
        "https://www.healthdirect.gov.au/covid-19",
        "https://www.healthdirect.gov.au/mental-health",
        "https://www.healthdirect.gov.au/gp-or-emergency-department",
        "https://www.healthdirect.gov.au/pregnancy",
        "https://www.healthdirect.gov.au/vaccinations",
        "https://www.healthdirect.gov.au/prescriptions-and-medication",
        "https://www.healthdirect.gov.au/telehealth",
        # Private health insurance
        "https://www.privatehealth.gov.au/health_insurance/what_is_covered/index.htm",
        "https://www.privatehealth.gov.au/health_insurance/what_is_covered/medicare.htm",
        "https://www.privatehealth.gov.au/health_insurance/what_is_covered/privatehealth.htm",
        "https://www.ombudsman.gov.au/about-us/phio/health-insurance-faq",
        # Medicare details
        "https://www.servicesaustralia.gov.au/medicare-safety-net",
        "https://www.servicesaustralia.gov.au/reciprocal-health-care-agreements",
        # OSHC (international students)
        "https://www.studyaustralia.gov.au/en/plan-your-studies/overseas-student-health-cover",
    ]),

    # ══════════════════════════════════════════════════════════
    #  MEDICARE — 额外来源 (servicesaustralia 大部分 422 但保留尝试)
    # ══════════════════════════════════════════════════════════
    ("medicare", "medicare", "Medicare & Health", [
        "https://www.servicesaustralia.gov.au/about-medicare",
        "https://www.servicesaustralia.gov.au/enrolling-medicare",
        "https://www.servicesaustralia.gov.au/health-care-and-medicare",
        "https://www.servicesaustralia.gov.au/medicare-claims",
        "https://www.servicesaustralia.gov.au/bulk-billing",
        "https://www.servicesaustralia.gov.au/medicare-and-tax",
        "https://www.servicesaustralia.gov.au/medical-costs",
        "https://www.servicesaustralia.gov.au/private-health-insurance-and-medicare",
        "https://www.servicesaustralia.gov.au/medicare-safety-net",
        "https://www.servicesaustralia.gov.au/reciprocal-health-care-agreements",
    ]),

    # ══════════════════════════════════════════════════════════
    #  ATO / TAX — 报税、税率、抵扣、TFN、myTax
    # ══════════════════════════════════════════════════════════
    ("tax", "ato", "ATO (Tax)", [
        "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/income-you-must-declare",
        "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim",
        "https://www.ato.gov.au/individuals-and-families/lodging-your-tax-return",
        "https://www.ato.gov.au/individuals-and-families/your-tax-return",
        "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/tax-offsets",
        "https://www.ato.gov.au/individuals-and-families/your-tax-return/how-to-lodge-your-tax-return",
        "https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents",
        "https://www.ato.gov.au/tax-rates-and-codes/tax-rates-foreign-residents",
        "https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy",
        "https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge",
        "https://www.ato.gov.au/individuals-and-families/paying-your-tax-or-getting-a-refund/tax-file-numbers",
        "https://www.ato.gov.au/individuals-and-families/super/growing-and-keeping-track-of-your-super",
        "https://www.ato.gov.au/individuals-and-families/your-tax-return/how-to-lodge-your-tax-return/lodge-your-tax-return-with-mytax",
        "https://www.ato.gov.au/individuals-and-families/your-tax-return/how-to-lodge-your-tax-return/use-a-registered-tax-agent",
        "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/records-you-need-to-keep",
        "https://www.ato.gov.au/individuals-and-families/paying-your-tax-or-getting-a-refund/help-with-paying",
        "https://www.ato.gov.au/individuals-and-families/working/working-as-an-employee",
        "https://www.ato.gov.au/individuals-and-families/working/working-as-a-contractor",
    ]),

    # ══════════════════════════════════════════════════════════
    #  FAIR WORK — 工资、假期、解雇、合同
    # ══════════════════════════════════════════════════════════
    ("fairwork", "fair-work", "Fair Work", [
        "https://www.fairwork.gov.au/pay-and-wages",
        "https://www.fairwork.gov.au/pay-and-wages/minimum-wages",
        "https://www.fairwork.gov.au/pay-and-wages/penalty-rates-and-allowances",
        "https://www.fairwork.gov.au/pay-and-wages/overtime",
        "https://www.fairwork.gov.au/pay-and-wages/tax-and-superannuation",
        "https://www.fairwork.gov.au/employment-conditions/national-employment-standards",
        "https://www.fairwork.gov.au/employment-conditions/hours-of-work-breaks-and-rosters/hours-of-work",
        "https://www.fairwork.gov.au/find-help-for/visa-holders-migrants",
        "https://www.fairwork.gov.au/tools-and-resources/fact-sheets/rights-and-obligations/international-students",
        "https://www.fairwork.gov.au/starting-employment/unpaid-work/unpaid-trials",
        "https://www.fairwork.gov.au/starting-employment/types-of-employees",
        "https://www.fairwork.gov.au/starting-employment/casual-employees",
        "https://www.fairwork.gov.au/ending-employment/notice-and-final-pay",
        "https://www.fairwork.gov.au/ending-employment/unfair-dismissal",
        "https://www.fairwork.gov.au/ending-employment/redundancy",
        "https://www.fairwork.gov.au/leave/annual-leave",
        "https://www.fairwork.gov.au/leave/sick-and-carers-leave",
        "https://www.fairwork.gov.au/leave/parental-leave",
        "https://www.fairwork.gov.au/leave/long-service-leave",
        "https://www.fairwork.gov.au/leave/public-holidays",
        "https://www.fairwork.gov.au/employment-conditions/hours-of-work-breaks-and-rosters/right-to-disconnect",
        "https://www.fairwork.gov.au/workplace-problems/fixing-a-workplace-problem",
    ]),

    # ══════════════════════════════════════════════════════════
    #  CENTRELINK PAYMENTS
    # ══════════════════════════════════════════════════════════
    ("centrelink", "centrelink", "Centrelink Payments", [
        "https://www.servicesaustralia.gov.au/child-care-subsidy",
        "https://www.servicesaustralia.gov.au/family-tax-benefit",
        "https://www.servicesaustralia.gov.au/parenting-payment",
        "https://www.servicesaustralia.gov.au/jobseeker-payment",
        "https://www.servicesaustralia.gov.au/age-pension",
        "https://www.servicesaustralia.gov.au/rent-assistance",
        "https://www.servicesaustralia.gov.au/parental-leave-pay",
        "https://www.servicesaustralia.gov.au/youth-allowance",
        "https://www.servicesaustralia.gov.au/austudy",
        "https://www.servicesaustralia.gov.au/disability-support-pension",
        "https://www.servicesaustralia.gov.au/carer-payment",
        "https://www.servicesaustralia.gov.au/low-income-health-care-card",
        "https://www.servicesaustralia.gov.au/newstart-allowance",
        "https://www.servicesaustralia.gov.au/crisis-payment",
    ]),

    # ══════════════════════════════════════════════════════════
    #  SUPERANNUATION
    # ══════════════════════════════════════════════════════════
    ("super", "super", "Superannuation", [
        "https://moneysmart.gov.au/how-super-works",
        "https://moneysmart.gov.au/how-super-works/choosing-a-super-fund",
        "https://moneysmart.gov.au/how-super-works/types-of-super-funds",
        "https://moneysmart.gov.au/how-super-works/getting-your-super",
        "https://moneysmart.gov.au/how-super-works/when-you-can-access-your-super-early",
        "https://moneysmart.gov.au/how-super-works/find-lost-super",
        "https://moneysmart.gov.au/how-super-works/consolidating-super-funds",
        "https://moneysmart.gov.au/how-super-works/tax-and-super",
    ]),

    # ══════════════════════════════════════════════════════════
    #  BANKING & FINANCE
    # ══════════════════════════════════════════════════════════
    ("finance", "banking", "Banking & Finance", [
        "https://moneysmart.gov.au/banking",
        "https://moneysmart.gov.au/banking/savings-accounts",
        "https://moneysmart.gov.au/banking/transaction-accounts-and-debit-cards",
        "https://moneysmart.gov.au/banking/sending-money-overseas",
        "https://moneysmart.gov.au/budgeting/how-to-do-a-budget",
        "https://moneysmart.gov.au/budgeting/manage-the-cost-of-living",
        "https://moneysmart.gov.au/credit-cards",
        "https://moneysmart.gov.au/loans/home-loans",
        "https://moneysmart.gov.au/insurance/car-insurance",
        "https://moneysmart.gov.au/insurance/health-insurance",
        "https://moneysmart.gov.au/managing-debt",
        "https://moneysmart.gov.au/scams",
    ]),

    # ══════════════════════════════════════════════════════════
    #  CONSUMER RIGHTS & SCAMS
    # ══════════════════════════════════════════════════════════
    ("consumer", "consumer", "Consumer & Scams", [
        "https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees",
        "https://www.accc.gov.au/consumers/problem-with-a-product-or-service-you-bought",
        "https://www.accc.gov.au/consumers/buying-products-and-services/buying-online",
        "https://www.accc.gov.au/consumers/specific-products-and-activities/new-and-second-hand-cars",
        "https://www.accc.gov.au/consumers/specific-products-and-activities/private-health-insurance",
        "https://www.accc.gov.au/consumers/specific-products-and-activities/real-estate",
        "https://www.accc.gov.au/consumers/specific-products-and-activities/electricity-prices-and-plans",
        "https://www.scamwatch.gov.au/types-of-scams",
        "https://www.scamwatch.gov.au/types-of-scams/phishing-scams",
        "https://www.scamwatch.gov.au/types-of-scams/investment-scams",
        "https://www.scamwatch.gov.au/types-of-scams/jobs-and-employment-scams",
        "https://www.scamwatch.gov.au/types-of-scams/relationship-scams",
    ]),

    # ══════════════════════════════════════════════════════════
    #  TRANSPORT — 公交卡、驾照转换、道路规则
    # ══════════════════════════════════════════════════════════
    ("transport", "transport", "Transport & Transit", [
        # Transit cards
        "https://transportnsw.info/tickets-opal/opal",
        "https://www.ptv.vic.gov.au/tickets/myki",
        "https://translink.com.au/tickets-and-fares/go-card",
        "https://www.transperth.wa.gov.au/smartrider",
        # Overseas driving licences
        "https://www.nsw.gov.au/driving-boating-and-transport/driver-and-rider-licences/visiting-or-moving-to-nsw",
        "https://www.vicroads.vic.gov.au/licences/renew-replace-or-update/new-to-victoria",
        "https://www.qld.gov.au/transport/licensing/driver-licensing/overseas-licence",
        "https://www.transport.wa.gov.au/licensing/overseas-licence-holders.asp",
        # Road rules
        "https://www.nsw.gov.au/driving-boating-and-transport/roads-safety-and-rules/road-rules",
        "https://www.vicroads.vic.gov.au/safety-and-road-rules/road-rules",
    ]),

    # ══════════════════════════════════════════════════════════
    #  LIVING IN AUSTRALIA — 生活实用信息
    # ══════════════════════════════════════════════════════════
    ("living", "living", "Living in Australia", [
        "https://www.australia.gov.au/information-and-services",
        "https://www.australia.gov.au/phone-and-internet",
        "https://www.servicesaustralia.gov.au/mygov",
        "https://www.servicesaustralia.gov.au/centrelink-online-account",
        "https://www.ato.gov.au/individuals-and-families/your-tax-return/how-to-lodge-your-tax-return/lodge-your-tax-return-with-mytax",
        # Safety
        "https://www.smartraveller.gov.au/before-you-go/safety",
        # Emergency contacts
        "https://www.triplezero.gov.au",
    ]),
]


# ── Jina Reader fetch ─────────────────────────────────────────

def fetch_with_jina(url: str) -> dict | None:
    """
    Fetch a URL via Jina Reader API.
    Returns {"title": ..., "content": ..., "url": ...} or None on failure.
    """
    headers = {
        "Authorization": f"Bearer {JINA_API_KEY}",
        "Accept": "application/json",
        "X-Return-Format": "markdown",
    }

    try:
        resp = requests.get(
            JINA_BASE + url,
            headers=headers,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") == 200 and data.get("data"):
            return data["data"]
        # Some responses return content at top-level
        if data.get("content"):
            return data
        print(f"  ⚠ Unexpected response structure for {url}")
        return None
    except requests.exceptions.HTTPError as e:
        print(f"  ✗ HTTP {e.response.status_code} for {url}")
        return None
    except Exception as e:
        print(f"  ✗ Error fetching {url}: {e}")
        return None


def clean_filename(url: str) -> str:
    """Generate a filesystem-safe filename from a URL."""
    parsed = urlparse(url)
    host = parsed.netloc.replace("www.", "").replace(".", "-")
    path = parsed.path.strip("/").replace("/", "_")
    if not path:
        path = "index"
    name = f"{host}_{path}"
    # Limit length
    if len(name) > 120:
        name = name[:120]
    return f"{name}.md"


def scrape_topic(topic_key, output_subdir, display_name, urls, *, force=False):
    """Scrape all URLs for a single topic using Jina Reader."""
    output_dir = RAG_DIR / output_subdir
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  {display_name}  ({len(urls)} URLs)")
    print(f"{'='*60}")

    saved = 0
    skipped = 0
    failed = 0
    total_bytes = 0

    for url in urls:
        filename = clean_filename(url)
        filepath = output_dir / filename

        # Skip existing unless --force
        if filepath.exists() and not force:
            sz = filepath.stat().st_size
            total_bytes += sz
            saved += 1
            skipped += 1
            print(f"  ✓ exists: {filename} ({sz:,}B)")
            continue

        result = fetch_with_jina(url)
        if not result:
            failed += 1
            continue

        content = result.get("content", "")
        title = result.get("title", "")

        if len(content) < MIN_CONTENT_LENGTH:
            print(f"  ✗ too short ({len(content)}B): {url}")
            failed += 1
            continue

        # Write markdown with metadata header
        md = f"""# {title or filename.replace('.md','').replace('_',' ').title()}

**Source**: {url}
**Last fetched**: {time.strftime('%Y-%m-%d')}

---

{content}
"""
        filepath.write_text(md, encoding="utf-8")
        sz = filepath.stat().st_size
        total_bytes += sz
        saved += 1
        print(f"  ✓ saved: {filename} ({sz:,}B)")

        time.sleep(REQUEST_DELAY)

    print(f"\n  Summary: {saved} saved ({skipped} cached), {failed} failed, {total_bytes/1024:.0f} KB total")
    return saved, failed, total_bytes


# ── Main ───────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scrape Australian gov pages via Jina Reader API")
    parser.add_argument("--force", action="store_true", help="Re-fetch even if file exists")
    parser.add_argument("--topic", type=str, help="Only scrape topics matching this substring")
    args = parser.parse_args()

    print("=" * 60)
    print("  Australian RAG Scraper — Jina Reader API")
    print("=" * 60)
    print(f"  Output: {RAG_DIR}")
    print(f"  Topics: {len(TOPICS)}")
    total_urls = sum(len(t[3]) for t in TOPICS)
    print(f"  Total URLs: {total_urls}")
    print(f"  Force re-fetch: {args.force}")
    print()

    grand_saved = 0
    grand_failed = 0
    grand_bytes = 0

    for topic_key, subdir, name, urls in TOPICS:
        if args.topic and args.topic.lower() not in topic_key.lower() and args.topic.lower() not in name.lower():
            continue
        saved, failed, nbytes = scrape_topic(topic_key, subdir, name, urls, force=args.force)
        grand_saved += saved
        grand_failed += failed
        grand_bytes += nbytes

    print(f"\n{'='*60}")
    print(f"  DONE — {grand_saved} files, {grand_failed} failures, {grand_bytes/1024/1024:.2f} MB")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
