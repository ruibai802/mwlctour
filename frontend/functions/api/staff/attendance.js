// /api/staff/attendance — 考勤列表/记录（静态段优先于 staff/[id].js）
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../_lib/auth.js'
import { handleError } from '../../_lib/util.js'

const DATE_STATUSES = ['present', 'absent', 'late', 'leave', 'off']

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const url = new URL(request.url)
    const date = url.searchParams.get('date')
    const staff_id = url.searchParams.get('staff_id')
    const month = url.searchParams.get('month')
    let rows
    if (date) {
      rows = await env.DB.prepare(`
        SELECT a.*, s.name AS staff_name, s.fanbook_id AS staff_fanbook FROM staff_attendance a
        JOIN staff s ON s.id = a.staff_id WHERE a.date = ? ORDER BY a.staff_id
      `).bind(String(date)).all()
    } else if (staff_id) {
      rows = await env.DB.prepare(`
        SELECT a.*, s.name AS staff_name, s.fanbook_id AS staff_fanbook FROM staff_attendance a
        JOIN staff s ON s.id = a.staff_id WHERE a.staff_id = ? ORDER BY a.date DESC
      `).bind(Number(staff_id)).all()
    } else if (month) {
      rows = await env.DB.prepare(`
        SELECT a.*, s.name AS staff_name, s.fanbook_id AS staff_fanbook FROM staff_attendance a
        JOIN staff s ON s.id = a.staff_id WHERE a.date LIKE ? ORDER BY a.date, a.staff_id
      `).bind(`${String(month)}%`).all()
    } else {
      rows = []
    }
    return json(Array.isArray(rows) ? rows : (rows.results || rows))
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
    const sid = Number(body.staff_id)
    if (!Number.isInteger(sid) || sid <= 0) return badRequest('请选择工作人员')
    const staff = await env.DB.prepare('SELECT * FROM staff WHERE id = ?').bind(sid).first()
    if (!staff) return notFound('工作人员不存在')
    if (!body.date) return badRequest('缺少日期')
    const finalStatus = DATE_STATUSES.includes(String(body.status || '')) ? String(body.status) : 'present'
    const existing = await env.DB.prepare('SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ?').bind(sid, String(body.date)).first()
    if (existing) {
      await env.DB.prepare(
        "UPDATE staff_attendance SET check_in=?, check_out=?, status=?, remark=?, recorded_by=?, updated_at=datetime('now','localtime') WHERE id=?"
      ).bind(
        body.check_in !== undefined ? String(body.check_in) : existing.check_in,
        body.check_out !== undefined ? String(body.check_out) : existing.check_out,
        body.status !== undefined ? String(body.status) : existing.status,
        body.remark !== undefined ? String(body.remark) : existing.remark,
        String(user.name || user.fanbook_id),
        existing.id
      ).run()
      const row = await env.DB.prepare('SELECT * FROM staff_attendance WHERE id = ?').bind(existing.id).first()
      return json(row)
    }
    const info = await env.DB.prepare(
      'INSERT INTO staff_attendance (staff_id, date, check_in, check_out, status, remark, recorded_by) VALUES (?,?,?,?,?,?,?)'
    ).bind(
      sid,
      String(body.date),
      String(body.check_in || ''),
      String(body.check_out || ''),
      finalStatus,
      String(body.remark || ''),
      String(user.name || user.fanbook_id)
    ).run()
    const row = await env.DB.prepare('SELECT * FROM staff_attendance WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(row, 201)
  } catch (e) {
    return handleError(e)
  }
}