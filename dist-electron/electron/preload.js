"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld("electron", {
    // Database operations
    getDatabasePath: () => electron_1.ipcRenderer.invoke("get-database-path"),
    selectDatabaseLocation: () => electron_1.ipcRenderer.invoke("select-database-location"),
    exportDatabase: () => electron_1.ipcRenderer.invoke("export-database"),
    importDatabase: () => electron_1.ipcRenderer.invoke("import-database"),
});
