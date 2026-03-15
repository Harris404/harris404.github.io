#!/usr/bin/env python3
"""
Australian Telco Plan Scraper — 电信套餐数据抓取
从 Finder.com.au 和运营商官网抓取最新套餐信息，存入 RAG 数据源。

更新频率建议: 每月1次（与 Finder 月度更新同步）
促销活动更新: 促销通常持续2-6周，重要节点:
  - 1月: New Year sale
  - 2月: Back to school
  - 6月: EOFY
  - 11月: Black Friday / Cyber Monday
  - 12月: Christmas sale

Usage:
    python3 scripts/scrape-telco-plans.py               # 抓取所有页面
    python3 scripts/scrape-telco-plans.py --force        # 强制重新抓取（忽略缓存）
    python3 scripts/scrape-telco-plans.py --topic nbn    # 只抓 NBN 相关
    python3 scripts/scrape-telco-plans.py --topic mobile # 只抓手机相关
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
RAG_DIR = BASE_DIR / "data" / "rag-sources" / "living" / "telco"
MIN_CONTENT_LENGTH = 500
REQUEST_DELAY = 2.0   # Finder 比较友好但别太快
TIMEOUT = 45

# ── 目标页面 ──────────────────────────────────────────────────
# 每个条目: (topic_key, display_name, [urls])

TELCO_PAGES = [
    # ── 手机套餐总览 ──
    ("mobile", "Mobile SIM Plans", [
        "https://www.finder.com.au/mobile-plans/best-sim-only-plans",
        "https://www.finder.com.au/mobile-plans/best-prepaid-plans",
        "https://www.finder.com.au/mobile-plans/cheap-mobile-plans",
        "https://www.finder.com.au/mobile-plans/5g-mobile-plans-australia",
        "https://www.finder.com.au/mobile-plans/unlimited-mobile-data-plans",
    ]),

    # ── 学生套餐 ──
    ("student", "Student Mobile Plans", [
        "https://www.finder.com.au/mobile-plans/best-mobile-plans-for-students",
    ]),

    # ── 国际通话 / Lebara ──
    ("international", "International Calls & Lebara", [
        "https://www.finder.com.au/mobile-plans/best-mobile-plans-international-calling",
        "https://www.finder.com.au/mobile-plans/lebara-mobile-plans",
    ]),

    # ── 年卡 / 长期预付 ──
    ("annual", "Long-expiry / Annual Plans", [
        "https://www.finder.com.au/best-long-expiry-prepaid-plans",
    ]),

    # ── NBN 宽带 ──
    ("nbn", "NBN Broadband Plans", [
        "https://www.finder.com.au/nbn/best-nbn-plans",
        "https://www.finder.com.au/nbn/cheapest-nbn-plans",
    ]),

    # ── 各运营商对比 ──
    ("carriers", "Carrier-specific Comparisons", [
        "https://www.finder.com.au/mobile-plans/optus-mobile",
        "https://www.finder.com.au/mobile-plans/telstra-mobile-plans",
        "https://www.finder.com.au/mobile-plans/vodafone-mobile-plans",
        "https://www.finder.com.au/mobile-plans/boost-mobile-plans",
        "https://www.finder.com.au/mobile-plans/amaysim-mobile-plans",
    ]),

    # ── 旅客 SIM ──
    ("tourist", "Tourist SIM Cards", [
        "https://www.finder.com.au/mobile-plans/best-tourist-sim-cards-australia",
    ]),
]


# ── Jina Reader 抓取 ─────────────────────────────────────────

def fetch_with_jina(url: str) -> dict | None:
    """通过 Jina Reader API 抓取 URL，返回 Markdown 内容。"""
    if not JINA_API_KEY:
        print("  ⚠ JINA_API_KEY not set, trying without auth...")
        headers = {"Accept": "application/json", "X-Return-Format": "markdown"}
    else:
        headers = {
            "Authorization": f"Bearer {JINA_API_KEY}",
            "Accept": "application/json",
            "X-Return-Format": "markdown",
        }

    try:
        resp = requests.get(JINA_BASE + url, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") == 200 and data.get("data"):
            return data["data"]
        if data.get("content"):
            return data
        print(f"  ⚠ Unexpected response for {url}")
        return None
    except requests.exceptions.HTTPError as e:
        print(f"  ✗ HTTP {e.response.status_code} for {url}")
        return None
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return None


def clean_filename(url: str) -> str:
    """URL → 安全文件名"""
    parsed = urlparse(url)
    path = parsed.path.strip("/").replace("/", "_")
    if not path:
        path = "index"
    # 去掉 finder.com.au 前缀保持简洁
    name = path
    if len(name) > 100:
        name = name[:100]
    return f"{name}.md"


def scrape_topic(topic_key, display_name, urls, *, force=False):
    """抓取一个主题下的所有 URL"""
    RAG_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  {display_name}  ({len(urls)} URLs)")
    print(f"{'='*60}")

    saved = 0
    skipped = 0
    failed = 0
    total_bytes = 0

    for url in urls:
        filename = clean_filename(url)
        filepath = RAG_DIR / filename

        # 跳过已存在的（除非 --force）
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

        # 写入带元数据头的 Markdown
        md = f"""# {title or display_name}

**Source**: {url}
**Topic**: Telco - {display_name}
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

    print(f"\n  Summary: {saved} saved ({skipped} cached), {failed} failed, {total_bytes/1024:.0f} KB")
    return saved, failed, total_bytes


# ── Main ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scrape telco plan data from Finder.com.au")
    parser.add_argument("--force", action="store_true", help="Re-fetch even if file exists")
    parser.add_argument("--topic", type=str, help="Only scrape topics matching this keyword")
    args = parser.parse_args()

    print("=" * 60)
    print("  Telco Plan Scraper — Jina Reader API")
    print("  更新频率: 建议每月1次（Finder月初更新）")
    print("=" * 60)
    print(f"  Output: {RAG_DIR}")
    print(f"  Topics: {len(TELCO_PAGES)}")
    total_urls = sum(len(t[2]) for t in TELCO_PAGES)
    print(f"  Total URLs: {total_urls}")
    print(f"  Force: {args.force}")
    print()

    grand_saved = 0
    grand_failed = 0
    grand_bytes = 0

    for topic_key, display_name, urls in TELCO_PAGES:
        if args.topic and args.topic.lower() not in topic_key.lower() and args.topic.lower() not in display_name.lower():
            continue
        saved, failed, nbytes = scrape_topic(topic_key, display_name, urls, force=args.force)
        grand_saved += saved
        grand_failed += failed
        grand_bytes += nbytes

    print(f"\n{'='*60}")
    print(f"  DONE — {grand_saved} files, {grand_failed} failures, {grand_bytes/1024/1024:.2f} MB")
    print(f"{'='*60}")
    print()
    print("📌 下一步:")
    print("  1. python3 scripts/prepare_rag_data.py    # 生成 chunks")
    print("  2. python3 scripts/generate_embeddings.py  # 生成 embeddings")
    print("  3. python3 scripts/upload_to_cloudflare.py # 上传到 Vectorize/D1")


if __name__ == "__main__":
    main()
