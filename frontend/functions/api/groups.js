// /api/groups — 分组列表/创建
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest } from '../_lib/auth.js'
import { resolveTournamentId, handleError } from '../_lib/util.js'

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const tid = await resolveTournamentId(request, env)
    const rows = await env.DB.prepare('SELECT * FROM groups WHERE tournament_id = ? ORDER BY sort, id').bind(tid).all()
    return json(rows.results || rows)
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const name = String((body && body.name) || '').trim()
    if (!name) return badRequest('缺少分组名称')
    const tid = await resolveTournamentId(request, env)
    const sort = parseInt(body.sort, 10) || 0
    const info = await env.DB.prepare(
      'INSERT INTO groups (tournament_id, name, description, sort) VALUES (?,?,?,?)'
    ).bind(tid, name, String((body && body.description) || '').trim(), sort).run()
    const row = await env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}