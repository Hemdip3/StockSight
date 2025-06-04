// StockSight/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { fetchStockData } = require('./js/stockService'); // Import your stockService

// Determine if the app is in development mode
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // nodeIntegration allows ipcRenderer to be available directly in renderer.js.
            // contextIsolation: false is used for compatibility with simpler preload/renderer access.
            // For production, contextIsolation: true is recommended for security, requiring proper contextBridge setup.
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile('index.html');

    // Open DevTools in development mode for debugging.
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
}

// App lifecycle events
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        // On macOS, re-create a window when the dock icon is clicked and no other windows are open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

//IPC Main Handlers
// Listens for stock data requests from the renderer process.
ipcMain.on('fetch-stock-data', async (event, { symbol, timeRange }) => {
    try {
        const { chartData, keyMetrics, errorMessage } = await fetchStockData(symbol, timeRange);

        if (errorMessage) {
            event.reply('stock-data-response', { success: false, message: errorMessage });
        } else {
            event.reply('stock-data-response', { success: true, chartData, keyMetrics });
        }
    } catch (error) {
        // Log unexpected backend errors for debugging.
        console.error('Main process: Error fetching stock data:', error);
        event.reply('stock-data-response', { success: false, message: `An unexpected error occurred: ${error.message}` });
    }
});