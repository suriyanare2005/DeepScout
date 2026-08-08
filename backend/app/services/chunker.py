import re
import logging

logger = logging.getLogger("company_research_rag.chunker")

class MarkdownStructureChunker:
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 150):
        """
        Initializes the structure-aware chunker.
        chunk_size: Maximum characters per chunk text block.
        chunk_overlap: Overlap characters between split text blocks.
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # Heading match regex
        self.heading_pattern = re.compile(r"^(#{1,6})\s+(.+)$")

    def _parse_sections(self, markdown_text: str) -> list[dict]:
        """
        Parses markdown text into sections grouped by active header hierarchy.
        """
        lines = markdown_text.splitlines()
        sections = []
        
        # Initial context state
        current_headings = {1: None, 2: None, 3: None, 4: None, 5: None, 6: None}
        current_section_blocks = []
        
        def save_current_section():
            if current_section_blocks:
                # Resolve current header context
                path = []
                for level in range(1, 7):
                    h = current_headings[level]
                    if h:
                        path.append(h)
                
                heading_context = " > ".join(path) if path else "General"
                section_text = "\n".join(current_section_blocks).strip()
                if section_text:
                    sections.append({
                        "header_context": heading_context,
                        "content": section_text
                    })
                current_section_blocks.clear()

        for line in lines:
            line_stripped = line.strip()
            match = self.heading_pattern.match(line_stripped)
            
            if match:
                # Save the accumulated section before updating the headings
                save_current_section()
                
                level = len(match.group(1))
                heading_text = match.group(2).strip()
                
                # Update headings tree: set current level, reset lower levels
                current_headings[level] = heading_text
                for lower_level in range(level + 1, 7):
                    current_headings[lower_level] = None
                
                # We keep the heading line as part of the section text
                current_section_blocks.append(line)
            else:
                current_section_blocks.append(line)
                
        # Save any final section left behind
        save_current_section()
        return sections

    def _split_text_recursive(self, text: str, max_size: int, overlap: int) -> list[str]:
        """
        Recursively splits text into blocks using list/paragraph/sentence boundaries.
        """
        if len(text) <= max_size:
            return [text]

        # Splitting boundaries in order of priority:
        # 1. Double newline (paragraphs)
        # 2. Single newline (lines/lists)
        # 3. Sentence end (.?!) followed by space
        # 4. Fallback to space
        
        splits = []
        
        # Try splitting by paragraph first
        paragraphs = text.split("\n\n")
        
        current_chunk = []
        current_len = 0
        
        for para in paragraphs:
            para_len = len(para)
            
            # If a single paragraph is too big, split it by line or sentence
            if para_len > max_size:
                # Flush current buffer first
                if current_chunk:
                    splits.append("\n\n".join(current_chunk))
                    current_chunk = []
                    current_len = 0
                
                # Split the large paragraph by sentences
                sentences = re.split(r"(?<=[.!?])\s+", para)
                for sentence in sentences:
                    sent_len = len(sentence)
                    
                    if current_len + sent_len > max_size:
                        if current_chunk:
                            splits.append(" ".join(current_chunk))
                            
                            # Add overlap from the end of the current split
                            overlap_text = splits[-1][-overlap:] if len(splits[-1]) > overlap else splits[-1]
                            current_chunk = [overlap_text, sentence]
                            current_len = len(overlap_text) + sent_len + 1
                        else:
                            # Sentence itself is larger than max_size, split by characters (fallback)
                            chars = [sentence[i:i + max_size] for i in range(0, len(sentence), max_size - overlap)]
                            splits.extend(chars[:-1])
                            current_chunk = [chars[-1]]
                            current_len = len(chars[-1])
                    else:
                        current_chunk.append(sentence)
                        current_len += sent_len + 1
            else:
                if current_len + para_len + 2 > max_size:
                    if current_chunk:
                        splits.append("\n\n".join(current_chunk))
                        
                        # Set up overlap
                        overlap_text = splits[-1][-overlap:] if len(splits[-1]) > overlap else splits[-1]
                        current_chunk = [overlap_text, para]
                        current_len = len(overlap_text) + para_len + 2
                    else:
                        current_chunk = [para]
                        current_len = para_len
                else:
                    current_chunk.append(para)
                    current_len += para_len + 2

        if current_chunk:
            splits.append("\n\n".join(current_chunk))
            
        return splits

    def chunk_document(
        self, 
        markdown_content: str, 
        company_id: str, 
        source_id: str,
        document_id: str
    ) -> list[dict]:
        """
        Splits a clean document into chunks and compiles all associated metadata.
        """
        if not markdown_content or not markdown_content.strip():
            logger.info("Empty content received for chunking.")
            return []

        sections = self._parse_sections(markdown_content)
        chunks = []
        chunk_index = 0
        
        for idx, sec in enumerate(sections):
            header_context = sec["header_context"]
            content = sec["content"]
            
            # Split the section content if it exceeds the chunk size
            split_blocks = self._split_text_recursive(content, self.chunk_size, self.chunk_overlap)
            
            for block in split_blocks:
                block_stripped = block.strip()
                if not block_stripped:
                    continue
                    
                chunks.append({
                    "company_id": company_id,
                    "source_id": source_id,
                    "document_id": document_id,
                    "chunk_index": chunk_index,
                    "section_header": header_context,
                    "content": block_stripped
                })
                chunk_index += 1
                
        logger.info(f"Generated {len(chunks)} chunks from document {document_id}.")
        return chunks
