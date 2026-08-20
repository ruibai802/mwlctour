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
    for (const item of list) {
      const p = cleanPlayer(item)
      if (validate(p)) { skipped++; continue }
      await stmt.bind(p.team, p.name, p.fanbook, p.game_id, p.slot, tid).run()
      inserted++
    }
    return json({ message: `导入完成：新增 ${inserted} 条，跳过 ${skipped} 条`, inserted, skipped })
  } catch (e) {
    return handleError(e)
  }
}
