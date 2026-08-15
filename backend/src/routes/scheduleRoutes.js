const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { resolveTournamentId } = require('../tournament');

const router = express.Router();

function nowStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildRoom(round, seq) {
  return `R${round}${seq}`;
}

function getResultBySchedule(scheduleId) {
  return db.prepare('SELECT * FROM results WHERE schedule_id = ?').get(scheduleId) || null;
}

function formatSchedule(row) {
  const result = getResultBySchedule(row.id);
  let screenshots = [];
  let gameLinks = [];
  if (result) {
    // results 表中 screenshots / game_links 存的是 JSON 字符串，需解析为数组后再返回给前端
    try { screenshots = JSON.parse(result.screenshots || '[]'); } catch (e) { screenshots = []; }
    try { gameLinks = JSON.parse(result.game_links || '[]'); } catch (e) { gameLinks = []; }
  }
  return {
    ...row,
    team_a_lineup: parseLineup(row.team_a_lineup),
    team_b_lineup: parseLineup(row.team_b_lineup),
    status: result ? 'completed' : 'pending',
    result: result ? { ...result, screenshots, game_links: gameLinks } : null
  };
}

function hasGroupKey(group, round, seq, tournamentId) {
  return db.prepare('SELECT COUNT(*) AS c FROM schedules WHERE group_name = ? AND round = ? AND seq = ? AND tournament_id = ?')
    .get(group, round, seq, tournamentId).c > 0;
}

const FIELDS = [
  'group_name', 'round', 'seq', 'matchup', 'room', 'time',
  'team_a_name', 't1_a_name', 't1_a_fb', 't1_a_id', 't2_a_name', 't2_a_id', 'sub_a_name', 'sub_a_id',
  'team_b_name', 't1_b_name', 't1_b_fb', 't1_b_id', 't2_b_name', 't2_b_id', 'sub_b_name', 'sub_b_id',
  'map', 'remark'
];

function parseLineup(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    if (Array.isArray(arr)) {
      return arr.map((p) => ({
        slot: String(p.slot || '').toUpperCase(),
        name: String(p.name || ''),
        fanbook: String(p.fanbook || ''),
        game_id: String(p.game_id || '')
      }));
    }
  } catch (e) { /* ignore */ }
  return [];
}

function serializeLineup(list) {
  if (!Array.isArray(list)) return '[]';
  return JSON.stringify(
    list.map((p) => ({
      slot: String(p.slot || '').toUpperCase(),
      name: String(p.name || ''),
      fanbook: String(p.fanbook || ''),
      game_id: String(p.game_id || '')
    }))
  );
}

function extractScheduleBody(body) {
  const data = {};
  for (const f of FIELDS) {
    data[f] = body[f] !== undefined ? String(body[f]) : '';
  }
  data.round = parseInt(data.round, 10) || 1;
  data.seq = parseInt(data.seq, 10) || 1;
  data.team_a_lineup = body.team_a_lineup !== undefined ? body.team_a_lineup : [];
  data.team_b_lineup = body.team_b_lineup !== undefined ? body.team_b_lineup : [];
  if (!data.room) {
    data.room = buildRoom(data.round, data.seq);
  }
  // 若未单独提供 t1/t2/sub，则从 P1-P7 名单推导（P1→T1、P2→T2、P3→替补）
  const deriveCore = (side, lineup) => {
    if (!Array.isArray(lineup) || !lineup.length) return;
    if (data[`t1_${side}_name`]) return;
    const at = (i) => (i < lineup.length ? lineup[i] : null);
    const p1 = at(0); const p2 = at(1); const p3 = at(2);
    data[`t1_${side}_name`] = p1 ? String(p1.name || '') : '';
    data[`t1_${side}_fb`] = p1 ? String(p1.fanbook || '') : '';
    data[`t1_${side}_id`] = p1 ? String(p1.game_id || '') : '';
    data[`t2_${side}_name`] = p2 ? String(p2.name || '') : '';
    data[`t2_${side}_id`] = p2 ? String(p2.game_id || '') : '';
    data[`sub_${side}_name`] = p3 ? String(p3.name || '') : '';
    data[`sub_${side}_id`] = p3 ? String(p3.game_id || '') : '';
  };
  deriveCore('a', data.team_a_lineup);
  deriveCore('b', data.team_b_lineup);
  return data;
}

router.get('/', requireAuth, (req, res) => {
  const { status, group } = req.query;
  const tid = resolveTournamentId(req);
  let rows;
  if (status === 'completed') {
    rows = db.prepare(`
      SELECT s.* FROM schedules s
      INNER JOIN results r ON r.schedule_id = s.id
      WHERE s.tournament_id = ?
      ORDER BY s.group_name, s.round, s.seq
    `).all(tid);
  } else if (status === 'pending') {
    rows = db.prepare(`
      SELECT s.* FROM schedules s
      LEFT JOIN results r ON r.schedule_id = s.id
      WHERE r.id IS NULL AND s.tournament_id = ?
      ORDER BY s.group_name, s.round, s.seq
    `).all(tid);
  } else {
    rows = db.prepare('SELECT * FROM schedules WHERE tournament_id = ? ORDER BY group_name, round, seq').all(tid);
  }
  if (group) {
    rows = rows.filter((r) => r.group_name === String(group));
  }
  res.json(rows.map(formatSchedule));
});

router.get('/groups', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT DISTINCT group_name FROM schedules WHERE tournament_id = ? ORDER BY group_name')
    .all(resolveTournamentId(req));
  res.json(rows.map((r) => r.group_name).filter(Boolean));
});

router.get('/missing-links', requireAuth, (req, res) => {
  const tid = resolveTournamentId(req);
  const rows = db.prepare(`
    SELECT s.*, r.score, r.winner, r.game_links
    FROM schedules s
    INNER JOIN results r ON r.schedule_id = s.id
    WHERE s.tournament_id = ? AND (r.game_links = '[]' OR r.game_links IS NULL OR r.game_links = '')
    ORDER BY s.group_name, s.round, s.seq
  `).all(tid);
  const byGroup = {};
  for (const r of rows) {
    if (!byGroup[r.group_name]) byGroup[r.group_name] = [];
    byGroup[r.group_name].push(formatSchedule(r));
  }
  res.json({ total: rows.length, byGroup });
});

router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM schedules WHERE id = ? AND tournament_id = ?')
    .get(req.params.id, resolveTournamentId(req));
  if (!row) return res.status(404).json({ error: '日程不存在' });
  res.json(formatSchedule(row));
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const data = extractScheduleBody(req.body);
  // 创建标签固定写入 tags 字段，与用户填写的 remark 互不干扰
  const tag = `创建于${nowStr()},来自于${req.user.name || req.user.fanbook_id}`;
  const tags = tag;
  const info = db.prepare(`
    INSERT INTO schedules (
      tournament_id, group_name, round, seq, matchup, room, time,
      team_a_name, t1_a_name, t1_a_fb, t1_a_id, t2_a_name, t2_a_id, sub_a_name, sub_a_id,
      team_b_name, t1_b_name, t1_b_fb, t1_b_id, t2_b_name, t2_b_id, sub_b_name, sub_b_id,
      map, remark, tags, created_by, team_a_lineup, team_b_lineup
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    resolveTournamentId(req), data.group_name, data.round, data.seq, data.matchup, data.room, data.time,
    data.team_a_name, data.t1_a_name, data.t1_a_fb, data.t1_a_id, data.t2_a_name, data.t2_a_id, data.sub_a_name, data.sub_a_id,
    data.team_b_name, data.t1_b_name, data.t1_b_fb, data.t1_b_id, data.t2_b_name, data.t2_b_id, data.sub_b_name, data.sub_b_id,
    data.map, data.remark, tags, req.user.name || req.user.fanbook_id,
    serializeLineup(data.team_a_lineup), serializeLineup(data.team_b_lineup)
  );
  const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(formatSchedule(row));
});

router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const tid = resolveTournamentId(req);
  const existing = db.prepare('SELECT * FROM schedules WHERE id = ? AND tournament_id = ?').get(req.params.id, tid);
  if (!existing) return res.status(404).json({ error: '日程不存在' });
  const data = extractScheduleBody(req.body);
  const tags = `${existing.tags || ''}\n修改于${nowStr()},来自于${req.user.name || req.user.fanbook_id}`.trim();
  db.prepare(`
    UPDATE schedules SET
      group_name=?, round=?, seq=?, matchup=?, room=?, time=?,
      team_a_name=?, t1_a_name=?, t1_a_fb=?, t1_a_id=?, t2_a_name=?, t2_a_id=?, sub_a_name=?, sub_a_id=?,
      team_b_name=?, t1_b_name=?, t1_b_fb=?, t1_b_id=?, t2_b_name=?, t2_b_id=?, sub_b_name=?, sub_b_id=?,
      map=?, remark=?, tags=?, updated_at=datetime('now','localtime'),
      team_a_lineup=?, team_b_lineup=?
    WHERE id=? AND tournament_id=?
  `).run(
    data.group_name, data.round, data.seq, data.matchup, data.room, data.time,
    data.team_a_name, data.t1_a_name, data.t1_a_fb, data.t1_a_id, data.t2_a_name, data.t2_a_id, data.sub_a_name, data.sub_a_id,
    data.team_b_name, data.t1_b_name, data.t1_b_fb, data.t1_b_id, data.t2_b_name, data.t2_b_id, data.sub_b_name, data.sub_b_id,
    data.map, data.remark, tags,
    serializeLineup(data.team_a_lineup), serializeLineup(data.team_b_lineup),
    req.params.id, tid
  );
  const row = db.prepare('SELECT * FROM schedules WHERE id = ? AND tournament_id = ?').get(req.params.id, tid);
  res.json(formatSchedule(row));
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM schedules WHERE id = ? AND tournament_id = ?')
    .run(req.params.id, resolveTournamentId(req));
  if (info.changes === 0) return res.status(404).json({ error: '日程不存在' });
  res.json({ message: '日程已删除' });
});

module.exports = router;
