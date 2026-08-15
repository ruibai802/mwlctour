// MWLC 临时预览服务器：托管 frontend/dist 成品 + 代理 /api、/uploads 到后端 3001
// 用法：node preview-server.js   （默认 8080 端口，可通过环境变量 PORT 修改）
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DIST = path.join(__dirname, 'frontend', 'dist');
const BACKEND = process.env.BACKEND || 'http://localhost:3001';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function spaFallback(res) {
  fs.readFile(path.join(DIST, 'index.html'), (err, html) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('未找到前端构建产物，请先在 frontend 目录执行 npm run build');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  // 1) /api 与 /uploads 转发到后端
  if (url.startsWith('/api') || url.startsWith('/uploads')) {
    const target = new URL(BACKEND + url);
    const proxy = http.request({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: req.method,
      headers: { ...req.headers, host: target.host }
    }, (pRes) => {
      res.writeHead(pRes.statusCode, pRes.headers);
      pRes.pipe(res);
    });
    proxy.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ error: '后端服务不可用，请确认 3001 端口已启动' }));
    });
    req.pipe(proxy);
    return;
  }

  // 2) 静态文件（含 SPA 路由回退）
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    pathname = '/';
  }
  let filePath = path.join(DIST, pathname);
  if (filePath !== DIST && !filePath.startsWith(DIST + path.sep)) filePath = DIST; // 防目录穿越

  fs.stat(filePath, (err, st) => {
    if (!err && st.isFile()) {
      serveFile(filePath, res);
    } else if (!err && st.isDirectory()) {
      fs.stat(path.join(filePath, 'index.html'), (e2, s2) => {
        if (!e2 && s2.isFile()) serveFile(path.join(filePath, 'index.html'), res);
        else spaFallback(res);
      });
    } else {
      spaFallback(res);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`MWLC 预览服务已启动: http://localhost:${PORT}`);
  console.log(`  静态目录: ${DIST}`);
  console.log(`  反向代理: ${BACKEND}  (/api, /uploads)`);
});
