import re
import logging

logger = logging.getLogger("company_research_rag.cleaner")

class ContentCleaner:
    def __init__(self):
        # Compiled patterns for efficiency
        
        # 1. Cookie & privacy popups keywords
        self.cookie_pattern = re.compile(
            r"(uses cookies|cookie policy|agree to cookies|cookie banner|we use cookies|privacy policy|terms of service|terms & conditions)",
            re.IGNORECASE
        )
        
        # 2. Copyright & legal boilerplates
        self.legal_pattern = re.compile(
            r"(copyright|©|\(c\)|all rights reserved|\bpowered by\b)",
            re.IGNORECASE
        )
        
        # 3. Social media links / sharing profiles
        self.social_pattern = re.compile(
            r"(linkedin\.com|twitter\.com|facebook\.com|instagram\.com|youtube\.com|github\.com/)",
            re.IGNORECASE
        )
        
        # 4. Markdown image syntax (e.g., ![Alt text](url))
        self.image_pattern = re.compile(r"!\[.*?\]\(.*?\)")
        
        # 5. Empty markdown headers (e.g., "# ")
        self.empty_header_pattern = re.compile(r"^#+\s*$")
        
        # 6. Inline link navigation blocks (e.g., "[Home](/home) | [About](/about) | [Services](/services)")
        self.nav_separator_pattern = re.compile(r"\[.*?\]\(.*?\)\s*[|•·*•-]\s*\[.*?\]\(.*?\)")
        
        # 7. Skip to main content navigation links
        self.skip_link_pattern = re.compile(r"^\[skip to (?:main )?content\]\(.*?\)$", re.IGNORECASE)

    def clean_markdown(self, markdown_content: str) -> str:
        """
        Cleans raw markdown by removing navigational elements, boilerplates,
        social media lists, and tracking scripts, while retaining semantic formatting.
        """
        if not markdown_content:
            return ""

        lines = markdown_content.splitlines()
        cleaned_lines = []
        
        # Track if we have encountered the first main heading (# or ##)
        first_heading_found = False
        
        # We will scan lines in a single pass
        for line in lines:
            line_stripped = line.strip()
            
            if not line_stripped:
                cleaned_lines.append("")
                continue

            # Strip skip-to-content links
            if self.skip_link_pattern.match(line_stripped):
                continue

            # Identify if this is a heading
            is_heading = line_stripped.startswith("#")
            if is_heading:
                first_heading_found = True

            # 1. Strip top-level inline nav bars before the main heading
            if not first_heading_found:
                # If a line before the main heading contains multiple markdown links separated by dividers, skip it
                if self.nav_separator_pattern.search(line_stripped):
                    continue
                # If the line starts with a list bullet and only contains a single link, it might be a header menu
                if line_stripped.startswith(("*", "-", "+")) and line_stripped.count("[") == 1 and line_stripped.count("]") == 1:
                    continue

            # 2. Strip lines that look like cookie banners or privacy consent
            if self.cookie_pattern.search(line_stripped):
                # Only strip if it's not a main heading (which might be a genuine privacy policy page)
                if not is_heading:
                    continue

            # 3. Strip legal boilerplate & copyright lines
            if self.legal_pattern.search(line_stripped):
                if not is_heading:
                    continue

            # 4. Strip social sharing profiles or social links list
            if self.social_pattern.search(line_stripped):
                # Typically, these appear in menus or sidebars; skip if they contain profiles list
                if line_stripped.startswith(("*", "-", "+")) or "follow us" in line_stripped.lower():
                    continue

            # 5. Remove empty headings
            if self.empty_header_pattern.match(line_stripped):
                continue

            # 6. Clean inline images from text (RAG embeddings do not need image markup)
            line_cleaned = self.image_pattern.sub("", line)

            cleaned_lines.append(line_cleaned.rstrip())

        # Post-processing: Rejoin and collapse empty lines
        cleaned_text = "\n".join(cleaned_lines)
        
        # Collapse multiple empty lines (3 or more) into exactly one empty line (2 newlines)
        cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text)
        
        # Strip outer whitespaces
        return cleaned_text.strip()
