// GET /api/members/roles — 角色/身份定义
import { currentUser, json, unauthorized } from '../../_lib/auth.js'

const ROLES = [
  { value: 'superadmin', label: '开发者/超级管理员' },
  { value: 'admin', label: '管理员（主办/管理/裁判长）' },
  { value: 'official', label: '裁判/录像' },
  { value: 'rules', label: '规则管理' },
  { value: 'staff', label: '赛事工作人员' },
  { value: 'guest', label: '普通用户' }
]

const TITLES = ['开发者', '超级管理员', '主办', '管理', '裁判长', '裁判/录像', '规则管理', '赛事工作人员', '普通用户']

export async function onRequestGet(context) {
  const { request } = context
  const user = await currentUser(request, context.env)
  if (!user) return unauthorized()
  return json({ roles: ROLES, titles: TITLES })
}
