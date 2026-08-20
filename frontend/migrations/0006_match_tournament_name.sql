-- MWLC - 日程（比赛）可指定赛事名称（来自赛事设置的赛事名列表）
-- 用法: npx wrangler d1 execute mwlc-db --remote --file migrations/0006_match_tournament_name.sql
--       （本地: npx wrangler d1 execute mwlc-db --local --file migrations/0006_match_tournament_name.sql）

ALTER TABLE matches ADD COLUMN tournament_name TEXT NOT NULL DEFAULT '';
