import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  // Database operations
  getDatabasePath: () => ipcRenderer.invoke("get-database-path"),
  selectDatabaseLocation: () => ipcRenderer.invoke("select-database-location"),
  exportDatabase: () => ipcRenderer.invoke("export-database"),
  importDatabase: () => ipcRenderer.invoke("import-database"),
  // Activation operations
  getActivationStatus: () => ipcRenderer.invoke("get-activation-status"),
  setActivationStatus: (status: boolean) => ipcRenderer.invoke("set-activation-status", status),
});

// Add type definitions for TypeScript
declare global {
  interface Window {
    electron?: {
      getDatabasePath: () => Promise<string>;
      selectDatabaseLocation: () => Promise<string | null>;
      exportDatabase: () => Promise<{ success: boolean; path?: string; error?: string }>;
      importDatabase: () => Promise<{ success: boolean; path?: string; error?: string }>;
      getActivationStatus: () => Promise<boolean>;
      setActivationStatus: (status: boolean) => Promise<boolean>;
    };
  }
}
