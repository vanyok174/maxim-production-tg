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
  `);

  return _db;
}
