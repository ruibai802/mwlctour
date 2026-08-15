// /api/members/:id — 成员修改/删除
import bcrypt from 'bcryptjs'
import { currentUser, isAdmin, isSuperAdmin, publicUser, json, unauthorized, forbidden, badRequest, notFound } from '../../_lib/auth.js'
import { handleError } from '../../_lib/util.js'

const ROLES = ['superadmin', 'admin', 'official', 'rules', 'staff', 'guest']
const TITLES = ['开发者', '超级管理员', '主办', '管理', '裁判长', '裁判/录像', '规则管理', '赛事工作人员', '普通用户']

function normalizeTitles(body) {
  const raw = Array.isArray(body.titles) ? body.titles : (body.title !== undefined ? [body.title] : [])
  return raw
    .map((t) => String(t || '').trim())
    .filter((t) => t && TITLES.includes(t))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(',')
}

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(params.id).first()
    if (!row) return notFound('成员不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const { name, role, password, reset_password } = body || {}
    if (role !== undefined && !ROLES.includes(role)) return badRequest('角色不合法')
    if (role === 'superadmin' && !isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可授予超管角色')
    if (String(row.role) === 'superadmin' && !isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可修改超管账号')
    if (String(row.fanbook_id) === '1000000' && role !== undefined && role !== 'superadmin') {
      return badRequest('不能降级初始主办账号')
    }
    const isOwn = String(user.id) === String(row.id)
    const wantsPassword = !!(reset_password || password !== undefined)
    if (wantsPassword && !isOwn && !isSuperAdmin(user)) {
      return forbidden('仅开发者/超级管理员可修改他人密码，其他成员请修改自己的密码')
    }
    const hash = wantsPassword
      ? await bcrypt.hash(String(password || 'MWLC123456'), 10)
      : row.password_hash
    const hasTitles = Array.isArray(body.titles) || body.title !== undefined
    await env.DB.prepare('UPDATE users SET name=?, title=?, role=?, password_hash=? WHERE id=?').bind(
      name !== undefined ? String(name) : row.name,
      hasTitles ? normalizeTitles(body) : row.title,
      role !== undefined ? String(role) : row.role,
      hash,
      params.id
    ).run()
    const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(params.id).first()
    return json(publicUser(updated))
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
    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(params.id).first()
    if (!row) return notFound('成员不存在')
    if (String(row.fanbook_id) === '1000000') return badRequest('不能删除初始主办账号')
    if (String(row.role) === 'superadmin' && !isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可删除超管账号')
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(params.id).run()
    return json({ message: '成员已删除' })
  } catch (e) {
    return handleError(e)
  }
}
