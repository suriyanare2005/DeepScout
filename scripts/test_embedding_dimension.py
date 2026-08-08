import os
import sys

# Adjust path to import backend app configs
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from backend.app.config import settings
except Exception as e:
    print(f"Error loading configuration: {e}")
    sys.exit(1)

if not settings.GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY is not defined in the environment or .env file.")
    sys.exit(1)

try:
    import google.generativeai as genai
except ImportError:
    print("Error: google-generativeai is not installed.")
    sys.exit(1)

async def test_gemini_embeddings():
    print("Attempting to connect to Google Gemini API...")
    
    # Configure genai with the loaded API key
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    # Default recommended model for embeddings
    model_name = "models/text-embedding-004"
    print(f"Targeting model: '{model_name}'...")
    
    try:
        # Call the embedding API
        response = genai.embed_content(
            model=model_name,
            content="Testing vector dimension compatibility for Company Research RAG pipeline.",
            task_type="retrieval_document"
        )
        
        # Check output structure
        if "embedding" in response:
            vector = response["embedding"]
            dimension = len(vector)
            print(f"\nAPI Call SUCCESS:")
            print(f"   - Model: {model_name}")
            print(f"   - Returned vector size: {dimension}")
            
            # Target dimension from models.py configuration
            target_dimension = 768
            matches = (dimension == target_dimension)
            print(f"   - Matches target database schema dimension ({target_dimension}): {matches}")
            
            if not matches:
                print(f"\n[ALERT] DIMENSION MISMATCH: Database is configured for {target_dimension} but API returned {dimension}!")
            else:
                print("\n[SUCCESS] Vector dimensions are perfectly aligned!")
                
            # Now test LLM call
            print("\nTesting Gemini LLM generation API (gemini-1.5-flash)...")
            llm_model = genai.GenerativeModel("gemini-1.5-flash")
            llm_response = llm_model.generate_content("Hello! Respond with exactly one word.")
            print("   - LLM Call SUCCESS!")
            print(f"   - Response received: '{llm_response.text.strip()}'")
            print("\nAll Gemini services authenticated successfully!")
                
        else:
            print(f"Error: Unexpected response format from API: {response}")
            sys.exit(1)
            
    except Exception as e:
        print(f"Error connecting to Gemini API: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_gemini_embeddings())
