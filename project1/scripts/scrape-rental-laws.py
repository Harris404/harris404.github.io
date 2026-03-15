#!/usr/bin/env python3
"""
Australian Rental Laws Scraper — All 8 States/Territories
Fills the empty rental-laws/{state}/ directories with comprehensive tenancy information.

Usage:
    python3 scripts/scrape-rental-laws.py              # scrape all states
    python3 scripts/scrape-rental-laws.py --state nsw  # scrape only NSW
    python3 scripts/scrape-rental-laws.py --force      # re-scrape even if file exists
"""

import os
import sys
import time
import argparse
import requests
from pathlib import Path
from urllib.parse import urlparse

# ── Config ────────────────────────────────────────────────────
JINA_API_KEY = os.environ.get("JINA_API_KEY", "jina_1fc5bda4a5cc436cb464efbd3aa37226B4Hg2372EfyP0LUBzl2wkYKORr20")
JINA_BASE = "https://r.jina.ai/"
BASE_DIR = Path(__file__).parent.parent
RAG_DIR = BASE_DIR / "data" / "rag-sources" / "rental-laws"
MIN_CONTENT_LENGTH = 500          # bytes – skip pages shorter than this
REQUEST_DELAY = 1.5               # seconds between requests (respect rate limit)
TIMEOUT = 45                      # seconds per request

# ── URL Registry ──────────────────────────────────────────────
# Each entry: (state_code, display_name, [urls])

RENTAL_LAWS_BY_STATE = [
    # ══════════════════════════════════════════════════════════
    #  NSW — Fair Trading NSW
    # ══════════════════════════════════════════════════════════
    ("nsw", "New South Wales", [
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy/bond",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy/before-you-sign",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy/the-condition-report",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/rent-increases",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/repairs-and-maintenance",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/you-and-your-landlord",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy/breaking-a-lease",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy/getting-your-bond-back",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/pets",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/sub-letting",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  VIC — Consumer Affairs Victoria
    # ══════════════════════════════════════════════════════════
    ("vic", "Victoria", [
        "https://www.consumer.vic.gov.au/housing/renting",
        "https://www.consumer.vic.gov.au/housing/renting/starting-and-changing-rental-agreements",
        "https://www.consumer.vic.gov.au/housing/renting/starting-and-changing-rental-agreements/types-of-rental-agreements",
        "https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports",
        "https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/bond",
        "https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/rent",
        "https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/rent-increases",
        "https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets",
        "https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets/repairs",
        "https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets/urgent-repairs",
        "https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets/pets",
        "https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions",
        "https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions/notice-to-vacate",
        "https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions/bond-claims",
        "https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions/ending-your-tenancy",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  QLD — Residential Tenancies Authority
    # ══════════════════════════════════════════════════════════
    ("qld", "Queensland", [
        "https://www.rta.qld.gov.au/starting-a-tenancy",
        "https://www.rta.qld.gov.au/starting-a-tenancy/before-renting",
        "https://www.rta.qld.gov.au/starting-a-tenancy/rental-bond",
        "https://www.rta.qld.gov.au/starting-a-tenancy/rent-payments",
        "https://www.rta.qld.gov.au/starting-a-tenancy/signing-a-tenancy-agreement",
        "https://www.rta.qld.gov.au/starting-a-tenancy/condition-reports",
        "https://www.rta.qld.gov.au/during-a-tenancy",
        "https://www.rta.qld.gov.au/during-a-tenancy/repairs-and-maintenance",
        "https://www.rta.qld.gov.au/during-a-tenancy/rent-increases",
        "https://www.rta.qld.gov.au/during-a-tenancy/pets",
        "https://www.rta.qld.gov.au/during-a-tenancy/access-and-entry",
        "https://www.rta.qld.gov.au/ending-a-tenancy",
        "https://www.rta.qld.gov.au/ending-a-tenancy/ending-a-tenancy-agreement",
        "https://www.rta.qld.gov.au/ending-a-tenancy/bond-refunds",
        "https://www.rta.qld.gov.au/ending-a-tenancy/notice-periods",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  WA — Consumer Protection WA
    # ══════════════════════════════════════════════════════════
    ("wa", "Western Australia", [
        "https://www.commerce.wa.gov.au/consumer-protection/renting-home",
        "https://www.commerce.wa.gov.au/consumer-protection/bond",
        "https://www.commerce.wa.gov.au/consumer-protection/rent",
        "https://www.commerce.wa.gov.au/consumer-protection/repairs-and-maintenance",
        "https://www.commerce.wa.gov.au/consumer-protection/ending-tenancy",
        "https://www.commerce.wa.gov.au/consumer-protection/property-condition-reports",
        "https://www.commerce.wa.gov.au/consumer-protection/tenant-rights-and-responsibilities",
        "https://www.commerce.wa.gov.au/consumer-protection/landlord-rights-and-responsibilities",
        "https://www.commerce.wa.gov.au/consumer-protection/rent-increases",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  SA — Consumer and Business Services
    # ══════════════════════════════════════════════════════════
    ("sa", "South Australia", [
        "https://www.sa.gov.au/topics/housing/renting-and-letting",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/bonds-and-deposits",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/repairs-and-maintenance",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/ending-a-tenancy",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/renting-privately",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/tenants-rights-and-responsibilities",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/landlord-rights-and-responsibilities",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/rent-increases",
        "https://www.cbs.sa.gov.au/residential-tenancies",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  ACT — Access Canberra / Justice ACT
    # ══════════════════════════════════════════════════════════
    ("act", "Australian Capital Territory", [
        "https://www.accesscanberra.act.gov.au/s/article/renting-a-property",
        "https://www.justice.act.gov.au/rental-bonds",
        "https://www.justice.act.gov.au/rental-bonds/bond-refunds",
        "https://www.justice.act.gov.au/rental-bonds/lodging-bonds",
        "https://www.acat.act.gov.au/case-types/residential-tenancies",
        "https://www.legislation.act.gov.au/View/a/2023-31/current/html/2023-31.html",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  TAS — Consumer Building and Occupational Services
    # ══════════════════════════════════════════════════════════
    ("tas", "Tasmania", [
        "https://www.cbos.tas.gov.au/topics/housing/renting",
        "https://www.cbos.tas.gov.au/topics/housing/renting/starting-a-tenancy",
        "https://www.cbos.tas.gov.au/topics/housing/renting/during-a-tenancy",
        "https://www.cbos.tas.gov.au/topics/housing/renting/ending-a-tenancy",
        "https://www.cbos.tas.gov.au/topics/housing/renting/bonds",
        "https://www.cbos.tas.gov.au/topics/housing/renting/repairs-and-maintenance",
        "https://www.cbos.tas.gov.au/topics/housing/renting/rent-increases",
        "https://www.cbos.tas.gov.au/topics/housing/renting/tenant-rights",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  NT — NT Government
    # ══════════════════════════════════════════════════════════
    ("nt", "Northern Territory", [
        "https://nt.gov.au/property/renters/rent-a-home-or-unit",
        "https://nt.gov.au/property/renters/rental-bonds",
        "https://nt.gov.au/property/renters/your-rights-as-a-renter",
        "https://nt.gov.au/property/renters/ending-a-tenancy",
        "https://nt.gov.au/property/renters/rent-increases",
        "https://nt.gov.au/property/renters/repairs-and-maintenance",
        "https://nt.gov.au/property/renters/tenancy-disputes",
    ]),
]


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


def clean_filename(url: str, state: str) -> str:
    """Generate a filesystem-safe filename from a URL."""
    parsed = urlparse(url)
    path = parsed.path.strip("/").replace("/", "_")
    if not path:
        path = "index"
    # Prefix with state for clarity
    name = f"{state}_{path}"
    # Limit length
    if len(name) > 100:
        name = name[:100]
    return f"{name}.md"


def scrape_state(state_code: str, display_name: str, urls: list, *, force: bool = False):
    """Scrape all URLs for a single state using Jina Reader."""
    output_dir = RAG_DIR / state_code
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  {display_name} ({state_code.upper()})  — {len(urls)} URLs")
    print(f"{'='*60}")

    saved = 0
    skipped = 0
    failed = 0
    total_bytes = 0

    for url in urls:
        filename = clean_filename(url, state_code)
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

**State**: {display_name}  
**Source**: {url}  
**Category**: rental-laws/{state_code}  
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


def main():
    parser = argparse.ArgumentParser(description="Scrape Australian rental laws by state via Jina Reader API")
    parser.add_argument("--force", action="store_true", help="Re-fetch even if file exists")
    parser.add_argument("--state", type=str, help="Only scrape this state (e.g., nsw, vic, qld)")
    args = parser.parse_args()

    print("=" * 60)
    print("  Australian Rental Laws Scraper — All 8 States/Territories")
    print("=" * 60)
    print(f"  Output: {RAG_DIR}")
    print(f"  States: {len(RENTAL_LAWS_BY_STATE)}")
    total_urls = sum(len(s[2]) for s in RENTAL_LAWS_BY_STATE)
    print(f"  Total URLs: {total_urls}")
    print(f"  Force re-fetch: {args.force}")
    print()

    grand_saved = 0
    grand_failed = 0
    grand_bytes = 0

    for state_code, display_name, urls in RENTAL_LAWS_BY_STATE:
        if args.state and args.state.lower() != state_code.lower():
            continue
        saved, failed, nbytes = scrape_state(state_code, display_name, urls, force=args.force)
        grand_saved += saved
        grand_failed += failed
        grand_bytes += nbytes

    print(f"\n{'='*60}")
    print(f"  DONE — {grand_saved} files, {grand_failed} failures, {grand_bytes/1024/1024:.2f} MB")
    print(f"{'='*60}")
    
    # Summary by state
    print("\n  Files per state:")
    for state_code, display_name, _ in RENTAL_LAWS_BY_STATE:
        if args.state and args.state.lower() != state_code.lower():
            continue
        state_dir = RAG_DIR / state_code
        if state_dir.exists():
            count = len(list(state_dir.glob("*.md")))
            print(f"    {state_code.upper()}: {count} files")


if __name__ == "__main__":
    main()
