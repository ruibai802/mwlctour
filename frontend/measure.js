(async () => {
  const login = await fetch('https://mwlctour.pages.dev/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fanbook_id: '28099316', password: 'MWLC123456' })
  })
  const loginJson = await login.json().catch(() => ({}))
  console.log('login status:', login.status, JSON.stringify(loginJson).slice(0, 120))
  if (!loginJson.token) return
  const H = { Authorization: 'Bearer ' + loginJson.token }
  for (const ep of ['/api/teams', '/api/players', '/api/matches', '/api/groups', '/api/settings']) {
    const t0 = Date.now()
    const r = await fetch('https://mwlctour.pages.dev' + ep, { headers: H })
    const buf = await r.arrayBuffer()
    console.log(ep, r.status, '大小:', (buf.byteLength / 1024).toFixed(1) + 'KB', '耗时:', (Date.now() - t0) + 'ms', '编码:', r.headers.get('content-encoding') || '无')
  }
  const m = await (await fetch('https://mwlctour.pages.dev/api/matches', { headers: H })).json()
  if (m && m.length) {
    const t0 = Date.now()
    const r = await fetch('https://mwlctour.pages.dev/api/matches/' + m[0].id, { headers: H })
    const buf = await r.arrayBuffer()
    console.log('/api/matches/:id', r.status, '大小:', (buf.byteLength / 1024).toFixed(1) + 'KB', '耗时:', (Date.now() - t0) + 'ms', '编码:', r.headers.get('content-encoding') || '无')
  }
})()
