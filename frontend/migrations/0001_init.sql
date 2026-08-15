-- MWLC 赛事协助系统 - D1 初始化迁移
-- 用法: npx wrangler d1 execute mwlc-db --remote --file migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fanbook_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff',
  avatar TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL DEFAULT 1,
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  team_a_lineup TEXT NOT NULL DEFAULT '[]',
  team_b_lineup TEXT NOT NULL DEFAULT '[]'
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
  tournament_id INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  fanbook TEXT NOT NULL DEFAULT '',
  game_id TEXT NOT NULL DEFAULT '',
  slot TEXT NOT NULL DEFAULT '',
  tournament_id INTEGER NOT NULL DEFAULT 1,
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

-- 种子：默认赛事
INSERT OR IGNORE INTO tournaments (code, name, description) VALUES ('default', 'MWLC赛事', '默认赛事');

-- 种子：预置账号（密码均为 MWLC123456）
INSERT OR IGNORE INTO users (fanbook_id, password_hash, name, title, role) VALUES
  ('1000000', '$2a$10$lqlcgNgKWsia3aMxEbxovO1XoGPaQT1eViOTCv1JqvPO2l5TjqGKe', '主办', '主办', 'superadmin'),
  ('20605142', '$2a$10$lqlcgNgKWsia3aMxEbxovO1XoGPaQT1eViOTCv1JqvPO2l5TjqGKe', '赛事综合组', '裁判长,裁判/录像', 'admin');
