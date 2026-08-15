// /api/results — 结果列表与上传（multipart，截图存入 R2）
import { currentUser, json, unauthorized, forbidden, badRequest, notFound } from '../_lib/auth.js'
import { resolveTournamentId, handleError } from '../_lib/util.js'
import { saveFile, removeFilesByUrls } from '../_lib/upload.js'

const RESULT_ROLES = ['official', 'admin', 'superadmin']

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

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const rows = await env.DB.prepare(`
      SELECT r.* FROM results r
      INNER JOIN schedules s ON s.id = r.schedule_id
      WHERE s.tournament_id = ?
      ORDER BY r.id DESC
    `).bind(await resolveTournamentId(request, env)).all()
    return json((rows.results || rows).map(formatResult))
  } catch (e) {
    return handleError(e)
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  if (!RESULT_ROLES.includes(user.role)) return forbidden('仅裁判/录像或管理员可上传结果')
  try {
    let form
    try { form = await request.formData() } catch (e) { return badRequest('上传失败') }
    const schedule_id = form.get('schedule_id')
    const score = form.get('score')
    const winner = form.get('winner')
    const referee_id = form.get('referee_id')
    const recorder_id = form.get('recorder_id')
    const remark = form.get('remark')
    if (!schedule_id) return badRequest('缺少日程')
    const schedule = await env.DB.prepare('SELECT * FROM schedules WHERE id = ? AND tournament_id = ?')
      .bind(schedule_id, await resolveTournamentId(request, env)).first()
    if (!schedule) return notFound('日程不存在')
    const existing = await env.DB.prepare('SELECT * FROM results WHERE schedule_id = ?').bind(schedule_id).first()
    if (existing) return badRequest('该日程已上传过结果')

    const files = form.getAll('screenshots') || []
    if (files.length > 10) return badRequest('截图最多上传 10 张')
    for (const f of files) {
      if (f.size > 15 * 1024 * 1024) return badRequest('单张截图不能超过 15MB')
      if (!f.type || !f.type.startsWith('image/')) return badRequest('只能上传图片文件')
    }
    const screenshots = []
    for (const f of files) {
      const { url } = await saveFile(env, 'screenshots', f)
      screenshots.push(url)
    }

    const finalWinner = (winner && String(winner)) || inferWinner(schedule, score)
    const info = await env.DB.prepare(`
      INSERT INTO results (schedule_id, score, winner, referee_id, recorder_id, screenshot_count, screenshots, remark, created_by)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(
      String(schedule_id),
      String(score || ''),
      finalWinner,
      String(referee_id || ''),
      String(recorder_id || ''),
      screenshots.length,
      JSON.stringify(screenshots),
      String(remark || ''),
      user.name || user.fanbook_id
    ).run()
    const row = await env.DB.prepare('SELECT * FROM results WHERE id = ?').bind(info.meta.last_row_id).first()
    return json(formatResult(row), 201)
  } catch (e) {
    return handleError(e)
  }
}
