// /api/rules/:id — 规则修改(PUT) / 删除(DELETE)
import { currentUser, canEditRules, json, unauthorized, forbidden, notFound, badRequest } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!canEditRules(user)) return forbidden('仅规则管理/管理员可修改规则')
  try {
    const tid = await resolveTournamentId(request, env)
    const existing = await env.DB.prepare('SELECT * FROM rules WHERE id = ? AND tournament_id = ?').bind(params.id, tid).first()
    if (!existing) return notFound('规则不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const title = body.title !== undefined ? String(body.title).trim() : existing.title
    if (!title) return badRequest('规则标题不能为空')
    await env.DB.prepare(`
      UPDATE rules SET
        title = ?, content = ?, background = ?, content_background = ?, registration_url = ?, sort = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ? AND tournament_id = ?
    `).bind(
      title,
      body.content !== undefined ? String(body.content) : existing.content,
      body.background !== undefined ? String(body.background) : existing.background,
      body.content_background !== undefined ? String(body.content_background) : existing.content_background,
      body.registration_url !== undefined ? String(body.registration_url) : (existing.registration_url || ''),
      body.sort !== undefined ? parseInt(body.sort, 10) || 0 : existing.sort,
      params.id,
      tid
    ).run()
    const row = await env.DB.prepare('SELECT * FROM rules WHERE id = ?').bind(params.id).first()
    return json(row)
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!canEditRules(user)) return forbidden('仅规则管理/管理员可删除规则')
  try {
    const tid = await resolveTournamentId(request, env)
    const existing = await env.DB.prepare('SELECT * FROM rules WHERE id = ? AND tournament_id = ?').bind(params.id, tid).first()
    if (!existing) return notFound('规则不存在')
    await env.DB.prepare('DELETE FROM rules WHERE id = ? AND tournament_id = ?').bind(params.id, tid).run()
    return json({ message: '规则已删除' })
  } catch (e) {
    return handleError(e)
  }
}
