// API 地址：
//  - 构建时设置 VITE_API_BASE=https://你的后端域名  → 前端部署在 Cloudflare Pages，后端在独立服务器（跨域，后端已开 CORS）
//  - 不设置（默认）→ 使用同源 /api（本地开发或与后端同域部署，由 vite/preview-server/nginx 代理）
const BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('mwlc_token')
  const headers = { ...(options.headers || {}) }
  const tid = localStorage.getItem('mwlc_tournament_id')
  if (tid) headers['X-Tournament-Id'] = tid
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  let data = null
  const text = await res.text()
  try { data = text ? JSON.parse(text) : null } catch (e) { data = text }
  if (!res.ok) {
    const err = new Error((data && data.error) || `请求失败 (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

export const login = (fanbook_id, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ fanbook_id, password }) })

export const getMe = () => request('/auth/me')

export const changePassword = (old_password, new_password) =>
  request('/auth/change-password', { method: 'POST', body: JSON.stringify({ old_password, new_password }) })

export const updateMe = (data) => request('/auth/me', { method: 'PUT', body: JSON.stringify(data) })

export const uploadAvatar = (formData) => request('/auth/avatar', { method: 'POST', body: formData })

export const getSchedules = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return request(`/schedules${q ? `?${q}` : ''}`)
}

export const getSchedule = (id) => request(`/schedules/${id}`)
export const createSchedule = (data) => request('/schedules', { method: 'POST', body: JSON.stringify(data) })
export const updateSchedule = (id, data) => request(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteSchedule = (id) => request(`/schedules/${id}`, { method: 'DELETE' })
export const getGroups = () => request('/schedules/groups')
export const getMissingLinks = () => request('/schedules/missing-links')

export const uploadResult = (formData) => request('/results', { method: 'POST', body: formData })
export const updateResult = (id, formData) => request(`/results/${id}`, { method: 'PUT', body: formData })
export const updateResultLinks = (id, gameLinks) =>
  request(`/results/${id}/links`, { method: 'PUT', body: JSON.stringify({ game_links: gameLinks }) })
export const getResults = () => request('/results')
export const getResult = (id) => request(`/results/${id}`)
export const deleteResult = (id) => request(`/results/${id}`, { method: 'DELETE' })

export const getMembers = () => request('/members')
export const createMember = (data) => request('/members', { method: 'POST', body: JSON.stringify(data) })
export const updateMember = (id, data) => request(`/members/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteMember = (id) => request(`/members/${id}`, { method: 'DELETE' })
export const batchDeleteMembers = (ids) => request('/members/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) })
export const getRoles = () => request('/members/roles')

export const getUploads = (type) => request(`/uploads${type ? `?type=${type}` : ''}`)
export const getPublicUploads = (type) => request(`/uploads/public${type ? `?type=${type}` : ''}`)
export const uploadDataFile = (formData) => request('/uploads', { method: 'POST', body: formData })
export const uploadEditorImage = (formData) => request('/uploads/editor-image', { method: 'POST', body: formData })
export const deleteUpload = (id) => request(`/uploads/${id}`, { method: 'DELETE' })

export const getPublicSettings = () => request('/settings/public')
export const getSettings = () => request('/settings')
export const updateSettings = (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) })

export const getPlayers = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return request(`/players${q ? `?${q}` : ''}`)
}
export const getTeams = () => request('/players/teams')
export const createPlayer = (data) => request('/players', { method: 'POST', body: JSON.stringify(data) })
export const updatePlayer = (id, data) => request(`/players/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deletePlayer = (id) => request(`/players/${id}`, { method: 'DELETE' })
export const batchDeletePlayers = (ids) => request('/players/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) })
export const importPlayers = (list) => request('/players/import', { method: 'POST', body: JSON.stringify(list) })
export const importMembers = (list) => request('/members/import', { method: 'POST', body: JSON.stringify(list) })

export const getTournaments = () => request('/tournaments')
export const getTournament = (code) => request(`/tournaments/${code}`)
export const createTournament = (data) => request('/tournaments', { method: 'POST', body: JSON.stringify(data) })
export const updateTournament = (id, data) => request(`/tournaments/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteTournament = (id) => request(`/tournaments/${id}`, { method: 'DELETE' })
