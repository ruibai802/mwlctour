// Pages Functions 共享：比赛详情格式化（staff/players/videos/penalties）
import { json } from './auth.js'

export const STAFF_ROLES = ['referee', 'recorder', 'referee_chief', 'coordinator', 'other']
export const MATCH_STATUS = ['scheduled', 'ongoing', 'completed', 'cancelled']
export const PLAYER_SIDES = ['a', 'b']
export const PENALTY_TYPES = ['warning', 'points', 'fine', 'ban']
export const PENALTY_STATUS = ['pending', 'decided', 'rejected']

export async function formatMatchDetail(env, row) {
  const staff = await env.DB.prepare(`
    SELECT ms.id, ms.match_id, ms.staff_id, ms.role, ms.confirmed, ms.remark AS ms_remark,
           s.name AS staff_name, s.fanbook_id, s.title AS staff_title, s.user_id AS staff_user_id
    FROM match_staff ms JOIN staff s ON s.id = ms.staff_id
    WHERE ms.match_id = ? ORDER BY ms.role, ms.id
  `).bind(row.id).all()
  const players = await env.DB.prepare(`
    SELECT mp.id, mp.match_id, mp.player_id, mp.team_id, mp.side, mp.slot, mp.confirmed, mp.remark AS mp_remark,
           p.name AS player_name, p.fanbook, p.game_id, p.slot AS player_slot,
           t.name AS team_name
    FROM match_players mp
    JOIN players p ON p.id = mp.player_id
    LEFT JOIN teams t ON t.id = mp.team_id
    WHERE mp.match_id = ? ORDER BY mp.side, mp.slot, mp.id
  `).bind(row.id).all()
  const videos = await env.DB.prepare('SELECT * FROM videos WHERE match_id = ? ORDER BY game_number, id').bind(row.id).all()
  const penalties = await env.DB.prepare(`
    SELECT pn.*, t.name AS team_name, pl.name AS player_name
    FROM penalties pn
    LEFT JOIN teams t ON t.id = pn.team_id
    LEFT JOIN players pl ON pl.id = pn.player_id
    WHERE pn.match_id = ? ORDER BY pn.id
  `).bind(row.id).all()
  return {
    ...row,
    staff: staff.results || staff,
    players: players.results || players,
    videos: videos.results || videos,
    penalties: penalties.results || penalties
  }
}

export async function resolveTeamName(env, teamId) {
  if (!teamId || Number(teamId) <= 0) return ''
  const t = await env.DB.prepare('SELECT name FROM teams WHERE id = ?').bind(Number(teamId)).first()
  return t ? t.name : ''
}

export function makeRoom(round, seq) {
  return `R${round}${seq}`
}