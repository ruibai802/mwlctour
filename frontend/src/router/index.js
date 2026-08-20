import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    // 单赛事组：首页直接进入规则/报名页（多赛事代码保留，界面隐藏）
    path: '/',
    redirect: '/rules/default'
  },
  {
    // 规则卡片列表（默认页）
    path: '/rules/:code',
    name: 'rules',
    component: () => import('../views/RulesIndex.vue'),
    meta: { title: '赛事规则' }
  },
  {
    // 单份规则详情
    path: '/rules/:code/:ruleId',
    name: 'rules-detail',
    component: () => import('../views/RulesView.vue'),
    meta: { title: '赛事规则' }
  },
  {
    path: '/rules-edit',
    name: 'rules-edit',
    component: () => import('../views/ruleedit/RulesEditView.vue'),
    meta: { title: '规则管理', auth: true, rules: true }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { title: '个人设置', auth: true }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { title: '裁判工作台', auth: true }
  },
  {
    path: '/schedule/:id',
    name: 'schedule-detail',
    component: () => import('../views/ScheduleDetailView.vue'),
    meta: { title: '日程详情', auth: true }
  },
  {
    // 比赛详情（裁判工作台也可进入）
    path: '/match/:id',
    name: 'match-detail',
    component: () => import('../views/admin/MatchDetail.vue'),
    meta: { title: '比赛详情', auth: true }
  },
  {
    path: '/admin',
    component: () => import('../views/AdminLayout.vue'),
    meta: { title: '管理后台', auth: true, admin: true },
    children: [
      { path: '', redirect: '/admin/schedules' },
      {
        path: 'schedules',
        name: 'admin-schedules',
        component: () => import('../views/admin/ScheduleManage.vue'),
        meta: { title: '日程管理' }
      },
      {
        path: 'members',
        name: 'admin-members',
        component: () => import('../views/admin/MemberManage.vue'),
        meta: { title: '成员管理' }
      },
      {
        path: 'uploads',
        name: 'admin-uploads',
        component: () => import('../views/admin/UploadManage.vue'),
        meta: { title: '数据上传' }
      },
      {
        path: 'players',
        name: 'admin-players',
        component: () => import('../views/admin/PlayerManage.vue'),
        meta: { title: '选手名单' }
      },
      {
        path: 'rules',
        name: 'admin-rules',
        component: () => import('../views/admin/RulesEdit.vue'),
        meta: { title: '规则编辑' }
      },
      {
        path: 'results',
        name: 'admin-results',
        component: () => import('../views/admin/ResultsOverview.vue'),
        meta: { title: '结果总览' }
      },
      {
        path: 'settings',
        name: 'admin-settings',
        component: () => import('../views/admin/SettingsManage.vue'),
        meta: { title: '赛事设置' }
      },
      {
        path: 'roles',
        name: 'admin-roles',
        component: () => import('../views/admin/RoleManage.vue'),
        meta: { title: '角色权限', superadmin: true }
      },
      {
        path: 'groups',
        name: 'admin-groups',
        component: () => import('../views/admin/GroupManage.vue'),
        meta: { title: '分组管理' }
      },
      {
        path: 'staff',
        name: 'admin-staff',
        component: () => import('../views/admin/StaffManage.vue'),
        meta: { title: '工作人员' }
      },
      {
        path: 'teams',
        name: 'admin-teams',
        component: () => import('../views/admin/TeamManage.vue'),
        meta: { title: '队伍管理' }
      },
      {
        path: 'matches',
        name: 'admin-matches',
        component: () => import('../views/admin/MatchManage.vue'),
        meta: { title: '比赛管理' }
      },
      {
        path: 'matches/:id',
        name: 'admin-match-detail',
        component: () => import('../views/admin/MatchDetail.vue'),
        meta: { title: '比赛详情' }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.auth && !auth.token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.rules && !auth.canEditRules) {
    return { name: 'home' }
  }
  if (to.meta.admin && !auth.isAdmin) {
    return { name: 'dashboard' }
  }
  if (to.meta.superadmin && !auth.isSuperAdmin) {
    return { name: 'dashboard' }
  }
  if (to.name === 'login' && auth.token) {
    return { name: 'dashboard' }
  }
  document.title = to.meta.title ? `${to.meta.title} - MWLC赛事协助系统` : 'MWLC赛事协助系统'
  return true
})

export default router
