import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/TournamentSelect.vue'),
    meta: { title: '选择赛事' }
  },
  {
    path: '/rules/:code',
    name: 'rules',
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
  if (to.name === 'login' && auth.token) {
    return { name: 'dashboard' }
  }
  document.title = to.meta.title ? `${to.meta.title} - MWLC赛事协助系统` : 'MWLC赛事协助系统'
  return true
})

export default router
