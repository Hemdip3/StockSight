const axios = require('axios');
const { alphaVantageKeys } = require('../config/apiKeys'); 

let currentApiKeyIndex = 0; // Index for rotating through API keys to handle rate limits
const MAX_RETRIES_PER_KEY = 1; // Number of retries with the current key before trying the next

/**
 * Cycles through available API keys.
 * Handles key exhaustion by warning and returning null if all keys have been tried.
 */
function getNextApiKey() {
    currentApiKeyIndex = (currentApiKeyIndex + 1) % alphaVantageKeys.length;
    // If rotation brings us back to the first key, it means all keys have been attempted.
    if (currentApiKeyIndex === 0) {
        console.warn('All Alpha Vantage API keys exhausted or rate limited. Please wait and try again later.');
        return null;
    }
    return alphaVantageKeys[currentApiKeyIndex];
}

/**
 * Fetches raw time series data from Alpha Vantage, incorporating API key rotation and retry logic.
 * Specifically handles Alpha Vantage's rate limit notes and custom error messages.
 */
async function fetchRawAlphaVantageData(symbol, timeFrame, retries = 0) {
    const apiKey = alphaVantageKeys[currentApiKeyIndex];
    if (!apiKey) {
        throw new Error('No Alpha Vantage API keys available or all exhausted.');
    }

    let functionType;
    let intervalParam = '';
    let outputsize = 'compact'; // 'compact' for recent data, 'full' for complete history

    switch (timeFrame) {
        case 'daily':
            functionType = 'TIME_SERIES_INTRADAY';
            intervalParam = '&interval=1min';
            break;
        case 'weekly':
        case 'monthly':
        case 'yearly':
        case '5year':
            functionType = 'TIME_SERIES_DAILY';
            outputsize = 'full'; 
            break;
        default:
            throw new Error('Invalid time frame provided.');
    }

    const url = `https://www.alphavantage.co/query?function=${functionType}&symbol=${symbol}${intervalParam}&outputsize=${outputsize}&apikey=${apiKey}`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        // Alpha Vantage embeds errors or notes directly in the response data.
        if (data['Error Message']) {
            if (data['Error Message'].includes('Invalid API call') && data['Error Message'].includes('time series is not available')) {
                throw new Error(`Stock symbol "${symbol}" not found or no data available.`);
            }
            throw new Error(`API Error: ${data['Error Message']}`);
        }

        // Handle explicit rate limit message from Alpha Vantage.
        if (data['Note'] && data['Note'].includes('Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute')) {
            console.warn(`Alpha Vantage API rate limit hit with key ${currentApiKeyIndex + 1}. Retrying with next key...`);
            if (retries < alphaVantageKeys.length * MAX_RETRIES_PER_KEY) {
                getNextApiKey(); 
                return fetchRawAlphaVantageData(symbol, timeFrame, retries + 1); 
            } else {
                throw new Error('API rate limit exceeded for all available keys. Please wait and try again later.');
            }
        }

        return data;

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            console.error(`HTTP error status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`);
            throw new Error(`Network error: ${error.response.status} - ${error.response.statusText}`);
        } else if (error.message.includes('API rate limit exceeded')) {
            // Re-throw specific rate limit error after exhausting all retry attempts.
            throw error;
        } else {
            console.error('Error in fetchRawAlphaVantageData:', error.message);
            throw error; // Re-throw unhandled errors.
        }
    }
}

/**
 * Processes raw Alpha Vantage data to extract structured chart data and key metrics.
 * Filters data based on the requested time frame.
 */
function processStockData(rawData, timeFrame) {
    let timeSeries;
    let latestDataPoint = {};

    switch (timeFrame) {
        case 'daily':
            timeSeries = rawData['Time Series (1min)'];
            break;
        case 'weekly':
        case 'monthly':
        case 'yearly':
        case '5year':
            timeSeries = rawData['Time Series (Daily)'];
            break;
        default:
            throw new Error('Invalid time frame for processing.');
    }

    if (!timeSeries) {
        throw new Error('No time series data found in the API response.');
    }

    const dataEntries = Object.entries(timeSeries).map(([dateStr, values]) => ({
        date: new Date(dateStr),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume'], 10),
    }));

    // Sort entries by date in ascending order for accurate chronological processing.
    dataEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    let filteredEntries = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date to midnight for consistent filtering.

    if (timeFrame === 'daily') {
        if (dataEntries.length === 0) {
            throw new Error('No intraday data available for the current day.');
        }
        // For 'daily' (intraday), filter to only include data from the most recent trading day.
        const latestDate = dataEntries[dataEntries.length - 1].date;
        const latestDateOnly = new Date(latestDate);
        latestDateOnly.setHours(0,0,0,0);

        filteredEntries = dataEntries.filter(entry => {
            const entryDateOnly = new Date(entry.date);
            entryDateOnly.setHours(0,0,0,0);
            return entryDateOnly.getTime() === latestDateOnly.getTime();
        });

    } else {
        let startDate = new Date(today); // Determine the start date for historical filtering.

        if (timeFrame === 'weekly') {
            startDate.setDate(today.getDate() - 7);
        } else if (timeFrame === 'monthly') {
            startDate.setMonth(today.getMonth() - 1);
        } else if (timeFrame === 'yearly') {
            startDate.setFullYear(today.getFullYear() - 1);
        } else if (timeFrame === '5year') {
            startDate.setFullYear(today.getFullYear() - 5);
        }

        // Filter data entries that fall within the calculated date range (inclusive).
        filteredEntries = dataEntries.filter(entry => entry.date >= startDate);
    }

    if (filteredEntries.length > 0) {
        latestDataPoint = filteredEntries[filteredEntries.length - 1]; // Use the most recent data point for current metrics.
    } else {
        throw new Error('No data available for the selected time frame after filtering.');
    }

    const chartLabels = filteredEntries.map(entry => entry.date.toISOString()); // ISO string for consistent date parsing by chart library.
    const chartClosePrices = filteredEntries.map(entry => entry.close);

    // Determine if the stock's closing price has declined over the selected period.
    let isDeclining = false;
    if (filteredEntries.length > 1) {
        const firstClose = filteredEntries[0].close;
        const lastClose = filteredEntries[filteredEntries.length - 1].close;
        isDeclining = lastClose < firstClose;
    }

    const keyMetrics = {
        open: latestDataPoint.open,
        high: latestDataPoint.high,
        low: latestDataPoint.low,
        close: latestDataPoint.close,
        volume: latestDataPoint.volume,
    };

    return {
        chartData: { labels: chartLabels, close: chartClosePrices, isDeclining },
        keyMetrics,
    };
}

/**
 * Main function to fetch and process stock data for the renderer process.
 */
async function fetchStockData(symbol, timeRange) {
    try {
        const rawData = await fetchRawAlphaVantageData(symbol, timeRange);
        const { chartData, keyMetrics } = processStockData(rawData, timeRange);
        return { chartData, keyMetrics, errorMessage: null };
    } catch (error) {
        console.error(`fetchStockData failed for ${symbol} (${timeRange}):`, error.message);
        let userMessage = 'Failed to fetch stock data.';

        // Map common error messages to user-friendly explanations.
        if (error.message.includes('API rate limit exceeded')) {
            userMessage = 'API rate limit exceeded. Please wait a minute and try again, or consider using multiple API keys.';
        } else if (error.message.includes('not found or no data available')) {
            userMessage = `Stock symbol "${symbol}" not found or no data available for this time range. API hit rate limit may have been exceeded for this device. Please try again tomorrow.`;
        } else if (error.message.includes('No time series data found')) {
            userMessage = 'No stock data found for the selected time range. This might be due to an invalid symbol or no trading activity.';
        } else if (error.message.includes('Network error')) {
            userMessage = `A network error occurred while fetching data. Please check your internet connection. (${error.message})`;
        } else if (error.message.includes('Invalid time frame')) {
            userMessage = 'Invalid time frame selection.';
        } else if (error.message.includes('No data available for the selected time frame')) {
             userMessage = `No historical data available for the selected time range for ${symbol}.`;
        }

        return { chartData: null, keyMetrics: null, errorMessage: userMessage };
    }
}

module.exports = {
    fetchStockData,
};