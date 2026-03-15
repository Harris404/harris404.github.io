#!/usr/bin/env python3
"""
Government Documentation Scraper for Australian Agent RAG
Collects government and official documentation from Australian sources
Topics: Medicare, Tax, Visa, Fair Work, Centrelink, Superannuation,
        Consumer Rights, Scams, Renting, Banking/Finance
"""

import os
import time
import requests
from pathlib import Path
from urllib.parse import urljoin, urlparse
import hashlib

# Base directories
BASE_DIR = Path(__file__).parent.parent
RAG_DIR = BASE_DIR / "data" / "rag-sources" / "government"

# ============================================================
# Target URLs grouped by topic
# ============================================================

# --- Medicare & Health ---
MEDICARE_URLS = [
    "https://www.servicesaustralia.gov.au/enrolling-medicare",
    "https://www.servicesaustralia.gov.au/enrolling-your-baby-medicare",
    "https://www.servicesaustralia.gov.au/about-medicare",
    "https://www.servicesaustralia.gov.au/health-care-and-medicare",
    "https://www.servicesaustralia.gov.au/medicine-and-medicare",
    "https://www.servicesaustralia.gov.au/mental-health-care-and-medicare",
    "https://www.servicesaustralia.gov.au/screening-tests-and-scans-covered-medicare",
    "https://www.servicesaustralia.gov.au/other-medicare-support",
    "https://www.servicesaustralia.gov.au/whos-covered-medicare",
    "https://www.servicesaustralia.gov.au/medicare-claims",
    "https://www.servicesaustralia.gov.au/bulk-billing",
    "https://www.servicesaustralia.gov.au/medicare-and-tax",
    "https://www.servicesaustralia.gov.au/medical-costs",
    "https://www.servicesaustralia.gov.au/private-health-insurance-and-medicare",
    "https://www.servicesaustralia.gov.au/getting-medicare-benefits",
    "https://www.servicesaustralia.gov.au/how-your-medicare-card-and-account-work",
    "https://www.servicesaustralia.gov.au/medicare-levy-surcharge",
    "https://www.servicesaustralia.gov.au/medicare-safety-net",
    "https://www.servicesaustralia.gov.au/medicare-for-refugees-and-humanitarian-entrants",
    "https://www.servicesaustralia.gov.au/reciprocal-health-care-agreements",
]

# --- ATO / Tax ---
ATO_URLS = [
    "https://www.ato.gov.au/individuals/income-deductions-offsets-and-records/income-you-must-declare",
    "https://www.ato.gov.au/individuals/income-deductions-offsets-and-records/deductions-you-can-claim",
    "https://www.ato.gov.au/individuals/lodging-your-tax-return",
    "https://www.ato.gov.au/individuals/your-tax-return",
    "https://www.ato.gov.au/individuals/tax-return/2024",
    "https://www.ato.gov.au/individuals/income-deductions-offsets-and-records/offsets-and-rebates",
    "https://www.ato.gov.au/individuals/paying-and-receiving-tax/tfn-and-abn",
    "https://www.ato.gov.au/individuals/paying-and-receiving-tax/when-you-need-to-pay-tax",
    "https://www.ato.gov.au/individuals/paying-and-receiving-tax/myTax",
    "https://www.ato.gov.au/individuals/tax-rates",
]

# --- Visa & Immigration ---
VISA_URLS = [
    "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing",
    "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-finder",
    "https://immi.homeaffairs.gov.au/visas/working-in-australia",
    "https://immi.homeaffairs.gov.au/visas/studying-in-australia",
    "https://immi.homeaffairs.gov.au/visas/permanent-resident",
    "https://immi.homeaffairs.gov.au/visas/becoming-a-citizen",
]

# --- Fair Work (workplace rights, migrant workers, pay, hours) ---
FAIRWORK_URLS = [
    "https://www.fairwork.gov.au/pay-and-wages",
    "https://www.fairwork.gov.au/pay-and-wages/minimum-wages",
    "https://www.fairwork.gov.au/pay-and-wages/penalty-rates-and-allowances",
    "https://www.fairwork.gov.au/employment-conditions/national-employment-standards",
    "https://www.fairwork.gov.au/employment-conditions/hours-of-work-breaks-and-rosters/hours-of-work",
    "https://www.fairwork.gov.au/find-help-for/visa-holders-migrants",
    "https://www.fairwork.gov.au/tools-and-resources/fact-sheets/rights-and-obligations/international-students",
    "https://www.fairwork.gov.au/starting-employment/unpaid-work/unpaid-trials",
    "https://www.fairwork.gov.au/ending-employment/notice-and-final-pay",
    "https://www.fairwork.gov.au/leave/annual-leave",
    "https://www.fairwork.gov.au/leave/sick-and-carers-leave",
    "https://www.fairwork.gov.au/leave/parental-leave",
    "https://www.fairwork.gov.au/employment-conditions/hours-of-work-breaks-and-rosters/right-to-disconnect",
]

# --- Centrelink / Services Australia payments ---
CENTRELINK_URLS = [
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
]

# --- Superannuation (MoneySmart / ASIC) ---
SUPER_URLS = [
    "https://moneysmart.gov.au/how-super-works",
    "https://moneysmart.gov.au/how-super-works/choosing-a-super-fund",
    "https://moneysmart.gov.au/how-super-works/types-of-super-funds",
    "https://moneysmart.gov.au/how-super-works/getting-your-super",
    "https://moneysmart.gov.au/how-super-works/when-you-can-access-your-super-early",
    "https://moneysmart.gov.au/how-super-works/find-lost-super",
    "https://moneysmart.gov.au/how-super-works/consolidating-super-funds",
    "https://moneysmart.gov.au/how-super-works/tax-and-super",
]

# --- Banking & Personal Finance (MoneySmart) ---
FINANCE_URLS = [
    "https://moneysmart.gov.au/banking",
    "https://moneysmart.gov.au/banking/savings-accounts",
    "https://moneysmart.gov.au/banking/transaction-accounts-and-debit-cards",
    "https://moneysmart.gov.au/banking/sending-money-overseas",
    "https://moneysmart.gov.au/budgeting/how-to-do-a-budget",
    "https://moneysmart.gov.au/budgeting/manage-the-cost-of-living",
    "https://moneysmart.gov.au/credit-cards",
    "https://moneysmart.gov.au/loans/home-loans",
]

# --- Consumer Rights & Scams (ACCC / Scamwatch) ---
CONSUMER_URLS = [
    # ACCC Consumer Rights
    "https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees",
    "https://www.accc.gov.au/consumers/problem-with-a-product-or-service-you-bought",
    "https://www.accc.gov.au/consumers/buying-products-and-services/buying-online",
    "https://www.accc.gov.au/consumers/specific-products-and-activities/new-and-second-hand-cars",
    "https://www.accc.gov.au/consumers/specific-products-and-activities/private-health-insurance",
    "https://www.accc.gov.au/consumers/specific-products-and-activities/real-estate",
    "https://www.accc.gov.au/consumers/specific-products-and-activities/electricity-prices-and-plans",
]

# --- Scamwatch & Anti-Scam (独立分类) ---
SCAM_URLS = [
    # Scamwatch — Types of scams (全覆盖)
    "https://www.scamwatch.gov.au/types-of-scams",
    "https://www.scamwatch.gov.au/types-of-scams/phishing-scams",
    "https://www.scamwatch.gov.au/types-of-scams/investment-scams",
    "https://www.scamwatch.gov.au/types-of-scams/jobs-and-employment-scams",
    "https://www.scamwatch.gov.au/types-of-scams/relationship-scams",
    "https://www.scamwatch.gov.au/types-of-scams/buying-or-selling-scams",
    "https://www.scamwatch.gov.au/types-of-scams/identity-theft",
    "https://www.scamwatch.gov.au/types-of-scams/product-and-service-scams",
    "https://www.scamwatch.gov.au/types-of-scams/threats-and-extortion-scams",
    "https://www.scamwatch.gov.au/types-of-scams/unexpected-money-scams",
    "https://www.scamwatch.gov.au/types-of-scams/attempts-to-gain-your-personal-information",
    # Scamwatch — How to protect yourself
    "https://www.scamwatch.gov.au/protect-yourself",
    "https://www.scamwatch.gov.au/protect-yourself/how-to-spot-a-scam",
    "https://www.scamwatch.gov.au/protect-yourself/protect-your-identity",
    "https://www.scamwatch.gov.au/protect-yourself/protect-your-devices",
    # Scamwatch — Report & recover
    "https://www.scamwatch.gov.au/report-a-scam",
    "https://www.scamwatch.gov.au/get-help/if-youve-been-scammed",
    "https://www.scamwatch.gov.au/get-help/where-to-get-help",
    # Scamwatch — News / latest scam alerts
    "https://www.scamwatch.gov.au/news-alerts",
    # ASIC MoneySmart — Scam checking
    "https://moneysmart.gov.au/check-and-report-scams",
    "https://moneysmart.gov.au/check-and-report-scams/identify-and-avoid-scams",
    # IDCARE — identity theft support
    "https://www.idcare.org/learning-centre/identity-security",
    # Cyber.gov.au — online safety
    "https://www.cyber.gov.au/protect-yourself",
    "https://www.cyber.gov.au/report-and-recover/common-scam-types",
]

# --- Renting / Tenancy (state authorities) ---
RENTING_URLS = [
    # VIC - Consumer Affairs Victoria
    "https://www.consumer.vic.gov.au/housing/renting/starting-and-changing-rental-agreements",
    "https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports",
    "https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets",
    "https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions",
    # QLD - Residential Tenancies Authority
    "https://www.rta.qld.gov.au/starting-a-tenancy",
    "https://www.rta.qld.gov.au/starting-a-tenancy/rental-bond",
    "https://www.rta.qld.gov.au/starting-a-tenancy/rent-payments",
    "https://www.rta.qld.gov.au/during-a-tenancy",
    "https://www.rta.qld.gov.au/ending-a-tenancy",
    # NSW - Fair Trading
    "https://www.fairtrading.nsw.gov.au/housing-and-property/renting",
    "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy",
    "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy",
    "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy",
    # SA - Consumer and Business Services
    "https://www.sa.gov.au/topics/housing/renting-and-letting",
    "https://www.sa.gov.au/topics/housing/renting-and-letting/repairs-and-maintenance",
    # ACT - Access Canberra
    "https://www.accesscanberra.act.gov.au/s/article/renting-a-property",
]

# --- Education (Universities, TAFE, CRICOS) ---
EDUCATION_URLS = [
    # Study in Australia (official)
    "https://www.studyinaustralia.gov.au/english/study/choosing-a-course",
    "https://www.studyinaustralia.gov.au/english/study/universities-and-higher-education",
    "https://www.studyinaustralia.gov.au/english/study/vocational-education-and-training",
    "https://www.studyinaustralia.gov.au/english/live-in-australia/work",
    "https://www.studyinaustralia.gov.au/english/live-in-australia/accommodation",
    "https://www.studyinaustralia.gov.au/english/plan-your-studies/scholarships-and-funding",
    "https://www.studyinaustralia.gov.au/english/plan-your-studies/how-to-apply",
    # TEQSA (quality and standards)
    "https://www.teqsa.gov.au/students",
    # HELP loan / HECS
    "https://www.studyassist.gov.au/help-loans",
    "https://www.studyassist.gov.au/help-loans/hecs-help",
    "https://www.studyassist.gov.au/help-loans/fee-help",
]

# --- Healthcare (HealthDirect, Medicare detailed) ---
HEALTHCARE_URLS = [
    "https://www.healthdirect.gov.au/seeing-a-doctor",
    "https://www.healthdirect.gov.au/emergency-departments",
    "https://www.healthdirect.gov.au/medicare",
    "https://www.healthdirect.gov.au/bulk-billing",
    "https://www.healthdirect.gov.au/pharmacist",
    "https://www.healthdirect.gov.au/after-hours-healthcare",
    "https://www.healthdirect.gov.au/mental-health-helplines",
    "https://www.healthdirect.gov.au/pregnancy-care-in-australia",
    "https://www.healthdirect.gov.au/dental-care",
    "https://www.healthdirect.gov.au/ambulance",
]

# --- Transport overview (state transit authorities) ---
TRANSPORT_URLS = [
    "https://transportnsw.info/tickets-opal/opal",
    "https://www.ptv.vic.gov.au/tickets/myki",
    "https://translink.com.au/tickets-and-fares/go-card",
    "https://www.transperth.wa.gov.au/smartrider",
]


def clean_filename(url):
    """Generate clean filename from URL"""
    path = urlparse(url).path
    name = path.strip("/").replace("/", "-")
    if not name:
        name = "index"
    return f"{name}.md"


def fetch_as_markdown(url, timeout=30):
    """Fetch URL and return Markdown content using basic requests"""
    print(f"Fetching: {url}")
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        # For now, return raw HTML - we'll use markdownify or similar later
        # This is a placeholder to get structure working
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove scripts, styles, navigation
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
            tag.decompose()
        
        # Extract main content
        main_content = soup.find(['main', 'article', 'div']) or soup.body
        
        if main_content:
            # Extract text with basic formatting
            text = main_content.get_text(separator='\n', strip=True)
            # Clean up excessive newlines
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            return '\n\n'.join(lines)
        
        return response.text
        
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None


def scrape_topic(urls, output_dir, topic_name):
    """Scrape a list of URLs and save to output directory"""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*60}")
    print(f"Scraping {topic_name} documentation...")
    print(f"{'='*60}\n")
    
    successful = 0
    total_size = 0
    
    for url in urls:
        filename = clean_filename(url)
        output_path = output_dir / filename
        
        # Skip if already exists
        if output_path.exists():
            print(f"✓ Already exists: {filename}")
            successful += 1
            total_size += output_path.stat().st_size
            continue
        
        # Fetch content
        content = fetch_as_markdown(url)
        
        if content and len(content) > 1000:  # Minimum 1KB
            # Add metadata header
            markdown = f"""# {filename.replace('.md', '').replace('-', ' ').title()}

**Source**: {url}  
**Downloaded**: {time.strftime('%Y-%m-%d')}

---

{content}
"""
            
            output_path.write_text(markdown, encoding='utf-8')
            file_size = output_path.stat().st_size
            total_size += file_size
            successful += 1
            print(f"✓ Saved: {filename} ({file_size:,} bytes)")
        else:
            print(f"✗ Failed or too small: {filename}")
        
        # Be nice to servers
        time.sleep(1)
    
    print(f"\n{topic_name} Summary:")
    print(f"  Files: {successful}/{len(urls)}")
    print(f"  Size: {total_size/1024/1024:.2f} MB")
    
    return successful, total_size


def main():
    """Main scraper function"""
    print("Australian Government Documentation Scraper")
    print("=" * 60)
    
    # Install required packages if missing
    try:
        import requests
        from bs4 import BeautifulSoup
    except ImportError:
        print("Installing required packages...")
        os.system("pip3 install requests beautifulsoup4")
        import requests
        from bs4 import BeautifulSoup
    
    total_files = 0
    total_bytes = 0
    
    # Define all scraping tasks
    tasks = [
        (MEDICARE_URLS,   RAG_DIR / "medicare",    "Medicare & Health"),
        (ATO_URLS,        RAG_DIR / "ato",         "ATO (Tax)"),
        (VISA_URLS,       RAG_DIR / "visa",        "Visa & Immigration"),
        (FAIRWORK_URLS,   RAG_DIR / "fair-work",   "Fair Work"),
        (CENTRELINK_URLS, RAG_DIR / "centrelink",  "Centrelink Payments"),
        (SUPER_URLS,      RAG_DIR / "super",       "Superannuation"),
        (FINANCE_URLS,    RAG_DIR / "banking",     "Banking & Finance"),
        (CONSUMER_URLS,   RAG_DIR / "consumer",    "Consumer Rights"),
        (SCAM_URLS,       RAG_DIR / "scams",       "Scamwatch & Anti-Scam"),
        (RENTING_URLS,    RAG_DIR / "housing",     "Renting & Tenancy"),
        (EDUCATION_URLS,  RAG_DIR / "education",   "Education & Study"),
        (HEALTHCARE_URLS, RAG_DIR / "healthcare",  "Healthcare Services"),
        (TRANSPORT_URLS,  RAG_DIR / "transport",   "Transport & Transit Cards"),
    ]
    
    for urls, output_dir, topic_name in tasks:
        files, size = scrape_topic(urls, output_dir, topic_name)
        total_files += files
        total_bytes += size
    
    # Final summary
    print(f"\n{'='*60}")
    print(f"OVERALL SUMMARY")
    print(f"{'='*60}")
    print(f"Total topics: {len(tasks)}")
    print(f"Total files: {total_files}")
    print(f"Total size: {total_bytes/1024/1024:.2f} MB")
    print(f"\nOutput directory: {RAG_DIR}")


if __name__ == "__main__":
    main()
