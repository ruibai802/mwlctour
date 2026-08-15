// /api/results/:id — 结果详情/修改/删除（截图追加或替换，R2 清理）
import { currentUser, isAdmin, json, unauthorized, forbidden, notFound, badRequest } from '../../_lib/auth.js'
import { resolveTournamentId, handleError } from '../../_lib/util.js'
import { saveFile, removeFilesByUrls, keyFromUrl, removeFile } from '../../_lib/upload.js'

function canManageResult(user, row) {
  return (
    isAdmin(user) ||
    String(user.fanbook_id) === String(row.referee_id) ||
    String(user.fanbook_id) === String(row.recorder_id)
  )
}

function parseScore(score) {
  const m = String(score || '').match(/(\d+)\s*[:\-：]\s*(\d+)/)
  if (m) return { a: parseInt(m[1], 10), b: parseInt(m[2], 10) }
  return null
}

function inferWinner(schedule, score) {
  const parts = parseScore(score)
  if (!parts) return ''
  if (parts.a > parts.b) return schedule.team_a_name || ''
  if (parts.b > parts.a) return schedule.team_b_name || ''
  return ''
}

function formatResult(row) {
  let screenshots = []
  let gameLinks = []
  try { screenshots = JSON.parse(row.screenshots || '[]') } catch (e) {}
  try { gameLinks = JSON.parse(row.game_links || '[]') } catch (e) {}
  return { ...row, screenshots, game_links: gameLinks }
}

async function findRow(env, request, id) {
  return env.DB.prepare(`
    SELECT r.* FROM results r
    INNER JOIN schedules s ON s.id = r.schedule_id
    WHERE r.id = ? AND s.tournament_id = ?
  `).bind(id, await resolveTournamentId(request, env)).first()
}

export async function onRequestGet(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const row = await findRow(env, request, params.id)
    if (!row) return notFound('结果不存在')
    return json(formatResult(row))
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPut(context) {
  const { request, env, params } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const row = await findRow(env, request, params.id)
    if (!row) return notFound('结果不存在')
    if (!canManageResult(user, row)) return forbidden('只能修改自己负责的结果')

    let form
    try { form = await request.formData() } catch (e) { return badRequest('上传失败') }
    const score = form.get('score')
    const winner = form.get('winner')
    const referee_id = form.get('referee_id')
    const recorder_id = form.get('recorder_id')
    const remark = form.get('remark')
    const replaceScreenshots = String(form.get('replace_screenshots') || '') === 'true'

    let screenshots = []
    try { screenshots = JSON.parse(row.screenshots || '[]') } catch (e) { screenshots = [] }
    const files = form.getAll('screenshots') || []
    if (files.length > 10) return badRequest('截图最多上传 10 张')
    for (const f of files) {
      if (f.size > 15 * 1024 * 1024) return badRequest('单张截图不能超过 15MB')
      if (!f.type || !f.type.startsWith('image/')) return badRequest('只能上传图片文件')
    }
    if (files.length) {
      const newShots = []
      for (const f of files) {
        const { url } = await saveFile(env, 'screenshots', f)
        newShots.push(url)
      }
      if (replaceScreenshots) {
        await removeFilesByUrls(env, screenshots)
        screenshots = newShots
      } else {
        screenshots = [...screenshots, ...newShots].slice(0, 10)
      }
    }

    const schedule = await env.DB.prepare('SELECT * FROM schedules WHERE id = ?').bind(row.schedule_id).first()
    const newScore = score !== null && score !== undefined ? String(score) : row.score
    let newWinner = winner !== null && winner !== undefined ? String(winner) : row.winner
    if ((winner === null || winner === undefined) && (score !== null && score !== undefined)) {
      newWinner = inferWinner(schedule, newScore) || row.winner
    }

    await env.DB.prepare(`
      UPDATE results SET
        score=?, winner=?, referee_id=?, recorder_id=?, screenshot_count=?, screenshots=?, remark=?,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).bind(
      newScore,
      newWinner,
      referee_id !== null && referee_id !== undefined ? String(referee_id) : row.referee_id,
      recorder_id !== null && recorder_id !== undefined ? String(recorder_id) : row.recorder_id,
      screenshots.length,
      JSON.stringify(screenshots),
      remark !== null && remark !== undefined ? String(remark) : row.remark,
      params.id
    ).run()
    const updated = await env.DB.prepare('SELECT * FROM results WHERE id = ?').bind(params.id).first()
    return json(formatResult(updated))
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
    const row = await findRow(env, request, params.id)
    if (!row) return notFound('结果不存在')
    let shots = []
    try { shots = JSON.parse(row.screenshots || '[]') } catch (e) { shots = [] }
    await removeFilesByUrls(env, shots)
    await env.DB.prepare('DELETE FROM results WHERE id = ?').bind(params.id).run()
    return json({ message: '结果已删除' })
  } catch (e) {
    return handleError(e)
  }
}
