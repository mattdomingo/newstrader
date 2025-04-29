import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

const StockChart = ({ symbol, title, apiKey }) => {
  const chartContainerRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiKey || apiKey === 'YOUR_ALPHA_VANTAGE_KEY') {
      setError('Alpha Vantage API key not provided.');
      setLoading(false);
      return;
    }

    let chart;
    let lineSeries;

    const fetchDataAndDrawChart = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch daily adjusted data from Alpha Vantage
        const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=compact&apikey=${apiKey}`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Add detailed logging of the entire response
        console.log(`Alpha Vantage Response for ${symbol}:`, JSON.stringify(data, null, 2));

        // Check for API errors or rate limiting
        if (data['Error Message']) {
          throw new Error(`API Error: ${data['Error Message']}`);
        }
        if (data['Note']) {
           console.warn('Alpha Vantage API Note:', data['Note']);
           // Potentially rate limited, show message
           throw new Error('API rate limit likely reached. Please wait and try again.');
        }
        if (!data['Time Series (Daily)']) {
           throw new Error('No time series data found in API response.');
        }

        // Format data for Lightweight Charts (time: YYYY-MM-DD, value: adjusted close)
        const formattedData = Object.entries(data['Time Series (Daily)'])
          .map(([date, values]) => ({
            time: date,
            value: parseFloat(values['5. adjusted close']),
          }))
          .sort((a, b) => new Date(a.time) - new Date(b.time)); // Sort ascending by date
        
        if (formattedData.length === 0) {
            throw new Error('No valid data points after formatting.');
        }

        // --- Create Chart ---
        chart = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: '#ffffff' },
            textColor: '#333',
          },
          grid: {
            vertLines: { color: '#f0f0f0' },
            horzLines: { color: '#f0f0f0' },
          },
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
          timeScale: {
             timeVisible: true,
             secondsVisible: false,
          }
        });

        lineSeries = chart.addLineSeries({ color: '#2962FF' });
        lineSeries.setData(formattedData);

        chart.timeScale().fitContent();

      } catch (err) {
        console.error(`Failed to fetch or draw chart for ${symbol}:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDataAndDrawChart();

    // Handle resizing
    const handleResize = () => {
      if (chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.remove();
      }
    };
  }, [symbol, apiKey]); // Rerun effect if symbol or apiKey changes

  return (
    <div className="chart-wrapper">
      <h3>{title} ({symbol})</h3>
      <div ref={chartContainerRef} className="chart-container-inner">
        {loading && <p>Loading chart data...</p>}
        {error && <p className="error">Error: {error}</p>}
        {/* Chart is rendered directly into the ref'd div */}
      </div>
    </div>
  );
};

export default StockChart; 