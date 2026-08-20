-- MWLC - 比赛（日程）裁判/录像接取
-- 用法: npx wrangler d1 execute mwlc-db --remote --file migrations/0005_match_claims.sql
--       （本地: npx wrangler d1 execute mwlc-db --local --file migrations/0005_match_claims.sql）

ALTER TABLE matches ADD COLUMN claimed_referee_id TEXT NOT NULL DEFAULT '';
ALTER TABLE matches ADD COLUMN claimed_recorder_id TEXT NOT NULL DEFAULT '';
