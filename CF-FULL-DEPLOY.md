# MWLC 全量迁入 Cloudflare 部署指南（Pages Functions + D1 + R2）

本方案把**前端和全部后端接口**都迁到 Cloudflare，不再需要独立服务器：

| 原组件 | Cloudflare 替代 | 说明 |
|--------|----------------|------|
| 前端 Vue 构建产物 | **Pages**（托管 `frontend/dist`） | 同域部署 |
| Express + SQLite 后端 | **Pages Functions**（`frontend/functions/`） | 全部 API 迁入 `/api/*` |
| SQLite 数据库 `mwlc.db` | **D1 数据库** | SQL 语法与 SQLite 一致，表结构原样迁移 |
| 本地 `uploads/` 文件夹 | **R2 对象存储** | 横幅/截图/头像/名单/内嵌图片 |

**关键好处**：前后端同域（`xxx.pages.dev`），前端默认的 `/api`、`/uploads` 相对路径**原样可用**，无需 CORS、无需 `VITE_API_BASE`、无需 `PUBLIC_BASE_URL`，现有构建产物直接可用。

## 代码结构（已就绪）

```
frontend/
├── dist/                  # 前端成品（Vite 构建）
├── functions/             # 后端 API（Pages Functions）
│   ├── _lib/              # 共享：JWT(jose)/权限、工具、R2 上传
│   ├── api/               # 全部接口：auth/schedules/results/members/players/settings/tournaments/uploads/health
│   └── uploads/           # /uploads/* 从 R2 读取静态文件
├── migrations/            # D1 建表 + 种子账号 SQL
├── wrangler.toml          # D1/R2 绑定配置（需填 database_id）
└── package.json           # 已含 jose、bcryptjs 依赖
```

## 部署步骤（一次即可）

### 0. 前置
- 本机安装 Node 20+、已 `npm install -g wrangler` 并 `wrangler login`
- 代码已推送到 GitHub（`frontend/functions`、`frontend/migrations`、`frontend/wrangler.toml` 都在仓库里）

### 1. 创建 D1 数据库并初始化

```bash
cd frontend
npx wrangler d1 create mwlc-db
# 输出中包含 database_id，复制它

# 把 database_id 填入 wrangler.toml 的 database_id = "..." 并保存
# 然后执行建表 + 种子数据（预置账号 1000000 / 20605142，密码 MWLC123456）
npx wrangler d1 execute mwlc-db --remote --file migrations/0001_init.sql
```

### 2. 创建 R2 存储桶

```bash
npx wrangler r2 bucket create mwlc-uploads
```

### 3. 部署（二选一）

**方式 A：wrangler 直传（推荐，最快）**

```bash
cd frontend
npm install
npx wrangler pages deploy   # 读取 wrangler.toml，部署 dist + functions
# 输出 https://xxx.pages.dev
```

**方式 B：Git 集成（每次 push 自动部署）**

Cloudflare 控制台 → Workers & Pages → Create → Pages → Connect to Git → 选 `mwlctour` 仓库：

| 配置项 | 值 |
|--------|-----|
| Production branch | `main` |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Deploy command | 留空（默认） |
| 环境变量 `NODE_VERSION` | `20` |

D1/R2 绑定会自动从仓库中的 `frontend/wrangler.toml` 读取（确保 database_id 已填对）。

### 4. 验证

- 打开 `https://xxx.pages.dev/` → 赛事选择页
- 用 `1000000 / MWLC123456` 登录 → 裁判工作台、管理后台可用
- 上传一张截图/横幅 → 图片正常显示（R2 生效）
- 刷新任意深链接（如 `/rules/default`）→ 不 404（`_redirects` 生效）

## 自定义域名

Pages 项目 → **Custom domains → Add** → 输入你的域名，Cloudflare 自动配置 DNS（之前 `tournament.cc.cd` 报 1016 是因为指向了旧 Worker，删掉旧 DNS/CNAME 记录，重新指向新的 Pages 项目即可）。

## 数据与备份

- D1 数据库可在控制台 **D1 → mwlc-db → Export** 导出备份
- R2 存储可在 **R2 → mwlc-uploads** 查看/下载文件
- 重置数据：`npx wrangler d1 execute mwlc-db --remote --file migrations/0001_init.sql`（会重建表；如需清空旧数据先删表）

## 本地开发/测试

```bash
cd frontend
npm install
npx wrangler pages dev      # 本地模拟 Pages + Functions（D1/R2 本地模拟）
node --experimental-sqlite test-functions.mjs   # 后端逻辑冒烟测试（18 项）
```
