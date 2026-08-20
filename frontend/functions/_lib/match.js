// Pages Functions 共享：比赛详情格式化（staff/players/videos/penalties）
import { json } from './auth.js'

export const STAFF_ROLES = ['referee', 'recorder', 'referee_chief', 'coordinator', 'other']
export const MATCH_STATUS = ['scheduled', 'ongoing', 'completed', 'cancelled']
export const PLAYER_SIDES = ['a', 'b']
export const PENALTY_TYPES = ['warning', 'points', 'fine', 'ban']
export const PENALTY_STATUS = ['pending', 'decided', 'rejected']

// 解析对阵名：如 "左卫门 VS 王" / "A队 vs B队" → [A队名, B队名]
export function parseMatchup(matchup) {
  const m = String(matchup || '').match(/^\s*(.+?)\s*(?:VS|vs|对)\s*(.+?)\s*$/)
  if (!m) return null
  const a = m[1].trim()
  const b = m[2].trim()
  if (!a || !b) return null
  return [a, b]
}

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
  // 双方队伍全名单：优先按对阵名（matchup）匹配同名队伍，其次按关联队伍 ID，再按队伍字段名
  const mup = parseMatchup(row.matchup)
  const [teamAPlayers, teamBPlayers] = await Promise.all([
    getTeamPlayersFor(env, row, 'a', mup),
    getTeamPlayersFor(env, row, 'b', mup)
  ])
  return {
    ...row,
    staff: staff.results || staff,
    players: players.results || players,
    videos: videos.results || videos,
    penalties: penalties.results || penalties,
    team_a_players: teamAPlayers,
    team_b_players: teamBPlayers
  }
}

// 队伍全名单（P 位 / 姓名 / fanbook / 游戏ID）
async function getTeamPlayers(env, teamId) {
  if (!teamId || Number(teamId) <= 0) return []
  const rows = await env.DB.prepare(`
    SELECT p.id, p.name, p.fanbook, p.game_id, p.slot,
           tp.slot AS team_slot, tp.remark AS tp_remark
    FROM team_players tp
    JOIN players p ON p.id = tp.player_id
    WHERE tp.team_id = ?
    ORDER BY tp.slot, p.slot, p.id
  `).bind(Number(teamId)).all()
  return rows.results || rows
}

// 按队伍名查找队伍队员（不存在返回 []）
async function getTeamPlayersByName(env, tid, name) {
  if (!name) return []
  const t = await env.DB.prepare('SELECT id FROM teams WHERE tournament_id = ? AND name = ?').bind(tid, name).first()
  if (!t) return []
  return getTeamPlayers(env, t.id)
}

// 按对阵名匹配队伍提取名单；回退关联队伍 ID / 队伍字段名
async function getTeamPlayersFor(env, row, side, mup) {
  const wantedName = mup ? mup[side === 'a' ? 0 : 1] : ''
  // 1) 对阵名同名队伍优先
  if (wantedName) {
    const byName = await getTeamPlayersByName(env, row.tournament_id, wantedName)
    if (byName.length) return byName
  }
  // 2) 关联队伍 ID
  const teamId = side === 'a' ? row.team_a_id : row.team_b_id
  if (teamId) {
    const byId = await getTeamPlayers(env, teamId)
    if (byId.length) return byId
  }
  // 3) 队伍字段名
  const fieldName = side === 'a' ? row.team_a_name : row.team_b_name
  return getTeamPlayersByName(env, row.tournament_id, fieldName)
}

export async function resolveTeamName(env, teamId) {
  if (!teamId || Number(teamId) <= 0) return ''
  const t = await env.DB.prepare('SELECT name FROM teams WHERE id = ?').bind(Number(teamId)).first()
  return t ? t.name : ''
}

export function makeRoom(round, seq) {
  return `R${round}${seq}`
}