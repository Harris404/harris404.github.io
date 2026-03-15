#!/usr/bin/env python3
"""
Test RAG retrieval quality for healthcare data
"""

import sys
import sqlite3
import json
from pathlib import Path

def test_rag_retrieval(db_path: str, test_queries: list[dict]):
    """Test RAG retrieval for given queries"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("🧪 RAG Retrieval Quality Test")
    print("=" * 70)
    
    # Get total stats
    cursor.execute("SELECT category, COUNT(*) FROM chunks GROUP BY category")
    stats = cursor.fetchall()
    print("\n📊 Database Statistics:")
    total_chunks = 0
    for category, count in stats:
        print(f"  {category}: {count:,} chunks")
        total_chunks += count
    print(f"  TOTAL: {total_chunks:,} chunks")
    
    # Test queries
    print("\n🔍 Testing Retrieval Quality")
    print("-" * 70)
    
    results = []
    for i, query in enumerate(test_queries, 1):
        print(f"\n{i}. Query: \"{query['text']}\"")
        print(f"   Expected Category: {query['expected_category']}")
        
        # Simple keyword-based retrieval (in production, use vector similarity)
        keywords = query['text'].lower().split()
        conditions = " OR ".join([f"content LIKE '%{kw}%'" for kw in keywords[:5]])
        
        sql = f"""
        SELECT id, category, substr(content, 1, 200) as preview
        FROM chunks
        WHERE {conditions}
        LIMIT 5
        """
        
        cursor.execute(sql)
        matches = cursor.fetchall()
        
        if matches:
            print(f"   ✅ Found {len(matches)} matches")
            for match in matches[:3]:
                chunk_id, category, preview = match
                print(f"      - [{category}] {preview[:100]}...")
            
            # Check if expected category is in top results
            categories_found = [m[1] for m in matches]
            if query['expected_category'] in categories_found:
                print(f"   ✅ Expected category found in results")
                results.append({'query': query['text'], 'status': 'PASS'})
            else:
                print(f"   ⚠️  Expected category NOT in top results")
                print(f"      Found: {categories_found}")
                results.append({'query': query['text'], 'status': 'PARTIAL'})
        else:
            print(f"   ❌ No matches found")
            results.append({'query': query['text'], 'status': 'FAIL'})
    
    # Summary
    print("\n\n📊 Test Summary")
    print("=" * 70)
    
    passed = sum(1 for r in results if r['status'] == 'PASS')
    partial = sum(1 for r in results if r['status'] == 'PARTIAL')
    failed = sum(1 for r in results if r['status'] == 'FAIL')
    
    accuracy = (passed / len(results)) * 100 if results else 0
    
    print(f"✅ PASS: {passed}/{len(results)}")
    print(f"⚠️  PARTIAL: {partial}/{len(results)}")
    print(f"❌ FAIL: {failed}/{len(results)}")
    print(f"📈 Accuracy: {accuracy:.1f}%")
    
    if accuracy >= 90:
        print("\n🎉 RAG retrieval quality target met (≥90%)")
        return 0
    else:
        print(f"\n⚠️  RAG retrieval quality below target ({accuracy:.1f}% < 90%)")
        print("   Note: This is a simple keyword test. Vector similarity would perform better.")
        return 1

if __name__ == "__main__":
    db_path = "data/processed/rag_database.db"
    
    if not Path(db_path).exists():
        print(f"❌ Error: Database not found at {db_path}")
        sys.exit(1)
    
    # Test queries covering different categories
    test_queries = [
        {
            "text": "Find hospitals in Sydney",
            "expected_category": "healthcare/facilities"
        },
        {
            "text": "Medical clinic near Melbourne",
            "expected_category": "healthcare/facilities"
        },
        {
            "text": "Emergency department Brisbane",
            "expected_category": "healthcare/facilities"
        },
        {
            "text": "How to apply for Medicare card",
            "expected_category": "government/medicare"
        },
        {
            "text": "Tax return lodgment deadline",
            "expected_category": "government/ato"
        },
        {
            "text": "Rental bond rules Victoria",
            "expected_category": "rental-laws/vic"
        },
        {
            "text": "Apply for visa to Australia",
            "expected_category": "government/visa"
        },
        {
            "text": "Minimum wage Australia",
            "expected_category": "government/fair-work"
        },
    ]
    
    sys.exit(test_rag_retrieval(db_path, test_queries))
