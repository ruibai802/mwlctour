// /api/groups/:id — 修改/删除分组
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const tid = await resolveTournamentId(request, env)
    const row = await env.DB.prepare('SELECT * FROM groups WHERE id = ? AND tournament_id = ?').bind(params.id, tid).first()
    if (!row) return notFound('分组不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const name = body.name !== undefined ? String(body.name).trim() : row.name
    if (!name) return badRequest('缺少分组名称')
    await env.DB.prepare('UPDATE groups SET name=?, description=?, sort=? WHERE id=?').bind(
      name,
      body.description !== undefined ? String(body.description).trim() : row.description,
      body.sort !== undefined ? parseInt(body.sort, 10) || 0 : row.sort,
      row.id
    ).run()
    return json(await env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(row.id).first())
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
    const useCount = await env.DB.prepare('SELECT COUNT(*) AS c FROM matches WHERE group_id = ?').bind(params.id).first()
    if (useCount && useCount.c > 0) return badRequest('该分组下已有比赛，无法删除')
    const tid = await resolveTournamentId(request, env)
    const info = await env.DB.prepare('DELETE FROM groups WHERE id = ? AND tournament_id = ?').bind(params.id, tid).run()
    if (!info.meta.changes) return notFound('分组不存在')
    return json({ message: '分组已删除' })
  } catch (e) {
    return handleError(e)
  }
}