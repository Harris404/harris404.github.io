#!/usr/bin/env python3
"""
Process HealthDirect NHSD 2025 dataset and add to RAG database.

This script:
1. Loads the HealthDirect NHSD JSON file from AURIN
2. Extracts healthcare facility information
3. Chunks facilities into semantically coherent groups
4. Generates embeddings using BGE-base-en-v1.5
5. Adds to existing RAG database

Expected Input:
- AURIN HealthDirect NHSD 2025 dataset (JSON format)
- ~15,000 healthcare facilities
- ~10MB file size

Usage:
    python3 scripts/process_healthdirect.py /path/to/healthdirect_nhsd_2025.json
"""

import json
import sqlite3
import sys
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
except ImportError:
    print("❌ Missing dependencies. Install with:")
    print("   pip3 install sentence-transformers numpy")
    sys.exit(1)


class HealthDirectProcessor:
    """Process HealthDirect NHSD dataset for RAG."""
    
    def __init__(self, json_path: Path):
        """Initialize processor with JSON file path."""
        self.json_path = json_path
        self.facilities = []
        self.chunks = []
    
    def load_data(self):
        """Load HealthDirect JSON data (GeoJSON format)."""
        print(f"📂 Loading HealthDirect data from: {self.json_path}")
        
        try:
            with open(self.json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Handle GeoJSON format from AURIN
            if isinstance(data, dict) and 'features' in data:
                self.facilities = data['features']
                print(f"✅ Loaded {len(self.facilities)} facilities (GeoJSON format)")
            elif isinstance(data, list):
                self.facilities = data
                print(f"✅ Loaded {len(self.facilities)} facilities (Array format)")
            elif isinstance(data, dict):
                # Check common top-level keys
                if 'facilities' in data:
                    self.facilities = data['facilities']
                elif 'services' in data:
                    self.facilities = data['services']
                elif 'data' in data:
                    self.facilities = data['data']
                else:
                    # Assume the dict values are the facilities
                    self.facilities = list(data.values())
                print(f"✅ Loaded {len(self.facilities)} facilities")
            
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing JSON: {e}")
            sys.exit(1)
        except FileNotFoundError:
            print(f"❌ File not found: {self.json_path}")
            sys.exit(1)
    def extract_facility_info(self, feature: Dict[str, Any]) -> Dict[str, str]:
        """Extract relevant information from a GeoJSON feature record."""
        # For GeoJSON format, data is in 'properties'
        if 'properties' in feature:
            facility = feature['properties']
        else:
            facility = feature
        
        # Common field names across different NHSD formats
        name_fields = ['organization', 'name', 'serviceName', 'service_name', 'facilityName', 'facility_name']
        address_fields = ['address', 'serviceAddress', 'service_address', 'location']
        suburb_fields = ['city', 'suburb', 'locality']
        state_fields = ['state', 'stateTerritory', 'state_territory']
        postcode_fields = ['postcode', 'postalCode', 'postal_code']
        phone_fields = ['phone', 'phoneNumber', 'phone_number', 'contact']
        service_fields = ['services', 'serviceType', 'service_type', 'serviceTypes', 'service_types']
        description_fields = ['description', 'serviceDescription', 'service_description']
        
        def get_field(obj, field_names):
            """Get first matching field from object."""
            if not isinstance(obj, dict):
                return ''
            for field in field_names:
                if field in obj and obj[field] is not None and obj[field] != '':
                    return str(obj[field])
            return ''
        
        # Extract opening hours from individual day fields
        hours_list = []
        for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']:
            day_hours = get_field(facility, [f'{day}_open_hours'])
            if day_hours:
                hours_list.append(f"{day.capitalize()}: {day_hours}")
        hours = "; ".join(hours_list) if hours_list else ''
        
        return {
            'name': get_field(facility, name_fields),
            'address': get_field(facility, address_fields),
            'suburb': get_field(facility, suburb_fields),
            'state': get_field(facility, state_fields),
            'postcode': get_field(facility, postcode_fields),
            'phone': get_field(facility, phone_fields),
            'services': get_field(facility, service_fields),
            'description': get_field(facility, description_fields),
            'hours': hours
        }
    
    def chunk_facilities(self, group_size: int = 5):
        """
        Chunk facilities into groups for RAG.
        
        Strategy: Group facilities by state and service type to create
        semantically coherent chunks that can answer queries like
        "Find GPs in Sydney" or "Emergency services in Melbourne".
        """
        print(f"📦 Chunking {len(self.facilities)} facilities...")
        
        # Group facilities by state
        by_state = {}
        for facility in self.facilities:
            info = self.extract_facility_info(facility)
            state = info['state'] or 'Unknown'
            
            if state not in by_state:
                by_state[state] = []
            
            by_state[state].append(info)
        
        print(f"   Found facilities in {len(by_state)} states/territories")
        
        # Create chunks by state (group every N facilities)
        chunk_id = 1
        for state, state_facilities in by_state.items():
            print(f"   {state}: {len(state_facilities)} facilities")
            
            # Group facilities in chunks of group_size
            for i in range(0, len(state_facilities), group_size):
                group = state_facilities[i:i+group_size]
                
                # Create chunk content
                content_lines = [f"# Healthcare Facilities in {state}\n"]
                
                for fac in group:
                    if not fac['name']:
                        continue
                    
                    content_lines.append(f"## {fac['name']}")
                    
                    if fac['address']:
                        full_address = fac['address']
                        if fac['suburb']:
                            full_address += f", {fac['suburb']}"
                        if fac['state']:
                            full_address += f", {fac['state']}"
                        if fac['postcode']:
                            full_address += f" {fac['postcode']}"
                        content_lines.append(f"**Address**: {full_address}")
                    
                    if fac['phone']:
                        content_lines.append(f"**Phone**: {fac['phone']}")
                    
                    if fac['services']:
                        content_lines.append(f"**Services**: {fac['services']}")
                    
                    if fac['description']:
                        content_lines.append(f"**Description**: {fac['description']}")
                    
                    if fac['hours']:
                        content_lines.append(f"**Hours**: {fac['hours']}")
                    
                    content_lines.append("")  # Blank line between facilities
                
                chunk_content = "\n".join(content_lines)
                
                # Create chunk metadata
                chunk_data = {
                    'id': f'healthdirect_nhsd_{state.lower().replace(" ", "_")}_{chunk_id}',
                    'content': chunk_content,
                    'metadata': {
                        'source_file': 'healthdirect_nhsd_2025.json',
                        'title': f'Healthcare Facilities in {state}',
                        'section': f'Facilities {i+1}-{min(i+group_size, len(state_facilities))}',
                        'category': 'healthcare/facilities',
                        'subcategory': f'Healthcare - {state}',
                        'source_url': 'https://www.healthdirect.gov.au/',
                        'last_updated': datetime.now().strftime('%Y-%m-%d'),
                        'chunk_index': chunk_id,
                        'total_chunks': (len(state_facilities) + group_size - 1) // group_size,
                        'facility_count': len(group),
                        'state': state
                    }
                }
                
                self.chunks.append(chunk_data)
                chunk_id += 1
        
        print(f"✅ Created {len(self.chunks)} chunks")
    
    def generate_embeddings(self, model_name: str = "BAAI/bge-base-en-v1.5") -> np.ndarray:
        """Generate embeddings for all chunks."""
        print(f"🔮 Generating embeddings using {model_name}...")
        
        model = SentenceTransformer(model_name)
        texts = [chunk['content'] for chunk in self.chunks]
        
        embeddings = model.encode(
            texts,
            batch_size=32,
            normalize_embeddings=True,
            show_progress_bar=True
        )
        
        print(f"✅ Generated {len(embeddings)} embeddings")
        return embeddings
    
    def add_to_database(self, db_path: Path, embeddings: np.ndarray):
        """Add chunks and embeddings to existing RAG database."""
        print(f"💾 Adding to database: {db_path}")
        
        if not db_path.exists():
            print(f"❌ Database not found: {db_path}")
            print("   Run generate_embeddings.py first to create the database")
            sys.exit(1)
        
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Get current max rowid for VSS table (if it exists)
        try:
            cursor.execute("SELECT MAX(rowid) FROM vss_chunks")
            max_rowid = cursor.fetchone()[0] or 0
        except sqlite3.OperationalError:
            max_rowid = 0
            print("   No VSS table found, skipping vector index")
        
        # Insert chunks
        inserted = 0
        for i, chunk in enumerate(self.chunks):
            metadata = chunk.get('metadata', {})
            
            try:
                # Insert chunk metadata
                cursor.execute("""
                    INSERT OR REPLACE INTO chunks (
                        id, content, source_file, title, section,
                        category, subcategory, source_url, last_updated,
                        chunk_index, total_chunks
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    chunk['id'],
                    chunk['content'],
                    metadata.get('source_file', ''),
                    metadata.get('title', ''),
                    metadata.get('section', ''),
                    metadata.get('category', ''),
                    metadata.get('subcategory', ''),
                    metadata.get('source_url', ''),
                    metadata.get('last_updated', ''),
                    metadata.get('chunk_index', 0),
                    metadata.get('total_chunks', 0)
                ))
                
                # Insert embedding as BLOB
                embedding_blob = embeddings[i].astype(np.float32).tobytes()
                cursor.execute("""
                    INSERT OR REPLACE INTO embeddings (chunk_id, embedding)
                    VALUES (?, ?)
                """, (chunk['id'], embedding_blob))
                
                # Insert into VSS table if available
                if max_rowid >= 0:
                    try:
                        cursor.execute("""
                            INSERT OR REPLACE INTO vss_chunks (rowid, embedding)
                            VALUES (?, ?)
                        """, (max_rowid + i + 1, embedding_blob))
                    except sqlite3.OperationalError:
                        pass  # VSS table doesn't exist
                
                inserted += 1
                
            except sqlite3.Error as e:
                print(f"   Warning: Failed to insert chunk {chunk['id']}: {e}")
        
        conn.commit()
        conn.close()
        
        print(f"✅ Inserted {inserted} chunks into database")
    
    def save_jsonl(self, output_path: Path):
        """Save chunks to JSONL file for backup."""
        print(f"💾 Saving chunks to: {output_path}")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            for chunk in self.chunks:
                f.write(json.dumps(chunk, ensure_ascii=False) + '\n')
        
        print(f"✅ Saved {len(self.chunks)} chunks to JSONL")


def main():
    """Main execution flow."""
    print("🏥 HealthDirect NHSD Dataset Processor\n")
    
    # Check arguments
    if len(sys.argv) < 2:
        print("❌ Usage: python3 scripts/process_healthdirect.py <path_to_json>")
        print("\nExample:")
        print("  python3 scripts/process_healthdirect.py ~/Downloads/healthdirect_nhsd_2025.json")
        print("\nDownload from:")
        print("  https://adp-access.aurin.org.au/dataset/healthdirect_nhsd_services_directory_2025")
        sys.exit(1)
    
    json_path = Path(sys.argv[1])
    
    # Setup paths
    project_root = Path(__file__).parent.parent
    db_path = project_root / "data" / "processed" / "rag_database.db"
    output_jsonl = project_root / "data" / "processed" / "healthdirect_chunks.jsonl"
    
    # Process data
    processor = HealthDirectProcessor(json_path)
    processor.load_data()
    processor.chunk_facilities(group_size=5)
    
    # Generate embeddings
    embeddings = processor.generate_embeddings()
    
    # Save backup
    processor.save_jsonl(output_jsonl)
    
    # Add to database
    processor.add_to_database(db_path, embeddings)
    
    # Update statistics
    import sqlite3
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM chunks")
    total = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT category, COUNT(*) as count
        FROM chunks
        GROUP BY category
        ORDER BY count DESC
    """)
    by_category = {row[0]: row[1] for row in cursor}
    
    conn.close()
    
    print(f"\n📊 Updated Database Statistics:")
    print(f"   Total chunks: {total}")
    print(f"   Healthcare facilities: {len(processor.chunks)} chunks")
    print(f"   Database: {db_path}")
    
    print(f"\n✨ Complete!")
    print(f"   Next: Test RAG retrieval with healthcare queries")


if __name__ == "__main__":
    main()
