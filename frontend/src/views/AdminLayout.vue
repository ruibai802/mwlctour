<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const auth = useAuthStore()

const baseTabs = [
  { path: '/admin/schedules', label: '日程管理' },
  { path: '/admin/members', label: '成员管理' },
  { path: '/admin/players', label: '选手名单' },
  { path: '/admin/teams', label: '队伍管理' },
  { path: '/admin/matches', label: '比赛管理' },
  { path: '/admin/groups', label: '分组管理' },
  { path: '/admin/staff', label: '工作人员' },
  { path: '/admin/uploads', label: '数据上传' },
  { path: '/admin/results', label: '结果总览' },
  { path: '/admin/settings', label: '赛事设置' },
  { path: '/rules-edit', label: '规则编辑' }
]

const tabs = computed(() => {
  if (auth.isSuperAdmin) return [...baseTabs, { path: '/admin/roles', label: '角色权限' }]
  return baseTabs
})
</script>

<template>
  <div class="container">
    <div class="page-head">
      <h2>管理后台</h2>
      <span class="text-muted">当前身份：{{ auth.user?.title || auth.user?.name }}</span>
    </div>
    <nav class="admin-tabs">
      <router-link
        v-for="t in tabs"
        :key="t.path"
        :to="t.path"
        class="admin-tab"
        :class="{ active: route.path.startsWith(t.path) }"
      >{{ t.label }}</router-link>
    </nav>
    <div class="admin-content">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-head h2 {
  background: linear-gradient(90deg, #e0f2fe, var(--accent), #c4b5fd);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.admin-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.admin-tab {
  padding: 8px 18px;
  border-radius: 999px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  font-size: 14px;
  color: var(--text-sub);
  transition: all 0.18s;
}

.admin-tab:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.admin-tab.active {
  background: var(--accent-grad);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.35);
}
</style>
