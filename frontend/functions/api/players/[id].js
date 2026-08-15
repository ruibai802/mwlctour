// /api/players/:id — 选手修改/删除
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../_lib/auth.js'
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

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const tid = await resolveTournamentId(request, env)
    const existing = await env.DB.prepare('SELECT * FROM players WHERE id = ? AND tournament_id = ?').bind(params.id, tid).first()
    if (!existing) return notFound('名单不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const p = cleanPlayer(body)
    const err = validate(p)
    if (err) return badRequest(err)
    await env.DB.prepare('UPDATE players SET team=?, name=?, fanbook=?, game_id=?, slot=? WHERE id=? AND tournament_id=?')
      .bind(p.team, p.name, p.fanbook, p.game_id, p.slot, params.id, tid).run()
    const row = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(params.id).first()
    return json(row)
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const info = await env.DB.prepare('DELETE FROM players WHERE id = ? AND tournament_id = ?')
      .bind(params.id, await resolveTournamentId(request, env)).run()
    if (info.meta.changes === 0) return notFound('名单不存在')
    return json({ message: '已删除' })
  } catch (e) {
    return handleError(e)
  }
}
