#!/usr/bin/env python3
"""
Australian Rental Laws Scraper — Direct HTML scraping (no Jina API)
Uses BeautifulSoup to extract content directly from government websites.

Usage:
    python3 scripts/scrape-rental-laws-direct.py              # scrape all states
    python3 scripts/scrape-rental-laws-direct.py --state nsw  # scrape only NSW
    python3 scripts/scrape-rental-laws-direct.py --force      # re-scrape even if file exists
"""

import os
import sys
import time
import argparse
import requests
from pathlib import Path
from urllib.parse import urlparse
from bs4 import BeautifulSoup
import html2text

# ── Config ────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
RAG_DIR = BASE_DIR / "data" / "rag-sources" / "rental-laws"
MIN_CONTENT_LENGTH = 500          # bytes – skip pages shorter than this
REQUEST_DELAY = 2.0               # seconds between requests (be polite)
TIMEOUT = 30                      # seconds per request

# HTML to Markdown converter
h2t = html2text.HTML2Text()
h2t.ignore_links = False
h2t.ignore_images = True
h2t.ignore_emphasis = False
h2t.body_width = 0  # Don't wrap lines

# ── URL Registry ──────────────────────────────────────────────
RENTAL_LAWS_BY_STATE = [
    # ══════════════════════════════════════════════════════════
    #  NSW — Fair Trading NSW
    # ══════════════════════════════════════════════════════════
    ("nsw", "New South Wales", [
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/starting-a-tenancy/bond",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/rent-increases",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/during-a-tenancy/repairs-and-maintenance",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy/breaking-a-lease",
        "https://www.fairtrading.nsw.gov.au/housing-and-property/renting/ending-a-tenancy/getting-your-bond-back",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  VIC — Consumer Affairs Victoria
    # ══════════════════════════════════════════════════════════
    ("vic", "Victoria", [
        "https://www.consumer.vic.gov.au/housing/renting",
        "https://www.consumer.vic.gov.au/housing/renting/starting-and-changing-rental-agreements",
        "https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports",
        "https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/bond",
        "https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets",
        "https://www.consumer.vic.gov.au/housing/renting/moving-out-giving-notice-and-evictions",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  QLD — Residential Tenancies Authority
    # ══════════════════════════════════════════════════════════
    ("qld", "Queensland", [
        "https://www.rta.qld.gov.au/starting-a-tenancy",
        "https://www.rta.qld.gov.au/starting-a-tenancy/rental-bond",
        "https://www.rta.qld.gov.au/starting-a-tenancy/rent-payments",
        "https://www.rta.qld.gov.au/during-a-tenancy",
        "https://www.rta.qld.gov.au/during-a-tenancy/repairs-and-maintenance",
        "https://www.rta.qld.gov.au/ending-a-tenancy",
        "https://www.rta.qld.gov.au/ending-a-tenancy/bond-refunds",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  WA — Consumer Protection WA
    # ══════════════════════════════════════════════════════════
    ("wa", "Western Australia", [
        "https://www.commerce.wa.gov.au/consumer-protection/renting-home",
        "https://www.commerce.wa.gov.au/consumer-protection/bond",
        "https://www.commerce.wa.gov.au/consumer-protection/repairs-and-maintenance",
        "https://www.commerce.wa.gov.au/consumer-protection/ending-tenancy",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  SA — Consumer and Business Services
    # ══════════════════════════════════════════════════════════
    ("sa", "South Australia", [
        "https://www.sa.gov.au/topics/housing/renting-and-letting",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/bonds-and-deposits",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/repairs-and-maintenance",
        "https://www.sa.gov.au/topics/housing/renting-and-letting/ending-a-tenancy",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  ACT — Access Canberra / Justice ACT
    # ══════════════════════════════════════════════════════════
    ("act", "Australian Capital Territory", [
        "https://www.accesscanberra.act.gov.au/s/article/renting-a-property",
        "https://www.justice.act.gov.au/rental-bonds",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  TAS — Consumer Building and Occupational Services
    # ══════════════════════════════════════════════════════════
    ("tas", "Tasmania", [
        "https://www.cbos.tas.gov.au/topics/housing/renting",
        "https://www.cbos.tas.gov.au/topics/housing/renting/bonds",
    ]),
    
    # ══════════════════════════════════════════════════════════
    #  NT — NT Government
    # ══════════════════════════════════════════════════════════
    ("nt", "Northern Territory", [
        "https://nt.gov.au/property/renters/rent-a-home-or-unit",
        "https://nt.gov.au/property/renters/rental-bonds",
        "https://nt.gov.au/property/renters/your-rights-as-a-renter",
        "https://nt.gov.au/property/renters/ending-a-tenancy",
    ]),
]


def fetch_page(url: str) -> dict | None:
    """
    Fetch a URL and convert HTML to Markdown.
    Returns {"title": ..., "content": ...} or None on failure.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
    }

    try:
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Extract title
        title = ""
        title_tag = soup.find('title')
        if title_tag:
            title = title_tag.get_text().strip()
        
        # Remove unwanted elements
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'noscript']):
            tag.decompose()
        
        # Try to find main content area
        main_content = None
        for selector in ['main', 'article', '[role="main"]', '.content', '#content', '.main-content', '#main-content']:
            main_content = soup.select_one(selector)
            if main_content:
                break
        
        if not main_content:
            main_content = soup.body
        
        if not main_content:
            return None
        
        # Convert to markdown
        html_content = str(main_content)
        markdown = h2t.handle(html_content)
        
        # Clean up markdown
        lines = [line.rstrip() for line in markdown.split('\n')]
        # Remove excessive blank lines
        cleaned_lines = []
        prev_blank = False
        for line in lines:
            if not line.strip():
                if not prev_blank:
                    cleaned_lines.append('')
                prev_blank = True
            else:
                cleaned_lines.append(line)
                prev_blank = False
        
        content = '\n'.join(cleaned_lines).strip()
        
        return {"title": title, "content": content}
        
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
    name = f"{state}_{path}"
    if len(name) > 100:
        name = name[:100]
    return f"{name}.md"


def scrape_state(state_code: str, display_name: str, urls: list, *, force: bool = False):
    """Scrape all URLs for a single state."""
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

        result = fetch_page(url)
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
    parser = argparse.ArgumentParser(description="Scrape Australian rental laws by state (direct HTML)")
    parser.add_argument("--force", action="store_true", help="Re-fetch even if file exists")
    parser.add_argument("--state", type=str, help="Only scrape this state (e.g., nsw, vic, qld)")
    args = parser.parse_args()

    # Check dependencies
    try:
        import html2text
        from bs4 import BeautifulSoup
    except ImportError:
        print("Installing required packages...")
        os.system("pip3 install beautifulsoup4 html2text requests")
        import html2text
        from bs4 import BeautifulSoup

    print("=" * 60)
    print("  Australian Rental Laws Scraper — Direct HTML")
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
