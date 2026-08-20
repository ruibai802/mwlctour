// POST /api/players/import — 批量导入选手名单
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'

const FIELDS = ['team', 'name', 'fanbook', 'game_id', 'slot']
const SLOTS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']

function cleanPlayer(body) {
  const p = {}
  for (const f of FIELDS) p[f] = body[f] !== undefined ? String(body[f]).trim() : ''
  return p
}

function validate(p) {
  if (!p.team) return '缺少队伍名'
  if (!p.name && !p.fanbook && !p.game_id) return '至少填写姓名、fanbook 或 ID 之一'
  if (p.slot && !SLOTS.includes(p.slot)) return `身份只能是 ${SLOTS.join('/')}`
  return null
}

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    let list
    try { list = await request.json() } catch (e) { list = null }
    if (!Array.isArray(list) || !list.length) return badRequest('导入数据不能为空')
    if (list.length > 2000) return badRequest('单次最多导入 2000 条')
    const tid = await resolveTournamentId(request, env)
    const stmt = env.DB.prepare('INSERT INTO players (team, name, fanbook, game_id, slot, tournament_id) VALUES (?,?,?,?,?,?)')
    let inserted = 0
    let skipped = 0
    let teamsCreated = 0
    for (const item of list) {
      const p = cleanPlayer(item)
      if (validate(p)) { skipped++; continue }
      // 同步队伍管理：按队伍名查找，不存在则自动创建
      let team = await env.DB.prepare('SELECT id FROM teams WHERE tournament_id = ? AND name = ?').bind(tid, p.team).first()
      if (!team) {
        const ti = await env.DB.prepare('INSERT INTO teams (tournament_id, name, status) VALUES (?,?,?)').bind(tid, p.team, 'active').run()
        team = { id: ti.meta.last_row_id }
        teamsCreated++
      }
      const info = await stmt.bind(p.team, p.name, p.fanbook, p.game_id, p.slot, tid).run()
      const playerId = info.meta.last_row_id
      // 队伍-队员关联
      const existsTp = await env.DB.prepare('SELECT id FROM team_players WHERE team_id = ? AND player_id = ?').bind(team.id, playerId).first()
      if (!existsTp) {
        await env.DB.prepare('INSERT INTO team_players (team_id, player_id, slot, remark) VALUES (?,?,?,?)')
          .bind(team.id, playerId, p.slot || '', '').run()
      }
      inserted++
    }
    return json({
      message: `导入完成：新增 ${inserted} 条，跳过 ${skipped} 条，自动创建队伍 ${teamsCreated} 个（已同步到队伍管理）`,
      inserted,
      skipped,
      teamsCreated
    })
  } catch (e) {
    return handleError(e)
  }
}
