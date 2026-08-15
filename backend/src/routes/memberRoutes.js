const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireAdmin, requireSuperAdmin, isSuperAdmin, publicUser } = require('../auth');

const router = express.Router();

const ROLES = [
  { value: 'superadmin', label: '开发者/超级管理员' },
  { value: 'admin', label: '管理员（主办/管理/裁判长）' },
  { value: 'official', label: '裁判/录像' },
  { value: 'rules', label: '规则管理' },
  { value: 'staff', label: '赛事工作人员' },
  { value: 'guest', label: '普通用户' }
];

const TITLES = ['开发者', '超级管理员', '主办', '管理', '裁判长', '裁判/录像', '规则管理', '赛事工作人员', '普通用户'];

router.get('/roles', requireAuth, (req, res) => {
  res.json({ roles: ROLES, titles: TITLES });
});

router.get('/', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY id').all();
  res.json(rows.map(publicUser));
});

function normalizeTitles(body) {
  const raw = Array.isArray(body.titles) ? body.titles : (body.title !== undefined ? [body.title] : []);
  return raw
    .map((t) => String(t || '').trim())
    .filter((t) => t && TITLES.includes(t))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(',');
}

function toTitles(item) {
  if (Array.isArray(item.titles)) return item.titles;
  if (typeof item.titles === 'string' && item.titles.trim()) {
    return item.titles.split(/[,，、;；]/).map((s) => String(s).trim()).filter(Boolean);
  }
  if (item.title !== undefined) return [item.title];
  return [];
}

router.post('/import', requireAuth, requireAdmin, (req, res) => {
  const list = req.body;
  if (!Array.isArray(list) || !list.length) {
    return res.status(400).json({ error: '导入数据不能为空' });
  }
  if (list.length > 2000) {
    return res.status(400).json({ error: '单次最多导入 2000 条' });
  }
  const hasSuperAdmin = Array.isArray(list) && list.some((it) => String(it.role || '') === 'superadmin');
  if (hasSuperAdmin && !isSuperAdmin(req.user)) {
    return res.status(403).json({ error: '仅开发者/超级管理员可导入超管账号' });
  }
  const insert = db.prepare('INSERT INTO users (fanbook_id, password_hash, name, title, role) VALUES (?,?,?,?,?)');
  const defaultHash = bcrypt.hashSync('MWLC123456', 10);
  const tx = db.transaction((items) => {
    let inserted = 0;
    let skipped = 0;
    for (const item of items) {
      const fanbookId = String((item.fanbook_id || item.fanbook || '').trim());
      if (!fanbookId) { skipped++; continue; }
      const titlesArr = toTitles(item);
      let role = String(item.role || '');
      if (!ROLES.some((r) => r.value === role)) {
        if (titlesArr.some((t) => /裁判|录像/.test(String(t || '')))) {
          role = 'official';
        } else if (titlesArr.some((t) => /开发者|超级|超管/.test(String(t || '')))) {
          role = 'superadmin';
        } else if (titlesArr.some((t) => /规则/.test(String(t || '')))) {
          role = 'rules';
        } else {
          role = 'staff';
        }
      }
      if (!ROLES.some((r) => r.value === role)) { skipped++; continue; }
      const exists = db.prepare('SELECT id FROM users WHERE fanbook_id = ?').get(fanbookId);
      if (exists) { skipped++; continue; }
      insert.run(
        fanbookId,
        defaultHash,
        String(item.name || ''),
        normalizeTitles({ titles: titlesArr }),
        role
      );
      inserted++;
    }
    return { inserted, skipped };
  });
  const result = tx(list);
  res.json({ message: `导入完成：新增 ${result.inserted} 人，跳过 ${result.skipped} 人`, ...result });
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { fanbook_id, name, role, password } = req.body || {};
  if (!fanbook_id) return res.status(400).json({ error: '缺少 fanbookID' });
  if (!role) return res.status(400).json({ error: '缺少角色' });
  if (role === 'superadmin' && !isSuperAdmin(req.user)) {
    return res.status(403).json({ error: '仅开发者/超级管理员可创建超管账号' });
  }
  if (password !== undefined && String(password) !== '' && !isSuperAdmin(req.user)) {
    return res.status(403).json({ error: '仅开发者/超级管理员可设置他人初始密码，其他成员使用默认密码' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE fanbook_id = ?').get(String(fanbook_id).trim());
  if (exists) return res.status(400).json({ error: '该 fanbookID 已存在' });
  const finalPassword = password || 'MWLC123456';
  const hash = bcrypt.hashSync(String(finalPassword), 10);
  const info = db.prepare(
    'INSERT INTO users (fanbook_id, password_hash, name, title, role) VALUES (?,?,?,?,?)'
  ).run(
    String(fanbook_id).trim(),
    hash,
    String(name || ''),
    normalizeTitles(req.body),
    String(role)
  );
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(publicUser(row));
});

router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '成员不存在' });
  const { name, role, password, reset_password } = req.body || {};
  if (role !== undefined && !ROLES.some((r) => r.value === role)) {
    return res.status(400).json({ error: '角色不合法' });
  }
  if (role === 'superadmin' && !isSuperAdmin(req.user)) {
    return res.status(403).json({ error: '仅开发者/超级管理员可授予超管角色' });
  }
  if (String(row.role) === 'superadmin' && !isSuperAdmin(req.user)) {
    return res.status(403).json({ error: '仅开发者/超级管理员可修改超管账号' });
  }
  if (String(row.fanbook_id) === '1000000' && role !== undefined && role !== 'superadmin') {
    return res.status(400).json({ error: '不能降级初始主办账号' });
  }
  const isOwn = String(req.user.id) === String(row.id);
  const wantsPassword = (reset_password || password !== undefined);
  if (wantsPassword && !isOwn && !isSuperAdmin(req.user)) {
    return res.status(403).json({ error: '仅开发者/超级管理员可修改他人密码，其他成员请修改自己的密码' });
  }
  const hash = (wantsPassword && (isOwn || isSuperAdmin(req.user)))
    ? bcrypt.hashSync(String(password || 'MWLC123456'), 10)
    : row.password_hash;
  // 只要前端显式传了 titles 数组（哪怕是空数组，表示清空身份）或 title，就应更新身份字段
  const hasTitles = Array.isArray(req.body.titles) || req.body.title !== undefined;
  db.prepare('UPDATE users SET name=?, title=?, role=?, password_hash=? WHERE id=?').run(
    name !== undefined ? String(name) : row.name,
    hasTitles ? normalizeTitles(req.body) : row.title,
    role !== undefined ? String(role) : row.role,
    hash,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json(publicUser(updated));
});

router.post('/batch-delete', requireAuth, requireAdmin, (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: '请选择要删除的成员' });
  const cleanIds = [...new Set(ids.map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  if (!cleanIds.length) return res.status(400).json({ error: '成员ID不合法' });
  const rows = db.prepare('SELECT * FROM users WHERE id IN (' + cleanIds.map(() => '?').join(',') + ')').all(...cleanIds);
  const hasSuperAdmin = rows.some((r) => r.role === 'superadmin');
  if (hasSuperAdmin && !isSuperAdmin(req.user)) {
    return res.status(403).json({ error: '仅开发者/超级管理员可删除超管账号' });
  }
  const deletable = rows.filter((r) => String(r.fanbook_id) !== '1000000').map((r) => r.id);
  let deleted = 0;
  const tx = db.transaction((idsToDelete) => {
    const del = db.prepare('DELETE FROM users WHERE id = ?');
    for (const id of idsToDelete) {
      const info = del.run(id);
      deleted += info.changes;
    }
  });
  tx(deletable);
  res.json({ message: `已删除 ${deleted} 人（初始主办账号不可删除）`, deleted });
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '成员不存在' });
  if (String(row.fanbook_id) === '1000000') {
    return res.status(400).json({ error: '不能删除初始主办账号' });
  }
  if (String(row.role) === 'superadmin' && !isSuperAdmin(req.user)) {
    return res.status(403).json({ error: '仅开发者/超级管理员可删除超管账号' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: '成员已删除' });
});

module.exports = router;
