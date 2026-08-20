// /api/members — 成员列表(GET) / 新增(POST)
// 子路径 roles/import/batch-delete 见独立文件
import bcrypt from 'bcryptjs'
import { currentUser, isAdmin, isSuperAdmin, publicUser, json, unauthorized, forbidden, badRequest } from '../_lib/auth.js'
import { handleError } from '../_lib/util.js'

const ROLES = [
  { value: 'superadmin', label: '开发者/超级管理员' },
  { value: 'admin', label: '管理员（主办/管理/裁判长）' },
  { value: 'official', label: '裁判/录像' },
  { value: 'rules', label: '规则管理' },
  { value: 'staff', label: '赛事工作人员' },
  { value: 'guest', label: '普通用户' }
]

const TITLES = ['开发者', '超级管理员', '主办', '管理', '裁判长', '裁判/录像', '规则管理', '赛事工作人员', '普通用户']

function normalizeTitles(body) {
  const raw = Array.isArray(body.titles) ? body.titles : (body.title !== undefined ? [body.title] : [])
  return raw
    .map((t) => String(t || '').trim())
    .filter((t) => t && TITLES.includes(t))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(',')
}

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  try {
    const rows = await env.DB.prepare('SELECT * FROM users ORDER BY id').all()
    return json((rows.results || rows).map(publicUser))
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
    const { fanbook_id, name, role, password } = body || {}
    if (!fanbook_id) return badRequest('缺少 fanbookID')
    if (!role) return badRequest('缺少角色')
    if (role === 'superadmin' && !isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可创建超管账号')
    if (password !== undefined && String(password) !== '' && !isSuperAdmin(user)) {
      return forbidden('仅开发者/超级管理员可设置他人初始密码，其他成员使用默认密码')
    }
    const exists = await env.DB.prepare('SELECT id FROM users WHERE fanbook_id = ?').bind(String(fanbook_id).trim()).first()
    if (exists) return badRequest('该 fanbookID 已存在')
    const finalPassword = password || 'MWLC123456'
    const hash = await bcrypt.hash(String(finalPassword), 10)
    const info = await env.DB.prepare(
      'INSERT INTO users (fanbook_id, password_hash, name, title, role) VALUES (?,?,?,?,?)'
    ).bind(
      String(fanbook_id).trim(),
      hash,
      String(name || ''),
      normalizeTitles(body),
      String(role)
    ).run()
    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(publicUser(row), 201)
  } catch (e) {
    return handleError(e)
  }
}
