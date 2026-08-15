const express = require('express');
const db = require('../db');
const { requireAuth, requireRules } = require('../auth');
const { resolveTournamentId, getTournamentById } = require('../tournament');

const router = express.Router();

function format(t) {
  let maps = [];
  try { maps = JSON.parse(t.maps || '[]'); } catch (e) { maps = []; }
  return {
    tournament_name: t.name,
    tournament_code: t.code,
    tournament_id: t.id,
    rules_content: t.rules_content,
    rules_background: t.rules_background,
    registration_url: t.registration_url,
    maps
  };
}

router.get('/public', (req, res) => {
  const t = getTournamentById(resolveTournamentId(req));
  res.json(format(t));
});

router.get('/', requireAuth, (req, res) => {
  const t = getTournamentById(resolveTournamentId(req));
  res.json(format(t));
});

router.put('/', requireAuth, requireRules, (req, res) => {
  const t = getTournamentById(resolveTournamentId(req));
  const { tournament_name, rules_content, rules_background, registration_url, maps } = req.body || {};
  const newMaps = (maps !== undefined && Array.isArray(maps))
    ? JSON.stringify(maps.map((m) => String(m)))
    : t.maps;
  db.prepare(`
    UPDATE tournaments SET
      name = ?, rules_content = ?, rules_background = ?, registration_url = ?, maps = ?,
      updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    tournament_name !== undefined ? String(tournament_name) : t.name,
    rules_content !== undefined ? String(rules_content) : t.rules_content,
    rules_background !== undefined ? String(rules_background) : t.rules_background,
    registration_url !== undefined ? String(registration_url) : t.registration_url,
    newMaps,
    t.id
  );
  const updated = getTournamentById(t.id);
  res.json(format(updated));
});

module.exports = router;