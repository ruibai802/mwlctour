// /api/staff/:id — 工作人员详情/修改/删除
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'

const STATUSES = ['active', 'inactive', 'left']

async function cleanStaff(env, body, tid) {
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
  } else if (body.user_id !== undefined) {
    s.user_id = null
  }
  return s
}

export async function onRequestGet(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const tid = await resolveTournamentId(request, env)
    const row = await env.DB.prepare('SELECT * FROM staff WHERE id = ? AND tournament_id = ?').bind(params.id, tid).first()
    if (!row) return notFound('工作人员不存在')
    const attendance = await env.DB.prepare(
      'SELECT * FROM staff_attendance WHERE staff_id = ? ORDER BY date DESC LIMIT 60'
    ).bind(row.id).all()
    return json({ ...row, attendance: attendance.results || attendance })
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const tid = await resolveTournamentId(request, env)
    const row = await env.DB.prepare('SELECT * FROM staff WHERE id = ? AND tournament_id = ?').bind(params.id, tid).first()
    if (!row) return notFound('工作人员不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const s = await cleanStaff(env, body, tid)
    if (!s.name) return badRequest('缺少姓名')
    if (!STATUSES.includes(s.status)) return badRequest('状态不合法')
    await env.DB.prepare(
      "UPDATE staff SET user_id=?, name=?, fanbook_id=?, title=?, department=?, phone=?, status=?, remark=?, updated_at=datetime('now','localtime') WHERE id=?"
    ).bind(s.user_id, s.name, s.fanbook_id, s.title, s.department, s.phone, s.status, s.remark, row.id).run()
    return json(await env.DB.prepare('SELECT * FROM staff WHERE id = ?').bind(row.id).first())
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
    const assigned = await env.DB.prepare('SELECT COUNT(*) AS c FROM match_staff WHERE staff_id = ?').bind(params.id).first()
    if (assigned && assigned.c > 0) return badRequest('该工作人员已分配到比赛，无法删除，请先移除分配')
    const tid = await resolveTournamentId(request, env)
    const info = await env.DB.prepare('DELETE FROM staff WHERE id = ? AND tournament_id = ?').bind(params.id, tid).run()
    if (!info.meta.changes) return notFound('工作人员不存在')
    return json({ message: '工作人员已删除' })
  } catch (e) {
    return handleError(e)
  }
}