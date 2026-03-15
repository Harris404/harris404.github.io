#!/usr/bin/env python3
"""
RAG Data Freshness Auditor
Checks all RAG source files and processed chunks for data staleness.
Flags content that is overdue for updates based on category-specific schedules.

Update schedules:
- government/*: quarterly (90 days)
- rental-laws/*: semi-annually (180 days)  
- healthcare: semi-annually (180 days)
- finance: annually (365 days)
- education: annually (365 days)
- consumer: semi-annually (180 days)
- transport: quarterly (90 days)
- living: annually (365 days)
"""

import os
import re
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

# Category-specific staleness thresholds (in days)
FRESHNESS_THRESHOLDS = {
    'government/ato': 90,
    'government/medicare': 90,
    'government/centrelink': 90,
    'government/fair-work': 90,
    'government/housing': 90,
    'government/banking': 90,
    'government/licensing': 90,
    'government/visa': 90,
    'rental-laws': 180,
    'healthcare': 180,
    'finance': 365,
    'education': 365,
    'consumer': 180,
    'transport': 90,
    'living': 365,
}

def get_threshold(category: str) -> int:
    """Get freshness threshold for a category, checking prefix matches."""
    for prefix, days in FRESHNESS_THRESHOLDS.items():
        if category.startswith(prefix):
            return days
    return 365  # default: 1 year


def parse_date(date_str: str) -> datetime | None:
    """Parse various date formats from source files."""
    date_str = date_str.strip()
    formats = [
        '%d %B %Y',        # "28 February 2026"
        '%d %b %Y',        # "28 Feb 2026"
        '%Y-%m-%d',        # "2026-02-28"
        '%B %Y',           # "March 2026"
        '%d/%m/%Y',        # "28/02/2026"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def audit_source_files(source_dir: Path) -> List[Dict]:
    """Audit all source markdown files for freshness."""
    results = []
    now = datetime.now()
    
    for md_file in sorted(source_dir.rglob('*.md')):
        rel_path = md_file.relative_to(source_dir)
        category_parts = list(rel_path.parts[:-1])
        category = '/'.join(category_parts) if category_parts else 'general'
        
        try:
            content = md_file.read_text(encoding='utf-8')
        except Exception:
            results.append({
                'file': str(rel_path),
                'category': category,
                'status': 'ERROR',
                'message': 'Cannot read file'
            })
            continue

        # Extract last_updated date
        date_match = re.search(r'\*\*Last Updated\*\*:\s*(.+?)(?:\n|$)', content)
        if not date_match:
            results.append({
                'file': str(rel_path),
                'category': category, 
                'status': 'WARNING',
                'message': 'No Last Updated date found',
                'last_updated': None,
                'days_old': None
            })
            continue
        
        date_str = date_match.group(1).strip()
        updated_date = parse_date(date_str)
        
        if not updated_date:
            results.append({
                'file': str(rel_path),
                'category': category,
                'status': 'WARNING', 
                'message': f'Cannot parse date: "{date_str}"',
                'last_updated': date_str,
                'days_old': None
            })
            continue
        
        days_old = (now - updated_date).days
        threshold = get_threshold(category)
        
        if days_old > threshold:
            status = 'STALE'
            message = f'Overdue by {days_old - threshold} days (threshold: {threshold}d)'
        elif days_old > threshold * 0.8:
            status = 'EXPIRING_SOON'
            message = f'Will expire in {threshold - days_old} days'
        else:
            status = 'FRESH'
            message = f'{threshold - days_old} days until expiry'
        
        results.append({
            'file': str(rel_path),
            'category': category,
            'status': status,
            'message': message,
            'last_updated': date_str,
            'days_old': days_old,
            'threshold_days': threshold
        })
    
    return results


def audit_chunks(chunks_file: Path) -> Dict:
    """Audit processed chunks for freshness metadata."""
    if not chunks_file.exists():
        return {'error': 'Chunks file not found'}
    
    now = datetime.now()
    category_dates = {}
    missing_dates = 0
    total = 0
    
    with open(chunks_file, 'r', encoding='utf-8') as f:
        for line in f:
            total += 1
            chunk = json.loads(line)
            meta = chunk.get('metadata', {})
            category = meta.get('category', 'unknown')
            date_str = meta.get('last_updated', '')
            
            if category not in category_dates:
                category_dates[category] = {'dates': set(), 'count': 0, 'missing': 0}
            
            category_dates[category]['count'] += 1
            
            if date_str:
                category_dates[category]['dates'].add(date_str)
            else:
                category_dates[category]['missing'] += 1
                missing_dates += 1
    
    # Analyze each category
    summary = {}
    for cat, info in sorted(category_dates.items()):
        threshold = get_threshold(cat)
        oldest = None
        newest = None
        for d in info['dates']:
            parsed = parse_date(d)
            if parsed:
                if oldest is None or parsed < oldest:
                    oldest = parsed
                if newest is None or parsed > newest:
                    newest = parsed
        
        days_since_oldest = (now - oldest).days if oldest else None
        is_stale = days_since_oldest is not None and days_since_oldest > threshold
        
        summary[cat] = {
            'chunks': info['count'],
            'missing_dates': info['missing'],
            'oldest_date': oldest.strftime('%Y-%m-%d') if oldest else None,
            'newest_date': newest.strftime('%Y-%m-%d') if newest else None,
            'days_since_oldest': days_since_oldest,
            'threshold_days': threshold,
            'is_stale': is_stale
        }
    
    return {
        'total_chunks': total,
        'chunks_missing_dates': missing_dates,
        'categories': summary
    }


def generate_report(source_results: List[Dict], chunk_audit: Dict) -> str:
    """Generate a human-readable freshness report."""
    lines = []
    lines.append("=" * 70)
    lines.append("RAG DATA FRESHNESS AUDIT REPORT")
    lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("=" * 70)
    
    # Source file summary
    stale = [r for r in source_results if r['status'] == 'STALE']
    expiring = [r for r in source_results if r['status'] == 'EXPIRING_SOON']
    fresh = [r for r in source_results if r['status'] == 'FRESH']
    warnings = [r for r in source_results if r['status'] == 'WARNING']
    errors = [r for r in source_results if r['status'] == 'ERROR']
    
    lines.append(f"\n📊 SOURCE FILES SUMMARY")
    lines.append(f"   Total files: {len(source_results)}")
    lines.append(f"   ✅ Fresh: {len(fresh)}")
    lines.append(f"   ⚠️  Expiring soon: {len(expiring)}")
    lines.append(f"   ❌ Stale: {len(stale)}")
    lines.append(f"   ⚡ Warnings: {len(warnings)}")
    if errors:
        lines.append(f"   🚫 Errors: {len(errors)}")
    
    if stale:
        lines.append(f"\n🔴 STALE FILES (need immediate update):")
        for r in sorted(stale, key=lambda x: -(x.get('days_old') or 0)):
            lines.append(f"   {r['file']}")
            lines.append(f"      Last updated: {r['last_updated']} ({r['days_old']}d ago)")
            lines.append(f"      {r['message']}")
    
    if expiring:
        lines.append(f"\n🟡 EXPIRING SOON:")
        for r in sorted(expiring, key=lambda x: x.get('days_old') or 0, reverse=True):
            lines.append(f"   {r['file']}")
            lines.append(f"      Last updated: {r['last_updated']} ({r['days_old']}d ago)")
            lines.append(f"      {r['message']}")
    
    if warnings:
        lines.append(f"\n⚠️  WARNINGS:")
        for r in warnings:
            lines.append(f"   {r['file']}: {r['message']}")
    
    # Chunk audit summary
    if 'categories' in chunk_audit:
        lines.append(f"\n📦 PROCESSED CHUNKS SUMMARY")
        lines.append(f"   Total chunks: {chunk_audit['total_chunks']}")
        lines.append(f"   Chunks missing dates: {chunk_audit['chunks_missing_dates']}")
        
        stale_cats = {k: v for k, v in chunk_audit['categories'].items() if v.get('is_stale')}
        if stale_cats:
            lines.append(f"\n   Stale categories:")
            for cat, info in sorted(stale_cats.items()):
                lines.append(f"   ❌ {cat}: {info['chunks']} chunks, "
                           f"oldest from {info['oldest_date']} "
                           f"({info['days_since_oldest']}d ago, threshold: {info['threshold_days']}d)")
    
    lines.append("\n" + "=" * 70)
    return '\n'.join(lines)


def generate_freshness_metadata(source_dir: Path, output_file: Path):
    """Generate a freshness metadata JSON file for use by the API."""
    results = audit_source_files(source_dir)
    now = datetime.now()
    
    # Build category-level freshness info
    category_freshness = {}
    for r in results:
        cat = r['category']
        if cat not in category_freshness:
            category_freshness[cat] = {
                'total_files': 0,
                'stale_files': 0,
                'oldest_update': None,
                'newest_update': None,
                'threshold_days': get_threshold(cat)
            }
        
        info = category_freshness[cat]
        info['total_files'] += 1
        
        if r['status'] == 'STALE':
            info['stale_files'] += 1
        
        if r.get('last_updated'):
            parsed = parse_date(r['last_updated'])
            if parsed:
                date_str = parsed.strftime('%Y-%m-%d')
                if info['oldest_update'] is None or date_str < info['oldest_update']:
                    info['oldest_update'] = date_str
                if info['newest_update'] is None or date_str > info['newest_update']:
                    info['newest_update'] = date_str
    
    # Add staleness flag
    for cat, info in category_freshness.items():
        if info['oldest_update']:
            oldest = datetime.strptime(info['oldest_update'], '%Y-%m-%d')
            days_old = (now - oldest).days
            info['days_since_oldest'] = days_old
            info['is_stale'] = days_old > info['threshold_days']
        else:
            info['days_since_oldest'] = None
            info['is_stale'] = False
    
    output = {
        'generated_at': now.isoformat(),
        'categories': category_freshness
    }
    
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    return output


if __name__ == '__main__':
    project_root = Path(__file__).parent.parent
    source_dir = project_root / 'data' / 'rag-sources'
    chunks_file = project_root / 'data' / 'processed' / 'rag_chunks.jsonl'
    freshness_output = project_root / 'data' / 'processed' / 'freshness_metadata.json'
    
    print("🔍 Running RAG Data Freshness Audit...\n")
    
    # Audit source files
    source_results = audit_source_files(source_dir)
    
    # Audit processed chunks
    chunk_audit = audit_chunks(chunks_file)
    
    # Generate report
    report = generate_report(source_results, chunk_audit)
    print(report)
    
    # Generate freshness metadata for API
    metadata = generate_freshness_metadata(source_dir, freshness_output)
    print(f"\n📄 Freshness metadata saved to: {freshness_output}")
    
    # Exit with non-zero code if stale data found
    stale_count = sum(1 for r in source_results if r['status'] == 'STALE')
    if stale_count > 0:
        print(f"\n⚠️  {stale_count} stale files found! Consider updating them.")
        exit(1)
    else:
        print("\n✅ All data is within freshness thresholds.")
        exit(0)
