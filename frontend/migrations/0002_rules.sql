-- MWLC - 多规则支持：新增 rules 表，并把各赛事现有的 rules_content 迁移为第一份规则
-- 用法: npx wrangler d1 execute mwlc-db --remote --file migrations/0002_rules.sql
--       （本地: npx wrangler d1 execute mwlc-db --local --file migrations/0002_rules.sql）

CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  background TEXT NOT NULL DEFAULT '',
  content_background TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 把每个赛事现有的单份规则迁移为 rules 表中的第一份规则
INSERT OR IGNORE INTO rules (tournament_id, title, content, background, content_background, sort)
SELECT t.id, '赛事规则', t.rules_content, t.rules_background, t.content_background, 0
FROM tournaments t
WHERE t.rules_content <> '' OR t.rules_background <> '' OR t.content_background <> '';

-- 没有任何内容的赛事也补一条占位规则，保证规则页始终可显示
INSERT OR IGNORE INTO rules (tournament_id, title, content, sort)
SELECT t.id, '赛事规则', '', 0
FROM tournaments t
WHERE NOT EXISTS (SELECT 1 FROM rules r WHERE r.tournament_id = t.id);
