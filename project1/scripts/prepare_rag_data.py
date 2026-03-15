#!/usr/bin/env python3
"""
RAG Data Preparation Script
Converts Markdown documentation to JSON chunks for embedding generation.

Processing strategy:
1. Parse markdown files with metadata extraction
2. Chunk by sections (## headers) for semantic coherence
3. Split large sections into 512-token chunks with overlap
4. Generate metadata (source, category, topic, url, date)
5. Output JSON format ready for embedding
"""

import os
import re
import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime


class MarkdownChunker:
    """Chunks markdown documents into semantically coherent pieces."""
    
    def __init__(self, max_tokens: int = 512, overlap_tokens: int = 80):
        """
        Initialize chunker.
        
        Args:
            max_tokens: Maximum tokens per chunk (approximate)
            overlap_tokens: Overlap tokens between chunks for context continuity
        """
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        # Will estimate chars dynamically based on content
        self.max_chars = max_tokens * 4   # default for English
        self.overlap_chars = overlap_tokens * 4
        
    def _estimate_chars_limit(self, text: str) -> tuple:
        """
        Estimate max chars and overlap chars based on the CJK content ratio.
        CJK characters are ~2-3 tokens each vs ~0.25 tokens per English char.
        """
        if not text:
            return self.max_chars, self.overlap_chars
        sample = text[:2000]
        cjk_count = sum(1 for c in sample if '\u4e00' <= c <= '\u9fff' or '\u3000' <= c <= '\u303f')
        cjk_ratio = cjk_count / max(len(sample), 1)
        # For pure CJK: ~1.5 chars/token; for pure English: ~4 chars/token
        chars_per_token = 4.0 - (cjk_ratio * 2.5)
        max_c = int(self.max_tokens * chars_per_token)
        overlap_c = int(self.overlap_tokens * chars_per_token)
        return max_c, overlap_c

    def extract_metadata(self, content: str) -> Dict[str, str]:
        """
        Extract metadata from markdown frontmatter.

        Expected format:
        **Source**: https://...
        **Topic**: Category - Subcategory
        **Last Updated**: DD Month YYYY   (or **Last fetched**: YYYY-MM-DD)
        """
        metadata = {
            'source': '',
            'topic': '',
            'category': '',
            'last_updated': '',
            'source_authority': 'other',  # 'gov' | 'edu' | 'other'
        }

        # Extract source URL
        source_match = re.search(r'\*\*Source\*\*:\s*(.+?)(?:\n|$)', content)
        if source_match:
            metadata['source'] = source_match.group(1).strip()

        # Extract topic
        topic_match = re.search(r'\*\*Topic\*\*:\s*(.+?)(?:\n|$)', content)
        if topic_match:
            metadata['topic'] = topic_match.group(1).strip()
            if ' - ' in metadata['topic']:
                metadata['category'] = metadata['topic'].split(' - ')[0].strip()

        # Accept both "Last Updated" and "Last fetched" field names
        date_match = re.search(
            r'\*\*(?:Last Updated|Last fetched|Last Fetched|Updated)\*\*:\s*(.+?)(?:\n|$)',
            content,
        )
        if date_match:
            metadata['last_updated'] = date_match.group(1).strip()

        # Source authority: gov > edu > other
        url = metadata['source']
        if re.search(
            r'\.gov\.au|data\.gov\.au|immi\.homeaffairs|ato\.gov|tga\.gov|abs\.gov|cricos\.education',
            url,
        ):
            metadata['source_authority'] = 'gov'
        elif re.search(r'\.edu\.au|handbook\.|study\.|scholarships\.', url):
            metadata['source_authority'] = 'edu'
        # else stays 'other'

        return metadata
    
    def extract_title(self, content: str) -> str:
        """Extract document title (first # header)."""
        title_match = re.search(r'^#\s+(.+?)$', content, re.MULTILINE)
        return title_match.group(1).strip() if title_match else 'Untitled'
    
    def split_into_sections(self, content: str) -> List[Dict[str, str]]:
        """
        Split markdown into sections by ## headers.
        
        Returns list of dicts with 'heading' and 'content' keys.
        """
        # Remove metadata block (first few lines with ** markers)
        content_start = 0
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('---') and i > 0:
                content_start = i + 1
                break
            if i > 10:  # Stop searching after first 10 lines
                break
        
        if content_start > 0:
            content = '\n'.join(lines[content_start:])
        
        # Split by ## headers (but not # or ###)
        sections = []
        current_section = {'heading': 'Overview', 'content': ''}
        
        for line in content.split('\n'):
            # Check for ## header (not # or ###)
            if re.match(r'^##\s+[^#]', line):
                # Save previous section if has content
                if current_section['content'].strip():
                    sections.append(current_section)
                
                # Start new section
                heading = re.sub(r'^##\s+', '', line).strip()
                current_section = {'heading': heading, 'content': ''}
            else:
                current_section['content'] += line + '\n'
        
        # Add final section
        if current_section['content'].strip():
            sections.append(current_section)
        
        return sections
    
    def chunk_large_section(self, text: str, heading: str) -> List[str]:
        """
        Chunk large section into smaller pieces with overlap.
        
        Args:
            text: Section text to chunk
            heading: Section heading (prepended to each chunk)
            
        Returns:
            List of text chunks with heading prepended
        """
        max_chars, overlap_chars = self._estimate_chars_limit(text)
        
        # If section fits in one chunk, return as-is
        if len(text) <= max_chars:
            return [f"## {heading}\n\n{text}"]
        
        chunks = []
        start = 0
        chunk_num = 1
        
        while start < len(text):
            # Extract chunk with overlap
            end = start + max_chars
            
            # Try to break at sentence boundary
            if end < len(text):
                # Look for period + space within last 200 chars
                search_start = max(start, end - 200)
                sentence_end = text.rfind('. ', search_start, end)
                if sentence_end > start:
                    end = sentence_end + 1
            
            chunk_text = text[start:end].strip()
            
            # Add heading with part number if multiple chunks
            if len(text) > max_chars:
                chunk_content = f"## {heading} (Part {chunk_num})\n\n{chunk_text}"
            else:
                chunk_content = f"## {heading}\n\n{chunk_text}"
            
            chunks.append(chunk_content)
            
            # Move start position with overlap
            start = end - overlap_chars
            chunk_num += 1
            
            # Safety check: prevent infinite loop
            if chunk_num > 20:
                print(f"Warning: Section '{heading}' produced {chunk_num} chunks, stopping.")
                break
        
        return chunks
    
    def process_file(self, filepath: Path, category: str) -> List[Dict[str, Any]]:
        """
        Process single markdown file into chunks.
        
        Args:
            filepath: Path to markdown file
            category: Category name (e.g., 'government/medicare', 'rental-laws/nsw')
            
        Returns:
            List of chunk dicts with content and metadata
        """
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            return []
        
        # Extract metadata
        metadata = self.extract_metadata(content)
        title = self.extract_title(content)
        
        # Split into sections
        sections = self.split_into_sections(content)
        
        # Process each section
        chunks = []
        for section in sections:
            heading = section['heading']
            text = section['content'].strip()
            
            # Skip empty sections
            if not text:
                continue
            
            # Chunk if too large
            section_chunks = self.chunk_large_section(text, heading)
            
            for i, chunk_text in enumerate(section_chunks):
                chunk_id = f"{category.replace('/', '_')}_{filepath.stem}_s{len(chunks)+1}"
                
                chunk_data = {
                    'id': chunk_id,
                    'content': chunk_text,
                    'metadata': {
                        'source_file': filepath.name,
                        'title': title,
                        'section': heading,
                        'category': category,
                        'subcategory': metadata.get('topic', ''),
                        'source_url': metadata.get('source', ''),
                        'last_updated': metadata.get('last_updated', ''),
                        'source_authority': metadata.get('source_authority', 'other'),
                        'chunk_index': len(chunks) + 1,
                        'total_chunks': None  # Will be set later
                    }
                }
                
                chunks.append(chunk_data)
        
        # Update total_chunks for all chunks from this file
        for chunk in chunks:
            chunk['metadata']['total_chunks'] = len(chunks)
        
        return chunks


def process_all_files(source_dir: Path, output_dir: Path):
    """
    Process all markdown files in source directory.
    
    Args:
        source_dir: Root directory containing markdown files
        output_dir: Directory to write JSON output
    """
    chunker = MarkdownChunker(max_tokens=512, overlap_tokens=50)
    
    # Find all markdown files
    md_files = list(source_dir.rglob('*.md'))
    print(f"Found {len(md_files)} markdown files to process")
    
    all_chunks = []
    stats = {
        'total_files': len(md_files),
        'total_chunks': 0,
        'by_category': {}
    }
    
    for filepath in sorted(md_files):
        # Determine category from path
        rel_path = filepath.relative_to(source_dir)
        category_parts = list(rel_path.parts[:-1])  # Exclude filename
        category = '/'.join(category_parts) if category_parts else 'general'
        
        print(f"Processing: {rel_path} (category: {category})")
        
        # Process file
        chunks = chunker.process_file(filepath, category)
        
        # Update stats
        stats['total_chunks'] += len(chunks)
        if category not in stats['by_category']:
            stats['by_category'][category] = {'files': 0, 'chunks': 0}
        stats['by_category'][category]['files'] += 1
        stats['by_category'][category]['chunks'] += len(chunks)
        
        all_chunks.extend(chunks)
        
        print(f"  → Generated {len(chunks)} chunks")
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Write all chunks to single JSONL file (one JSON object per line)
    output_file = output_dir / 'rag_chunks.jsonl'
    with open(output_file, 'w', encoding='utf-8') as f:
        for chunk in all_chunks:
            f.write(json.dumps(chunk, ensure_ascii=False) + '\n')
    
    print(f"\n✅ Processing complete!")
    print(f"   Total files processed: {stats['total_files']}")
    print(f"   Total chunks generated: {stats['total_chunks']}")
    print(f"   Output file: {output_file}")
    print(f"   File size: {output_file.stat().st_size / 1024:.1f} KB")
    
    # Write stats summary
    stats_file = output_dir / 'processing_stats.json'
    stats['processing_date'] = datetime.now().isoformat()
    stats['output_file'] = str(output_file)
    with open(stats_file, 'w', encoding='utf-8') as f:
        f.write(json.dumps(stats, indent=2, ensure_ascii=False))
    
    print(f"\n📊 Statistics by category:")
    for category, cat_stats in sorted(stats['by_category'].items()):
        print(f"   {category}: {cat_stats['files']} files → {cat_stats['chunks']} chunks")
    
    return all_chunks, stats


if __name__ == '__main__':
    # Define paths
    project_root = Path(__file__).parent.parent  # Go up from scripts/ to project root
    source_dir = project_root / 'data' / 'rag-sources'
    output_dir = project_root / 'data' / 'processed'
    
    print("🔄 RAG Data Preparation")
    print(f"   Source: {source_dir}")
    print(f"   Output: {output_dir}")
    print()
    
    # Process all files
    chunks, stats = process_all_files(source_dir, output_dir)
    
    print(f"\n✨ Ready for embedding generation!")
    print(f"   Load chunks from: {output_dir / 'rag_chunks.jsonl'}")
    print(f"   Each line is a JSON object with 'id', 'content', and 'metadata'")
