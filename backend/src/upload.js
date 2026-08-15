const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const SCREENSHOT_DIR = path.join(UPLOAD_DIR, 'screenshots');
const DATA_DIR = path.join(UPLOAD_DIR, 'data');

for (const dir of [UPLOAD_DIR, SCREENSHOT_DIR, DATA_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(subDir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, subDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const base = path.basename(file.originalname || 'file', ext).replace(/[^\w\u4e00-\u9fa5-]/g, '_').slice(0, 40);
      cb(null, `${Date.now()}_${Math.round(Math.random() * 1e6)}_${base}${ext}`);
    }
  });
}

const screenshotUpload = multer({
  storage: makeStorage(SCREENSHOT_DIR),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('只能上传图片文件'));
  }
});

const dataUpload = multer({
  storage: makeStorage(DATA_DIR),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 }
});

const avatarUpload = multer({
  storage: makeStorage(DATA_DIR),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('头像仅支持图片文件'));
  }
});

// 规则编辑器内嵌图片上传：仅图片、单张、最大 10MB
const editorImageUpload = multer({
  storage: makeStorage(DATA_DIR),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('内嵌图片仅支持图片文件'));
  }
});

// 生成可访问的上传文件 URL：
//  - 设置 PUBLIC_BASE_URL（如 https://api.example.com）→ 返回绝对地址，供部署在其它域名（如 Cloudflare Pages）的前端直接加载
//  - 不设置 → 返回相对路径 /uploads/...（本地开发或与后端同域部署）
function relUrl(fullPath) {
  const publicBase = String(process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  const rel = `/uploads/${path.relative(UPLOAD_DIR, fullPath).split(path.sep).join('/')}`;
  return publicBase ? `${publicBase}${rel}` : rel;
}

module.exports = { screenshotUpload, dataUpload, avatarUpload, editorImageUpload, UPLOAD_DIR, relUrl };
