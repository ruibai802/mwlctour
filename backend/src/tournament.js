const db = require('./db');

function resolveTournamentId(req) {
  const raw = req.headers['x-tournament-id'];
  const n = parseInt(raw, 10);
  if (Number.isInteger(n) && n > 0) return n;
  const first = db.prepare('SELECT id FROM tournaments ORDER BY id LIMIT 1').get();
  return first ? first.id : 1;
}

function getTournamentById(id) {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
  if (t) return t;
  return db.prepare('SELECT * FROM tournaments ORDER BY id LIMIT 1').get() || {
    id: 1,
    code: 'default',
    name: 'MWLC赛事',
    rules_content: '',
    rules_background: '',
    maps: '[]'
  };
}

function requireTournamentExists(id) {
  return !!db.prepare('SELECT id FROM tournaments WHERE id = ?').get(id);
}

module.exports = { resolveTournamentId, getTournamentById, requireTournamentExists };