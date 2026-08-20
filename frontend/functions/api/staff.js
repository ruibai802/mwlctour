// /api/staff — 工作人员列表/新增
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest } from '../_lib/auth.js'
import { resolveTournamentId, handleError } from '../_lib/util.js'

const STATUSES = ['active', 'inactive', 'left']

function cleanStaff(body) {
  const s = {}
  s.name = body.name !== undefined ? String(body.name).trim() : ''
  s.fanbook_id = body.fanbook_id !== undefined ? String(body.fanbook_id).trim() : ''
  s.title = body.title !== undefined ? String(body.title).trim() : ''
  s.department = body.department !== undefined ? String(body.department).trim() : ''
  s.phone = body.phone !== undefined ? String(body.phone).trim() : ''
  s.status = body.status !== undefined ? String(body.status).trim() : 'active'
  s.remark = body.remark !== undefined ? String(body.remark).trim() : ''
  if (body.user_id !== undefined && String(body.user_id).trim() !== '' && Number(body.user_id) > 0) {
    s.user_id = Number(body.user_id)
  } else {
    s.user_id = null
  }
  return s
}

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden('仅管理员可查看工作人员名单')
  try {
    const url = new URL(request.url)
    const tid = await resolveTournamentId(request, env)
    const status = url.searchParams.get('status')
    const keyword = url.searchParams.get('keyword')
    let rows
    if (status && keyword) {
      const kw = `%${String(keyword).trim()}%`
      rows = await env.DB.prepare(
        'SELECT * FROM staff WHERE tournament_id = ? AND status = ? AND (name LIKE ? OR fanbook_id LIKE ? OR department LIKE ? OR title LIKE ?) ORDER BY id'
      ).bind(tid, String(status), kw, kw, kw, kw).all()
    } else if (status) {
      rows = await env.DB.prepare('SELECT * FROM staff WHERE tournament_id = ? AND status = ? ORDER BY id').bind(tid, String(status)).all()
    } else if (keyword) {
      const kw = `%${String(keyword).trim()}%`
      rows = await env.DB.prepare(
        'SELECT * FROM staff WHERE tournament_id = ? AND (name LIKE ? OR fanbook_id LIKE ? OR department LIKE ? OR title LIKE ?) ORDER BY id'
      ).bind(tid, kw, kw, kw, kw).all()
    } else {
      rows = await env.DB.prepare('SELECT * FROM staff WHERE tournament_id = ? ORDER BY id').bind(tid).all()
    }
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
    const s = cleanStaff(body)
    if (!s.name) return badRequest('缺少姓名')
    if (!STATUSES.includes(s.status)) return badRequest('状态不合法')
    const tid = await resolveTournamentId(request, env)
    const info = await env.DB.prepare(
      'INSERT INTO staff (tournament_id, user_id, name, fanbook_id, title, department, phone, status, remark) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(tid, s.user_id, s.name, s.fanbook_id, s.title, s.department, s.phone, s.status, s.remark).run()
    const row = await env.DB.prepare('SELECT * FROM staff WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}