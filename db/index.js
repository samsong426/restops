const Database = require('better-sqlite3');
const fs = require('fs');
const os = require('os');
const path = require('path');

function resolveDbPath() {
  const explicitDbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : null;
  const localProjectDbPath = path.join(os.homedir(), 'Downloads', 'code', 'restaurant-ops', 'data.db');
  const repoDbPath = path.join(__dirname, '..', 'data.db');
  const appDataDbPath = process.env.APP_DATA_DIR
    ? path.join(path.resolve(process.env.APP_DATA_DIR), 'data.db')
    : null;

  const candidates = [
    explicitDbPath,
    fs.existsSync(localProjectDbPath) ? localProjectDbPath : null,
    fs.existsSync(repoDbPath) ? repoDbPath : null,
    appDataDbPath,
  ].filter(Boolean);

  return candidates[0];
}

const DB_PATH = resolveDbPath();
const dbDir = path.dirname(DB_PATH);

fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schedule_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'unit',
    par_level REAL NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'general',
    active INTEGER NOT NULL DEFAULT 1,
    cost_per_unit REAL DEFAULT 0,
    expiry_date TEXT
  );

  CREATE TABLE IF NOT EXISTS inventory_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id),
    count REAL NOT NULL,
    counted_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS eod_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    covers INTEGER,
    sales_total REAL,
    cash_total REAL,
    card_total REAL,
    ran_out TEXT,
    notes TEXT,
    opener_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inventory_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    qty REAL NOT NULL,
    expiry_date TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS recipe_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    qty_used REAL NOT NULL,
    UNIQUE(menu_item_id, inventory_item_id)
  );

  CREATE TABLE IF NOT EXISTS dish_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    qty_sold INTEGER NOT NULL DEFAULT 0,
    UNIQUE(date, menu_item_id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS clock_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff(id),
    date TEXT NOT NULL,
    clocked_in TEXT NOT NULL,
    clocked_out TEXT,
    notes TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS daily_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrations
['cost_per_unit REAL DEFAULT 0', 'expiry_date TEXT'].forEach(col => {
  try { db.exec(`ALTER TABLE inventory_items ADD COLUMN ${col}`); } catch {}
});
try { db.exec(`ALTER TABLE staff ADD COLUMN hourly_rate REAL DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE inventory_batches ADD COLUMN purchase_date TEXT`); } catch {}
db.exec(`UPDATE inventory_batches SET purchase_date = date(received_at, 'localtime') WHERE purchase_date IS NULL`);

module.exports = db;
