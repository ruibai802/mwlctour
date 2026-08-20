// /api/auth/permissions — 当前用户的权限码列表
import { currentUser, json, unauthorized } from '../../_lib/auth.js'
import { PERMISSIONS, getUserPermissions } from '../../_lib/rbac.js'
import { handleError } from '../../_lib/util.js'

export async function onRequestGet(context) {
  const { request, env } = context
  const user = await currentUser(request, env)
  if (!user) return unauthorized()
  try {
    const perms = await getUserPermissions(env, user)
    const granted = new Set(perms)
    return json({
      permissions: perms,
      permissions_detail: PERMISSIONS.map((p) => ({ ...p, granted: granted.has(p.code) }))
    })
  } catch (e) {
    return handleError(e)
  }
}