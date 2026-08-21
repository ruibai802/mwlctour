(async () => {
  const BASE = 'https://mwlctour.pages.dev'
  // 规则接口（公开）：确认 gzip 生效
  const r = await fetch(BASE + '/api/rules', { headers: { 'X-Tournament-Id': '1' } })
  const enc = r.headers.get('content-encoding')
  const buf = await r.arrayBuffer()
  console.log('/api/rules: status', r.status, '| content-encoding:', enc || '无', '| 传输大小:', (buf.byteLength / 1024).toFixed(1) + 'KB')

  // 登录验证（1000000 用户密码已改，尝试常见密码）
  for (const pw of ['MWLC123456', 'mwlc123456', '123456']) {
    const lr = await fetch(BASE + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fanbook_id: '1000000', password: pw })
    })
    const lj = await lr.json().catch(() => ({}))
    console.log('login 1000000/' + pw + ':', lr.status, lj.error || 'OK')
  }
})()
