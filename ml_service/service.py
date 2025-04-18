from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import shap
import torch
import numpy as np
from newspaper import Article, Config
import requests
import traceback

app = Flask(__name__)

# Load pre-trained FinBERT model
MODEL_ID = "ProsusAI/finbert"
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)

# Create a wrapper function for the model that handles the input format correctly
def model_wrapper(x):
    # Handle various input formats that SHAP might provide
    if isinstance(x, np.ndarray):
        # Convert numpy array to list of strings
        if len(x.shape) == 1:
            x = [str(item) for item in x]
        else:
            x = [str(item) for item in x[0]]  # Take first row if 2D
    elif not isinstance(x, list) and not isinstance(x, str):
        x = [str(x)]
    
    # Ensure we have a list of strings for tokenizer
    if isinstance(x, str):
        x = [x]
    
    # Process with tokenizer and model
    inputs = tokenizer(x, return_tensors="pt", truncation=True, padding=True)
    outputs = model(**inputs)
    return outputs.logits.detach().numpy()

# Create the explainer with a simpler approach
masker = shap.maskers.Text(tokenizer)
explainer = shap.Explainer(model_wrapper, masker, output_names=["neg","neu","pos"])

def scrape_article(url):
    try:
        # Configure newspaper with a browser-like User-Agent
        config = Config()
        config.browser_user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        config.request_timeout = 10
        
        # Create Article with the config
        a = Article(url, config=config)
        a.download()
        a.parse()
        
        # If the article text is too short, it might have failed to parse correctly
        if len(a.text) < 100 and url:
            # Try a direct request as fallback
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                # Very simple HTML text extraction
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(response.text, 'html.parser')
                # Remove script and style elements
                for script in soup(['script', 'style']):
                    script.decompose()
                text = soup.get_text()
                # Clean up text: break into lines and remove leading/trailing space
                lines = (line.strip() for line in text.splitlines())
                # Break multi-headlines into a line each
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                # Drop blank lines
                text = '\n'.join(chunk for chunk in chunks if chunk)
                return text
        
        return a.text
    except Exception as e:
        print(f"Error scraping article {url}: {e}")
        print(traceback.format_exc())
        return None

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    
    # Check if URL is provided
    url = data.get("url", "")
    headline = data.get("text", "")
    
    # If URL is provided, scrape the full article
    full_text = ""
    if url:
        print(f"Scraping article from URL: {url}")
        article_text = scrape_article(url)
        if article_text:
            # Use the first 3 paragraphs or up to 1000 characters
            paragraphs = article_text.split('\n\n')[:3]
            full_text = '\n\n'.join(paragraphs)
            if len(full_text) > 1000:
                full_text = full_text[:1000]
            print(f"Successfully scraped {len(full_text)} characters")
        else:
            # Fallback to headline if scraping fails
            print("Scraping failed, falling back to headline")
            full_text = headline
    else:
        # Use headline if no URL is provided
        full_text = headline
    
    if not full_text:
        return jsonify({
            "error": "No text or URL provided, or failed to extract text",
            "sentiment": 0.0,
            "tokens": []
        }), 400
    
    # Tokenize and predict
    inputs = tokenizer(full_text, return_tensors="pt", truncation=True, padding=True)
    outputs = model(**inputs)
    scores = torch.softmax(outputs.logits, dim=1).detach().numpy()[0]
    
    # sentiment score = positive minus negative
    sentiment_score = float(scores[2] - scores[0])
    
    try:
        # Compute SHAP values for explanation
        shap_values = explainer([full_text])
        
        # Extract tokens and values safely
        tokens = shap_values.data[0]
        # Use the positive sentiment class (index 2) for explanation
        values = shap_values.values[0, :, 2]  
        
        # Pick top 3 tokens by absolute impact
        token_contribs = list(zip(tokens, values))
        token_contribs_sorted = sorted(token_contribs, key=lambda x: abs(x[1]), reverse=True)
        top_tokens = [tok for tok, val in token_contribs_sorted[:3]]
    except Exception as e:
        print(f"Error in SHAP calculation: {e}")
        print(traceback.format_exc())
        top_tokens = []
    
    return jsonify({
        "sentiment": sentiment_score,
        "tokens": top_tokens
    })

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)
