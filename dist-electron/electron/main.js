"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_store_1 = __importDefault(require("electron-store"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const path_2 = require("path");
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = (0, path_2.dirname)(__filename);
const store = new electron_store_1.default();
let mainWindow = null;
let serverReady = false;
// Database path management
function getDatabasePath() {
    let dbPath = store.get("databasePath");
    if (!dbPath) {
        // Default to Documents/PaintPulse/paintpulse.db
        const documentsPath = electron_1.app.getPath("documents");
        const defaultPath = path_1.default.join(documentsPath, "PaintPulse", "paintpulse.db");
        dbPath = defaultPath;
        store.set("databasePath", defaultPath);
    }
    return dbPath;
}
async function selectDatabaseLocation() {
    const result = await electron_1.dialog.showSaveDialog({
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
    // Get saved window bounds or use defaults
    const windowBounds = store.get("windowBounds") || {
        width: 1400,
        height: 900
    };
    mainWindow = new electron_1.BrowserWindow({
        ...windowBounds,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: "PaintPulse - Paint Store Management",
        show: false, // Don't show until ready-to-show event
    });
    // Save window bounds on resize/move
    mainWindow.on("resize", () => {
        if (!mainWindow)
            return;
        const bounds = mainWindow.getBounds();
        store.set("windowBounds", bounds);
    });
    mainWindow.on("move", () => {
        if (!mainWindow)
            return;
        const bounds = mainWindow.getBounds();
        store.set("windowBounds", bounds);
    });
    // Show window when ready
    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
    });
    // Load app
    if (process.env.NODE_ENV === "development") {
        mainWindow.loadURL("http://localhost:5000");
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, "../dist/public/index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
// IPC Handlers
electron_1.ipcMain.handle("get-database-path", () => {
    return getDatabasePath();
});
electron_1.ipcMain.handle("select-database-location", async () => {
    const newPath = await selectDatabaseLocation();
    if (newPath) {
        // Restart app to apply new database location
        electron_1.app.relaunch();
        electron_1.app.exit();
    }
    return newPath;
});
electron_1.ipcMain.handle("export-database", async () => {
    const currentDbPath = getDatabasePath();
    const result = await electron_1.dialog.showSaveDialog({
        title: "Export Database",
        defaultPath: "paintpulse-backup.db",
        filters: [
            { name: "Database Files", extensions: ["db"] },
            { name: "All Files", extensions: ["*"] }
        ],
    });
    if (!result.canceled && result.filePath) {
        const fs = await Promise.resolve().then(() => __importStar(require("fs/promises")));
        try {
            await fs.copyFile(currentDbPath, result.filePath);
            return { success: true, path: result.filePath };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    return { success: false, error: "Export cancelled" };
});
electron_1.ipcMain.handle("import-database", async () => {
    const result = await electron_1.dialog.showOpenDialog({
        title: "Import Database",
        filters: [
            { name: "Database Files", extensions: ["db"] },
            { name: "All Files", extensions: ["*"] }
        ],
        properties: ["openFile"],
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const newDbPath = result.filePaths[0];
        store.set("databasePath", newDbPath);
        // Restart app to apply new database
        electron_1.app.relaunch();
        electron_1.app.exit();
        return { success: true, path: newDbPath };
    }
    return { success: false, error: "Import cancelled" };
});
// App lifecycle
electron_1.app.whenReady().then(async () => {
    // Ensure database directory exists
    const dbPath = getDatabasePath();
    const dbDir = path_1.default.dirname(dbPath);
    const fs = await Promise.resolve().then(() => __importStar(require("fs/promises")));
    try {
        await fs.mkdir(dbDir, { recursive: true });
    }
    catch (error) {
        console.error("Error creating database directory:", error);
    }
    // Set database path in server module
    process.env.DATABASE_PATH = dbPath;
    // Start Express server
    const serverModule = await Promise.resolve().then(() => __importStar(require("../server/index.js")));
    createWindow();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
