#!/usr/bin/env python3
"""
Australian Agent RAG Data Scraper — Jina Search API (keyword-based)
Uses s.jina.ai to search by keywords, automatically fetches full page content.
No more manual URL lists — keywords cover everything automatically.

Usage:
    python3 scripts/scrape-with-jina-search.py                  # scrape all topics
    python3 scripts/scrape-with-jina-search.py --force          # overwrite existing
    python3 scripts/scrape-with-jina-search.py --topic visa     # single topic
    python3 scripts/scrape-with-jina-search.py --results 8      # 8 results per query
"""

import os
import sys
import time
import json
import hashlib
import argparse
import requests
from pathlib import Path
from urllib.parse import urlparse, quote

# ── Config ────────────────────────────────────────────────────
JINA_API_KEY = os.environ.get(
    "JINA_API_KEY",
    "jina_1fc5bda4a5cc436cb464efbd3aa37226B4Hg2372EfyP0LUBzl2wkYKORr20",
)
JINA_SEARCH = "https://s.jina.ai/"
BASE_DIR = Path(__file__).parent.parent
RAG_DIR = BASE_DIR / "data" / "rag-sources" / "government"
MIN_CONTENT_LENGTH = 500
REQUEST_DELAY = 2.0        # s.jina.ai needs slightly slower pacing
TIMEOUT = 60
RESULTS_PER_QUERY = 5      # default; override with --results

# ── Search Topics ─────────────────────────────────────────────
# (topic_key, output_subdir, display_name, [search_queries])

SEARCH_TOPICS = [
    # ═══════════════════════════════════════════════════════
    #  EDUCATION — 大学课程、学费、院系、TAFE、留学
    # ═══════════════════════════════════════════════════════
    ("education", "education", "Education & Study", [
        "Australia university tuition fees international students 2025",
        "UNSW courses computer science engineering fees",
        "University of Sydney admission requirements international",
        "University of Melbourne bachelor master courses fees",
        "Monash University courses fees scholarships international",
        "ANU Australian National University programs admission",
        "UQ University of Queensland courses fees international",
        "UTS courses fees international students Sydney",
        "RMIT courses fees international students Melbourne",
        "Macquarie University courses fees Sydney",
        "Deakin University courses fees online study",
        "University of Adelaide courses international students",
        "TAFE NSW courses fees international students",
        "TAFE Victoria courses fees vocational training",
        "Australia HECS HELP student loan repayment rates",
        "Australia university scholarships international students 2025",
        "Australia postgraduate research PhD funding scholarships",
        "CRICOS registered courses search Australia",
        "Australia English language requirements IELTS university",
        "Australia university admission ATAR requirements entry",
        "Australia study abroad student accommodation cost living",
        "Australia university semester dates academic calendar",
        "Australia Group of Eight Go8 universities ranking",
        "Australia vocational education apprenticeship pathway",
        "Australia student visa work hours rights limitations",
        "University of Western Australia courses fees",
        "QUT Queensland University Technology courses fees",
        "University of Wollongong courses international fees",
        "Griffith University courses fees international",
        "La Trobe University courses fees international",
        "Curtin University courses fees international Perth",
        "Australian Catholic University courses fees",
        "Western Sydney University courses fees international",
        "Swinburne University Technology courses fees",
        "James Cook University courses fees international",
    ]),

    # ═══════════════════════════════════════════════════════
    #  VISA & IMMIGRATION
    # ═══════════════════════════════════════════════════════
    ("visa", "visa", "Visa & Immigration", [
        "Australia student visa 500 requirements how to apply 2025",
        "Australia temporary graduate visa 485 post study work stream",
        "Australia skilled independent visa 189 points calculator",
        "Australia skilled nominated visa 190 state nomination requirements",
        "Australia employer sponsored visa 482 TSS requirements",
        "Australia working holiday visa 417 462 requirements countries",
        "Australia partner visa 820 801 processing time cost requirements",
        "Australia parent visa 103 143 contributory processing time",
        "Australia visitor visa 600 tourist requirements documents",
        "Australia permanent resident visa pathway options",
        "Australia citizenship test requirements eligibility application",
        "Australia visa processing times current 2025",
        "Australia skilled occupation list MLTSSL STSOL 2025",
        "Australia regional visa 491 494 requirements regional areas",
        "Australia bridging visa A B C conditions work rights",
        "Australia visa health requirements medical examination",
        "Australia visa English language test IELTS PTE requirements",
        "Australia visa points test calculator how to calculate",
        "Australia visa refusal appeal AAT review process",
        "Australia student visa genuine temporary entrant GTE",
        "Australia New Zealand citizens special category visa rights",
        "Australia visa condition 8105 8501 8202 meaning explanation",
        "Australia employer nomination scheme 186 direct entry requirements",
        "Australia global talent visa program GTI requirements",
        "Australia protection visa refugee asylum application",
        "Australia visa age requirement limit upper",
        "Australia skilled regional visa 887 permanent requirements",
        "Australia business innovation visa 188 investor requirements",
        "Australia distinguished talent visa requirements",
        "Australia carer visa parent family requirements",
    ]),

    # ═══════════════════════════════════════════════════════
    #  RENTING / TENANCY — 各州
    # ═══════════════════════════════════════════════════════
    ("renting", "housing", "Renting & Housing", [
        "NSW rental bond rules how much weeks refund process",
        "Victoria rental bond RTBA tenant rights obligations",
        "Queensland rental bond RTA tenant rights 2025 rules",
        "South Australia rental bond tenant rights obligations",
        "Western Australia rental bond tenant rights renting",
        "ACT Canberra rental bond tenant rights renting",
        "Tasmania rental bond tenant rights rules obligations",
        "Northern Territory rental bond tenant rights rules",
        "Australia rental application process documents needed tips",
        "Australia breaking lease early penalty cost state rules",
        "Australia rent increase rules notice period how often",
        "Australia tenant rights repairs maintenance urgent emergency",
        "Australia share house flatmate rights obligations rules",
        "Australia rental inspection notice rights frequency limits",
        "Australia eviction notice period tenant rights protection",
        "Australia rental property condition report move in out",
        "Sydney rental market average rent suburbs 2025 prices",
        "Melbourne rental market average rent suburbs 2025 prices",
        "Brisbane rental market average rent 2025 prices areas",
        "Australia rental scams how to identify avoid protect",
        "Australia rental assistance government payment eligibility",
        "Australia strata body corporate rules fees obligations",
        "Australia first home buyer grant scheme 2025 state",
        "Perth rental market average rent prices suburbs 2025",
        "Adelaide rental market average rent prices 2025",
        "Canberra rental market average rent prices 2025",
        "Australia rental rights pet policy state rules",
        "Australia subletting sublease rules tenant rights",
        "Australia rent affordability percentage income rule",
        "Australia public housing social housing application wait",
    ]),

    # ═══════════════════════════════════════════════════════
    #  HEALTHCARE — Medicare、GP、保险
    # ═══════════════════════════════════════════════════════
    ("healthcare", "healthcare", "Healthcare", [
        "Australia Medicare how to enroll register card number",
        "Australia Medicare bulk billing GP doctor free cost",
        "Australia Medicare safety net threshold 2025 gap",
        "Australia Medicare reciprocal health care agreements countries list",
        "Australia private health insurance comparison rebate 2025",
        "Australia private health insurance hospital extras cover what",
        "Australia OSHC overseas student health cover comparison best",
        "Australia mental health plan GP psychology sessions free bulk",
        "Australia dental care cost Medicare coverage gap options",
        "Australia ambulance cover cost state by state insurance",
        "Australia PBS pharmaceutical benefits scheme medication cost",
        "Australia NDIS disability support how to apply eligible",
        "Australia hospital emergency department what to expect cost",
        "Australia specialist referral GP process waiting time cost",
        "Australia pregnancy maternity care Medicare midwife hospital",
        "Australia health insurance lifetime loading penalty age 31",
        "Australia Medicare levy surcharge threshold how much",
        "Australia telehealth services Medicare rebate online doctor",
        "Australia vaccination schedule free immunisation children adult",
        "Australia health care card low income concession benefits",
        "Australia optical eye care Medicare coverage optometrist",
        "Australia physiotherapy Medicare coverage rebate",
        "Australia pathology blood test Medicare bulk billed",
        "Australia private hospital cost gap payment excess",
        "Australia waiting period private health insurance hospital",
    ]),

    # ═══════════════════════════════════════════════════════
    #  TAX / ATO
    # ═══════════════════════════════════════════════════════
    ("tax", "ato", "Tax & ATO", [
        "Australia income tax rates brackets 2024 2025 resident",
        "Australia income tax rates foreign resident non-resident",
        "Australia tax deductions work from home claim 2025",
        "Australia tax return how to lodge myTax online ATO",
        "Australia tax file number TFN how to apply get",
        "Australia tax deductions vehicle car travel logbook",
        "Australia tax deductions education self study course fees",
        "Australia capital gains tax CGT property shares calculation",
        "Australia negative gearing investment property tax deduction",
        "Australia superannuation tax contribution limits concessional",
        "Australia GST goods services tax registration threshold",
        "Australia ABN Australian Business Number sole trader register",
        "Australia Medicare levy surcharge how much income threshold",
        "Australia tax offset low income LITO LAMITO 2025",
        "Australia cryptocurrency tax rules ATO obligations 2025",
        "Australia investment income tax dividends franking credits",
        "Australia HECS HELP repayment threshold rates 2025",
        "Australia working holiday maker tax rate 417 462",
        "Australia tax agent cost how much lodge return accountant",
        "Australia fringe benefits tax FBT employer salary packaging",
        "Australia rental property tax deductions depreciation",
        "Australia side hustle gig economy tax obligations ABN",
        "Australia tax residency test rules days overseas",
        "Australia tax return due date deadline lodgment",
    ]),

    # ═══════════════════════════════════════════════════════
    #  FAIR WORK / EMPLOYMENT
    # ═══════════════════════════════════════════════════════
    ("fairwork", "fair-work", "Employment & Fair Work", [
        "Australia minimum wage 2025 hourly rate per hour",
        "Australia casual employee rights entitlements loading 25%",
        "Australia annual leave entitlement accrual 4 weeks payout",
        "Australia sick leave personal carer entitlement 10 days",
        "Australia parental leave entitlement paid unpaid 2025",
        "Australia unfair dismissal claim Fair Work Commission how",
        "Australia redundancy pay entitlement notice period table",
        "Australia penalty rates weekend public holiday how much",
        "Australia international student work rights hours 48 visa",
        "Australia workplace bullying harassment complaint process",
        "Australia employer underpayment wage theft claim Fair Work",
        "Australia long service leave entitlement state territory",
        "Australia contractor vs employee difference rights test",
        "Australia probation period rules dismissal termination",
        "Australia right to disconnect after hours work rules 2025",
        "Australia award rates hospitality retail fast food wages",
        "Australia overtime pay rates rules when entitled",
        "Australia notice period resignation termination employment",
        "Australia workplace health safety WHS rights obligations",
        "Australia payslip requirements employer obligations law",
        "Australia superannuation guarantee rate employer 2025",
        "Australia workplace discrimination complaint equal opportunity",
        "Australia apprenticeship wages rates conditions",
        "Australia gig economy delivery rider rights uber",
    ]),

    # ═══════════════════════════════════════════════════════
    #  CENTRELINK / GOVERNMENT PAYMENTS
    # ═══════════════════════════════════════════════════════
    ("centrelink", "centrelink", "Centrelink Payments", [
        "Australia JobSeeker payment rates eligibility 2025",
        "Australia Youth Allowance student eligibility rates 2025",
        "Australia Austudy payment eligibility rates study 2025",
        "Australia Age Pension eligibility rates assets test 2025",
        "Australia Disability Support Pension eligibility application",
        "Australia Carer Payment Allowance eligibility rates 2025",
        "Australia Family Tax Benefit Part A Part B rates 2025",
        "Australia Child Care Subsidy rates eligibility activity test",
        "Australia Parental Leave Pay eligibility how to claim 2025",
        "Australia Rent Assistance rates eligibility how much payment",
        "Australia Commonwealth Seniors Health Card eligibility 2025",
        "Australia Low Income Health Care Card eligibility benefits",
        "Australia crisis payment emergency financial hardship",
        "Australia Centrelink myGov how to set up link account",
        "Australia Centrelink reporting requirements mutual obligations",
        "Australia Centrelink income test assets test thresholds",
        "Australia special benefit visa holder payment eligibility",
    ]),

    # ═══════════════════════════════════════════════════════
    #  SUPERANNUATION
    # ═══════════════════════════════════════════════════════
    ("super", "super", "Superannuation", [
        "Australia superannuation how it works employer contribution rate",
        "Australia superannuation guarantee rate percentage 2025",
        "Australia choose super fund comparison best returns fees",
        "Australia super early access hardship financial release",
        "Australia super consolidation combine multiple accounts how",
        "Australia super tax concessional non-concessional contribution cap",
        "Australia super retirement how much need calculator savings",
        "Australia lost super unclaimed how to find ATO myGov",
        "Australia self-managed super fund SMSF rules setup cost",
        "Australia super death benefit nomination binding beneficiary",
        "Australia super investment options balanced growth conservative",
        "Australia departing Australia super payment DASP visa",
    ]),

    # ═══════════════════════════════════════════════════════
    #  BANKING & FINANCE
    # ═══════════════════════════════════════════════════════
    ("finance", "banking", "Banking & Finance", [
        "Australia bank account open international student new arrival",
        "Australia savings account best interest rate comparison 2025",
        "Australia credit card fees comparison international charges",
        "Australia send money overseas transfer compare fees Wise",
        "Australia home loan mortgage first home buyer deposit 2025",
        "Australia car insurance CTP third party comprehensive compare",
        "Australia budget cost of living manage expenses tips",
        "Australia scam protection identify report ACCC Scamwatch",
        "Australia financial hardship help free counselling service",
        "Australia investment options shares ETF property beginner",
        "Australia home contents renters insurance compare cost",
        "Australia term deposit rates comparison best 2025",
        "Australia buy now pay later Afterpay regulations risks",
    ]),

    # ═══════════════════════════════════════════════════════
    #  CONSUMER RIGHTS
    # ═══════════════════════════════════════════════════════
    ("consumer", "consumer", "Consumer Rights", [
        "Australia consumer rights refund return faulty product ACL",
        "Australia consumer guarantee Australian Consumer Law rights",
        "Australia online shopping consumer rights international purchase",
        "Australia car buying rights lemon law recall faulty",
        "Australia electricity gas plan compare switch provider save",
        "Australia phone internet plan comparison NBN 5G best",
        "Australia real estate buying auction process fees stamp duty",
        "Australia scam types phishing investment employment romance",
        "Australia complaint ACCC consumer affairs ombudsman how",
        "Australia warranty rights manufacturer retailer consumer law",
        "Australia travel insurance comparison claim rights",
        "Australia energy rebate concession low income discount",
    ]),

    # ═══════════════════════════════════════════════════════
    #  TRANSPORT
    # ═══════════════════════════════════════════════════════
    ("transport", "transport", "Transport", [
        "Sydney Opal card how to use transfer discount cap daily",
        "Melbourne Myki card how to use zones fare caps",
        "Brisbane Go Card TransLink fares zones concession",
        "Perth SmartRider TransPerth fares zones concession",
        "Adelaide Metrocard fares zones concession discount",
        "Australia overseas driving licence convert state requirements",
        "NSW driving licence overseas convert test requirements steps",
        "Victoria driving licence overseas convert VicRoads process",
        "Queensland driving licence overseas convert steps requirements",
        "Australia road rules speed limits fines demerit points",
        "Australia car registration cost transfer state rego",
        "Australia toll road Sydney Melbourne Brisbane etag account",
        "Australia cycling rules helmet registration paths",
        "Australia public transport concession card student senior",
    ]),

    # ═══════════════════════════════════════════════════════
    #  DAILY LIVING
    # ═══════════════════════════════════════════════════════
    ("living", "living", "Living in Australia", [
        "Australia cost of living city comparison Sydney Melbourne 2025",
        "Australia emergency numbers 000 police ambulance fire SES",
        "Australia myGov account set up link services how to",
        "Australia phone plan comparison prepaid postpaid best value",
        "Australia NBN internet plan comparison speed tier best",
        "Australia electricity gas provider compare switch save money",
        "Australia postal service Australia Post rates tracking parcels",
        "Australia public holidays 2025 2026 state territory dates",
        "Australia weather climate cities seasons what to expect",
        "Australia pet import quarantine rules regulations BICON",
        "Australia recycling waste collection rules council bins",
        "Australia voting compulsory how to enrol AEC fine",
        "Australia driver licence proof of identity 100 points",
        "Australia Woolworths Coles Aldi grocery comparison prices",
        "Australia mobile phone coverage regional 4G 5G Telstra",
        "Australia bank public holiday trading hours",
        "Australia tipping culture custom practice restaurants",
        "Australia daylight saving time states dates change",
        "Australia metric system measurement conversion guide",
        "Australia wildlife dangerous animals snakes spiders safety",
    ]),
]


# ── Jina Search ────────────────────────────────────────────────

def search_with_jina(query: str, num_results: int = 5) -> list[dict]:
    """
    Search via Jina Search API (s.jina.ai).
    Returns a list of {"title", "content", "url"} dicts with full page markdown.
    """
    headers = {
        "Authorization": f"Bearer {JINA_API_KEY}",
        "Accept": "application/json",
        "X-Return-Format": "markdown",
    }
    try:
        resp = requests.get(
            JINA_SEARCH + quote(query, safe=""),
            headers=headers,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        results = []
        # s.jina.ai returns { data: [...] } where each item has title, content, url
        items = data.get("data", [])
        if isinstance(items, list):
            for item in items[:num_results]:
                content = item.get("content", "")
                title = item.get("title", "")
                url = item.get("url", "")
                if len(content) >= MIN_CONTENT_LENGTH and url:
                    results.append({
                        "title": title,
                        "content": content,
                        "url": url,
                    })
        return results
    except requests.exceptions.HTTPError as e:
        print(f"  ✗ HTTP {e.response.status_code} for query: {query}")
        return []
    except Exception as e:
        print(f"  ✗ Search error for '{query}': {e}")
        return []


def clean_filename(url: str) -> str:
    """Generate a filesystem-safe filename from a URL."""
    parsed = urlparse(url)
    host = parsed.netloc.replace("www.", "").replace(".", "-")
    path = parsed.path.strip("/").replace("/", "_")
    if not path:
        path = "index"
    name = f"{host}_{path}"
    if len(name) > 120:
        name = name[:120]
    return f"{name}.md"


def scrape_topic(topic_key, output_subdir, display_name, queries, *,
                 force=False, results_per_query=5):
    """Search all queries for a topic and save results."""
    output_dir = RAG_DIR / output_subdir
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  {display_name}  ({len(queries)} search queries × {results_per_query} results)")
    print(f"{'='*60}")

    saved = 0
    skipped = 0
    failed_queries = 0
    total_bytes = 0
    seen_urls = set()

    # Also track already-existing files to avoid duplicate URLs across queries
    for existing in output_dir.glob("*.md"):
        seen_urls.add(existing.name)

    for qi, query in enumerate(queries, 1):
        print(f"\n  [{qi}/{len(queries)}] 🔍 {query}")
        results = search_with_jina(query, results_per_query)

        if not results:
            failed_queries += 1
            time.sleep(REQUEST_DELAY)
            continue

        for item in results:
            filename = clean_filename(item["url"])

            # Skip duplicates
            if filename in seen_urls:
                print(f"    ✓ duplicate: {filename[:60]}…")
                skipped += 1
                continue
            seen_urls.add(filename)

            filepath = output_dir / filename

            # Skip existing unless --force
            if filepath.exists() and not force:
                sz = filepath.stat().st_size
                total_bytes += sz
                saved += 1
                skipped += 1
                print(f"    ✓ exists: {filename[:60]}… ({sz:,}B)")
                continue

            content = item["content"]
            title = item["title"]

            # Write markdown
            md = f"""# {title or 'Untitled'}

**Source**: {item['url']}
**Last fetched**: {time.strftime('%Y-%m-%d')}
**Search query**: {query}

---

{content}
"""
            filepath.write_text(md, encoding="utf-8")
            sz = filepath.stat().st_size
            total_bytes += sz
            saved += 1
            print(f"    ✓ saved: {filename[:60]}… ({sz:,}B)")

        time.sleep(REQUEST_DELAY)

    print(f"\n  Summary: {saved} saved ({skipped} cached/dup), "
          f"{failed_queries} failed queries, {total_bytes/1024:.0f} KB total")
    return saved, failed_queries, total_bytes


# ── Main ───────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Scrape Australian info via Jina Search API (keyword-based)")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite existing files")
    parser.add_argument("--topic", type=str,
                        help="Only scrape topics matching this substring")
    parser.add_argument("--results", type=int, default=RESULTS_PER_QUERY,
                        help=f"Results per search query (default: {RESULTS_PER_QUERY})")
    args = parser.parse_args()

    print("=" * 60)
    print("  Australian RAG Scraper — Jina Search API (keyword mode)")
    print("=" * 60)
    print(f"  Output:  {RAG_DIR}")
    print(f"  Topics:  {len(SEARCH_TOPICS)}")
    total_queries = sum(len(t[3]) for t in SEARCH_TOPICS)
    print(f"  Queries: {total_queries}")
    print(f"  Results per query: {args.results}")
    print(f"  Max pages: ~{total_queries * args.results}")
    print(f"  Force:   {args.force}")
    print()

    grand_saved = 0
    grand_failed = 0
    grand_bytes = 0

    for topic_key, subdir, name, queries in SEARCH_TOPICS:
        if (args.topic and
                args.topic.lower() not in topic_key.lower() and
                args.topic.lower() not in name.lower()):
            continue
        saved, failed, nbytes = scrape_topic(
            topic_key, subdir, name, queries,
            force=args.force,
            results_per_query=args.results,
        )
        grand_saved += saved
        grand_failed += failed
        grand_bytes += nbytes

    print(f"\n{'='*60}")
    print(f"  DONE — {grand_saved} files, {grand_failed} failed queries, "
          f"{grand_bytes/1024/1024:.2f} MB")
    print(f"{'='*60}")
    print(f"\n  Next steps:")
    print(f"    1. python3 scripts/prepare_rag_data.py")
    print(f"    2. python3 scripts/generate_embeddings.py")
    print(f"    3. python3 scripts/upload_to_cloudflare.py")


if __name__ == "__main__":
    main()
