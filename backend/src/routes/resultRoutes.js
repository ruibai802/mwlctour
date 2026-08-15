const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, requireAdmin, isAdmin } = require('../auth');
const { resolveTournamentId } = require('../tournament');
const { screenshotUpload, relUrl, UPLOAD_DIR } = require('../upload');

const router = express.Router();

const RESULT_ROLES = ['official', 'admin', 'superadmin'];

function removeScreenshotFiles(urls) {
  for (const url of urls || []) {
    const rel = String(url || '').replace(/^\/uploads\//, '');
    if (!rel) continue;
    const full = path.join(UPLOAD_DIR, rel);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isFile()) fs.unlinkSync(full);
    } catch (e) { /* 文件已不存在时忽略 */ }
  }
}

function canManageResult(user, row) {
  return (
    isAdmin(user) ||
    String(user.fanbook_id) === String(row.referee_id) ||
    String(user.fanbook_id) === String(row.recorder_id)
  );
}

function parseScore(score) {
  const m = String(score || '').match(/(\d+)\s*[:\-：]\s*(\d+)/);
  if (m) return { a: parseInt(m[1], 10), b: parseInt(m[2], 10) };
  return null;
}

function inferWinner(schedule, score) {
  const parts = parseScore(score);
  if (!parts) return '';
  if (parts.a > parts.b) return schedule.team_a_name || '';
  if (parts.b > parts.a) return schedule.team_b_name || '';
  return '';
}

function formatResult(row) {
  let screenshots = [];
  let gameLinks = [];
  try { screenshots = JSON.parse(row.screenshots || '[]'); } catch (e) {}
  try { gameLinks = JSON.parse(row.game_links || '[]'); } catch (e) {}
  return { ...row, screenshots, game_links: gameLinks };
}

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT r.* FROM results r
    INNER JOIN schedules s ON s.id = r.schedule_id
    WHERE s.tournament_id = ?
    ORDER BY r.id DESC
  `).all(resolveTournamentId(req));
  res.json(rows.map(formatResult));
});

router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT r.* FROM results r
    INNER JOIN schedules s ON s.id = r.schedule_id
    WHERE r.id = ? AND s.tournament_id = ?
  `).get(req.params.id, resolveTournamentId(req));
  if (!row) return res.status(404).json({ error: '结果不存在' });
  res.json(formatResult(row));
});

router.post('/',
  requireAuth,
  (req, res, next) => {
    if (!RESULT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: '仅裁判/录像或管理员可上传结果' });
    }
    screenshotUpload.array('screenshots', 10)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '单张截图不能超过 15MB' });
        if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: '截图最多上传 10 张' });
        return res.status(400).json({ error: err.message || '上传失败' });
      }
      next();
    });
  },
  (req, res) => {
    const { schedule_id, score, referee_id, recorder_id, remark, winner } = req.body || {};
    if (!schedule_id) return res.status(400).json({ error: '缺少日程' });
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ? AND tournament_id = ?')
      .get(schedule_id, resolveTournamentId(req));
    if (!schedule) return res.status(404).json({ error: '日程不存在' });

    const existing = db.prepare('SELECT * FROM results WHERE schedule_id = ?').get(schedule_id);
    if (existing) return res.status(400).json({ error: '该日程已上传过结果' });

    const screenshots = (req.files || []).map((f) => relUrl(f.path));
    const finalWinner = (winner && String(winner)) || inferWinner(schedule, score);

    const info = db.prepare(`
      INSERT INTO results (schedule_id, score, winner, referee_id, recorder_id, screenshot_count, screenshots, remark, created_by)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
      schedule_id,
      String(score || ''),
      finalWinner,
      String(referee_id || ''),
      String(recorder_id || ''),
      screenshots.length,
      JSON.stringify(screenshots),
      String(remark || ''),
      req.user.name || req.user.fanbook_id
    );
    const row = db.prepare('SELECT * FROM results WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(formatResult(row));
  }
);

router.put('/:id',
  requireAuth,
  (req, res, next) => {
    screenshotUpload.array('screenshots', 10)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '单张截图不能超过 15MB' });
        if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: '截图最多上传 10 张' });
        return res.status(400).json({ error: err.message || '上传失败' });
      }
      next();
    });
  },
  (req, res) => {
    const row = db.prepare(`
      SELECT r.* FROM results r
      INNER JOIN schedules s ON s.id = r.schedule_id
      WHERE r.id = ? AND s.tournament_id = ?
    `).get(req.params.id, resolveTournamentId(req));
    if (!row) return res.status(404).json({ error: '结果不存在' });

    if (!canManageResult(req.user, row)) {
      return res.status(403).json({ error: '只能修改自己负责的结果' });
    }

    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(row.schedule_id);
    const { score, referee_id, recorder_id, remark, winner, replace_screenshots } = req.body || {};

    let screenshots = [];
    try { screenshots = JSON.parse(row.screenshots || '[]'); } catch (e) {}
    if (req.files && req.files.length) {
      const newShots = (req.files || []).map((f) => relUrl(f.path));
      if (String(replace_screenshots) === 'true') {
        // 替换模式：清理被替换掉的旧截图文件
        removeScreenshotFiles(screenshots);
        screenshots = newShots;
      } else {
        screenshots = [...screenshots, ...newShots].slice(0, 10);
      }
    }

    const newScore = score !== undefined ? String(score) : row.score;
    let newWinner = winner !== undefined ? String(winner) : row.winner;
    if (winner === undefined && score !== undefined) {
      newWinner = inferWinner(schedule, newScore) || row.winner;
    }

    db.prepare(`
      UPDATE results SET
        score=?, winner=?, referee_id=?, recorder_id=?, screenshot_count=?, screenshots=?, remark=?,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      newScore,
      newWinner,
      referee_id !== undefined ? String(referee_id) : row.referee_id,
      recorder_id !== undefined ? String(recorder_id) : row.recorder_id,
      screenshots.length,
      JSON.stringify(screenshots),
      remark !== undefined ? String(remark) : row.remark,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
    res.json(formatResult(updated));
  }
);

router.put('/:id/links', requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT r.* FROM results r
    INNER JOIN schedules s ON s.id = r.schedule_id
    WHERE r.id = ? AND s.tournament_id = ?
  `).get(req.params.id, resolveTournamentId(req));
  if (!row) return res.status(404).json({ error: '结果不存在' });

  const isOwnerRecorder = isAdmin(req.user) || String(req.user.fanbook_id) === String(row.recorder_id);
  if (!isOwnerRecorder) {
    return res.status(403).json({ error: '只有该场录像或管理员可以添加链接' });
  }

  const { game_links } = req.body || {};
  if (!Array.isArray(game_links)) return res.status(400).json({ error: '链接格式错误' });
  if (game_links.length > 7) return res.status(400).json({ error: '最多提供 7 局链接' });
  const clean = game_links.map((l) => String(l || '').trim()).filter(Boolean);

  db.prepare(`UPDATE results SET game_links=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(JSON.stringify(clean), req.params.id);
  const updated = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
  res.json(formatResult(updated));
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const row = db.prepare(`
    SELECT r.id, r.screenshots FROM results r
    INNER JOIN schedules s ON s.id = r.schedule_id
    WHERE r.id = ? AND s.tournament_id = ?
  `).get(req.params.id, resolveTournamentId(req));
  if (!row) return res.status(404).json({ error: '结果不存在' });
  // 清理该结果关联的截图文件
  let shots = [];
  try { shots = JSON.parse(row.screenshots || '[]'); } catch (e) { shots = []; }
  removeScreenshotFiles(shots);
  db.prepare('DELETE FROM results WHERE id = ?').run(req.params.id);
  res.json({ message: '结果已删除' });
});

module.exports = router;
