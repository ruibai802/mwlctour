const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { UPLOAD_DIR } = require('./upload');

const authRoutes = require('./routes/authRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const resultRoutes = require('./routes/resultRoutes');
const memberRoutes = require('./routes/memberRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const playerRoutes = require('./routes/playerRoutes');
const tournamentRoutes = require('./routes/tournamentRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1d' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/tournaments', tournamentRoutes);

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`MWLC 后端服务已启动: http://localhost:${PORT}`);
  const t = db.prepare('SELECT id, name, code FROM tournaments ORDER BY id LIMIT 1').get();
  console.log(`默认赛事: ${t ? `${t.name} (${t.code} #${t.id})` : '未设置'}`);
});
