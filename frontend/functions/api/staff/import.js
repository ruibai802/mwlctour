// POST /api/staff/import — 批量导入工作人员（按 fanbook_id 去重）
import { currentUser, isAdmin, json, unauthorized, forbidden, badRequest } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'

const STATUSES = ['active', 'inactive', 'left']

function cleanStaff(item) {
  const s = {}
  s.name = item.name !== undefined ? String(item.name).trim() : ''
  s.fanbook_id = item.fanbook_id !== undefined ? String(item.fanbook_id).trim() : ''
  s.title = item.title !== undefined ? String(item.title).trim() : ''
  s.department = item.department !== undefined ? String(item.department).trim() : ''
  s.phone = item.phone !== undefined ? String(item.phone).trim() : ''
  s.status = item.status !== undefined ? String(item.status).trim() : 'active'
  s.remark = item.remark !== undefined ? String(item.remark).trim() : ''
  return s
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
    const stmt = env.DB.prepare(
      'INSERT INTO staff (tournament_id, user_id, name, fanbook_id, title, department, phone, status, remark) VALUES (?,?,?,?,?,?,?,?,?)'
    )
    let inserted = 0
    let skipped = 0
    for (const item of list) {
      const s = cleanStaff(item)
      if (!s.name && !s.fanbook_id) { skipped++; continue }
      if (!s.name) { skipped++; continue }
      if (!STATUSES.includes(s.status)) s.status = 'active'
      // 位置部门默认填写「MWLC 赛事组」
      if (!s.department) s.department = 'MWLC 赛事组'
      // 同一赛事下 fanbook_id 去重（有 fanbook 时）
      if (s.fanbook_id) {
        const exists = await env.DB.prepare('SELECT id FROM staff WHERE tournament_id = ? AND fanbook_id = ?')
          .bind(tid, s.fanbook_id).first()
        if (exists) { skipped++; continue }
      }
      await stmt.bind(tid, null, s.name, s.fanbook_id, s.title, s.department, s.phone, s.status, s.remark).run()
      inserted++
    }
    return json({ message: `导入完成：新增 ${inserted} 人，跳过 ${skipped} 人`, inserted, skipped })
  } catch (e) {
    return handleError(e)
  }
}
