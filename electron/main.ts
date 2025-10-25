import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import fs from "fs";

// ✅ Correct import for ESM default export in electron-store v11+
import ElectronStore from "electron-store";

// ------------------------------
//  Electron Store Configuration
// ------------------------------
interface StoreType {
  databasePath?: string;
  windowBounds?: { width: number; height: number; x?: number; y?: number };
  isActivated?: boolean;
}

const store = new ElectronStore<StoreType>({
  schema: {
    databasePath: { type: "string" },
    windowBounds: {
      type: "object",
      properties: {
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
      },
    },
    isActivated: { type: "boolean", default: false },
  },
});

// ------------------------------
//  Globals
// ------------------------------
let mainWindow: BrowserWindow | null = null;

// ------------------------------
//  Database Path Management
// ------------------------------
function getDatabasePath(): string {
  let dbPath = store.get("databasePath");
  if (!dbPath) {
    const documentsPath = app.getPath("documents");
    const defaultPath = path.join(documentsPath, "PaintPulse", "paintpulse.db");
    dbPath = defaultPath;
    store.set("databasePath", defaultPath);
  }
  return dbPath;
}

async function selectDatabaseLocation(): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: "Select Database Location",
    defaultPath: getDatabasePath(),
    filters: [
      { name: "Database Files", extensions: ["db"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["createDirectory", "showOverwriteConfirmation"],
  });

  if (!result.canceled && result.filePath) {
    store.set("databasePath", result.filePath);
    return result.filePath;
  }
  return null;
}

// ------------------------------
//  Create Browser Window
// ------------------------------
function createWindow() {
  const windowBounds = store.get("windowBounds") || {
    width: 1400,
    height: 900,
  };

  mainWindow = new BrowserWindow({
    ...windowBounds,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "PaintPulse - Paint Store Management",
    show: false,
  });

  // Save window bounds
  const saveBounds = () => {
    if (mainWindow) store.set("windowBounds", mainWindow.getBounds());
  };
  mainWindow.on("resize", saveBounds);
  mainWindow.on("move", saveBounds);

  // Show when ready
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // Load renderer
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/public/index.html"));
  }

  mainWindow.on("closed", () => (mainWindow = null));
}

// ------------------------------
//  IPC Handlers
// ------------------------------
ipcMain.handle("get-database-path", () => getDatabasePath());

ipcMain.handle("select-database-location", async () => {
  const newPath = await selectDatabaseLocation();
  if (newPath) {
    app.relaunch();
    app.exit();
  }
  return newPath;
});

ipcMain.handle("export-database", async () => {
  const currentDbPath = getDatabasePath();

  const result = await dialog.showSaveDialog({
    title: "Export Database",
    defaultPath: "paintpulse-backup.db",
    filters: [
      { name: "Database Files", extensions: ["db"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (!result.canceled && result.filePath) {
    const fsPromises = await import("fs/promises");
    try {
      await fsPromises.copyFile(currentDbPath, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  return { success: false, error: "Export cancelled" };
});

ipcMain.handle("import-database", async () => {
  const result = await dialog.showOpenDialog({
    title: "Import Database",
    filters: [
      { name: "Database Files", extensions: ["db"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const newDbPath = result.filePaths[0];
    store.set("databasePath", newDbPath);
    app.relaunch();
    app.exit();
    return { success: true, path: newDbPath };
  }

  return { success: false, error: "Import cancelled" };
});

ipcMain.handle("get-activation-status", () => store.get("isActivated", false));
ipcMain.handle("set-activation-status", (_event, status: boolean) => {
  store.set("isActivated", status);
  return true;
});

// ------------------------------
//  App Lifecycle
// ------------------------------
app.whenReady().then(async () => {
  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);
  const fsPromises = await import("fs/promises");
  try {
    await fsPromises.mkdir(dbDir, { recursive: true });
  } catch (error) {
    console.error("Error creating database directory:", error);
  }

  process.env.DATABASE_PATH = dbPath;

  // Start server
  await import("../server/index.js");

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
