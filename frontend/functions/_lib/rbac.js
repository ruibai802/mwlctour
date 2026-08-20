// Pages Functions 共享：RBAC 权限定义与计算（与 backend/src/rbac.js 同步）
// 注意：Pages Functions 无同步 db 对象，此处全部为纯函数/异步

export const PERMISSIONS = [
  { code: 'schedule:view', name: '查看日程', description: '查看日程列表与详情' },
  { code: 'schedule:manage', name: '管理日程', description: '创建/编辑/删除日程' },
  { code: 'result:view', name: '查看结果', description: '查看比赛结果' },
  { code: 'result:submit', name: '提交/修改结果', description: '上传/修改比赛结果' },
  { code: 'result:manage', name: '管理结果', description: '管理全部比赛结果' },
  { code: 'member:view', name: '查看成员', description: '查看成员列表' },
  { code: 'member:manage', name: '管理成员', description: '添加/编辑/删除成员' },
  { code: 'role:manage', name: '管理角色与权限', description: '角色/权限/成员角色分配' },
  { code: 'player:manage', name: '管理选手名单', description: '选手名单增删改与导入' },
  { code: 'team:manage', name: '管理队伍', description: '队伍与队员管理' },
  { code: 'staff:manage', name: '管理工作人员', description: '工作人员增删改' },
  { code: 'attendance:manage', name: '管理考勤', description: '工作人员考勤记录' },
  { code: 'group:manage', name: '管理分组', description: '赛事分组管理' },
  { code: 'match:view', name: '查看比赛', description: '查看比赛与详情' },
  { code: 'match:manage', name: '管理比赛', description: '创建/编辑/删除比赛' },
  { code: 'match:confirm', name: '确认比赛任务', description: '确认本人负责的比赛任务' },
  { code: 'video:manage', name: '管理视频链接', description: '添加/修改/删除比赛视频链接' },
  { code: 'penalty:manage', name: '管理罚单', description: '添加/修改/删除罚单' },
  { code: 'upload:manage', name: '数据上传', description: '上传/删除数据文件' },
  { code: 'settings:manage', name: '赛事设置', description: '修改赛事设置' },
  { code: 'rules:edit', name: '编辑规则', description: '编辑规则内容与背景' },
  { code: 'tournament:manage', name: '赛事管理', description: '多赛事管理' }
]

export const ALL_CODES = PERMISSIONS.map((p) => p.code)

// 兼容旧版：未绑定 RBAC 角色时按原 role 字段映射
export const LEGACY_ROLE_PERMS = {
  superadmin: ALL_CODES,
  admin: ALL_CODES.filter((c) => c !== 'role:manage'),
  official: ['schedule:view', 'result:view', 'result:submit', 'match:view', 'match:confirm', 'video:manage'],
  rules: ['rules:edit'],
  staff: ['schedule:view', 'match:view'],
  guest: []
}

// 依据 user_roles → roles → role_permissions 计算用户权限码列表（D1 异步版本）
export async function getUserPermissions(env, user) {
  const link = await env.DB.prepare('SELECT COUNT(*) AS c FROM user_roles WHERE user_id = ?').bind(user.id).first()
  const rows = await env.DB.prepare(`
    SELECT DISTINCT p.code FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = ?
  `).bind(user.id).all()
  const set = new Set((rows.results || rows).map((r) => r.code))
  if ((link ? link.c : 0) === 0 && user.role && LEGACY_ROLE_PERMS[user.role]) {
    return [...LEGACY_ROLE_PERMS[user.role]]
  }
  return [...set]
}

export async function hasPerm(env, user, code) {
  const perms = await getUserPermissions(env, user)
  return perms.includes(code)
}