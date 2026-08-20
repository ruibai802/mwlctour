<script setup>
import { ref, onMounted } from 'vue'
import { getRoleList, createRole, updateRole, deleteRole, getPermissions, getRoleUsers, setUserRoles } from '../../api'

const roles = ref([])
const perms = ref([])
const users = ref([])
const loading = ref(true)
const error = ref('')

const showForm = ref(false)
const editing = ref(null)
const form = ref({ code: '', name: '', description: '', permission_ids: [] })
const saving = ref(false)
const formError = ref('')

const showAssign = ref(false)
const assignUser = ref(null)
const assignRoleIds = ref([])
const assignMsg = ref('')
const assignSaving = ref(false)

const permGroups = [
  { label: '日程与结果', codes: ['schedule:view', 'schedule:manage', 'result:view', 'result:submit', 'result:manage'] },
  { label: '成员与角色', codes: ['member:view', 'member:manage', 'role:manage'] },
  { label: '名单与队伍', codes: ['player:manage', 'team:manage'] },
  { label: '人员与考勤', codes: ['staff:manage', 'attendance:manage'] },
  { label: '分组与比赛', codes: ['group:manage', 'match:view', 'match:manage', 'match:confirm'] },
  { label: '视频与罚单', codes: ['video:manage', 'penalty:manage'] },
  { label: '站点管理', codes: ['upload:manage', 'settings:manage', 'rules:edit', 'tournament:manage'] }
]

const permName = (code) => {
  const p = perms.value.find((x) => x.code === code)
  return p ? p.name : code
}

const permDesc = (code) => {
  const p = perms.value.find((x) => x.code === code)
  return p ? p.description : ''
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [rs, ps] = await Promise.all([getRoleList(), getPermissions()])
    roles.value = rs
    perms.value = ps
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

async function loadUsers() {
  try {
    users.value = await getRoleUsers()
  } catch (e) {
    error.value = e.message
  }
}

function openCreate() {
  editing.value = null
  form.value = { code: '', name: '', description: '', permission_ids: [] }
  formError.value = ''
  showForm.value = true
}

function openEdit(r) {
  editing.value = r
  form.value = { code: r.code, name: r.name, description: r.description || '', permission_ids: [...r.permission_ids] }
  formError.value = ''
  showForm.value = true
}

function togglePerm(code) {
  const i = form.value.permission_ids.indexOf(code)
  if (i >= 0) form.value.permission_ids.splice(i, 1)
  else form.value.permission_ids.push(code)
}

function toggleGroupPerms(codes) {
  const allChecked = codes.every((c) => form.value.permission_ids.includes(c))
  for (const c of codes) {
    const i = form.value.permission_ids.indexOf(c)
    if (allChecked) {
      if (i >= 0) form.value.permission_ids.splice(i, 1)
    } else if (i < 0) {
      form.value.permission_ids.push(c)
    }
  }
}

async function save() {
  formError.value = ''
  if (!form.value.code.trim() || !form.value.name.trim()) {
    formError.value = '请填写角色代码和名称'
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await updateRole(editing.value.id, {
        name: form.value.name,
        description: form.value.description,
        permission_ids: form.value.permission_ids
      })
    } else {
      await createRole(form.value)
    }
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  }
  saving.value = false
}

async function remove(r) {
  if (!confirm(`确认删除角色「${r.name}」？删除后该角色的成员将失去对应权限`)) return
  try {
    await deleteRole(r.id)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

function openAssign(u) {
  assignUser.value = u
  assignRoleIds.value = [...(u.role_ids || [])]
  assignMsg.value = ''
  showAssign.value = true
}

function toggleAssignRole(id) {
  const i = assignRoleIds.value.indexOf(id)
  if (i >= 0) assignRoleIds.value.splice(i, 1)
  else assignRoleIds.value.push(id)
}

async function saveAssign() {
  assignSaving.value = true
  assignMsg.value = ''
  try {
    const res = await setUserRoles(assignUser.value.id, assignRoleIds.value)
    assignUser.value.role_ids = res.role_ids
    assignMsg.value = `已保存 ${assignUser.value.name || assignUser.value.fanbook_id} 的角色`
    await load()
  } catch (e) {
    assignMsg.value = e.message
  }
  assignSaving.value = false
}

onMounted(() => {
  load()
  loadUsers()
})
</script>

<template>
  <div>
    <div class="toolbar">
      <span class="text-muted">RBAC 角色权限：角色 → 权限点；成员 → 角色。系统内置角色不可删除。</span>
      <div class="actions">
        <button class="btn" @click="loadUsers">刷新成员角色</button>
        <button class="btn btn-primary" @click="openCreate">＋ 新建角色</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>角色</th>
            <th>代码</th>
            <th>权限数</th>
            <th>绑定成员</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in roles" :key="r.id">
            <td>
              {{ r.name }}
              <span v-if="r.is_system" class="sys-pill">系统</span>
            </td>
            <td class="mono">{{ r.code }}</td>
            <td class="mono">{{ r.permission_ids.length }}</td>
            <td>{{ r.user_count }} 人</td>
            <td class="ops">
              <button class="btn btn-sm" @click="openEdit(r)">编辑</button>
              <button class="btn btn-sm btn-danger" :disabled="r.is_system" @click="remove(r)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section-head">
      <h3>成员角色分配</h3>
      <span class="text-muted">点击成员的「分配角色」，可同时绑定多个角色（优先级取并集）</span>
    </div>

    <div class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>fanbookID</th>
            <th>姓名</th>
            <th>身份</th>
            <th>已绑定角色</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td class="mono">{{ u.fanbook_id }}</td>
            <td>{{ u.name || '-' }}</td>
            <td>{{ u.title || '-' }}</td>
            <td>
              <span v-if="!u.role_ids.length" class="text-muted">未绑定</span>
              <span v-else v-for="rid in u.role_ids" :key="rid" class="role-pill">
                {{ (roles.find((r) => r.id === rid) || {}).name || rid }}
              </span>
            </td>
            <td class="ops">
              <button class="btn btn-sm" @click="openAssign(u)">分配角色</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新建/编辑角色 -->
    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal wide">
        <h3>{{ editing ? `编辑角色：${editing.name}` : '新建角色' }}</h3>
        <div class="form-row">
          <div class="form-group">
            <label>角色代码 *（英文，如 referee_chief）</label>
            <input v-model="form.code" class="form-control mono" :disabled="!!editing" />
          </div>
          <div class="form-group">
            <label>角色名称 *</label>
            <input v-model="form.name" class="form-control" />
          </div>
        </div>
        <div class="form-group">
          <label>描述</label>
          <input v-model="form.description" class="form-control" />
        </div>
        <label class="form-label">权限点</label>
        <div class="perm-groups">
          <div v-for="g in permGroups" :key="g.label" class="perm-group">
            <div class="perm-group-head">
              <span>{{ g.label }}</span>
              <button class="btn btn-sm" @click="toggleGroupPerms(g.codes)">
                {{ g.codes.every((c) => form.permission_ids.includes(c)) ? '取消全选' : '全选' }}
              </button>
            </div>
            <div class="perm-checks">
              <label v-for="c in g.codes" :key="c" class="perm-check" :class="{ checked: form.permission_ids.includes(c) }">
                <input type="checkbox" :checked="form.permission_ids.includes(c)" @change="togglePerm(c)" />
                <span class="perm-name">{{ permName(c) }}</span>
                <span class="perm-desc">{{ permDesc(c) }}</span>
              </label>
            </div>
          </div>
        </div>
        <p v-if="formError" class="error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showForm = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 成员角色分配 -->
    <div v-if="showAssign" class="modal-mask" @click.self="showAssign = false">
      <div class="modal">
        <h3>分配角色：{{ assignUser ? (assignUser.name || assignUser.fanbook_id) : '' }}</h3>
        <p class="text-muted" style="margin-bottom: 12px">fanbookID：{{ assignUser ? assignUser.fanbook_id : '' }}</p>
        <div class="title-checks">
          <label
            v-for="r in roles"
            :key="r.id"
            class="title-check"
            :class="{ checked: assignRoleIds.includes(r.id) }"
            @click="toggleAssignRole(r.id)"
          >
            <input type="checkbox" :checked="assignRoleIds.includes(r.id)" @change="toggleAssignRole(r.id)" />
            {{ r.name }}
          </label>
        </div>
        <p v-if="assignMsg" class="success" style="margin-top: 10px">{{ assignMsg }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showAssign = false">取消</button>
          <button class="btn btn-primary" :disabled="assignSaving" @click="saveAssign">{{ assignSaving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  gap: 10px;
  flex-wrap: wrap;
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 22px 0 12px;
}

.section-head h3 {
  font-size: 16px;
}

.error {
  color: var(--red);
  margin-bottom: 12px;
}

.success {
  color: var(--green);
}

.mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.sys-pill {
  display: inline-block;
  background: rgba(250, 204, 21, 0.15);
  border: 1px solid rgba(250, 204, 21, 0.35);
  color: var(--warning, #facc15);
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  margin-left: 6px;
}

.role-pill {
  display: inline-block;
  background: rgba(167, 139, 250, 0.15);
  border: 1px solid rgba(167, 139, 250, 0.35);
  color: #a78bfa;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  margin: 1px 3px 1px 0;
}

.table-wrap {
  padding: 0;
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.table th {
  text-align: left;
  padding: 12px 14px;
  background: rgba(148, 163, 184, 0.08);
  color: var(--text-sub);
  font-weight: 500;
  white-space: nowrap;
}

.table td {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
}

.ops {
  display: flex;
  gap: 6px;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.form-label {
  display: block;
  font-size: 13px;
  color: var(--text-sub);
  margin: 12px 0 8px;
}

.perm-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.perm-group {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--bg-elev);
}

.perm-group-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 8px;
}

.perm-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.perm-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  background: var(--bg-card-solid);
  color: var(--text-sub);
}

.perm-check input {
  accent-color: var(--accent);
}

.perm-check.checked {
  border-color: var(--accent);
  background: rgba(56, 189, 248, 0.15);
  color: var(--accent);
}

.perm-desc {
  color: var(--text-dim);
  font-size: 11px;
}

.title-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-input);
}

.title-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  background: var(--bg-elev);
  color: var(--text-sub);
  transition: all 0.15s;
}

.title-check.checked {
  background: rgba(56, 189, 248, 0.16);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
}

.modal {
  background: var(--bg-card-solid);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 14px;
  padding: 26px;
  width: 100%;
  max-width: 520px;
  max-height: 86vh;
  overflow-y: auto;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.1);
}

.modal.wide {
  max-width: 760px;
}

.modal h3 {
  margin-bottom: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
</style>