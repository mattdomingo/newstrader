import React, { useState, useEffect } from 'react';
import './App.css';
import StockChart from './StockChart'; // Import the chart component
import ErrorBoundary from './ErrorBoundary'; // Import error boundary

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

// Get Alpha Vantage API Key from environment variable
const ALPHA_VANTAGE_KEY = process.env.REACT_APP_ALPHA_VANTAGE_KEY;

function App() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [isStreaming, setIsStreaming] = useState(false);

  const fetchNewsStreaming = () => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 0, message: 'Connecting...' });
    setArticles([]);
    setIsStreaming(true);

    const eventSource = new EventSource('http://localhost:5000/news_analysis_stream');
    
    eventSource.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        
        switch(data.status) {
          case 'starting':
            setProgress({ current: 0, total: 0, message: data.message });
            break;
          case 'fetched':
            setProgress({ current: 0, total: data.total, message: data.message });
            break;
          case 'analyzing':
            setProgress({ current: data.current, total: data.total, message: data.message });
            break;
          case 'analyzed':
            setProgress({ current: data.current, total: data.total, message: `Processed ${data.current}/${data.total} articles` });
            // Add the analyzed article to the list in real-time
            setArticles(prevArticles => {
              const newArticle = {
                ...data.article,
                source: getSourceInfo(data.article.url)
              };
              return [...prevArticles, newArticle];
            });
            break;
          case 'complete':
            setProgress({ current: data.total || 0, total: data.total || 0, message: data.message });
            setLoading(false);
            setIsStreaming(false);
            eventSource.close();
            break;
          case 'error':
            setError(data.message);
            setLoading(false);
            setIsStreaming(false);
            eventSource.close();
            break;
        }
      } catch (e) {
        console.error("Failed to parse SSE data:", e);
      }
    };

    eventSource.onerror = function(event) {
      console.error("SSE connection error:", event);
      setError("Connection lost. Falling back to standard fetch...");
      setIsStreaming(false);
      eventSource.close();
      // Fallback to regular fetch
      fetchNewsRegular();
    };
  };

  const fetchNewsRegular = async () => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 0, message: 'Loading...' });
    setIsStreaming(false);
    
    try {
      // Increased timeout to 60 seconds for processing time
      const response = await fetch('http://localhost:5000/news_analysis', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(60000) // 60 second timeout
      });
      if (!response.ok) {
        throw new Error(`Service unavailable (${response.status})`);
      }
      const data = await response.json();

      // Add source info to each article
      const articlesWithSource = data.map(article => ({
        ...article,
        source: getSourceInfo(article.url)
      }));

      setArticles(articlesWithSource);
      setProgress({ current: articlesWithSource.length, total: articlesWithSource.length, message: 'Complete!' });
    } catch (e) {
      console.error("Failed to fetch news analysis:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNews = () => {
    // Try streaming first, fall back to regular if it fails
    fetchNewsStreaming();
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>News Trader Analysis</h1>
        <p style={{ margin: '10px 0 0 0', fontSize: '1.1em', opacity: 0.9 }}>
          AI-powered financial sentiment analysis
        </p>
      </header>
      <main>
        {/* Wrap the feed in its own container */} 
        <div className="feed-container">
          {loading && (
            <div className="loading-message">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    border: '3px solid #e3f2fd',
                    borderTop: '3px solid #007bff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span>{isStreaming ? 'Real-time processing...' : 'Loading news analysis...'}</span>
                </div>
                {progress.message && (
                  <div style={{ fontSize: '0.9em', color: '#666', textAlign: 'center' }}>
                    {progress.message}
                  </div>
                )}
                {progress.total > 0 && (
                  <div style={{ width: '100%', maxWidth: '300px' }}>
                    <div style={{ 
                      width: '100%', 
                      height: '8px', 
                      backgroundColor: '#e3f2fd', 
                      borderRadius: '4px', 
                      overflow: 'hidden',
                      marginTop: '8px'
                    }}>
                      <div style={{ 
                        width: `${(progress.current / progress.total) * 100}%`, 
                        height: '100%', 
                        backgroundColor: '#007bff',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px', textAlign: 'center' }}>
                      {progress.current}/{progress.total} articles processed
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {error && (
            <div className="error">
              <strong>🚫 Connection Error</strong><br/>
              {error}<br/>
              {error.includes('ML Service Loading') ? (
                <small style={{ opacity: 0.8 }}>
                  The ML service is starting up. This can take 1-2 minutes for the AI models to load.
                </small>
              ) : (
                <small style={{ opacity: 0.8 }}>
                  Make sure the ML service is running: <code>cd ml_service && source venv/bin/activate && python service.py</code>
                </small>
              )}
              <div style={{ marginTop: '15px' }}>
                <button 
                  onClick={fetchNews}
                  style={{
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9em'
                  }}
                >
                  🔄 Retry Connection
                </button>
              </div>
            </div>
          )}
          {!loading && !error && (
            <div className="article-list">
              {articles.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '16px',
                  color: '#666'
                }}>
                  <h3>📰 No articles found</h3>
                  <p>Try refreshing the page or check your connection.</p>
                  <button 
                    onClick={fetchNews}
                    style={{
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginTop: '10px'
                    }}
                  >
                    🔄 Refresh News
                  </button>
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                    padding: '15px 20px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <span style={{ fontSize: '1.1em', fontWeight: '600' }}>
                      📈 Latest Tech News ({articles.length} articles{isStreaming ? ' - updating live...' : ''})
                    </span>
                    <button 
                      onClick={fetchNews}
                      style={{
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85em'
                      }}
                    >
                      🔄 Refresh
                    </button>
                  </div>
                  {articles.map((article, index) => {
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
                            <div>
                              <p style={{ margin: 0, fontSize: '0.9em', color: '#666' }}>Sentiment Score: {article.sentiment.toFixed(3)}</p>
                            </div>
                            <div style={{ 
                              background: recommendation.color === 'green' ? '#d4edda' : recommendation.color === 'red' ? '#f8d7da' : '#e2e3e5',
                              color: recommendation.color === 'green' ? '#155724' : recommendation.color === 'red' ? '#721c24' : '#6c757d',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              fontSize: '0.85em',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              {recommendation.text}
                            </div>
                          </div>
                          <div className="card-tokens">
                            <p>Key Tokens (SHAP): {article.tokens.length > 0 ? article.tokens.join(', ') : 'N/A'}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Add the charts container */} 
        <aside className="charts-container">
          <ErrorBoundary>
            <StockChart 
              symbol="SPY" 
              title="S&P 500 Index" 
              apiKey={ALPHA_VANTAGE_KEY} 
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <StockChart 
              symbol="XLK" 
              title="Technology Sector (XLK)" 
              apiKey={ALPHA_VANTAGE_KEY} 
            />
          </ErrorBoundary>
        </aside>
      </main>
    </div>
  );
}

export default App;
