import os
import sys
import pytest

sys.path.append("c:/Users/SURIYA/Desktop/RAG")
from backend.app.services.cleaner import ContentCleaner

def test_content_cleaner():
    # 1. Prepare realistic raw scraped webpage markdown
    raw_markdown = """
![Logo](https://acme.com/images/logo.png)
[Products](/products) | [Careers](/careers) | [About Us](/about) | [Contact](/contact)

*   [Sign In](https://acme.com/login)
*   [Get Started](https://acme.com/signup)

---

# About Acme Corporation

Acme Corporation is a leading provider of innovative widgets and solutions.

We help companies optimize their pipelines. ![Acme pipeline diagram](https://acme.com/diagram.png)

## Core Offerings
Here are our main products:
1.  **Acme Widget Pro**: High efficiency widgets.
2.  **Acme Cloud**: Remote widget management.

### Features List
*   Low latency operations
*   Secure cloud backup
*   24/7 technical support

```python
# Code snippet example
def initialize_acme():
    return "Acme Widget Active"
```

| Plan | Price | Features |
|---|---|---|
| Basic | $10/mo | 5 widgets |
| Pro | $50/mo | Unlimited widgets |

---

We use cookies to improve your user experience on our site. By continuing to use our website, you agree to our Cookie Policy.
Follow us on [Twitter](https://twitter.com/acme) or [LinkedIn](https://linkedin.com/company/acme).
© 2026 Acme Corp. All rights reserved. Privacy Policy | Terms of Service.
    """
    
    # 2. Run cleaner
    cleaner = ContentCleaner()
    cleaned = cleaner.clean_markdown(raw_markdown)
    
    print("\n--- CLEANED OUTPUT ---")
    print(cleaned)
    print("----------------------")
    
    # 3. Assertions to verify removal of noise
    assert "[Products](/products)" not in cleaned, "Failed to strip top navigation links."
    assert "[Sign In]" not in cleaned, "Failed to strip top navigation menu lists."
    assert "We use cookies to improve" not in cleaned, "Failed to strip cookie consent warnings."
    assert "© 2026 Acme Corp" not in cleaned, "Failed to strip copyright notices."
    assert "Follow us on" not in cleaned, "Failed to strip social links list."
    assert "https://twitter.com/acme" not in cleaned, "Failed to strip twitter profile link."
    
    # 4. Assertions to verify preservation of rich content
    assert "# About Acme Corporation" in cleaned, "Heading 1 was incorrectly stripped."
    assert "Acme Corporation is a leading provider" in cleaned, "Paragraph content was incorrectly stripped."
    assert "## Core Offerings" in cleaned, "Heading 2 was incorrectly stripped."
    assert "1.  **Acme Widget Pro**:" in cleaned, "Numbered lists were incorrectly stripped."
    assert "Low latency operations" in cleaned, "Bullet lists were incorrectly stripped."
    assert "initialize_acme" in cleaned, "Code blocks were incorrectly stripped."
    assert "Basic | $10/mo" in cleaned, "Tables were incorrectly stripped."
    
    # 5. Verify image tag removal
    assert "![Logo]" not in cleaned, "Failed to strip logo image syntax."
    assert "![Acme pipeline diagram]" not in cleaned, "Failed to strip inline pipeline diagram."
    
    # 6. Verify whitespace compression
    # The output should not contain three or more consecutive newlines
    assert "\n\n\n" not in cleaned, "Failed to compress multiple empty lines."

if __name__ == "__main__":
    test_content_cleaner()
    print("All Content Cleaner verification tests passed successfully!")
