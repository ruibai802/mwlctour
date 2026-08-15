# Cloudflare 全量部署 —— 保姆级教学（从零开始）

> 目标：把 MWLC 赛事系统（前端 + 后端 + 数据库 + 文件存储）全部部署到 Cloudflare。
> 本教学假设你**完全没碰过 wrangler 命令行**，每一步都写到"看到什么输出、点什么按钮"。

---

## 第 0 步：理解你要部署什么

```
你的电脑（本地代码）
   └── git push → GitHub（mwlctour 仓库，已完成 ✅）

Cloudflare 侧（你要创建的 4 样东西）：
   ① Pages 项目  = 网站本身（前端页面 + 后端接口）
   ② D1 数据库   = 存数据（成员/日程/结果/名单…）
   ③ R2 存储桶   = 存文件（横幅/截图/头像…）
   ④ 自定义域名  = tournament.cc.cd（可选）
```

代码已经全部写好并推到 GitHub 了，你只需要：**装工具 → 登录 → 创建数据库/存储 → 部署**。

---

## 第 1 步：检查电脑环境

打开你的命令行（Windows 用 PowerShell 或 CMD，Mac 用终端），输入：

```bash
node -v
npm -v
```

要求：
- `node -v` 显示 **v20 或更高**（v18 也行，推荐 20/22/24）
- 如果没装：去 https://nodejs.org 下载 **LTS 版**安装，装完重开命令行再检查

---

## 第 2 步：安装 wrangler（Cloudflare 的命令行工具）

```bash
npm install -g wrangler
```

看到类似 `added 1 package` 或版本号输出就成功了。验证：

```bash
wrangler --version
```

> ⚠️ 中国网络提示：如果卡住/报网络错误，说明连不上 npm 或 Cloudflare，需要：
> - 给 npm 换国内镜像：`npm config set registry https://registry.npmmirror.com`
> - 或开代理（VPN）后重试

---

## 第 3 步：登录 Cloudflare

```bash
wrangler login
```

- 会自动打开浏览器 → 让你登录 Cloudflare 账号 → 点 **Allow** 授权
- 命令行显示 `Successfully logged in.` 就成功了
- 如果浏览器没自动打开，把终端里显示的链接复制到浏览器打开

> 登录后建议验证一下：
> ```bash
> wrangler whoami
> ```
> 会显示你的账号邮箱，说明登录成功。

---

## 第 4 步：进入项目目录

打开终端，进入前端项目目录（你的代码所在位置）：

```bash
cd frontend
```

先确认依赖已装好（没有就装）：

```bash
npm install
```

---

## 第 5 步：创建 D1 数据库（存业务数据）

```bash
npx wrangler d1 create mwlc-db
```

**预期输出**（注意看 `database_id` 那一行）：

```
✅ Successfully created DB 'mwlc-db' in region APAC
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "mwlc-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   ← 这串就是 database_id
```

**马上要做的事**：打开 `frontend/wrangler.toml`，把 `database_id` 那一行的占位符换成你刚得到的 ID：

```toml
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # 替换 REPLACE_WITH_YOUR_D1_DATABASE_ID
```

（可以用记事本/VSCode 打开编辑，保存。）

---

## 第 6 步：初始化数据库（建表 + 预置账号）

```bash
npx wrangler d1 execute mwlc-db --remote --file migrations/0001_init.sql
```

**预期输出**：显示执行成功，例如：

```
🚣 Executing on remote database mwlc-db (xxxxxxxx-...):
-- 一串 SQL 执行日志 --
✅ Done in 512ms.
```

这一步会创建全部数据表，并写入：
- 默认赛事（code=default）
- 两个预置账号（fanbookID `1000000` 和 `20605142`，密码都是 `MWLC123456`）

> 如果报错 "Table already exists" 之类，说明重复执行了，不影响（SQL 里有 IF NOT EXISTS）。

---

## 第 7 步：创建 R2 存储桶（存上传文件）

```bash
npx wrangler r2 bucket create mwlc-uploads
```

**预期输出**：

```
✅ Created bucket "mwlc-uploads".
```

---

## 第 8 步：部署网站（二选一）

### 方式 A：wrangler 命令行部署（推荐，最简单）

在 `frontend` 目录下：

```bash
npx wrangler pages deploy
```

它会读取 `wrangler.toml`，自动：
1. 上传 `dist`（前端成品）作为静态资源
2. 上传 `functions`（后端接口）作为 Pages Functions
3. 绑定 D1 和 R2

**预期输出**（第一次会要求输入项目名）：

```
? Enter the name of your new project:  → 直接回车（默认用 wrangler.toml 里的 mwlctour）
...
✨ Deployed! You can access your site at: https://mwlctour.pages.dev
```

记下 `https://xxx.pages.dev` 这个地址。

> 以后每次改了代码，重新构建并部署：
> ```bash
> npm run build
> npx wrangler pages deploy
> ```

### 方式 B：Git 集成（每次 push 自动部署）

1. Cloudflare 控制台 → 左侧 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 点 **Connect to GitHub** → 授权后选择 `mwlctour` 仓库
3. 构建设置**严格按下面填**（这是之前失败过多次的关键）：

   | 配置项 | 填什么 |
   |--------|--------|
   | Production branch | `main` |
   | Framework preset | `None` |
   | Root directory | `frontend` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Deploy command | **留空**（不要填 `npx wrangler deploy`！） |

4. 点 **Save and Deploy**
5. 等 1~3 分钟，日志里看到 `vite build` 成功 + `Deployed` 即成功

> D1/R2 绑定会自动读取仓库里 `frontend/wrangler.toml` 的配置（前提：第 5 步的 database_id 已替换并 push 到 GitHub）。

---

## 第 9 步：验证网站

用浏览器打开 `https://mwlctour.pages.dev`（或你部署的地址）：

1. ✅ 应看到「选择赛事」页面 + 赛事卡片「MWLC赛事」
2. 点卡片进入规则页，**直接刷新**该页面 —— 不应 404（SPA 回退已配置）
3. 右上角点「登录」：
   - 账号：`1000000`
   - 密码：`MWLC123456`
   - 应进入「裁判工作台」
4. 进入「管理后台」→「日程管理」→「创建日程」→ 保存成功
5. 「数据上传」上传一张图片 → 图片能显示（说明 R2 生效）

**验证接口是否正常**（浏览器地址栏直接访问）：
- `https://你的地址/api/health` → 应显示 `{"status":"ok",...}`
- `https://你的地址/api/tournaments` → 应显示赛事列表 JSON

---

## 第 10 步（可选）：绑定你自己的域名 tournament.cc.cd

之前这个域名报 1016 是因为它指向了旧的 Worker 项目。现在：

1. Cloudflare 控制台 → **Workers & Pages** → 点进你的 Pages 项目 → **Custom domains** → **Add custom domain**
2. 输入 `tournament.cc.cd` → **Continue** → Cloudflare 会自动检测/创建 DNS 记录
3. 等状态变成 **Active**（几分钟）
4. 访问 `https://tournament.cc.cd` 验证

> 如果 `cc.cd` 域名不在 Cloudflare 管理：去 cc.cd 的域名面板，把 CNAME 记录指向你的 `xxx.pages.dev`，删除旧的指向 Worker 的记录。

---

## 常见问题排查表

| 现象 | 原因 | 处理 |
|------|------|------|
| `wrangler login` 打不开浏览器 | 网络/代理 | 复制终端里的链接到浏览器；或开代理 |
| `d1 create` 报网络错误 | 连不上 Cloudflare API | 开代理重试；或到控制台手动创建：**Workers & Pages → D1 → Create database** |
| 部署后页面空白 | 部署的不是 dist，或 DNS 没生效 | 确认走 Pages（不是 Worker）；刷新 + 无痕窗口 |
| 登录返回 405/404 | 接口没部署成功 / D1 没绑定 | 访问 `/api/health` 验证；确认 database_id 已填并重新部署 |
| `/api/health` 报 500 或数据库错误 | D1 未初始化 | 重跑第 6 步 `d1 execute` |
| 图片裂图 | R2 未绑定或没上传成功 | 确认第 7 步已执行；检查 R2 控制台是否有文件 |
| 刷新深链接 404 | _redirects 没进 dist | 重新 `npm run build`（public/_redirects 会复制进 dist） |
| 构建日志报 Node 版本错误 | CF 云端 Node 太旧 | Git 集成时加环境变量 `NODE_VERSION=20` |

---

## 日常维护

- **改代码后更新**（方式 A）：`cd frontend && npm run build && npx wrangler pages deploy`
- **改代码后更新**（方式 B）：`git add -A && git commit -m "..." && git push`（自动部署）
- **备份数据库**：控制台 → D1 → mwlc-db → **Export**
- **查看接口日志**：控制台 → Workers & Pages → 项目 → **Logs**（或 wrangler pages deployment tail）
- **重置全部数据**：`npx wrangler d1 execute mwlc-db --remote --file migrations/0001_init.sql`（会重建表；想清空先 `DROP TABLE`）
