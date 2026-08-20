// POST /api/members/import — 批量导入成员
import bcrypt from 'bcryptjs'
import { currentUser, isAdmin, isSuperAdmin, json, unauthorized, forbidden, badRequest } from '../../_lib/auth.js'
import { handleError } from '../../_lib/util.js'

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
      await stmt.bind(fanbookId, defaultHash, String(item.name || ''), normalizeTitles({ titles: titlesArr }), role).run()
      inserted++
    }
    return json({ message: `导入完成：新增 ${inserted} 人，跳过 ${skipped} 人`, inserted, skipped })
  } catch (e) {
    return handleError(e)
  }
}
