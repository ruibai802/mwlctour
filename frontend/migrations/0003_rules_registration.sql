-- MWLC - 每份规则可单独配置报名链接
-- 用法: npx wrangler d1 execute mwlc-db --remote --file migrations/0003_rules_registration.sql
--       （本地: npx wrangler d1 execute mwlc-db --local --file migrations/0003_rules_registration.sql）

ALTER TABLE rules ADD COLUMN registration_url TEXT NOT NULL DEFAULT '';
