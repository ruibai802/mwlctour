// /api/members — 成员列表/新增/批量导入/批量删除/角色定义
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

function toTitles(item) {
  if (Array.isArray(item.titles)) return item.titles
  if (typeof item.titles === 'string' && item.titles.trim()) {
    return item.titles.split(/[,，、;；]/).map((s) => String(s).trim()).filter(Boolean)
  }
  if (item.title !== undefined) return [item.title]
  return []
}

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  const url = new URL(request.url)
  if (url.pathname.endsWith('/roles')) {
    return json({ roles: ROLES, titles: TITLES })
  }
  if (!isAdmin(user)) return forbidden()
  const rows = await env.DB.prepare('SELECT * FROM users ORDER BY id').all()
  return json((rows.results || rows).map(publicUser))
}

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!isAdmin(user)) return forbidden()
  const url = new URL(request.url)

  // POST /api/members/import
  if (url.pathname.endsWith('/import')) {
    let list
    try { list = await request.json() } catch (e) { list = null }
    if (!Array.isArray(list) || !list.length) return badRequest('导入数据不能为空')
    if (list.length > 2000) return badRequest('单次最多导入 2000 条')
    const hasSuperAdmin = list.some((it) => String(it.role || '') === 'superadmin')
    if (hasSuperAdmin && !isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可导入超管账号')
    const defaultHash = await bcrypt.hash('MWLC123456', 10)
    const stmt = env.DB.prepare('INSERT INTO users (fanbook_id, password_hash, name, title, role) VALUES (?,?,?,?,?)')
    let inserted = 0
    let skipped = 0
    for (const item of list) {
      const fanbookId = String((item.fanbook_id || item.fanbook || '').trim())
      if (!fanbookId) { skipped++; continue }
      const titlesArr = toTitles(item)
      let role = String(item.role || '')
      if (!ROLES.some((r) => r.value === role)) {
        if (titlesArr.some((t) => /裁判|录像/.test(String(t || '')))) role = 'official'
        else if (titlesArr.some((t) => /开发者|超级|超管/.test(String(t || '')))) role = 'superadmin'
        else if (titlesArr.some((t) => /规则/.test(String(t || '')))) role = 'rules'
        else role = 'staff'
      }
      if (!ROLES.some((r) => r.value === role)) { skipped++; continue }
      const exists = await env.DB.prepare('SELECT id FROM users WHERE fanbook_id = ?').bind(fanbookId).first()
      if (exists) { skipped++; continue }
      await stmt.bind(
        fanbookId,
        defaultHash,
        String(item.name || ''),
        normalizeTitles({ titles: titlesArr }),
        role
      ).run()
      inserted++
    }
    return json({ message: `导入完成：新增 ${inserted} 人，跳过 ${skipped} 人`, inserted, skipped })
  }

  // POST /api/members/batch-delete
  if (url.pathname.endsWith('/batch-delete')) {
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const ids = Array.isArray(body && body.ids) ? body.ids : []
    if (!ids.length) return badRequest('请选择要删除的成员')
    const cleanIds = [...new Set(ids.map(Number))].filter((n) => Number.isInteger(n) && n > 0)
    if (!cleanIds.length) return badRequest('成员ID不合法')
    const rows = await env.DB.prepare('SELECT * FROM users WHERE id IN (' + cleanIds.map(() => '?').join(',') + ')').bind(...cleanIds).all()
    const list = rows.results || rows
    const hasSuperAdmin = list.some((r) => r.role === 'superadmin')
    if (hasSuperAdmin && !isSuperAdmin(user)) return forbidden('仅开发者/超级管理员可删除超管账号')
    const deletable = list.filter((r) => String(r.fanbook_id) !== '1000000').map((r) => r.id)
    let deleted = 0
    const del = env.DB.prepare('DELETE FROM users WHERE id = ?')
    for (const id of deletable) {
      const info = await del.bind(id).run()
      deleted += info.meta.changes
    }
    return json({ message: `已删除 ${deleted} 人（初始主办账号不可删除）`, deleted })
  }

  // POST /api/members
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
}
