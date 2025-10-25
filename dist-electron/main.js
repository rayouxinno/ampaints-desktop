"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_electron_store = __toESM(require("electron-store"), 1);
var import_path = __toESM(require("path"), 1);
var store = new import_electron_store.default({
  schema: {
    databasePath: { type: "string" },
    windowBounds: {
      type: "object",
      properties: {
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" }
      }
    },
    isActivated: { type: "boolean", default: false }
  }
});
var mainWindow = null;
function getDatabasePath() {
  let dbPath = store.get("databasePath");
  if (!dbPath) {
    const documentsPath = import_electron.app.getPath("documents");
    const defaultPath = import_path.default.join(documentsPath, "PaintPulse", "paintpulse.db");
    dbPath = defaultPath;
    store.set("databasePath", defaultPath);
  }
  return dbPath;
}
async function selectDatabaseLocation() {
  const result = await import_electron.dialog.showSaveDialog({
    title: "Select Database Location",
    defaultPath: getDatabasePath(),
    filters: [
      { name: "Database Files", extensions: ["db"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["createDirectory", "showOverwriteConfirmation"]
  });
  if (!result.canceled && result.filePath) {
    store.set("databasePath", result.filePath);
    return result.filePath;
  }
  return null;
}
function createWindow() {
  const windowBounds = store.get("windowBounds") || {
    width: 1400,
    height: 900
  };
  mainWindow = new import_electron.BrowserWindow({
    ...windowBounds,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: "PaintPulse - Paint Store Management",
    show: false
    // Don't show until ready-to-show event
  });
  mainWindow.on("resize", () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    store.set("windowBounds", bounds);
  });
  mainWindow.on("move", () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    store.set("windowBounds", bounds);
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(import_path.default.join(__dirname, "../dist/public/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron.ipcMain.handle("get-database-path", () => {
  return getDatabasePath();
});
import_electron.ipcMain.handle("select-database-location", async () => {
  const newPath = await selectDatabaseLocation();
  if (newPath) {
    import_electron.app.relaunch();
    import_electron.app.exit();
  }
  return newPath;
});
import_electron.ipcMain.handle("export-database", async () => {
  const currentDbPath = getDatabasePath();
  const result = await import_electron.dialog.showSaveDialog({
    title: "Export Database",
    defaultPath: "paintpulse-backup.db",
    filters: [
      { name: "Database Files", extensions: ["db"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (!result.canceled && result.filePath) {
    const fs = await import("fs/promises");
    try {
      await fs.copyFile(currentDbPath, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: "Export cancelled" };
});
import_electron.ipcMain.handle("import-database", async () => {
  const result = await import_electron.dialog.showOpenDialog({
    title: "Import Database",
    filters: [
      { name: "Database Files", extensions: ["db"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const newDbPath = result.filePaths[0];
    store.set("databasePath", newDbPath);
    import_electron.app.relaunch();
    import_electron.app.exit();
    return { success: true, path: newDbPath };
  }
  return { success: false, error: "Import cancelled" };
});
import_electron.ipcMain.handle("get-activation-status", () => {
  return store.get("isActivated", false);
});
import_electron.ipcMain.handle("set-activation-status", (_event, status) => {
  store.set("isActivated", status);
  return true;
});
import_electron.app.whenReady().then(async () => {
  const dbPath = getDatabasePath();
  const dbDir = import_path.default.dirname(dbPath);
  const fs = await import("fs/promises");
  try {
    await fs.mkdir(dbDir, { recursive: true });
  } catch (error) {
    console.error("Error creating database directory:", error);
  }
  process.env.DATABASE_PATH = dbPath;
  const serverModule = await import("../server/index.js");
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});
