const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, requireRules } = require('../auth');
const { resolveTournamentId } = require('../tournament');

const router = express.Router();

function parseMaps(maps) {
  if (maps !== undefined && Array.isArray(maps)) return JSON.stringify(maps.map((m) => String(m)));
  return undefined;
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, code, name, description FROM tournaments ORDER BY id').all();
  res.json(rows);
});

router.get('/:code', (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE code = ?').get(String(req.params.code));
  if (!t) return res.status(404).json({ error: '赛事不存在' });
  const banners = db.prepare(
    "SELECT id, original_name, path, created_at FROM uploads WHERE type = 'banner' AND tournament_id = ? ORDER BY id DESC"
  ).all(t.id);
  const rosters = db.prepare(
    "SELECT id, original_name, path, created_at FROM uploads WHERE type = 'roster' AND tournament_id = ? ORDER BY id DESC"
  ).all(t.id);
  let maps = [];
  try { maps = JSON.parse(t.maps || '[]'); } catch (e) { maps = []; }
  res.json({
    id: t.id,
    code: t.code,
    name: t.name,
    description: t.description,
    rules_content: t.rules_content,
    rules_background: t.rules_background,
    content_background: t.content_background,
    registration_url: t.registration_url,
    maps,
    banners,
    rosters
  });
});

router.post('/', requireAuth, requireRules, (req, res) => {
  const { code, name, description } = req.body || {};
  const c = String(code || '').trim();
  if (!c) return res.status(400).json({ error: '请输入赛事代码（英文/数字）' });
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(c)) {
    return res.status(400).json({ error: '赛事代码只能包含字母、数字、下划线或短横线' });
  }
  const exists = db.prepare('SELECT id FROM tournaments WHERE code = ?').get(c);
  if (exists) return res.status(400).json({ error: '该赛事代码已存在' });
  const info = db.prepare(
    'INSERT INTO tournaments (code, name, description, created_by) VALUES (?,?,?,?)'
  ).run(c, String(name || c), String(description || ''), req.user.name || req.user.fanbook_id);
  const row = db.prepare('SELECT id, code, name, description FROM tournaments WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', requireAuth, requireRules, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '赛事不存在' });
  const { name, description, rules_content, rules_background, content_background, registration_url, maps } = req.body || {};
  const newMaps = parseMaps(maps);
  db.prepare(`
    UPDATE tournaments SET
      name = ?, description = ?, rules_content = ?, rules_background = ?, content_background = ?, registration_url = ?, maps = ?,
      updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    name !== undefined ? String(name) : t.name,
    description !== undefined ? String(description) : t.description,
    rules_content !== undefined ? String(rules_content) : t.rules_content,
    rules_background !== undefined ? String(rules_background) : t.rules_background,
    content_background !== undefined ? String(content_background) : t.content_background,
    registration_url !== undefined ? String(registration_url) : t.registration_url,
    newMaps !== undefined ? newMaps : t.maps,
    req.params.id
  );
  const row = db.prepare('SELECT id, code, name, description FROM tournaments WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '赛事不存在' });
  const total = db.prepare('SELECT COUNT(*) AS c FROM tournaments').get().c;
  if (total <= 1) return res.status(400).json({ error: '至少保留一个赛事' });
  if (String(t.code) === 'default') return res.status(400).json({ error: '默认赛事不可删除' });
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM schedules WHERE tournament_id = ?').run(t.id);
    db.prepare('DELETE FROM players WHERE tournament_id = ?').run(t.id);
    db.prepare('DELETE FROM uploads WHERE tournament_id = ?').run(t.id);
    db.prepare('DELETE FROM tournaments WHERE id = ?').run(t.id);
  });
  tx();
  res.json({ message: '赛事已删除，其日程/选手/上传数据已一并清理' });
});

module.exports = router;