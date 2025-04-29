import React, { useState, useEffect } from 'react';
import './App.css';
import StockChart from './StockChart'; // Import the chart component

// --- Helper function to determine recommendation ---
// You can adjust these thresholds
const getRecommendation = (sentiment) => {
  if (sentiment > 0.3) return { text: 'BUY', color: 'green' };
  if (sentiment < -0.3) return { text: 'SELL', color: 'red' };
  return { text: 'HOLD', color: 'gray' };
};

// --- Helper function to get source info from URL ---
const getSourceInfo = (urlString) => {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.replace(/^www\./, ''); // Remove leading 'www.'
    // Use Google's favicon service (replace with another if preferred)
    const faviconUrl = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${url.protocol}//${url.hostname}&size=64`;
    return { name: hostname, logo: faviconUrl };
  } catch (e) {
    console.error("Error parsing URL for source info:", urlString, e);
    // Fallback if URL is invalid
    return { name: 'Unknown Source', logo: null }; 
  }
};

// Define your Alpha Vantage API Key here (replace with your actual key)
const ALPHA_VANTAGE_KEY = 'JBJOPE9IFEYNIOTE';

function App() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError(null);
      try {
        // Assuming the Flask backend is running on http://localhost:5000
        const response = await fetch('http://localhost:5000/news_analysis');
        if (!response.ok) {
          // Try to get error message from backend response
          const errorData = await response.json().catch(() => ({})); // Handle cases where response isn't valid JSON
          throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
        }
        const data = await response.json();

        // Add source info to each article
        const articlesWithSource = data.map(article => ({
          ...article,
          source: getSourceInfo(article.url)
        }));

        setArticles(articlesWithSource);
      } catch (e) {
        console.error("Failed to fetch news analysis:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []); // Empty dependency array means this effect runs once on mount

  return (
    <div className="App">
      <header className="App-header">
        <h1>News Trader Analysis</h1>
      </header>
      <main>
        {/* Wrap the feed in its own container */} 
        <div className="feed-container">
          {loading && <p>Loading news analysis...</p>}
          {error && <p className="error">Error fetching news: {error}</p>}
          {!loading && !error && (
            <div className="article-list">
              {articles.length === 0 ? (
                <p>No articles found.</p>
              ) : (
                articles.map((article, index) => {
                  const recommendation = getRecommendation(article.sentiment);
                  return (
                    <article key={index} className="article-card">
                      <div className="card-header">
                        {article.source.logo && (
                          <img 
                            src={article.source.logo} 
                            alt={`${article.source.name} logo`} 
                            className="card-logo" 
                            // Add simple error handling for broken favicon links
                            onError={(e) => { e.target.style.display = 'none'; }} 
                          />
                        )}
                        <span className="card-source">{article.source.name}</span>
                      </div>
                      <div className="card-content">
                        <h2><a href={article.url} target="_blank" rel="noopener noreferrer">{article.headline}</a></h2>
                        <div className="card-sentiment">
                          <p>Sentiment Score: {article.sentiment.toFixed(3)}</p>
                          <p>Recommendation: <span style={{ color: recommendation.color, fontWeight: 'bold' }}>{recommendation.text}</span></p>
                        </div>
                        <div className="card-tokens">
                          <p>Key Tokens (SHAP): {article.tokens.length > 0 ? article.tokens.join(', ') : 'N/A'}</p>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Add the charts container */} 
        <aside className="charts-container">
          <StockChart 
            symbol="SPY" 
            title="S&P 500 Index" 
            apiKey={ALPHA_VANTAGE_KEY} 
          />
          <StockChart 
            symbol="XLK" 
            title="Technology Sector (XLK)" 
            apiKey={ALPHA_VANTAGE_KEY} 
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
