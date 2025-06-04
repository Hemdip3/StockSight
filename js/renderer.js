// StockSight/js/renderer.js

// Establishes communication channel with the main Electron process for backend interactions.
const { ipcRenderer } = require('electron');

const stockSymbolInput = document.getElementById('stockSymbol');
const timeRangeSelect = document.getElementById('timeRange');
const fetchDataButton = document.getElementById('fetchDataButton');
const statusMessageDiv = document.getElementById('statusMessage');

const metricOpen = document.getElementById('metricOpen');
const metricHigh = document.getElementById('metricHigh');
const metricLow = document.getElementById('metricLow');
const metricClose = document.getElementById('metricClose');
const metricVolume = document.getElementById('metricVolume');

const stockChartManager = new ChartManager('stockChart');

/** Displays status updates to the user with dynamic styling and auto-hiding. */
function showStatusMessage(message, type) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = `status-message ${type}-message`;
    statusMessageDiv.classList.remove('hidden');

    if (type !== 'loading') {
        setTimeout(() => {
            statusMessageDiv.classList.add('hidden');
        }, 5000);
    }
}

/** Resets all displayed key stock metrics to a default placeholder. */
function clearMetrics() {
    metricOpen.textContent = '--';
    metricHigh.textContent = '--';
    metricLow.textContent = '--';
    metricClose.textContent = '--';
    metricVolume.textContent = '--';
}

/** Populates the UI with new stock key metrics, formatting values and handling missing data. */
function updateKeyMetrics(metrics) {
    if (metrics) {
        metricOpen.textContent = metrics.open ? metrics.open.toFixed(2) : '--';
        metricHigh.textContent = metrics.high ? metrics.high.toFixed(2) : '--';
        metricLow.textContent = metrics.low ? metrics.low.toFixed(2) : '--';
        metricClose.textContent = metrics.close ? metrics.close.toFixed(2) : '--';
        metricVolume.textContent = metrics.volume ? metrics.volume.toLocaleString() : '--';
    } else {
        clearMetrics();
    }
}

// Event listener for the 'Fetch Data' button, validating input and sending a request to the main process.
fetchDataButton.addEventListener('click', async () => {
    const symbol = stockSymbolInput.value.trim().toUpperCase();
    const timeRange = timeRangeSelect.value;

    if (!symbol) {
        showStatusMessage('Please enter a stock symbol.', 'error');
        stockChartManager.clearChart();
        clearMetrics();
        return;
    }

    showStatusMessage('Fetching data...', 'loading');
    fetchDataButton.disabled = true;
    stockChartManager.clearChart();
    clearMetrics();

    ipcRenderer.send('fetch-stock-data', { symbol, timeRange });
});

// IPC listener to process stock data responses (success or error) received from the main process.
ipcRenderer.on('stock-data-response', (event, { success, chartData, keyMetrics, message }) => {
    fetchDataButton.disabled = false;

    if (success) {
        showStatusMessage(`Data fetched successfully for ${stockSymbolInput.value.trim().toUpperCase()}!`, 'success');
        if (chartData && chartData.labels && chartData.labels.length > 0) {
            stockChartManager.updateChart(chartData, stockSymbolInput.value.trim().toUpperCase(), chartData.isDeclining);
        } else {
            stockChartManager.clearChart();
            showStatusMessage('No chart data available for the selected time range.', 'error');
        }
        updateKeyMetrics(keyMetrics);
    } else {
        showStatusMessage(message || 'Failed to fetch stock data. Please try again.', 'error');
        stockChartManager.clearChart();
        clearMetrics();
    }
});

// Initializes UI state on DOM content load, ensuring a clean and hidden status message.
document.addEventListener('DOMContentLoaded', () => {
    stockChartManager.clearChart();
    clearMetrics();
    statusMessageDiv.classList.add('hidden');
});