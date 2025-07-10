import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

const StockChart = ({ symbol, title, apiKey }) => {
  const chartContainerRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if API key is configured
    if (!apiKey || apiKey === 'YOUR_ALPHA_VANTAGE_KEY' || apiKey === '' || apiKey === 'your_alpha_vantage_key_here') {
      setError('Alpha Vantage API key not configured. Charts disabled.');
      setLoading(false);
      return;
    }

    let chart;
    let lineSeries;
    let mounted = true;

    const fetchDataAndDrawChart = async () => {
      if (!mounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch daily data from Alpha Vantage
        const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${apiKey}`;
        console.log(`Fetching data for ${symbol}`);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Check for API errors or rate limiting
        if (data['Error Message']) {
          throw new Error(`API Error: ${data['Error Message']}`);
        }
        if (data['Note']) {
           throw new Error('API rate limit reached. Please try again in a few minutes.');
        }
        if (data['Information']) {
           throw new Error('API call frequency limit reached. Please try again later.');
        }
        if (!data['Time Series (Daily)']) {
           throw new Error(`No daily time series data available for ${symbol}.`);
        }

        // Only proceed if component is still mounted
        if (!mounted) return;

        // Format data for Lightweight Charts
        const formattedData = Object.entries(data['Time Series (Daily)'])
          .map(([date, values]) => ({
            time: date,
            value: parseFloat(values['4. close']),
          }))
          .sort((a, b) => new Date(a.time) - new Date(b.time));
        
        if (formattedData.length === 0) {
            throw new Error('No valid data points after formatting.');
        }

        // Only create chart if container exists and component is mounted
        if (!chartContainerRef.current || !mounted) return;

        // Get container dimensions
        const container = chartContainerRef.current;
        const width = container.clientWidth || 300;
        const height = container.clientHeight || 200;

        // Create chart with v4.x API
        chart = createChart(container, {
          width: width,
          height: height,
          layout: {
            backgroundColor: '#ffffff',
            textColor: '#333',
          },
          grid: {
            vertLines: {
              color: '#f0f0f0',
            },
            horzLines: {
              color: '#f0f0f0',
            },
          },
          timeScale: {
             timeVisible: true,
             secondsVisible: false,
          }
        });

        // Add line series
        lineSeries = chart.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
        });

        // Set data
        lineSeries.setData(formattedData);
        
        // Fit content to time scale
        chart.timeScale().fitContent();

        console.log(`Chart created successfully for ${symbol}`);

      } catch (err) {
        console.error(`Failed to fetch or draw chart for ${symbol}:`, err);
        if (mounted) {
          setError(err.message || 'Chart loading failed');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Add delay to prevent API rate limiting
    const timeoutId = setTimeout(fetchDataAndDrawChart, 1000);

    // Handle window resize
    const handleResize = () => {
      if (chart && chartContainerRef.current) {
        try {
          chart.applyOptions({ 
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight 
          });
        } catch (resizeError) {
          console.error('Chart resize error:', resizeError);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      if (chart) {
        try {
          chart.remove();
        } catch (removeError) {
          console.error('Chart removal error:', removeError);
        }
      }
    };
  }, [symbol, apiKey]);

  return (
    <div className="chart-wrapper">
      <h3>{title} ({symbol})</h3>
      <div ref={chartContainerRef} className="chart-container-inner">
        {loading && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: '#007bff',
            fontSize: '0.9em'
          }}>
            <div>📈 Loading chart data...</div>
          </div>
        )}
        {error && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: '#dc3545',
            fontSize: '0.9em',
            textAlign: 'center',
            padding: '20px'
          }}>
            <div>⚠️ {error}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockChart; 