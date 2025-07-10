import os # Keep os import
# Disable tokenizer parallelism before importing transformers
os.environ["TOKENIZERS_PARALLELISM"] = "false"

from flask import Flask, request, jsonify, Response
from flask_cors import CORS # Import CORS
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import shap
import torch
import numpy as np
from newspaper import Article, Config
import requests
import traceback
import json

app = Flask(__name__)
CORS(app) # Enable CORS for the entire app

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

# Get NewsAPI Key from environment variable
NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY")

if not NEWSAPI_KEY:
    print("WARNING: NEWSAPI_KEY environment variable not set")
    print("Please set it with: export NEWSAPI_KEY=your_api_key_here")
    print("The service will not work without a valid NewsAPI key.")

def analyze_text(text_to_analyze, url=None):
    """Reusable analysis function, similar to existing /analyze logic."""
    # Add a check for empty or whitespace-only input
    if not text_to_analyze or text_to_analyze.isspace():
        print(f"Skipping analysis for empty input (URL: {url})")
        return {"sentiment": 0.0, "tokens": [], "error": "Input text is empty"}

    sentiment_score = 0.0
    top_tokens = []
    analysis_error = None

    try:
        # --- Sentiment Prediction --- 
        inputs = tokenizer(text_to_analyze, return_tensors="pt", truncation=True, padding=True, max_length=512)
        with torch.no_grad():
            outputs = model(**inputs)
        scores = torch.softmax(outputs.logits, dim=1).detach().numpy()[0]
        sentiment_score = float(scores[2] - scores[0]) # positive - negative

        # --- SHAP Explanation (with separate error handling) --- 
        try:
            # Ensure input is a list of one string
            shap_values = explainer([str(text_to_analyze)])
            
            # Extract tokens and values safely
            tokens = shap_values.data[0]
            # Use the positive sentiment class (index 2) for explanation
            values = shap_values.values[0, :, 2]
            
            # Pick top 3 tokens by absolute impact
            token_contribs = list(zip(tokens, values))
            # Filter out any potential NaN/inf values from SHAP before sorting
            token_contribs_filtered = [(tok, val) for tok, val in token_contribs if np.isfinite(val)]
            token_contribs_sorted = sorted(token_contribs_filtered, key=lambda x: abs(x[1]), reverse=True)
            top_tokens = [tok for tok, val in token_contribs_sorted[:3]]

        except Exception as shap_e:
            print(f"SHAP calculation failed for text: '{text_to_analyze[:50]}...'")
            print(f"SHAP Error: {shap_e}")
            # Optionally print traceback for SHAP error:
            # print(traceback.format_exc())
            top_tokens = [] # Default to empty tokens on SHAP failure
            # We still have the sentiment score, so don't set analysis_error unless needed

    except Exception as e:
        print(f"Error during sentiment analysis for text: '{text_to_analyze[:50]}...'")
        print(f"Analysis Error: {e}")
        print(traceback.format_exc())
        sentiment_score = 0.0 # Reset score on error
        top_tokens = []
        analysis_error = str(e)

    result = {"sentiment": sentiment_score, "tokens": top_tokens}
    if analysis_error:
        result["error"] = analysis_error
    
    return result

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
    inputs = tokenizer(full_text, return_tensors="pt", truncation=True, padding=True, max_length=512)
    with torch.no_grad():
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

# New endpoint to fetch news and analyze with real-time streaming
@app.route("/news_analysis_stream", methods=["GET"])
def get_news_analysis_stream():
    def generate():
        yield "data: " + json.dumps({"status": "starting", "message": "Fetching news from NewsAPI..."}) + "\n\n"
        
        news_url = (
            f"https://newsapi.org/v2/top-headlines?"
            f"category=technology&language=en&pageSize=10&"
            f"apiKey={NEWSAPI_KEY}"
        )
        
        try:
            response = requests.get(news_url, timeout=30)
            response.raise_for_status()
            news_data = response.json()

            articles = news_data.get("articles", [])
            yield "data: " + json.dumps({
                "status": "fetched", 
                "message": f"Fetched {len(articles)} articles. Starting analysis...", 
                "total": len(articles)
            }) + "\n\n"

            for i, article in enumerate(articles):
                headline = article.get("title", "")
                article_url = article.get("url", "")
                content_to_analyze = headline

                yield "data: " + json.dumps({
                    "status": "analyzing", 
                    "message": f"Analyzing: {headline[:50]}...", 
                    "current": i+1, 
                    "total": len(articles)
                }) + "\n\n"
                
                analysis_result = analyze_text(content_to_analyze, url=article_url)

                result = {
                    "status": "analyzed",
                    "current": i+1,
                    "total": len(articles),
                    "article": {
                        "headline": headline,
                        "url": article_url,
                        "sentiment": analysis_result.get("sentiment", 0.0),
                        "tokens": analysis_result.get("tokens", [])
                    }
                }
                yield "data: " + json.dumps(result) + "\n\n"

            yield "data: " + json.dumps({"status": "complete", "message": "Analysis complete!"}) + "\n\n"

        except requests.exceptions.RequestException as e:
            error_msg = f"Failed to fetch news: {e}"
            yield "data: " + json.dumps({"status": "error", "message": error_msg}) + "\n\n"
        except Exception as e:
            error_msg = f"An internal error occurred: {e}"
            yield "data: " + json.dumps({"status": "error", "message": error_msg}) + "\n\n"

    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Connection'] = 'keep-alive'
    return response

# New endpoint to fetch news and analyze
@app.route("/news_analysis", methods=["GET"])
def get_news_analysis():
    print("Fetching news from NewsAPI...")
    news_url = (
        f"https://newsapi.org/v2/top-headlines?"
        f"category=technology&language=en&pageSize=10&"
        f"apiKey={NEWSAPI_KEY}"
    )
    results = []
    try:
        response = requests.get(news_url, timeout=30)  # Increased timeout
        response.raise_for_status()
        news_data = response.json()

        articles = news_data.get("articles", [])
        print(f"Fetched {len(articles)} articles.")

        for article in articles:
            headline = article.get("title", "")
            article_url = article.get("url", "")
            content_to_analyze = headline

            print(f"Analyzing: {headline}")
            analysis_result = analyze_text(content_to_analyze, url=article_url)

            results.append({
                "headline": headline,
                "url": article_url,
                "sentiment": analysis_result.get("sentiment", 0.0),
                "tokens": analysis_result.get("tokens", [])
            })

    except requests.exceptions.RequestException as e:
        print(f"Error fetching news from NewsAPI: {e}")
        return jsonify({"error": f"Failed to fetch news: {e}"}), 500
    except Exception as e:
        print(f"An error occurred during news analysis: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"An internal error occurred: {e}"}), 500

    print(f"Returning {len(results)} analyzed articles.")
    return jsonify(results)

if __name__ == "__main__":
    # Run on 0.0.0.0 to be accessible from other devices on the network
    # (like a React dev server running on the same machine)
    app.run(host="0.0.0.0", port=5000)
