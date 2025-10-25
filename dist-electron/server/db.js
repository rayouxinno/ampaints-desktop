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
exports.sqliteDb = exports.db = void 0;
exports.setDatabasePath = setDatabasePath;
exports.getDatabasePath = getDatabasePath;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const better_sqlite3_2 = require("drizzle-orm/better-sqlite3");
const schema = __importStar(require("@shared/schema"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// This will be set by Electron main process via environment variable
// Default to current working directory for development
let dbPath = process.env.DATABASE_PATH || path_1.default.join(process.cwd(), "paintpulse.db");
// Function to set database path (called from Electron main process)
function setDatabasePath(newPath) {
    dbPath = newPath;
    // Ensure directory exists
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    // Reinitialize database with new path
    initializeDatabase();
}
// Get current database path
function getDatabasePath() {
    return dbPath;
}
let sqlite;
let dbInstance;
function initializeDatabase() {
    // Close existing connection if any
    if (sqlite) {
        sqlite.close();
    }
    // Create new connection
    sqlite = new better_sqlite3_1.default(dbPath);
    sqlite.pragma("journal_mode = WAL"); // Write-Ahead Logging for better performance
    sqlite.pragma("foreign_keys = ON"); // Enable foreign key constraints
    // Initialize drizzle
    dbInstance = (0, better_sqlite3_2.drizzle)(sqlite, { schema });
    // Create tables if they don't exist
    createTables();
}
function createTables() {
    if (!sqlite)
        return;
    // Create products table
    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      product_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
    // Create variants table
    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      packing_size TEXT NOT NULL,
      rate TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);
    // Create colors table
    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS colors (
      id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL,
      color_name TEXT NOT NULL,
      color_code TEXT NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE
    );
  `);
    // Create sales table
    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      total_amount TEXT NOT NULL,
      amount_paid TEXT NOT NULL DEFAULT '0',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      created_at INTEGER NOT NULL
    );
  `);
    // Create sale_items table
    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      color_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      rate TEXT NOT NULL,
      subtotal TEXT NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (color_id) REFERENCES colors(id)
    );
  `);
}
// Initialize database on startup
initializeDatabase();
exports.db = dbInstance;
exports.sqliteDb = sqlite;
