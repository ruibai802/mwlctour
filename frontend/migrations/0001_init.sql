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

-- ============================================================
-- 扩展模块（RBAC 角色权限 / 分组 / 工作人员与考勤 / 队伍 / 比赛 / 视频 / 罚单）
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  fanbook_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL DEFAULT '',
  check_in TEXT NOT NULL DEFAULT '',
  check_out TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'present',
  remark TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(staff_id, date)
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  short_name TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  captain TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS team_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slot TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(team_id, player_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  round INTEGER NOT NULL DEFAULT 1,
  seq INTEGER NOT NULL DEFAULT 1,
  matchup TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  team_a_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  team_b_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  team_a_name TEXT NOT NULL DEFAULT '',
  team_b_name TEXT NOT NULL DEFAULT '',
  map TEXT NOT NULL DEFAULT '',
  score TEXT NOT NULL DEFAULT '',
  winner TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  remark TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS match_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'referee',
  confirmed INTEGER NOT NULL DEFAULT 0,
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(match_id, staff_id, role)
);

CREATE TABLE IF NOT EXISTS match_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  side TEXT NOT NULL DEFAULT 'a',
  slot TEXT NOT NULL DEFAULT '',
  confirmed INTEGER NOT NULL DEFAULT 0,
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(match_id, player_id)
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  game_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS penalties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'warning',
  reason TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  points_deduct INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 种子：权限
INSERT OR IGNORE INTO permissions (code, name, description) VALUES
  ('schedule:view', '查看日程', '查看日程列表与详情'),
  ('schedule:manage', '管理日程', '创建/编辑/删除日程'),
  ('result:view', '查看结果', '查看比赛结果'),
  ('result:submit', '提交/修改结果', '上传/修改比赛结果'),
  ('result:manage', '管理结果', '管理全部比赛结果'),
  ('member:view', '查看成员', '查看成员列表'),
  ('member:manage', '管理成员', '添加/编辑/删除成员'),
  ('role:manage', '管理角色与权限', '角色/权限/成员角色分配'),
  ('player:manage', '管理选手名单', '选手名单增删改与导入'),
  ('team:manage', '管理队伍', '队伍与队员管理'),
  ('staff:manage', '管理工作人员', '工作人员增删改'),
  ('attendance:manage', '管理考勤', '工作人员考勤记录'),
  ('group:manage', '管理分组', '赛事分组管理'),
  ('match:view', '查看比赛', '查看比赛与详情'),
  ('match:manage', '管理比赛', '创建/编辑/删除比赛'),
  ('match:confirm', '确认比赛任务', '确认本人负责的比赛任务'),
  ('video:manage', '管理视频链接', '添加/修改/删除比赛视频链接'),
  ('penalty:manage', '管理罚单', '添加/修改/删除罚单'),
  ('upload:manage', '数据上传', '上传/删除数据文件'),
  ('settings:manage', '赛事设置', '修改赛事设置'),
  ('rules:edit', '编辑规则', '编辑规则内容与背景'),
  ('tournament:manage', '赛事管理', '多赛事管理');

-- 种子：角色
INSERT OR IGNORE INTO roles (code, name, description, is_system) VALUES
  ('superadmin', '开发者/超级管理员', '全部权限', 1),
  ('admin', '管理员', '除角色管理外的全部管理权限', 1),
  ('official', '裁判/录像', '查看日程与比赛、提交结果、管理视频', 1),
  ('rules', '规则管理', '仅可编辑规则', 1),
  ('staff', '赛事工作人员', '仅可查看日程与比赛', 1),
  ('guest', '普通用户', '无登录后权限', 1);

-- 种子：角色-权限
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'superadmin';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'admin' AND p.code != 'role:manage';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'official' AND p.code IN (
  'schedule:view','result:view','result:submit','match:view','match:confirm','video:manage');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'rules' AND p.code = 'rules:edit';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'staff' AND p.code IN ('schedule:view','match:view');

-- 种子：预置账号的角色绑定
INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.fanbook_id = '1000000' AND r.code = 'superadmin';

INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.fanbook_id = '20605142' AND r.code = 'admin';
