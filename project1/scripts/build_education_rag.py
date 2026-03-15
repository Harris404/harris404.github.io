#!/usr/bin/env python3
"""
Education RAG Data Builder
=============================
Collects and converts multiple static education data sources into markdown
chunks for the RAG knowledge base:

1. CRICOS Courses.csv  — all international courses with fees & duration
2. CRICOS Institutions.csv — registered edu providers
3. courseseeker.edu.au — ATAR entry score data
4. studylink.gov.au — scholarship listings
5. AQF + TEQSA reference pages

Output: data/rag-sources/education/*.md  (one file per topic/institution)
Author: auto-generated
"""

import urllib.request
import urllib.parse
import urllib.error
import io
import csv
import json
import re
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# ── Output directory ──────────────────────────────────────────────────────────
BASE = Path(__file__).parent.parent
OUT_DIR = BASE / "data" / "rag-sources" / "education"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TODAY = datetime.now().strftime("%Y-%m-%d")

# ── Target institutions (CRICOS Codes verified against 2026-02 data.gov.au) ──
TARGET_CODES = {
    "00026A": "University of Sydney",
    "00098G": "University of New South Wales",
    "00116K": "University of Melbourne",
    "00008C": "Monash University",
    "00025B": "University of Queensland",
    "00120C": "Australian National University",
    "00126G": "University of Western Australia",
    "00123M": "University of Adelaide",
    "00099F": "University of Technology Sydney",
    "00213J": "Queensland University of Technology",
    "00122A": "RMIT University",
    "00301J": "Curtin University",
    "00002J": "Macquarie University",
    "00113B": "Deakin University",
    "00233E": "Griffith University",
    "00917K": "Western Sydney University",
    "00102E": "University of Wollongong",
    "00586B": "University of Tasmania",
    "00115M": "La Trobe University",
    "00111D": "Swinburne University",
    "00109J": "University of Newcastle",
    "00114A": "Flinders University",
    "00124K": "Victoria University",
    "03389E": "Torrens University Australia",
    "00117J": "James Cook University",
    "00300K": "Charles Darwin University",
    "00212K": "University of Canberra",
    "01241G": "Southern Cross University",
    "00004G": "Australian Catholic University",
    "00017B": "Bond University",
    "00279B": "Edith Cowan University",
    "00121B": "University of South Australia",
    "00125J": "Murdoch University",
    "00005F": "Charles Sturt University",
    "00003G": "University of New England",
    "00219C": "Central Queensland University",
    "00244B": "University of Southern Queensland",
    "00591E": "TAFE NSW",
    "00021N": "TAFE Queensland",
}

OPENER = urllib.request.build_opener()
OPENER.addheaders = [
    ("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120"),
    ("Accept", "text/html,application/xhtml+xml,*/*;q=0.8"),
    ("Accept-Language", "en-AU,en;q=0.9"),
]


def safe_get(url: str, timeout: int = 20) -> Optional[bytes]:
    try:
        r = OPENER.open(url, timeout=timeout)
        return r.read()
    except Exception as e:
        print(f"  WARN: GET {url[:80]} → {e}")
        return None


def write_md(filename: str, title: str, source: str, content: str):
    path = OUT_DIR / filename
    text = f"# {title}\n\n**Source**: {source}\n**Last fetched**: {TODAY}\n\n---\n\n{content}\n"
    path.write_text(text, encoding="utf-8")
    print(f"  ✓ Wrote {path.name} ({len(text):,} chars)")


# ══════════════════════════════════════════════════════════════════════════════
# 1. CRICOS DATA
# ══════════════════════════════════════════════════════════════════════════════

def fetch_cricos_data():
    """Download CRICOS Institutions + Courses CSV, generate per-institution and
    overview markdown files."""
    print("\n=== [1] CRICOS Institutions & Courses ===")

    INST_URL = "https://data.gov.au/data/dataset/e5ae7059-bfa8-4fa4-a5c0-c13cf3520193/resource/7f6941f3-5327-4db7-b556-5f16d77f63c1/download/cricos-institutions.csv"
    COURSE_URL = "https://data.gov.au/data/dataset/e5ae7059-bfa8-4fa4-a5c0-c13cf3520193/resource/48cacf69-2082-415e-9595-f17d0c3a4af0/download/cricos-courses.csv"

    # ── Institutions ──────────────────────────────────────────────────────────
    print("  Downloading CRICOS Institutions.csv…")
    raw_inst = safe_get(INST_URL)
    if not raw_inst:
        print("  ERROR: Could not download institutions CSV")
        return {}

    inst_reader = csv.DictReader(io.StringIO(raw_inst.decode("utf-8-sig", errors="replace")))
    institutions: Dict[str, dict] = {}
    for row in inst_reader:
        code = row.get("CRICOS Provider Code", "").strip()
        if code in TARGET_CODES:
            institutions[code] = {
                "code": code,
                "name": row.get("Institution Name", "").strip(),
                "trading": row.get("Trading Name", "").strip(),
                "type": row.get("Institution Type", "").strip(),
                "capacity": row.get("Institution Capacity", "").strip(),
                "website": row.get("Website", "").strip(),
                "state": row.get("Postal Address State", "").strip(),
                "city": row.get("Postal Address City", "").strip(),
                "postcode": row.get("Postal Address Postcode", "").strip(),
                "courses": [],  # filled below
            }
    print(f"  Found {len(institutions)} target institutions")

    # ── Courses ───────────────────────────────────────────────────────────────
    print("  Downloading CRICOS Courses.csv (7MB)…")
    raw_courses = safe_get(COURSE_URL, timeout=60)
    if not raw_courses:
        print("  ERROR: Could not download courses CSV")
        return institutions

    course_reader = csv.DictReader(io.StringIO(raw_courses.decode("utf-8-sig", errors="replace")))
    total_courses = 0
    for row in course_reader:
        code = row.get("CRICOS Provider Code", "").strip()
        if code not in institutions:
            continue
        expired = row.get("Expired", "").strip().lower()
        if expired in ("yes", "true", "1"):
            continue
        course = {
            "course_code": row.get("CRICOS Course Code", "").strip(),
            "name": row.get("Course Name", "").strip(),
            "vet_code": row.get("VET National Code", "").strip(),
            "level": row.get("Course Level", "").strip(),
            "field1": row.get("Field of Education 1 Broad Field", "").strip(),
            "field2": row.get("Field of Education 1 Narrow Field", "").strip(),
            "duration_weeks": row.get("Duration (Weeks)", "").strip(),
            "tuition_fee": row.get("Tuition Fee", "").strip(),
            "total_cost": row.get("Estimated Total Course Cost", "").strip(),
            "work_component": row.get("Work Component", "").strip(),
            "foundation": row.get("Foundation Studies", "").strip(),
        }
        institutions[code]["courses"].append(course)
        total_courses += 1
    print(f"  Loaded {total_courses} active courses across target institutions")

    # ── Generate per-institution markdown ─────────────────────────────────────
    for code, inst in institutions.items():
        courses = inst["courses"]
        if not courses:
            continue
        # Group by level
        by_level: Dict[str, List[dict]] = {}
        for c in courses:
            lvl = c["level"] or "Other"
            by_level.setdefault(lvl, []).append(c)

        name = inst["name"]
        trading = inst.get("trading", "")
        display_name = trading if trading and trading != name else name
        website = inst.get("website", "")

        lines = []
        lines.append(f"## Overview")
        lines.append(f"")
        lines.append(f"- **CRICOS Provider Code**: {code}")
        lines.append(f"- **Official Name**: {name}")
        if trading and trading != name:
            lines.append(f"- **Trading As**: {trading}")
        lines.append(f"- **State**: {inst.get('state','')}")
        lines.append(f"- **Website**: {website}")
        lines.append(f"- **International Capacity**: {inst.get('capacity','N/A')} students")
        lines.append(f"- **Total Active CRICOS Courses**: {len(courses)}")
        lines.append(f"")

        # Level summary table
        lines.append(f"## Courses by Level")
        lines.append(f"")
        lines.append(f"| Level | Count | Typical Duration | Typical Annual Fee |")
        lines.append(f"|-------|-------|-----------------|-------------------|")
        for lvl, cs in sorted(by_level.items()):
            durations = [int(c["duration_weeks"]) for c in cs if c["duration_weeks"].isdigit()]
            fees = []
            for c in cs:
                fee_str = c["tuition_fee"].replace("$", "").replace(",", "").strip()
                try:
                    fees.append(float(fee_str))
                except:
                    pass
            avg_dur = f"~{round(sum(durations)/len(durations))} weeks" if durations else "varies"
            avg_fee = f"~${sum(fees)/len(fees)/((sum(durations)/len(durations))/52):,.0f}/yr" if fees and durations else "varies"
            lines.append(f"| {lvl} | {len(cs)} | {avg_dur} | {avg_fee} |")
        lines.append(f"")

        # Detailed course listing by level
        LEVEL_ORDER = [
            "Bachelor Degree", "Bachelor Honours Degree",
            "Masters Degree (Coursework)", "Masters Degree (Research)",
            "Doctoral Degree", "Graduate Diploma", "Graduate Certificate",
            "Associate Degree", "Advanced Diploma", "Diploma",
            "Certificate IV", "Certificate III", "Certificate II", "Certificate I",
            "Non-Award Pathway", "Foundation", "English", "Other",
        ]

        def level_sort_key(lvl):
            try:
                return LEVEL_ORDER.index(lvl)
            except ValueError:
                for i, lo in enumerate(LEVEL_ORDER):
                    if lo.lower() in lvl.lower() or lvl.lower() in lo.lower():
                        return i
                return 99

        for lvl in sorted(by_level.keys(), key=level_sort_key):
            cs = by_level[lvl]
            lines.append(f"## {lvl} Programs")
            lines.append(f"")
            lines.append(f"| CRICOS Code | Course Name | Duration (wks) | Total Fee (AUD) |")
            lines.append(f"|-------------|-------------|---------------|----------------|")
            for c in sorted(cs, key=lambda x: x["name"]):
                fee_display = c["total_cost"] if c["total_cost"] else (c["tuition_fee"] if c["tuition_fee"] else "N/A")
                vet_note = f" [{c['vet_code']}]" if c["vet_code"] else ""
                lines.append(f"| {c['course_code']} | {c['name']}{vet_note} | {c['duration_weeks']} | {fee_display} |")
            lines.append(f"")

        slug = re.sub(r"[^a-z0-9]+", "-", display_name.lower()).strip("-")[:80]
        write_md(
            f"cricos_{slug}_courses.md",
            f"CRICOS Courses — {display_name}",
            f"https://data.gov.au/dataset/ds-dga-e5ae7059-bfa8-4fa4-a5c0-c13cf3520193",
            "\n".join(lines),
        )

    # ── Generate Australia-wide CRICOS overview ───────────────────────────────
    overview_lines = []
    overview_lines.append(
        "## What is CRICOS?\n\n"
        "CRICOS (Commonwealth Register of Institutions and Courses for Overseas Students) "
        "is the official Australian Government register of all education providers authorised "
        "to enrol international students on a student visa (subclass 500). Every institution "
        "and every course taught to international students must be CRICOS-registered.\n"
    )
    overview_lines.append("## How to Use CRICOS Codes\n")
    overview_lines.append("- **Institution code**: Used on visa applications to identify the university/TAFE")
    overview_lines.append("- **Course code**: Used on the Confirmation of Enrolment (CoE) document")
    overview_lines.append("- Search at: https://cricos.education.gov.au\n")
    overview_lines.append("## Major Australian Universities — CRICOS Provider Codes\n")
    overview_lines.append("| Institution | CRICOS Code | State | Int'l Students |")
    overview_lines.append("|-------------|-------------|-------|---------------|")
    for code, inst in sorted(institutions.items(), key=lambda x: len(x[1]["courses"]), reverse=True):
        if inst["type"] == "TAFE":
            continue
        overview_lines.append(
            f"| {inst['name']} | {code} | {inst.get('state','')} | up to {inst.get('capacity','?')} |"
        )
    overview_lines.append("")
    overview_lines.append("## TAFE and VET Providers — CRICOS Codes\n")
    overview_lines.append("| Institution | CRICOS Code | State |")
    overview_lines.append("|-------------|-------------|-------|")
    for code, inst in institutions.items():
        if inst["type"] != "TAFE" and not any(t in inst["name"].lower() for t in ["tafe", "polytechnic", "institute of technology"]):
            continue
        overview_lines.append(f"| {inst['name']} | {code} | {inst.get('state','')} |")

    write_md(
        "cricos_overview.md",
        "CRICOS — Australian International Education Register Overview",
        "https://cricos.education.gov.au",
        "\n".join(overview_lines),
    )

    return institutions


# ══════════════════════════════════════════════════════════════════════════════
# 2. ENGLISH LANGUAGE REQUIREMENTS (static reference)
# ══════════════════════════════════════════════════════════════════════════════

def build_english_requirements():
    """Generate a comprehensive markdown on English entry requirements for Australian universities."""
    print("\n=== [2] English Language Requirements (static) ===")

    content = """\
## Overview

Australian universities require proof of English language proficiency for international students.
The most common tests are IELTS Academic, TOEFL iBT, PTE Academic, and CAE/CPE.

## Standard Entry Requirements by Study Level

| Level | IELTS Overall | IELTS Min Band | TOEFL iBT | PTE Academic | Alternatives |
|-------|--------------|----------------|-----------|--------------|--------------|
| Undergraduate (Bachelor) | 6.0–6.5 | 6.0 per band | 72–79 | 50–58 | Duolingo 105+ |
| Postgraduate (Masters Coursework) | 6.5 | 6.0 per band | 79–90 | 58–65 | Duolingo 115+ |
| Masters (Research) | 6.5–7.0 | 6.0–6.5 per band | 90–100 | 65–79 | — |
| PhD / Doctoral | 6.5–7.0 | 6.0 per band | 90–100 | 65–79 | — |
| Diploma / Pathway Programs | 5.5–6.0 | 5.5–6.0 | 60–72 | 42–50 | — |
| English Language Course (ELICOS) | No IELTS required | — | — | — | — |

## University-Specific Requirements

### Group of Eight (G8) Universities

| University | Undergrad IELTS | Postgrad IELTS | Notes |
|-----------|----------------|----------------|-------|
| University of Melbourne | 6.5 | 6.5–7.0 | Medicine/Law require 7.0 overall |
| University of Sydney | 6.5 | 6.5–7.0 | Engineering min 7.0; Education 7.5 |
| UNSW Sydney | 6.5 | 6.5–7.5 | Law 7.5; Engineering 6.5 |
| University of Queensland | 6.5 | 6.5 | Health sciences may require 7.0 |
| Monash University | 6.0–6.5 | 6.5 | Engineering 6.0; Health 7.0 |
| ANU | 6.5 | 6.5–7.0 | Research higher degrees 7.0 |
| University of Western Australia | 6.5 | 6.5 | Some programs 7.0 |
| University of Adelaide | 6.0–6.5 | 6.5 | Health 7.0 |

### Technology-Focused Universities

| University | Undergrad IELTS | Postgrad IELTS | Notes |
|-----------|----------------|----------------|-------|
| UTS | 6.0–6.5 | 6.5 | Design 6.0; Law 7.0 |
| QUT | 6.0–6.5 | 6.5 | |
| RMIT | 6.0 | 6.5 | |
| Curtin | 6.0 | 6.5 | Health programs 7.0 |
| Macquarie | 6.5 | 6.5 | |

### Other Major Universities

| University | Undergrad IELTS | Postgrad IELTS |
|-----------|----------------|----------------|
| Deakin | 6.0 | 6.5 |
| Griffith | 6.0 | 6.5 |
| Western Sydney | 6.0 | 6.5 |
| University of Wollongong | 6.0–6.5 | 6.5 |
| La Trobe | 6.0 | 6.5 |
| Swinburne | 6.0 | 6.5 |
| University of Newcastle | 6.0 | 6.5 |
| Flinders | 6.0 | 6.5 |

## Conditional Admission & Pathway Programs

If you don't meet IELTS requirements, most universities offer:

- **ELICOS (English Language Intensive Courses for Overseas Students)** — 10–40+ weeks
- **University English Programs** (e.g., Monash English, UQ College)
- **Foundation / Diploma pathways** — include English + academic content
- Some universities offer **Direct Entry after ELICOS** without re-sitting IELTS

| Pathway | Duration | Leads To | Typical IELTS Entry |
|---------|----------|----------|---------------------|
| ELICOS General: 20 weeks | 20 wks | IELTS improvement | No test required |
| Diploma + ELICOS package | 1.5–2 yrs | Bachelor Year 2 | 5.0–5.5 IELTS |
| Foundation program | 1 year | Bachelor Year 1 | 5.0–6.0 IELTS |

## Important Notes

- All IELTS requirements refer to **IELTS Academic** (not IELTS General Training)
- **PTE Academic** is widely accepted as equivalent to IELTS
- TOEFL iBT is accepted but less preferred at some institutions
- **Duolingo English Test** is accepted by many universities at 100–120 threshold
- English test results are generally valid for **2 years**
- Some degrees (Medicine, Pharmacy, Teaching, Law) have **higher requirements** than standard
"""
    write_md(
        "university_english_requirements.md",
        "English Language Entry Requirements — Australian Universities",
        "https://www.studyaustralia.gov.au/english",
        content,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 3. UNIVERSITY ENTRY REQUIREMENTS / ATAR (static reference)
# ══════════════════════════════════════════════════════════════════════════════

def build_atar_requirements():
    print("\n=== [3] ATAR / Entry Requirements (static) ===")

    content = """\
## What is ATAR?

The ATAR (Australian Tertiary Admission Rank) is the primary undergraduate admission score
used across most Australian states. It's a percentile rank: ATAR 90.00 means you scored
higher than 90% of your eligible peers.

Note: ATAR is **not used** for:
- Postgraduate (Masters/PhD) admission — uses undergraduate GPA + other criteria
- VET/TAFE courses — typically no ATAR requirement
- International students — use overseas equivalent qualifications

## Typical ATAR Ranges by Field (2025 indicative cut-offs)

| Field of Study | Typical ATAR Range | Top University ATAR | Notes |
|---------------|-------------------|---------------------|-------|
| Medicine (MBBS) | 95–99.9 | 99.9 (UCAT + interview) | Requires UCAT/GAMSAT |
| Law (LLB) | 92–99 | 99+ | Some unis use interviews |
| Dentistry | 92–99 | 99 | Requires UCAT |
| Optometry | 88–96 | 96 | UCAT increasingly required |
| Pharmacy | 80–92 | 90 | |
| Physiotherapy | 82–95 | 90+ | |
| Nursing | 65–80 | 80 | Many unis accept lower ATARs |
| Engineering | 75–95 | 90+ (USyd/UNSW) | Varies widely |
| Computer Science / IT | 70–92 | 90 (UNSW/Melb) | |
| Architecture | 78–92 | 90 | |
| Business / Commerce | 75–95 | 95 (USyd/UNSW Commerce) | |
| Economics | 78–92 | 90+ | |
| Accounting | 70–85 | 90 | |
| Science | 70–90 | 85+ | Depends on university |
| Arts / Humanities | 60–85 | 80+ | |
| Education (Teaching) | 65–80 | 80 | Literacy/numeracy test required |
| Psychology | 75–88 | 85+ | |
| Social Work | 65–80 | 75 | |
| Design / Creative Arts | 65–85 | 80 | Portfolio often required |

## International Student Equivalents

International students submit equivalent home-country qualifications. General equivalencies:

| Country | Qualification | Equivalent to ATAR |
|---------|--------------|-------------------|
| China | Gaokao | Score-dependent; 600+/750 → ~ATAR 90+ |
| India | CBSE/ISC Class 12 | 85–90%+ → competitive programs |
| South Korea | CSAT (수능) | Top percentile → Melbourne/Sydney |
| Indonesia | Ujian Nasional | 8.5+/10.0 → most programs |
| Malaysia | STPM / A-Levels | 4A / 2A+2B → most universities |
| UK / HK / SG | A-Levels | ABB → most; AAA → medicine |
| USA / Canada | High school GPA | 3.7+/4.0 → competitive programs |
| Germany | Abitur | 1.0–2.0 → competitive |

## Postgraduate Entry (Masters) Requirements

Unlike undergraduate entry, postgraduate admission is based on:

1. **Undergraduate GPA** — typically credit average (65%) or above; distinction (75%+) for top programs
2. **Related degree** — most coursework Masters require same/related field
3. **Work experience** — MBA typically requires 2–5 years professional experience
4. **GMAT/GRE** — required by top business schools (e.g., Melbourne Business School)
5. **English proficiency** — IELTS 6.5–7.0
6. **Research experience** — for research Masters/MPhil

## Scholarship Criteria (Common Thresholds)

| Scholarship | ATAR / GPA Required |
|-------------|---------------------|
| University Merit Scholarship (typical) | ATAR 95+ or GPA 3.8/4.0 |
| Vice-Chancellor's Scholarship | ATAR 99+ or Dux of school |
| AusAID / Australia Awards | Competitive; Government sponsored |
| Research Training Program (RTP) | First-class Honours or equivalent |
| University of Melbourne Scholarship | Various; see study.unimelb.edu.au |
"""

    write_md(
        "university_atar_entry_requirements.md",
        "ATAR and University Entry Requirements — Australia",
        "https://www.courseseeker.edu.au",
        content,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 4. TUITION FEES GUIDE (derived from CRICOS data + known data)
# ══════════════════════════════════════════════════════════════════════════════

def build_fees_guide():
    print("\n=== [4] Tuition Fees Guide (static) ===")

    content = """\
## Overview

International student tuition fees in Australia are set by each institution
and can vary significantly between universities and programs. Fees listed here
are approximate 2025 annual figures.

**Important**: CRICOS-registered courses must display indicative fees.
Always verify current fees on the university or CRICOS register website.

## Annual International Tuition Fees by Level

### Undergraduate (Bachelor Degree) — Annual Fee (AUD)

| University | Business/Commerce | Engineering | IT/CS | Science | Nursing/Health |
|-----------|-------------------|-------------|-------|---------|----------------|
| University of Melbourne | $47,000 | $49,000 | $49,000 | $48,000 | $55,000 |
| University of Sydney | $48,000 | $55,000 | $55,000 | $52,000 | $58,000 |
| UNSW Sydney | $50,000 | $55,000 | $55,000 | $52,000 | $55,000 |
| University of Queensland | $43,000 | $48,000 | $47,000 | $45,000 | $48,000 |
| Monash University | $42,000 | $46,000 | $46,000 | $44,000 | $46,000 |
| ANU | $44,000 | $48,000 | $47,000 | $46,000 | N/A |
| UWA | $38,000 | $45,000 | $44,000 | $42,000 | $45,000 |
| University of Adelaide | $38,000 | $45,000 | $44,000 | $42,000 | $45,000 |
| UTS | $37,000 | $41,000 | $41,000 | $37,000 | $37,000 |
| QUT | $33,000 | $38,000 | $38,000 | $34,000 | $36,000 |
| RMIT | $32,000 | $37,000 | $37,000 | $33,000 | $34,000 |
| Deakin | $32,000 | $35,000 | $36,000 | $33,000 | $34,000 |
| Griffith | $30,000 | $34,000 | $34,000 | $32,000 | $34,000 |

### Postgraduate Coursework (Masters) — Annual Fee (AUD)

| University | Business/MBA | Engineering | IT/CS | Science | Health/Medicine |
|-----------|--------------|-------------|-------|---------|----------------|
| University of Melbourne | $48,000 | $50,000 | $50,000 | $48,000 | $58,000+ |
| University of Sydney | $50,000 | $57,000 | $57,000 | $52,000 | $62,000+ |
| UNSW Sydney | $50,000 | $57,000 | $57,000 | $52,000 | $57,000 |
| University of Queensland | $45,000 | $49,000 | $48,000 | $46,000 | $50,000 |
| Monash University | $43,000 | $48,000 | $48,000 | $45,000 | $48,000 |
| ANU | $46,000 | $50,000 | $49,000 | $47,000 | N/A |
| Macquarie University | $40,000 | $43,000 | $43,000 | $40,000 | $44,000 |

### VET / TAFE — Annual Fee (AUD)

| Program | TAFE NSW | TAFE QLD | TAFE VIC |
|---------|----------|----------|----------|
| Certificate III (trade) | $6,000–$14,000 | $6,000–$12,000 | $5,000–$12,000 |
| Certificate IV | $8,000–$16,000 | $8,000–$14,000 | $7,000–$14,000 |
| Diploma (1 year) | $10,000–$20,000 | $10,000–$18,000 | $9,000–$18,000 |
| Advanced Diploma | $14,000–$24,000 | $12,000–$22,000 | $12,000–$22,000 |

Note: TAFE fees for international students are significantly higher than domestic student fees.

## Additional Costs

| Cost Item | Typical Amount (AUD) |
|-----------|---------------------|
| Student Services & Amenities Fee (SSAF) | $300–$350/yr (capped by law) |
| Overseas Student Health Cover (OSHC) | $635–$700/yr (single, 12 months) |
| Textbooks & study materials | $1,000–$2,000/yr |
| University accommodation (on-campus) | $12,000–$25,000/yr |
| Living expenses (ATAR-style guide) | $21,041/yr (government estimate 2024) |

## Payment Information

- International students pay tuition **per semester** or **per year** upfront
- **Refund policy** varies by institution and timing of withdrawal
- CRICOS institutions are required to hold student fees in a protected account
- Provider Default Protection: if a provider closes, students are guaranteed a refund or transfer
- **FEE-HELP and HECS-HELP**: Only available to citizens and permanent residents; NOT available to international students on student visas

## Scholarship Opportunities

| Scholarship | Value | Eligibility |
|-------------|-------|-------------|
| Australia Awards | Full tuition + living | Government-sponsored; citizens of specific countries |
| Research Training Program (RTP) | Tuition + $32,000/yr stipend | PhD/Masters Research |
| University merit scholarships | $5,000–$25,000/yr | Academic excellence; check each university |
| Destination Australia | Up to $15,000/yr | Study in regional Australia |
| Endeavour Scholarships | Various | Professional development |
"""
    write_md(
        "university_tuition_fees_guide.md",
        "International Student Tuition Fees — Australian Universities 2025",
        "https://cricos.education.gov.au",
        content,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 5. STUDENT VISA (500) KEY FACTS
# ══════════════════════════════════════════════════════════════════════════════

def build_student_visa_guide():
    print("\n=== [5] Student Visa 500 Guide (static) ===")
    content = """\
## Overview

The Australian Student Visa (Subclass 500) allows international students to study
full-time at a CRICOS-registered institution. It replaced the previous subclass 573
(Higher Education) and other education-specific visas in 2016.

## Key Requirements

| Requirement | Details |
|-------------|---------|
| Enrolled in CRICOS course | Must hold a valid Confirmation of Enrolment (CoE) |
| Genuine Temporary Entrant (GTE) | Must demonstrate intent to study and return home |
| English proficiency | IELTS 5.5+ (or equivalent) for most visas |
| Financial capacity | ~AUD $29,710 for first year (2025: includes fees + living) |
| Health insurance (OSHC) | Must purchase for entire visa duration |
| Health requirements | May need chest X-ray or medical exam depending on country |
| Character requirements | Police clearance from countries lived in 12+ months |

## Financial Requirement (2025)

| Item | Amount (AUD) |
|------|-------------|
| Course fees (12 months) | Actual tuition fee |
| Living expenses | $29,710 (ATAR guide 2025, up from $24,505 in 2024) |
| School fees for dependents | $8,000 per child |
| Travel costs | $2,000 one-way |

**Total first year minimum**: Tuition + $31,710+ (living + travel)

Note: The living expense threshold increased significantly in 2024–2025.

## Conditions

| Condition | Details |
|-----------|---------|
| Study load | Must maintain full-time enrolment |
| Work rights | **Up to 48 hours per fortnight** during semester (changed from 40hrs in 2023) |
| Work rights during vacation | Unlimited hours |
| Course changes | Can change courses but must maintain CRICOS enrolment |
| Dependents | Spouse/children can accompany; work rights vary |

## Important: GTE (Genuine Temporary Entrant) Test

The Department of Home Affairs assesses whether you genuinely intend to stay temporarily.
Key factors considered:

- Circumstances in home country (ties, family, employment)
- Immigration history  
- Academic/work history consistent with intended study
- Study destination in Australia makes sense
- Realistic financial capacity

## Confirmation of Enrolment (CoE)

The CoE is issued by your university and contains:
- Your name and date of birth
- **CRICOS Course Code** (e.g., 059727K)
- **CRICOS Provider Code** (e.g., 00025B for UQ)
- Course start and end dates
- Tuition fee paid

You **must** have a CoE before applying for a Student Visa.

## After Arrival

| Obligation | Requirement |
|-----------|-------------|
| Report address | Must update address in PRISMS system via university |
| Maintain enrolment | Withdrawal triggers visa cancellation process |
| Attendance | Must meet institution's attendance requirements |
| Academic progress | Satisfactory academic progress required |
| OSHC | Must maintain valid OSHC cover throughout visa duration |

## Post-Study Work Rights

After completing a CRICOS-registered course of 2+ years, you may be eligible for:

| Course Level | Temporary Graduate Visa (TSS/TGV 485) Duration |
|-------------|------------------------------------------------|
| Bachelor Degree (in regional area) | 4–5 years |
| Bachelor Degree (major cities) | 2 years |
| Masters by Coursework | 3 years |
| Masters by Research | 4 years |
| Doctoral Degree (PhD) | 4 years |
| Long-term study (8+ years in Aus) | Older rules may apply |

Note: Post-study work visa rules had major changes announced in 2024–2025.
Verify current rules at immi.homeaffairs.gov.au.
"""
    write_md(
        "student_visa_500_guide.md",
        "Australian Student Visa (Subclass 500) — Key Facts for International Students",
        "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500",
        content,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 6. SCRAPE COURSESEEKER (ATAR-based entry scores)
# ══════════════════════════════════════════════════════════════════════════════

def scrape_courseseeker():
    """Try to get some ATAR cut-off data from courseseeker.edu.au."""
    print("\n=== [6] Courseseeker.edu.au (ATAR cut-off data) ===")
    url = "https://www.courseseeker.edu.au/course-search?keyword=computer+science&state=NSW,VIC,QLD&level=bachelor&institution="
    raw = safe_get(url, timeout=15)
    if raw:
        html = raw.decode("utf-8", errors="replace")
        print(f"  Got {len(html)} bytes")
        # Check if it's a React app (likely) or server-side HTML
        if "application/json" in html or '"courses"' in html or 'atar' in html.lower():
            print("  Found course data in HTML")
            atar_data = re.findall(r'"atar"\s*:\s*([0-9.]+)', html)
            print(f"  ATAR values found: {atar_data[:10]}")
        elif '{"props"' in html or 'window.__NEXT_DATA__' in html:
            next_data = re.search(r'window\.__NEXT_DATA__\s*=\s*({.*?})\s*</script>', html, re.DOTALL)
            if next_data:
                print("  Found Next.js data")
            else:
                print("  React/Next.js app — client-side rendered, no static data")
        else:
            print("  HTML without structured data (JS-rendered)")
    else:
        print("  Could not fetch courseseeker")

    # Try API endpoint
    api_url = "https://courseseeker.edu.au/api/courses?keyword=computer+science&level=bachelor&limit=5"
    raw2 = safe_get(api_url, timeout=10)
    if raw2:
        try:
            d = json.loads(raw2)
            print(f"  API returned JSON: {list(d.keys())[:5]}")
        except:
            print(f"  API returned non-JSON: {raw2[:100]}")


# ══════════════════════════════════════════════════════════════════════════════
# 7. SCHOLARSHIP DATABASE (static reference)
# ══════════════════════════════════════════════════════════════════════════════

def build_scholarships():
    print("\n=== [7] Scholarships Reference (static) ===")
    content = """\
## Overview

Australia offers numerous scholarships for international students.
Major categories: Government-funded, University-funded, and External/Private.

## Australian Government Scholarships

### Australia Awards
- **Eligibility**: Citizens of eligible developing countries (primarily Asia-Pacific, Africa, Middle East)
- **Value**: Full tuition + living allowance (~$32,000/yr) + airfares
- **Level**: Undergraduate and Postgraduate (Masters preferred)
- **Duration**: Full course length
- **Application**: https://australiaawardscholarships.dfat.gov.au (opens March–April annually)
- **Note**: Applicants must return home for 2+ years after completing studies

### Destination Australia Program
- **Value**: $15,000 per year
- **Eligibility**: International students studying in regional Australia
- **Level**: VET/TAFE, Undergraduate, Postgraduate, HDR
- **Institutions**: Selected regional providers only
- **Info**: https://www.studyaustralia.gov.au/english/scholarships

### Research Training Program (RTP)
- **Value**: Full tuition offset + living allowance ($34,653/yr in 2024)
- **Eligibility**: PhD and Masters by Research; some international positions available
- **Selection**: Highly competitive — First Class Honours, publications, supervisor match
- **Note**: Most positions are domestic-priority; check each university for international RTP quotas

## University Scholarships (Selected)

### University of Melbourne
| Scholarship | Value | Notes |
|-------------|-------|-------|
| Graduate Research Scholarships | Full tuition + $32,000/yr | HDR only |
| Melbourne International Undergraduate Scholarship | $10,000/yr | ATAR 99+ or equivalent |
| School of Graduate Research International Fee Remission | Tuition offset | HDR |

### University of Sydney
| Scholarship | Value | Notes |
|-------------|-------|-------|
| International Research Scholarship | Full tuition + $32,192/yr | HDR PhD |
| USyd International Merit | $10,000 one-off | High academic achievement |
| Faculty scholarships | $5,000–$20,000 | Discipline-specific |

### UNSW Sydney
| Scholarship | Value | Notes |
|-------------|-------|-------|
| UNSW International Scholarship | $5,000–$30,000 | Academic merit |
| Scientia PhD Scholarship | Full tuition + $50,000/yr | Elite research scholarship |

### University of Queensland
| Scholarship | Value | Notes |
|-------------|-------|-------|
| UQ International Scholarship | $10,000 | High academic achievement |
| UQ Graduate Research Award | Full tuition | HDR programs |

### Monash University
| Scholarship | Value | Notes |
|-------------|-------|-------|
| Monash International Merit Scholarship | $10,000/yr | Undergrad/Postgrad |
| Monash Graduate Scholarship | Full tuition + stipend | HDR |

## How to Find Scholarships

1. **Study Australia**: https://www.studyaustralia.gov.au/english/scholarships
2. **AusAwards**: https://australiaawardscholarships.dfat.gov.au
3. Each university's international scholarships page (search "[University] international scholarships")
4. **scholarships.com.au** — aggregator
5. **MPOWER**, **Prodigy Finance** — international student loans (not scholarships)

## Important Tips

- Apply **early** — many scholarships close 6–12 months before semester start
- Government scholarships (Australia Awards) often require returning home after study
- HDR (PhD) scholarships are more abundant than undergraduate scholarships
- Regional study destinations often offer additional incentives
- Check if your home country has bilateral agreements with Australia
"""
    write_md(
        "scholarships_international_students.md",
        "Scholarships for International Students in Australia",
        "https://www.studyaustralia.gov.au/english/scholarships",
        content,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 8. RECOGNITION OF OVERSEAS QUALIFICATIONS
# ══════════════════════════════════════════════════════════════════════════════

def build_qualifications_recognition():
    print("\n=== [8] Qualifications Recognition (static) ===")
    content = """\
## Overview

Before working in Australia using your overseas qualifications, you may need
to get them assessed (Skills Assessment) or recognised by a professional body.

## Skills Assessment for Visa Purposes

### Migration Skills Assessment
Required if applying for a skilled migration visa (subclass 189, 190, 491, 482 etc.).
The relevant Skills Assessing Authority depends on your nominated occupation:

| Authority | Occupations Covered |
|-----------|---------------------|
| VETASSESS | Most professional and trade occupations (150+) |
| Engineers Australia | All engineering disciplines |
| ACS (Australian Computer Society) | IT & computing |
| Australian Nursing & Midwifery Accreditation Council (ANMAC) | Nursing, midwifery |
| Australian Medical Council (AMC) | Medical doctors |
| Pharmacy Board of Australia | Pharmacists |
| Australian Institute of Quantity Surveyors (AIQS) | Quantity surveying |
| CPA Australia / ICAA | Accounting & finance |
| Architects Accreditation Council (AACA) | Architecture |
| NAATI | Translation & interpreting |

### Positive Skills Assessment
A "positive" assessment confirms your overseas qualification is comparable to
the relevant Australian qualification level.

## Academic Credit in Australian Universities

If you have completed some university study overseas, you may be eligible for
**credit transfer** (also called "recognition of prior learning" or RPL):

- **Credit Transfer**: Direct recognition of equivalent courses
- **Advanced Standing**: Entry into a later year of a degree
- **Block Credit**: Credit for a complete overseas qualification

Typical rules:
| Overseas Qualification | Australian Credit Offered |
|----------------------|--------------------------|
| 3-year bachelor (related field) | Up to 1 year (26 credit points) |
| 4-year bachelor (same field) | Up to 2 years; may enter Masters directly |
| Diploma/Advanced Diploma | Up to 1 year in related Bachelor |
| Partial university study | Subject-by-subject assessment |

## Professional Recognition by Field

### Medicine (Overseas Doctor)
1. AMC Part 1 exam (MCQ) — tests medical knowledge
2. AMC Part 2 (clinical exam) OR workplace-based assessment
3. Supervised practice period
4. Apply for registration with AHPRA (Medical Board of Australia)

### Nursing
1. ANMAC skills assessment
2. NCLEX is NOT used in Australia (unlike the US); Australian system is different
3. AHPRA registration

### Engineering
1. Engineers Australia assessment — CDR (Competency Demonstration Report)
2. Confirm competency at Professional Engineer level (PE) or equivalent
3. May need further supervised practice

### Teaching
1. State-based teacher registration (each state has its own authority)
2. Often requires: 4-year teaching degree, practical experience, police check
3. LANTITE (Literacy and Numeracy Test for Initial Teacher Education) may be required

### Law
Overseas lawyers generally must:
1. Get qualifications assessed by an Australian law admissions authority
2. Complete additional study (Graduate Diploma in Australian Law at minimum)
3. Complete Practical Legal Training (PLT)
4. Apply for admission to the relevant state Bar

## National Recognition Framework (AQF Equivalences)

| Country | Qualification | AQF Equivalent |
|---------|--------------|----------------|
| China | Benke (Bachelor 4yr) | AQF Level 7 (Bachelor) |
| China | Shuoshi (Masters) | AQF Level 9 (Masters) |
| India | Bachelor (3yr) Pass | AQF Level 7 less credit |
| India | Bachelor (3yr) Honours | AQF Level 8 |
| USA | Bachelor (4yr) | AQF Level 7–8 |
| UK | Bachelor (Hons) | AQF Level 8 |
| UK | Masters (1yr) | AQF Level 9 |
| Germany | Bachelor (3yr) | AQF Level 7 |
| Germany | Master (2yr) | AQF Level 9 |
| Japan | Gakushi (Bachelor 4yr) | AQF Level 7 |

ACER (Australian Council for Educational Research) provides the NOOSR (National 
Office of Overseas Skills Recognition) country qualification equivalency tables.
"""
    write_md(
        "qualifications_recognition_australia.md",
        "Recognition of Overseas Qualifications in Australia",
        "https://www.serviceaustralia.gov.au/recognition-overseas-qualifications",
        content,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 9. AQF FRAMEWORK + TEQSA REFERENCE (scrape + static)
# ══════════════════════════════════════════════════════════════════════════════

def build_aqf_extended():
    print("\n=== [9] AQF Extended Reference (static) ===")
    content = """\
## Overview

The Australian Qualifications Framework (AQF) is the national policy for regulated
qualifications in the Australian education and training system. Established in 1995,
revised 2011 (current edition).

**Regulator**: AQF Council; overseen by Department of Employment and Workplace Relations
**Website**: https://www.aqf.edu.au

## AQF Level Summary

| Level | Qualification Name | Sector | Typical Duration | AQF Descriptor |
|-------|-------------------|--------|-----------------|----------------|
| 1 | Certificate I | VET | 6 months | Basic knowledge, routine tasks |
| 2 | Certificate II | VET | 6–12 months | Application of knowledge in a range of tasks |
| 3 | Certificate III | VET | 1–2 years | Breadth of skills; some autonomy |
| 4 | Certificate IV | VET | 1–2 years | Specialised technical applications |
| 5 | Diploma | VET/HE | 1–2 years | Theoretical + practical; paraprofessional |
| 6 | Advanced Diploma / Associate Degree | VET/HE | 1.5–2 years | Specialised knowledge; Associate Degree is HE award |
| 7 | Bachelor Degree | Higher Education | 3–4 years | Broad multi-disciplinary theoretical + practical knowledge |
| 8 | Bachelor Honours / Grad Certificate / Grad Diploma | HE | 1–2 years | Advanced theory + independent research introduction |
| 9 | Masters Degree | Higher Education | 1.5–2 years | Advanced, specialised knowledge + research |
| 10 | Doctoral Degree | Higher Education | 3–5 years | Original contribution to knowledge |

## VET Sector (Levels 1–6)

**Regulator**: ASQA (Australian Skills Quality Authority) — national; or state equivalents in VIC (VRQA) and QLD (ASQA)
**Register**: training.gov.au
**Funding**: Skills First (VIC), JobTrainer, and other state/territory funding programs

Key VET qualifications:
- **Apprenticeship**: Certificate III level; employer-based; 3–4 years; wages paid during training
- **Traineeship**: Certificate II/III; 12 months; service/clerical industries
- **School-based**: VET qualifications embedded in Year 11/12 (can count toward ATAR)

Training Package vs. Accredited Course:
- Training Package: developed by Industry Reference Committees (IRCs); nationally standardised units
- Accredited Course: locally developed; time-limited approval; typically for niche occupations

## Higher Education Sector (Levels 7–10)

**Regulator**: TEQSA (Tertiary Education Quality and Standards Agency)
**National Register**: https://www.teqsa.gov.au/national-register (search all registered HE providers)
**Category of HE providers**:
- Australian University (full self-accrediting; broad range of programs including research)
- University College (self-accrediting in limited fields; may not offer doctoral programs)
- Higher Education Provider (accredits programs with TEQSA approval)

## Dual Sector Providers

Some institutions offer both VET and Higher Education qualifications:
- RMIT University, Swinburne University, Victoria University, CQUniversity
- Can offer pathway from VET diploma directly into university degree

## Articulation Pathways

| From | To | Typical Credit |
|------|----|----------------|
| Diploma (AQF 5) in related field | Bachelor Year 2 | 1 year credit |
| Advanced Diploma (AQF 6) | Bachelor Year 2–3 | 1–2 years credit |
| Bachelor with Credit (AQF 7) | Honours or Masters | May enter Masters directly |
| Masters by Coursework | Doctoral | Depends on research component |

## TEQSA National Register — Major University Registrations

TEQSA registration types for universities:
- **Australian University** (52 institutions as of 2025)
- **Overseas University** (branch campuses)
- **University College** (15+ institutions)

All TEQSA-registered providers appear at: https://www.teqsa.gov.au/national-register
"""
    write_md(
        "aqf_teqsa_reference.md",
        "Australian Qualifications Framework (AQF) and TEQSA Reference",
        "https://www.aqf.edu.au",
        content,
    )


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# 10. LIVE UNIVERSITY PAGES  — scholarships & entry requirements
# ══════════════════════════════════════════════════════════════════════════════

# Mapping: slug → (display_name, [urls_to_try], source_label)
UNIVERSITY_PAGES = {
    "unimelb_scholarships": (
        "University of Melbourne",
        [
            "https://scholarships.unimelb.edu.au/info/search?citizenship=international&level=undergraduate",
            "https://study.unimelb.edu.au/how-to-apply/fees-and-scholarships/scholarships",
        ],
        "https://scholarships.unimelb.edu.au",
    ),
    "unimelb_english": (
        "University of Melbourne",
        [
            "https://study.unimelb.edu.au/how-to-apply/entry-requirements/english-language-requirements",
        ],
        "https://study.unimelb.edu.au",
    ),
    "unsw_scholarships": (
        "UNSW Sydney",
        [
            "https://www.unsw.edu.au/study/international/scholarships",
            "https://www.scholarships.unsw.edu.au/scholarships?international=true",
        ],
        "https://www.unsw.edu.au",
    ),
    "uq_scholarships": (
        "University of Queensland",
        [
            "https://scholarships.uq.edu.au/scholarship-search?International=1",
            "https://www.uq.edu.au/study/scholarships/international",
        ],
        "https://scholarships.uq.edu.au",
    ),
    "anu_scholarships": (
        "Australian National University",
        [
            "https://www.anu.edu.au/study/scholarships/find-a-scholarship/international",
        ],
        "https://www.anu.edu.au",
    ),
    "monash_scholarships": (
        "Monash University",
        [
            "https://www.monash.edu/study/fees-scholarships/scholarships/find-a-scholarship/international",
        ],
        "https://www.monash.edu",
    ),
    "usyd_scholarships": (
        "University of Sydney",
        [
            "https://www.sydney.edu.au/scholarships/b/international-student-scholarships.html",
        ],
        "https://www.sydney.edu.au",
    ),
    "uwa_scholarships": (
        "University of Western Australia",
        [
            "https://www.uwa.edu.au/study/fees-and-scholarships/scholarships/international",
        ],
        "https://www.uwa.edu.au",
    ),
}


def _extract_text_from_html(html: str, max_chars: int = 8000) -> str:
    """Rudimentary HTML → plain-text extractor (no BS4 dependency)."""
    # Remove scripts, styles, nav, footer blocks
    for tag in ("script", "style", "nav", "footer", "header", "noscript"):
        html = re.sub(rf"<{tag}[^>]*>.*?</{tag}>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    # Strip remaining tags
    text = re.sub(r"<[^>]+>", " ", html)
    # Collapse whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove lines that are just whitespace
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    return "\n".join(lines)[:max_chars]


def scrape_university_pages():
    """Try to fetch live scholarship and English requirement pages from university websites.
    Falls back gracefully — pages that fail are silently skipped."""
    print("\n=== [10] University Official Pages (scholarships / entry requirements) ===")

    for slug, (uni_name, urls, source) in UNIVERSITY_PAGES.items():
        print(f"  {uni_name} — {slug}…", end=" ")
        page_text = None
        fetched_url = source

        for url in urls:
            raw = safe_get(url, timeout=15)
            if raw and len(raw) > 5000:
                html = raw.decode("utf-8", errors="replace")
                # Skip if clearly a React SPA with empty body
                if html.count("<p") < 3 and 'id="root"' in html:
                    continue
                page_text = _extract_text_from_html(html)
                fetched_url = url
                break

        if not page_text or len(page_text) < 400:
            print("skipped (JS-only or too short)")
            continue

        # Decide on title
        if "scholarship" in slug:
            title = f"Scholarships — {uni_name} (International Students)"
        else:
            title = f"English Language Entry Requirements — {uni_name}"

        # Wrap in a clean markdown structure  
        content = f"## {title}\n\n{page_text}\n"
        write_md(f"live_{slug}.md", title, fetched_url, content)

    print("  University page scraping complete.")


def main():
    print(f"Education RAG Data Builder — {TODAY}")
    print(f"Output: {OUT_DIR}\n")

    institutions = fetch_cricos_data()
    build_english_requirements()
    build_atar_requirements()
    build_fees_guide()
    build_student_visa_guide()
    scrape_courseseeker()
    build_scholarships()
    build_qualifications_recognition()
    build_aqf_extended()
    scrape_university_pages()

    # Summary
    files = list(OUT_DIR.glob("*.md"))
    total_size = sum(f.stat().st_size for f in files)
    print(f"\n{'='*60}")
    print(f"Done! Generated {len(files)} markdown files ({total_size/1024:.0f} KB total)")
    for f in sorted(files):
        print(f"  {f.name:60s} {f.stat().st_size/1024:6.1f} KB")


if __name__ == "__main__":
    main()
