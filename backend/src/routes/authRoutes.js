const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, publicUser, requireAuth } = require('../auth');
const { avatarUpload, relUrl } = require('../upload');

const router = express.Router();

router.post('/login', (req, res) => {
  const { fanbook_id, password } = req.body || {};
  if (!fanbook_id || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }
  const user = db.prepare('SELECT * FROM users WHERE fanbook_id = ?').get(String(fanbook_id).trim());
  if (!user) {
    return res.status(401).json({ error: '账号不存在' });
  }
  if (!bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: '密码错误' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { old_password, new_password } = req.body || {};
  if (!old_password || !new_password) {
    return res.status(400).json({ error: '请填写原密码和新密码' });
  }
  if (String(new_password).length < 6) {
    return res.status(400).json({ error: '新密码至少 6 位' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(old_password), user.password_hash)) {
    return res.status(400).json({ error: '原密码错误' });
  }
  const hash = bcrypt.hashSync(String(new_password), 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: '密码修改成功' });
});

router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(row) });
});

router.put('/me', requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (name === undefined || String(name).trim() === '') {
    return res.status(400).json({ error: '姓名不能为空' });
  }
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).trim().slice(0, 40), req.user.id);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(row) });
});

router.post('/avatar', requireAuth, (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '头像不能超过 5MB' });
      return res.status(400).json({ error: err.message || '头像上传失败' });
    }
    next();
  });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未选择头像图片' });
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(relUrl(req.file.path), req.user.id);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(row), avatar: relUrl(req.file.path) });
});

module.exports = router;
