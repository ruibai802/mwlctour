-- MWLC - 每份规则详情页可自定义大标题/副标题
-- 用法: npx wrangler d1 execute mwlc-db --remote --file migrations/0004_rule_page_titles.sql
--       （本地: npx wrangler d1 execute mwlc-db --local --file migrations/0004_rule_page_titles.sql）

ALTER TABLE rules ADD COLUMN page_title TEXT NOT NULL DEFAULT '';
ALTER TABLE rules ADD COLUMN page_subtitle TEXT NOT NULL DEFAULT '';
