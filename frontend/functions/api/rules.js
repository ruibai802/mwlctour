// /api/rules — 规则列表(GET) / 新建(POST)
import { currentUser, canEditRules, json, unauthorized, forbidden, badRequest } from '../_lib/auth.js'
import { resolveTournamentId, handleError } from '../_lib/util.js'

export async function onRequestGet(context) {
  const { request, env } = context
  try {
    const tid = await resolveTournamentId(request, env)
    const rows = await env.DB.prepare('SELECT * FROM rules WHERE tournament_id = ? ORDER BY sort, id').bind(tid).all()
    return json(rows.results || rows)
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!canEditRules(user)) return forbidden('仅规则管理/管理员可新建规则')
  try {
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const title = String(body && body.title ? body.title : '').trim()
    if (!title) return badRequest('请输入规则标题')
    const tid = await resolveTournamentId(request, env)
    const maxSort = await env.DB.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM rules WHERE tournament_id = ?').bind(tid).first()
    const info = await env.DB.prepare(
      'INSERT INTO rules (tournament_id, title, content, background, content_background, registration_url, page_title, page_subtitle, sort) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(
      tid,
      title,
      String((body && body.content) || ''),
      String((body && body.background) || ''),
      String((body && body.content_background) || ''),
      String((body && body.registration_url) || ''),
      String((body && body.page_title) || ''),
      String((body && body.page_subtitle) || ''),
      (maxSort ? maxSort.m : 0) + 1
    ).run()
    const row = await env.DB.prepare('SELECT * FROM rules WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}
