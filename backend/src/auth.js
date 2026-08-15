const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'mwlc-tournament-secret-2026';
const ADMIN_ROLES = ['superadmin', 'admin'];
const SUPER_ADMIN_ROLES = ['superadmin'];
const RULES_ROLES = ['rules', 'admin', 'superadmin'];

function signToken(user) {
  return jwt.sign(
    { id: user.id, fanbook_id: user.fanbook_id, name: user.name, title: user.title, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    fanbook_id: user.fanbook_id,
    name: user.name,
    title: user.title,
    role: user.role,
    avatar: user.avatar || ''
  };
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: '无权限执行此操作' });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || !SUPER_ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: '仅开发者/超级管理员可执行此操作' });
  }
  next();
}

function requireRules(req, res, next) {
  if (!req.user || !RULES_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: '仅规则管理/管理员可执行此操作' });
  }
  next();
}

function isAdmin(user) {
  return user && ADMIN_ROLES.includes(user.role);
}

function isSuperAdmin(user) {
  return user && SUPER_ADMIN_ROLES.includes(user.role);
}

function canEditRules(user) {
  return user && RULES_ROLES.includes(user.role);
}

module.exports = { signToken, publicUser, requireAuth, requireAdmin, requireSuperAdmin, requireRules, isAdmin, isSuperAdmin, canEditRules, ADMIN_ROLES, SUPER_ADMIN_ROLES, RULES_ROLES };
