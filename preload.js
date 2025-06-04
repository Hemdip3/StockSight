// StockSight/preload.js
// This script runs in the renderer process *before* your web page loads.
// It has access to Node.js APIs as well as the DOM.

// For now, since contextIsolation is set to false in main.js,
// we will comment out contextBridge related code to prevent the error.
// If you enable contextIsolation: true in main.js later, you can uncomment this.

// const { contextBridge, ipcRenderer } = require('electron'); // Include ipcRenderer

window.addEventListener('DOMContentLoaded', () => {
  // Example of using contextBridge to expose a safe API to the renderer
  
  //preload script logic that doesn't use contextBridge can go here.
  // Example:
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }
  // for (const type of ['chrome', 'node', 'electron']) {
  //   replaceText(`${type}-version`, process.versions[type])
  // }
});