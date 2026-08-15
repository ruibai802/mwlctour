const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, requireAdmin, ADMIN_ROLES, RULES_ROLES } = require('../auth');
const { resolveTournamentId } = require('../tournament');
const { dataUpload, editorImageUpload, relUrl, UPLOAD_DIR } = require('../upload');

const router = express.Router();

const ALLOWED_TYPES = ['banner', 'roster', 'map', 'document', 'other', 'editor-image'];

function canUpload(req) {
  const role = req.user && req.user.role;
  if (ADMIN_ROLES.includes(role)) return true;
  // 规则管理身份允许上传横幅（用于规则页背景）
  if (RULES_ROLES.includes(role) && String(req.body.type) === 'banner') return true;
  return false;
}

router.post('/',
  requireAuth,
  (req, res, next) => {
    dataUpload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '文件不能超过 50MB' });
        return res.status(400).json({ error: err.message || '上传失败' });
      }
      next();
    });
  },
  (req, res) => {
    if (!canUpload(req)) {
      return res.status(403).json({ error: '仅管理员可上传数据，规则管理可上传横幅' });
    }
    if (!req.file) return res.status(400).json({ error: '未选择文件' });
    const type = ALLOWED_TYPES.includes(req.body.type) ? req.body.type : 'other';
    const info = db.prepare(
      'INSERT INTO uploads (type, original_name, filename, path, uploaded_by, tournament_id) VALUES (?,?,?,?,?,?)'
    ).run(
      type,
      String(req.file.originalname || ''),
      String(req.file.filename || ''),
      relUrl(req.file.path),
      req.user.name || req.user.fanbook_id,
      resolveTournamentId(req)
    );
    const row = db.prepare('SELECT * FROM uploads WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  }
);

// 规则编辑器内嵌图片上传：规则管理/管理员/超管可用，图片类型强制为 editor-image
router.post('/editor-image',
  requireAuth,
  (req, res, next) => {
    editorImageUpload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '图片不能超过 10MB' });
        return res.status(400).json({ error: err.message || '上传失败' });
      }
      next();
    });
  },
  (req, res) => {
    const role = req.user && req.user.role;
    if (!RULES_ROLES.includes(role)) {
      return res.status(403).json({ error: '仅规则管理/管理员可上传内嵌图片' });
    }
    if (!req.file) return res.status(400).json({ error: '未选择图片' });
    const info = db.prepare(
      'INSERT INTO uploads (type, original_name, filename, path, uploaded_by, tournament_id) VALUES (?,?,?,?,?,?)'
    ).run(
      'editor-image',
      String(req.file.originalname || ''),
      String(req.file.filename || ''),
      relUrl(req.file.path),
      req.user.name || req.user.fanbook_id,
      resolveTournamentId(req)
    );
    const row = db.prepare('SELECT * FROM uploads WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  }
);

router.get('/public', (req, res) => {
  const { type } = req.query;
  const rows = db.prepare('SELECT id, type, original_name, path, created_at FROM uploads WHERE type = ? AND tournament_id = ? ORDER BY id DESC')
    .all(String(type || 'banner'), resolveTournamentId(req));
  res.json(rows);
});

router.get('/', requireAuth, (req, res) => {
  const { type } = req.query;
  const tid = resolveTournamentId(req);
  let rows;
  if (type) {
    rows = db.prepare('SELECT * FROM uploads WHERE type = ? AND tournament_id = ? ORDER BY id DESC').all(String(type), tid);
  } else {
    rows = db.prepare('SELECT * FROM uploads WHERE tournament_id = ? ORDER BY id DESC').all(tid);
  }
  res.json(rows);
});

router.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM uploads WHERE id = ? AND tournament_id = ?')
    .get(req.params.id, resolveTournamentId(req));
  if (!row) return res.status(404).json({ error: '文件不存在' });
  const role = req.user && req.user.role;
  const allowed = ADMIN_ROLES.includes(role) || (RULES_ROLES.includes(role) && (row.type === 'banner' || row.type === 'editor-image'));
  if (!allowed) return res.status(403).json({ error: '仅管理员可删除文件，规则管理可删除横幅与内嵌图片' });
  // 先删数据库记录，再清理磁盘上的物理文件，避免残留
  const rel = String(row.path || '').replace(/^\/uploads\//, '');
  if (rel) {
    const full = path.join(UPLOAD_DIR, rel);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isFile()) fs.unlinkSync(full);
    } catch (e) { /* 文件已不存在时忽略 */ }
  }
  db.prepare('DELETE FROM uploads WHERE id = ?').run(req.params.id);
  res.json({ message: '文件已删除' });
});

module.exports = router;
