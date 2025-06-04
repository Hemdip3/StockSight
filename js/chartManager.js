/**
 * Manages an ApexCharts instance for displaying stock data.
 * Handles chart initialization, updates, and clearing.
 */
function ChartManager(elementId) {
    this.chartElement = document.getElementById(elementId);
    // Crucial check: Ensure the target HTML element exists before proceeding.
    if (!this.chartElement) {
        console.error(`ChartManager: Chart element with ID '${elementId}' not found. Cannot initialize.`);
        return;
    }
    this.chartInstance = null; // Holds the active ApexCharts object.
}

//Updates or initializes the stock price chart with new data.

ChartManager.prototype.updateChart = function(chartData, symbol, isDeclining) {
    // Basic validation: Ensure essential chart data is present before attempting to render.
    if (!chartData || !chartData.labels || chartData.labels.length === 0 || !chartData.close || chartData.close.length === 0) {
        console.warn('ChartManager: No valid line chart data provided. Chart will be cleared or not rendered.');
        this.clearChart();
        return;
    }

    const { labels, close } = chartData;

   
    const lineColor = isDeclining ? '#e74c3c' : '#00E396';
    const gradientStartColor = isDeclining ? '#f7baba' : '#C7F7D2'; 

    const options = {
        series: [{
            name: `${symbol} Close Price`,
            data: close
        }],
        chart: {
            type: 'area', // Uses 'area' for a filled appearance, effectively a line chart with fill.
            height: '100%',
            width: '100%',
            toolbar: { show: true },
            zoom: { enabled: true },
            animations: { enabled: true, easing: 'easeinout', speed: 800 }
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2, colors: [lineColor] },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.9, stops: [0, 100],
                colorStops: [
                    { offset: 0, color: lineColor, opacity: 0.7 },
                    { offset: 100, color: gradientStartColor, opacity: 0.1 }
                ]
            }
        },
        title: { text: `${symbol} Close Price Trend`, align: 'left', style: { fontSize: '16px', color: '#263238' } },
        grid: {
            row: { colors: ['#f3f3f3', 'transparent'], opacity: 0.5 },
            borderColor: '#e7e7e7',
        },
        xaxis: {
            categories: labels,
            type: 'datetime',
            title: { text: 'Date' },
            labels: {
                formatter: function(val) {
                    // Format X-axis labels to a readable date format.
                    return val ? new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
                }
            },
            tickAmount: 6,
            tooltip: { enabled: false } // Disable X-axis specific tooltip to rely on the main tooltip.
        },
        yaxis: {
            title: { text: 'Price (INR)' },
            labels: { formatter: function (val) { return val.toFixed(2); } },
            // Add a 5% buffer to min/max Y-axis values for better visual spacing.
            min: function(min) { return min * 0.95; },
            max: function(max) { return max * 1.05; }
        },
        tooltip: {
            x: {
                formatter: function(val) {
                    // Format tooltip date/time for detailed display on hover.
                    return val ? new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                }
            }
        }
    };

    // Update existing chart or create a new one.
    if (this.chartInstance) {
        this.chartInstance.updateOptions(options, true);
        console.log(`ApexCharts instance updated for line chart.`);
    } else {
        this.chartInstance = new ApexCharts(this.chartElement, options);
        this.chartInstance.render();
        console.log(`New ApexCharts instance created and rendered as line chart.`);
    }
};


//Destroys the current ApexCharts instance and clears its container.

ChartManager.prototype.clearChart = function() {
    if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null; // Nullify reference to allow garbage collection.
        console.log("ApexCharts instance destroyed.");
    }
    // Explicitly clear the HTML content in case `destroy()` doesn't fully remove it.
    if (this.chartElement) {
        this.chartElement.innerHTML = '';
    }
};