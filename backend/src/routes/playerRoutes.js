const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { resolveTournamentId } = require('../tournament');

const router = express.Router();

const FIELDS = ['team', 'name', 'fanbook', 'game_id', 'slot'];
const SLOTS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];

function cleanPlayer(body) {
  const p = {};
  for (const f of FIELDS) p[f] = body[f] !== undefined ? String(body[f]).trim() : '';
  return p;
}

function validate(p) {
  if (!p.team) return '缺少队伍名';
  if (!p.name && !p.fanbook && !p.game_id) return '至少填写姓名、fanbook 或 ID 之一';
  if (p.slot && !SLOTS.includes(p.slot)) return `身份只能是 ${SLOTS.join('/')}`;
  return null;
}

function formatTeamRows(tid) {
  const teams = {};
  const rows = db.prepare('SELECT * FROM players WHERE tournament_id = ? ORDER BY team, id').all(tid);
  for (const r of rows) {
    if (!teams[r.team]) teams[r.team] = { team: r.team, players: [] };
    teams[r.team].players.push(r);
  }
  return Object.values(teams);
}

router.get('/', requireAuth, (req, res) => {
  const { team, slot } = req.query;
  const tid = resolveTournamentId(req);
  let rows;
  if (team && slot) {
    rows = db.prepare('SELECT * FROM players WHERE team = ? AND slot = ? AND tournament_id = ? ORDER BY id').all(String(team), String(slot), tid);
  } else if (team) {
    rows = db.prepare('SELECT * FROM players WHERE team = ? AND tournament_id = ? ORDER BY slot, id').all(String(team), tid);
  } else if (slot) {
    rows = db.prepare('SELECT * FROM players WHERE slot = ? AND tournament_id = ? ORDER BY team, id').all(String(slot), tid);
  } else {
    rows = db.prepare('SELECT * FROM players WHERE tournament_id = ? ORDER BY team, slot, id').all(tid);
  }
  res.json(rows);
});

router.get('/teams', requireAuth, (req, res) => {
  res.json(formatTeamRows(resolveTournamentId(req)));
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const p = cleanPlayer(req.body);
  const err = validate(p);
  if (err) return res.status(400).json({ error: err });
  const info = db.prepare('INSERT INTO players (team, name, fanbook, game_id, slot, tournament_id) VALUES (?,?,?,?,?,?)')
    .run(p.team, p.name, p.fanbook, p.game_id, p.slot, resolveTournamentId(req));
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const tid = resolveTournamentId(req);
  const existing = db.prepare('SELECT * FROM players WHERE id = ? AND tournament_id = ?').get(req.params.id, tid);
  if (!existing) return res.status(404).json({ error: '名单不存在' });
  const p = cleanPlayer(req.body);
  const err = validate(p);
  if (err) return res.status(400).json({ error: err });
  db.prepare('UPDATE players SET team=?, name=?, fanbook=?, game_id=?, slot=? WHERE id=? AND tournament_id=?')
    .run(p.team, p.name, p.fanbook, p.game_id, p.slot, req.params.id, tid);
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.post('/batch-delete', requireAuth, requireAdmin, (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: '请选择要删除的选手' });
  const cleanIds = [...new Set(ids.map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  if (!cleanIds.length) return res.status(400).json({ error: '选手ID不合法' });
  let deleted = 0;
  const tid = resolveTournamentId(req);
  const tx = db.transaction((idsToDelete) => {
    const del = db.prepare('DELETE FROM players WHERE id = ? AND tournament_id = ?');
    for (const id of idsToDelete) {
      deleted += del.run(id, tid).changes;
    }
  });
  tx(cleanIds);
  res.json({ message: `已删除 ${deleted} 名选手`, deleted });
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM players WHERE id = ? AND tournament_id = ?')
    .run(req.params.id, resolveTournamentId(req));
  if (info.changes === 0) return res.status(404).json({ error: '名单不存在' });
  res.json({ message: '已删除' });
});

router.post('/import', requireAuth, requireAdmin, (req, res) => {
  const list = req.body;
  if (!Array.isArray(list) || !list.length) {
    return res.status(400).json({ error: '导入数据不能为空' });
  }
  if (list.length > 2000) {
    return res.status(400).json({ error: '单次最多导入 2000 条' });
  }
  const tid = resolveTournamentId(req);
  const insert = db.prepare('INSERT INTO players (team, name, fanbook, game_id, slot, tournament_id) VALUES (?,?,?,?,?,?)');
  const tx = db.transaction((items) => {
    let inserted = 0;
    let skipped = 0;
    for (const item of items) {
      const p = cleanPlayer(item);
      if (validate(p)) { skipped++; continue; }
      insert.run(p.team, p.name, p.fanbook, p.game_id, p.slot, tid);
      inserted++;
    }
    return { inserted, skipped };
  });
  const result = tx(list);
  res.json({ message: `导入完成：新增 ${result.inserted} 条，跳过 ${result.skipped} 条`, ...result });
});

module.exports = router;
