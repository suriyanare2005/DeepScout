import os
import sys
import uuid
import pytest

sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.services.chunker import MarkdownStructureChunker

def test_chunker_scenarios():
    company_id = str(uuid.uuid4())
    source_id = str(uuid.uuid4())
    document_id = str(uuid.uuid4())

    # Configure chunker with specific small sizes to force boundary splits easily
    chunker = MarkdownStructureChunker(chunk_size=200, chunk_overlap=30)

    # Scenario 1: Empty content
    print("Testing Scenario 1: Empty content...")
    chunks_empty = chunker.chunk_document("", company_id, source_id, document_id)
    assert len(chunks_empty) == 0

    # Scenario 2: Very short content
    print("Testing Scenario 2: Very short content...")
    short_content = "Just a single short paragraph."
    chunks_short = chunker.chunk_document(short_content, company_id, source_id, document_id)
    assert len(chunks_short) == 1
    assert chunks_short[0]["content"] == short_content
    assert chunks_short[0]["section_header"] == "General"

    # Scenario 3: Normal document with headings and subsections
    print("Testing Scenario 3: Headings and subsections hierarchy...")
    hierarchical_content = """
# Main H1
Paragraph under H1.

## Sub H2
Paragraph under H2.

### Sub-sub H3
Paragraph under H3.
"""
    # Use larger sizes for hierarchy check to avoid splits
    hier_chunker = MarkdownStructureChunker(chunk_size=1000, chunk_overlap=100)
    chunks_hier = hier_chunker.chunk_document(hierarchical_content, company_id, source_id, document_id)
    
    assert len(chunks_hier) >= 3
    # Check H1 context
    h1_chunk = [c for c in chunks_hier if "Paragraph under H1" in c["content"]][0]
    assert h1_chunk["section_header"] == "Main H1"
    
    # Check H2 context
    h2_chunk = [c for c in chunks_hier if "Paragraph under H2" in c["content"]][0]
    assert h2_chunk["section_header"] == "Main H1 > Sub H2"
    
    # Check H3 context
    h3_chunk = [c for c in chunks_hier if "Paragraph under H3" in c["content"]][0]
    assert h3_chunk["section_header"] == "Main H1 > Sub H2 > Sub-sub H3"

    # Scenario 4: Long sections requiring splits
    print("Testing Scenario 4: Long sections splitting & boundaries...")
    long_section_content = """
# Long Topic
This is a very long paragraph that will easily exceed the 200 characters limit. It contains multiple sentences. Let's make sure it splits correctly without losing text. Here is another sentence to add characters. And one more to guarantee a split.
"""
    chunks_long = chunker.chunk_document(long_section_content, company_id, source_id, document_id)
    assert len(chunks_long) > 1
    
    # Verify no content was lost: combine text and verify sentences exist
    combined_text = " ".join([c["content"] for c in chunks_long])
    assert "exceed the 200 characters limit" in combined_text
    assert "guarantee a split" in combined_text

    # Scenario 5: Lists and tables
    print("Testing Scenario 5: Lists and Tables formatting preservation...")
    list_table_content = """
# Data Summary
Here is the core items list:
*   First list item
*   Second list item
*   Third list item

And our pricing model:
| Tier | Price |
|---|---|
| Startup | Free |
| Enterprise | Custom |
"""
    list_table_chunker = MarkdownStructureChunker(chunk_size=1000, chunk_overlap=100)
    chunks_list_table = list_table_chunker.chunk_document(list_table_content, company_id, source_id, document_id)
    
    assert len(chunks_list_table) == 1
    chunk_text = chunks_list_table[0]["content"]
    assert "*   First list item" in chunk_text
    assert "| Startup | Free |" in chunk_text

    # Scenario 6: Verify metadata elements
    print("Testing Scenario 6: Verify metadata elements...")
    chunks_meta = chunker.chunk_document("Test document text.", company_id, source_id, document_id)
    assert len(chunks_meta) == 1
    c = chunks_meta[0]
    assert c["company_id"] == company_id
    assert c["source_id"] == source_id
    assert c["document_id"] == document_id
    assert c["chunk_index"] == 0
    assert "section_header" in c
    assert c["content"] == "Test document text."

    print("All chunker unit test scenarios verified successfully!")

if __name__ == "__main__":
    test_chunker_scenarios()
