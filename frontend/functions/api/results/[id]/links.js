// /api/results/:id/links — 添加/更新视频链接（最多 7 局）
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../../_lib/util.js'

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const row = await env.DB.prepare(`
      SELECT r.* FROM results r
      INNER JOIN schedules s ON s.id = r.schedule_id
      WHERE r.id = ? AND s.tournament_id = ?
    `).bind(params.id, await resolveTournamentId(request, env)).first()
    if (!row) return notFound('结果不存在')

    const isOwnerRecorder = isAdmin(user) || String(user.fanbook_id) === String(row.recorder_id)
    if (!isOwnerRecorder) return forbidden('只有该场录像或管理员可以添加链接')

    let body
    try { body = await request.json() } catch (e) { body = {} }
    const { game_links } = body || {}
    if (!Array.isArray(game_links)) return badRequest('链接格式错误')
    if (game_links.length > 7) return badRequest('最多提供 7 局链接')
    const clean = game_links.map((l) => String(l || '').trim()).filter(Boolean)

    await env.DB.prepare(`UPDATE results SET game_links=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .bind(JSON.stringify(clean), params.id).run()
    const updated = await env.DB.prepare('SELECT * FROM results WHERE id = ?').bind(params.id).first()
    let gameLinks = []
    try { gameLinks = JSON.parse(updated.game_links || '[]') } catch (e) {}
    return json({ ...updated, game_links: gameLinks })
  } catch (e) {
    return handleError(e)
  }
}
