// /api/tournaments/:param — 赛事详情(GET by code)/修改(PUT by id)/删除(DELETE by id)
import { currentUser, canEditRules, isAdmin, json, unauthorized, forbidden, badRequest, notFound } from '../../_lib/auth.js'
import { handleError } from '../../_lib/util.js'

function parseMaps(maps) {
  if (maps !== undefined && Array.isArray(maps)) return JSON.stringify(maps.map((m) => String(m)))
  return undefined
}

export async function onRequestGet(context) {
  const { request, env, params } = context
  try {
    const t = await env.DB.prepare('SELECT * FROM tournaments WHERE code = ?').bind(String(params.param)).first()
    if (!t) return notFound('赛事不存在')
    const banners = await env.DB.prepare(
      "SELECT id, original_name, path, created_at FROM uploads WHERE type = 'banner' AND tournament_id = ? ORDER BY id DESC"
    ).bind(t.id).all()
    const rosters = await env.DB.prepare(
      "SELECT id, original_name, path, created_at FROM uploads WHERE type = 'roster' AND tournament_id = ? ORDER BY id DESC"
    ).bind(t.id).all()
    // 多规则：返回该赛事的全部规则（默认首条为 rules_content 迁移而来）
    const rules = await env.DB.prepare('SELECT * FROM rules WHERE tournament_id = ? ORDER BY sort, id').bind(t.id).all()
    let maps = []
    try { maps = JSON.parse(t.maps || '[]') } catch (e) { maps = [] }
    return json({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      rules_content: t.rules_content,
      rules_background: t.rules_background,
      content_background: t.content_background,
      registration_url: t.registration_url,
      maps,
      banners: banners.results || banners,
      rosters: rosters.results || rosters,
      rules: rules.results || rules
    })
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!canEditRules(user)) return forbidden('仅规则管理/管理员可修改赛事')
  try {
    const t = await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(params.param).first()
    if (!t) return notFound('赛事不存在')
    let body
    try { body = await request.json() } catch (e) { body = {} }
    const { name, description, rules_content, rules_background, content_background, registration_url, maps } = body || {}
    const newMaps = parseMaps(maps)
    await env.DB.prepare(`
      UPDATE tournaments SET
        name = ?, description = ?, rules_content = ?, rules_background = ?, content_background = ?, registration_url = ?, maps = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).bind(
      name !== undefined ? String(name) : t.name,
      description !== undefined ? String(description) : t.description,
      rules_content !== undefined ? String(rules_content) : t.rules_content,
      rules_background !== undefined ? String(rules_background) : t.rules_background,
      content_background !== undefined ? String(content_background) : t.content_background,
      registration_url !== undefined ? String(registration_url) : t.registration_url,
      newMaps !== undefined ? newMaps : t.maps,
      params.param
    ).run()
    const row = await env.DB.prepare('SELECT id, code, name, description FROM tournaments WHERE id = ?').bind(params.param).first()
    return json(row)
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
    const t = await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(params.param).first()
    if (!t) return notFound('赛事不存在')
    const total = await env.DB.prepare('SELECT COUNT(*) AS c FROM tournaments').first()
    if (total.c <= 1) return badRequest('至少保留一个赛事')
    if (String(t.code) === 'default') return badRequest('默认赛事不可删除')
    // 清理该赛事的上传文件（R2）
    const ups = await env.DB.prepare('SELECT path FROM uploads WHERE tournament_id = ?').bind(t.id).all()
    const { keyFromUrl, removeFile } = await import('../../_lib/upload.js')
    for (const u of ups.results || ups) {
      await removeFile(env, keyFromUrl(u.path))
    }
    await env.DB.batch([
      env.DB.prepare('DELETE FROM schedules WHERE tournament_id = ?').bind(t.id),
      env.DB.prepare('DELETE FROM players WHERE tournament_id = ?').bind(t.id),
      env.DB.prepare('DELETE FROM uploads WHERE tournament_id = ?').bind(t.id),
      env.DB.prepare('DELETE FROM tournaments WHERE id = ?').bind(t.id)
    ])
    return json({ message: '赛事已删除，其日程/选手/上传数据已一并清理' })
  } catch (e) {
    return handleError(e)
  }
}
