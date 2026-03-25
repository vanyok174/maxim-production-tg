import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const sqlitePath = process.env.SQLITE_PATH || path.resolve(process.cwd(), 'data/app.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) throw new Error('DB not initialized');
  return _db;
}

export function initDb(): Database.Database {
  const dir = path.dirname(sqlitePath);
  fs.mkdirSync(dir, { recursive: true });
  _db = new Database(sqlitePath);
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      productivity_per_day REAL NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      pay_per_unit REAL NOT NULL DEFAULT 0,
      plan_fbs_per_day REAL NOT NULL DEFAULT 0,
      wb_supplier_article TEXT,
      avg_daily_sales REAL,
      wb_synced_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assemblies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assembly_date TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      article_name TEXT NOT NULL,
      qty REAL NOT NULL,
      confirmed INTEGER NOT NULL DEFAULT 0,
      pay_per_unit REAL,
      amount REAL,
      created_by_tg_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_assemblies_date ON assemblies(assembly_date);
    CREATE INDEX IF NOT EXISTS idx_assemblies_employee ON assemblies(employee_name);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_type TEXT NOT NULL CHECK(shipment_type IN ('FBO', 'FBS')),
      shipment_date TEXT NOT NULL,
      article_name TEXT NOT NULL,
      qty REAL NOT NULL,
      collected REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments(shipment_date);

    CREATE TABLE IF NOT EXISTS schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name TEXT NOT NULL,
      work_date TEXT NOT NULL,
      is_working INTEGER NOT NULL DEFAULT 1,
      UNIQUE(employee_name, work_date)
    );

    CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule(work_date);

    CREATE TABLE IF NOT EXISTS stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_name TEXT NOT NULL,
      warehouse_name TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(article_name, warehouse_name)
    );
  `);

  return _db;
}
