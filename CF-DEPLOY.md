# 部署到 Cloudflare Pages 指南

## 为什么之前会报错？

> 「该上传器目前尚未支持需要构建流程的项目。发现了TypeScript文件。请使用 wrangler deploy」

Cloudflare Pages 的**「直接上传（Direct Upload）」**只接受**构建好的纯静态成品**。
本项目是 **Vue 3 + Vite 构建型前端**（源码含 `.vue`/`package.json`，必须执行 `npm run build` 才有成品），所以直接上传源码会被拒绝。

> 部署时又遇到 **`Failed: error occurred while running deploy command`**：
> 这是 **Cloudflare 云端构建**失败的通用提示（Git 集成/控制台构建才会出现）。它只是"构建命令没跑成功"的壳，具体原因要看**构建日志**：Cloudflare 控制台 → Workers & Pages → 你的项目 → **Deployments** → 点失败的部署 → **View build log**。
> 三个最常见原因与修复见下文「方式 B」和第 4 节。

## 架构说明（重要）

本项目 = 前端（Vue 3）+ **后端（Node.js/Express/SQLite）**。

| 部分 | 部署位置 | 说明 |
|------|---------|------|
| 前端 SPA | **Cloudflare Pages**（免费、全球 CDN） | 只托管 `frontend/dist` 构建产物 |
| 后端 API | **你自己的服务器**（3001 端口） | Express + SQLite，用 `mwlc-tournament-deploy.zip` 部署；**Cloudflare Pages 无法运行 Node/Express/SQLite 后端** |

前后端通过 HTTPS 跨域通信（后端已开启 CORS，无需额外配置）。

## 第一步：先部署后端到你的服务器

```bash
unzip mwlc-tournament-deploy.zip -d /opt/mwlc && cd /opt/mwlc
chmod +x start.sh && ./start.sh
```

给后端配置对外地址，二选一：
- 直接用 `http://服务器IP:3001`（防火墙放行 3001）；
- 或用 nginx 反代成子域名：`api.你的域名.com → 127.0.0.1:3001`（推荐，走 HTTPS）。

**关键**：在服务器 `.env` 里加一行（让接口返回的图片/横幅/截图 URL 变成绝对地址，前端在 Cloudflare 上才能加载）：

```bash
echo 'PUBLIC_BASE_URL=https://api.你的域名.com' >> .env   # 没域名则填 http://服务器IP:3001
./stop.sh && ./start.sh
```

## 第二步：部署前端到 Cloudflare Pages

### 方式 A：本地构建 + wrangler 直传（推荐，最稳，不依赖 Cloudflare 云端构建）

在你自己电脑上构建好成品，再直接上传——**不会触发云端 build，从根本上避免 "deploy command" 类报错**：

```bash
# 1. 安装 wrangler 并登录（只需一次，会打开浏览器授权）
npm install -g wrangler
wrangler login

# 2. 进入前端目录，设置后端地址并构建
cd frontend

# Windows PowerShell:
$env:VITE_API_BASE = "https://api.你的域名.com"; npm install; npm run build
# Linux/macOS:
VITE_API_BASE=https://api.你的域名.com npm install && npm run build

# 3. 直传 dist 成品
npx wrangler pages deploy dist --project-name mwlc-tournament

# 4. 完成后输出 https://mwlc-tournament.pages.dev
```

- 本项目本地 Node 版本需 **20+**（`node -v` 确认；Vite 6 不兼容过旧版本）。
- 若 `wrangler login` 不便，可用 API Token：`CLOUDFLARE_API_TOKEN=xxx npx wrangler pages deploy dist --project-name mwlc-tournament`（Token 需 Pages:Edit 权限，控制台 → My Profile → API Tokens 创建）。
- 直传后如需 SPA 回退：`frontend/public/_redirects` 已随构建进入 `dist/`，无需额外配置。

### 方式 C：控制台「直接上传」构建好的 dist（零命令行，最省事）

不想配任何构建命令、不想碰 wrangler 的话，用 Cloudflare 控制台的**直传**，但**必须传构建产物 `dist`，不是源码**：

1. 本地先构建（生成带后端地址的成品）：
   ```bash
   cd frontend
   npm install
   $env:VITE_API_BASE = "https://api.你的域名.com"   # Windows；Linux 用 VITE_API_BASE=... npm run build
   npm run build
   ```
2. Cloudflare 控制台 → **Workers & Pages → Create → Pages → Upload assets（直接上传）**；
3. 把 **`frontend/dist` 文件夹**拖进上传框（不是项目根目录！）；
4. 部署完成后设置自定义域名即可。

> 你最初报「上传器不支持需要构建流程的项目」就是因为拖的是**源码**（含 `.vue`）。拖 `dist` 是纯静态成品，直传完全接受，`_redirects` 也已包含在 dist 里（SPA 回退自动生效）。
> 缺点：每次更新都要本地重新构建再上传，没有自动 CI。

#### ⚠️ 怎么判断自己传对了（上传错目录的典型症状）

传错的表现：线上页面报浏览器错误

```
Failed to resolve module specifier "vue"
ERR_BLOCKED_BY_CLIENT
```

（`Failed to resolve module specifier "vue"` = 浏览器加载到了**未构建的源码**，源码里的 `import 'vue'` 只有打包器能解析；`ERR_BLOCKED_BY_CLIENT` 是广告拦截器拦截请求，与代码无关。）

验证方法：打开线上地址 → 右键 → **查看网页源代码**，看 script 标签：
- ✅ 正确：`<script type="module" crossorigin src="/assets/index-xxx.js">`
- ❌ 传错：`<script type="module" src="/src/main.js">` → 说明上传的是 `frontend` 源码目录，重新上传 `frontend/dist` 的**内容**（index.html + assets/ 文件夹）

本地预览的正确姿势：`npm run dev`（Vite，端口 5173）或 `node preview-server.js`（托管 dist，端口 8080），**不要直接双击 `frontend/index.html`**（file:// 打开源码会报上面的错）。

### 方式 B：Git 集成（每次 push 自动构建）

1. 把项目推送到 GitHub/GitLab；
2. Cloudflare 控制台 → **Workers & Pages → Create → Pages → Connect to Git**；
3. 选择仓库，**构建配置务必按下表填**（Cloudflare 新版构建系统把「构建命令」和「部署命令」分开了，两个都要正确）：

   | 配置项 | 填写值 | 说明 |
   |--------|--------|------|
   | **Production branch** | `main` | |
   | **Framework preset** | `None` | 不用预设，避免覆盖下面配置 |
   | **Root directory（构建目录）** | `frontend` | **关键！** 仓库根没有 package.json，不填这里构建必然失败 |
   | **Build command（构建命令）** | `npm run build` | 产出静态成品到 `dist` |
   | **Build output directory（输出目录）** | `dist` | 相对 Root directory |
   | **Deploy command（部署命令）** | **留空/恢复默认**（默认是 `npx wrangler pages deploy`） | ⚠️ **不要填 `npx wrangler deploy`**，见下方报错案例 |

4. **环境变量**（Settings → Environment variables）：
   - `VITE_API_BASE` = `https://api.你的域名.com`
   - `NODE_VERSION` = `20`  ← **关键！** 防止 Cloudflare 云端用旧版 Node 构建（Vite 6 需要 Node 20+）
5. Save and Deploy。

> 首次构建会 `npm install`，需 1~3 分钟。**构建失败请先看构建日志**（Deployments → 失败项 → View build log）。
>
> **如何判断配置是否生效**：最新部署日志里**必须出现 `npm install` 和 `vite build` 的成功输出**。如果日志里只有 wrangler 报错、完全没有构建输出，说明 Build command 没生效（没填/没保存/填错位置），dist 从未生成——这就是「无法检测到包含项目静态文件的目录」的直接原因。

#### ⚠️ 报错案例：「无法检测到包含项目静态文件（e.g. html、CSS和JS）的目录」

如果你把 **Deploy command 填成了 `npx wrangler deploy`**，会出现：

```
执行用户部署命令：npx wrangler deploy
✘ [错误] 无法检测到包含项目静态文件（e.g. html、CSS和JS）的目录
失败：运行部署命令时发生错误
```

原因有二：
1. `npx wrangler deploy` 是 **Workers 部署命令**，不是 Pages 的构建/部署命令；且仓库根没有 `wrangler.toml`；
2. **`frontend/dist/` 被 `.gitignore` 排除**，云端克隆仓库后根本没有构建产物目录，wrangler 自然找不到静态文件。

修复：按上表配置——Build command=`npm run build`、Root directory=`frontend`、Output=`dist`，**Deploy command 恢复默认**（或填 `npx wrangler pages deploy`）。云端流程变成：克隆仓库 → 进入 `frontend/` → `npm install` → `npm run build` 生成 `dist` → wrangler pages 发布 `dist`。

## 第 3 节：构建失败排查（针对 "Failed: error occurred while running deploy command"）

按下面顺序检查，每步都能在构建日志里对上号：

| # | 检查项 | 日志典型报错 | 修复 |
|---|--------|-------------|------|
| 1 | **Root directory 是否为 `frontend`** | `npm error Could not read package.json` / `ENOENT` | 构建配置里把 Root directory 改为 `frontend` |
| 2 | **NODE_VERSION 是否设置** | `error: unsupported Node.js version` / vite 崩溃 / `ERR_REQUIRE_ESM` | 环境变量加 `NODE_VERSION=20`（前端 package.json 已声明 `engines.node >=20`） |
| 3 | **Deploy command 是否误填了 `npx wrangler deploy`** | `无法检测到包含项目静态文件（e.g. html、CSS和JS）的目录` | Deploy command 恢复默认（`npx wrangler pages deploy`）；Build command 填 `npm run build`；见方式 B 报错案例 |
| 4 | **构建命令与输出目录** | `output directory ... not found` / `vite build` 失败 | Build command=`npm run build`、Output=`dist`（相对 Root directory） |
| 5 | 依赖安装失败 | `npm ERR!` 网络/registry 错误 | 重试部署；确认仓库内**不包含 node_modules** |
| 6 | 依然查不到原因 | — | 直接把构建日志复制给运维/技术支持，或改用**方式 A**（本地构建直传，绕开云端构建） |

> 本项目已在 `frontend/package.json` 声明 `"engines": { "node": ">=20.0.0" }`，Cloudflare 会优先按此选择构建版本；再加上 `NODE_VERSION=20` 双保险。

## 部署后验证

- 打开 `https://mwlc-tournament.pages.dev` → 应看到赛事选择页；
- 点进赛事规则页，**直接刷新**该地址（验证 SPA 回退，`_redirects` 已配置）；
- 用 `1000000 / MWLC123456` 登录 → 裁判工作台、管理后台；
- 上传一张截图/横幅，确认图片能正常显示（验证 `PUBLIC_BASE_URL` 生效）。

## 常见问题

| 现象 | 处理 |
|------|------|
| 页面能开但接口 502/失败 | `VITE_API_BASE` 没设置或指向不对；后端 3001 没放行/没启动 |
| 图片/横幅裂图 | 后端 `.env` 缺 `PUBLIC_BASE_URL`，或填的不是 HTTPS 地址 |
| 刷新深链接 404 | 确认 `frontend/public/_redirects` 存在且已随构建进入 `dist/` |
| 登录后马上掉线 | 前后端时间不同步影响 JWT（少见），或 `JWT_SECRET` 每次启动变化——`.env` 固定后不再变 |
| 想用自己的域名 | Pages 项目 → Custom domains → 添加 `www.你的域名.com`，CF 自动配 DNS |
| 部署失败但本地构建正常 | 一定是**云端构建环境**问题：优先用**方式 A** 本地直传，或严格按第 3 节检查 |

## 为支持 Cloudflare 部署所做的代码修改

1. `frontend/src/api/index.js`：API 地址支持 `VITE_API_BASE` 环境变量（默认仍为 `/api`，本地开发不受影响）；
2. `backend/src/upload.js`：上传文件 URL 支持 `PUBLIC_BASE_URL` 生成绝对地址（不设置时仍返回相对路径）；
3. `frontend/public/_redirects`：Cloudflare Pages 单页应用路由回退；
4. `frontend/wrangler.toml`：Pages 项目配置；
5. `frontend/package.json`：声明 `engines.node >= 20`，指引 Cloudflare 构建使用 Node 20+。
