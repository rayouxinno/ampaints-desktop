"use strict";

// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electron", {
  // Database operations
  getDatabasePath: () => import_electron.ipcRenderer.invoke("get-database-path"),
  selectDatabaseLocation: () => import_electron.ipcRenderer.invoke("select-database-location"),
  exportDatabase: () => import_electron.ipcRenderer.invoke("export-database"),
  importDatabase: () => import_electron.ipcRenderer.invoke("import-database"),
  // Activation operations
  getActivationStatus: () => import_electron.ipcRenderer.invoke("get-activation-status"),
  setActivationStatus: (status) => import_electron.ipcRenderer.invoke("set-activation-status", status)
});
