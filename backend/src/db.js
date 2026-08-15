const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'mwlc.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fanbook_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT NOT NULL DEFAULT '',
  round INTEGER NOT NULL DEFAULT 1,
  seq INTEGER NOT NULL DEFAULT 1,
  matchup TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  team_a_name TEXT NOT NULL DEFAULT '',
  t1_a_name TEXT NOT NULL DEFAULT '',
  t1_a_fb TEXT NOT NULL DEFAULT '',
  t1_a_id TEXT NOT NULL DEFAULT '',
  t2_a_name TEXT NOT NULL DEFAULT '',
  t2_a_id TEXT NOT NULL DEFAULT '',
  sub_a_name TEXT NOT NULL DEFAULT '',
  sub_a_id TEXT NOT NULL DEFAULT '',
  team_b_name TEXT NOT NULL DEFAULT '',
  t1_b_name TEXT NOT NULL DEFAULT '',
  t1_b_fb TEXT NOT NULL DEFAULT '',
  t1_b_id TEXT NOT NULL DEFAULT '',
  t2_b_name TEXT NOT NULL DEFAULT '',
  t2_b_id TEXT NOT NULL DEFAULT '',
  sub_b_name TEXT NOT NULL DEFAULT '',
  sub_b_id TEXT NOT NULL DEFAULT '',
  map TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL UNIQUE REFERENCES schedules(id) ON DELETE CASCADE,
  score TEXT NOT NULL DEFAULT '',
  winner TEXT NOT NULL DEFAULT '',
  referee_id TEXT NOT NULL DEFAULT '',
  recorder_id TEXT NOT NULL DEFAULT '',
  screenshot_count INTEGER NOT NULL DEFAULT 0,
  screenshots TEXT NOT NULL DEFAULT '[]',
  game_links TEXT NOT NULL DEFAULT '[]',
  remark TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'file',
  original_name TEXT NOT NULL DEFAULT '',
  filename TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  fanbook TEXT NOT NULL DEFAULT '',
  game_id TEXT NOT NULL DEFAULT '',
  slot TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  rules_content TEXT NOT NULL DEFAULT '',
  rules_background TEXT NOT NULL DEFAULT '',
  content_background TEXT NOT NULL DEFAULT '',
  registration_url TEXT NOT NULL DEFAULT '',
  maps TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`);

// 多赛事支持：为既有表补充 tournament_id（默认归属 1 号赛事，向后兼容存量数据）
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('schedules', 'tournament_id', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('schedules', 'team_a_lineup', 'TEXT NOT NULL DEFAULT \'[]\'');
ensureColumn('schedules', 'team_b_lineup', 'TEXT NOT NULL DEFAULT \'[]\'');
ensureColumn('players', 'tournament_id', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('uploads', 'tournament_id', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('tournaments', 'content_background', 'TEXT NOT NULL DEFAULT \'\'');

const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!cols.includes('title')) {
  db.exec(`ALTER TABLE users ADD COLUMN title TEXT NOT NULL DEFAULT ''`);
}
if (!cols.includes('avatar')) {
  db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ''`);
}

function seedTournaments() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM tournaments').get().c;
  if (count === 0) {
    const g = (key, def) => {
      const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return r ? r.value : def;
    };
    db.prepare(`
      INSERT INTO tournaments (code, name, description, rules_content, rules_background, registration_url, maps)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'default',
      g('tournament_name', 'MWLC赛事'),
      '默认赛事',
      g('rules_content', ''),
      g('rules_background', ''),
      g('registration_url', ''),
      g('maps', '[]')
    );
  }
}

seedTournaments();

function seed() {
  const hash = bcrypt.hashSync('MWLC123456', 10);
  const main = db.prepare("SELECT id, role FROM users WHERE fanbook_id = '1000000'").get();
  if (!main) {
    db.prepare('INSERT INTO users (fanbook_id, password_hash, name, title, role) VALUES (?, ?, ?, ?, ?)')
      .run('1000000', hash, '主办', '主办', 'superadmin');
  } else if (main.role !== 'superadmin') {
    db.prepare("UPDATE users SET role = 'superadmin' WHERE id = ?").run(main.id);
  }
  const special = db.prepare("SELECT id, title FROM users WHERE fanbook_id = '20605142'").get();
  if (!special) {
    db.prepare('INSERT INTO users (fanbook_id, password_hash, name, title, role) VALUES (?, ?, ?, ?, ?)')
      .run('20605142', hash, '赛事综合组', '裁判长,裁判/录像', 'admin');
  } else if (special.title.includes('裁判,录像')) {
    db.prepare("UPDATE users SET title = '裁判长,裁判/录像' WHERE id = ?").run(special.id);
  }
  const tCount = db.prepare("SELECT COUNT(*) AS c FROM settings WHERE key = 'tournament_name'").get().c;
  if (tCount === 0) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('tournament_name', 'MWLC赛事');
  }
  const rCount = db.prepare("SELECT COUNT(*) AS c FROM settings WHERE key = 'rules_content'").get().c;
  if (rCount === 0) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('rules_content', '');
  }
  const bCount = db.prepare("SELECT COUNT(*) AS c FROM settings WHERE key = 'rules_background'").get().c;
  if (bCount === 0) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('rules_background', '');
  }
  const mCount = db.prepare("SELECT COUNT(*) AS c FROM settings WHERE key = 'maps'").get().c;
  if (mCount === 0) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('maps', '[]');
  }
}

seed();

module.exports = db;
