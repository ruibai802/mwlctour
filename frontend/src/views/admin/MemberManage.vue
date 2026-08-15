<script setup>
import { ref, computed, onMounted } from 'vue'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { getMembers, getRoles, createMember, updateMember, deleteMember, importMembers, batchDeleteMembers } from '../../api'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()

const members = ref([])
const roles = ref([])
const titles = ref([])
const loading = ref(true)
const error = ref('')
const selected = ref({})

const showForm = ref(false)
const editing = ref(null)
const form = ref({ fanbook_id: '', name: '', titles: [], role: 'staff', password: 'MWLC123456' })
const saving = ref(false)
const formError = ref('')

const importOpen = ref(false)
const fileName = ref('')
const parsed = ref({ columns: [], rows: [] })
const mapping = ref({ fanbook_id: '', name: '', titles: '', role: '' })
const importError = ref('')
const importMsg = ref('')

const FIELD_LABELS = {
  fanbook_id: 'fanbookID *',
  name: '姓名',
  role: '角色(可选，留空按身份自动推导)'
}

const identityPreset = ref('裁判/录像')

const roleAlias = (v) => {
  const s = String(v || '').trim().toLowerCase()
  if (/裁判/.test(s) || /录像/.test(s) || s === 'referee' || s === 'recorder' || s === 'official') return 'official'
  if (/规则|rules/.test(s)) return 'rules'
  if (/工作|staff/.test(s)) return 'staff'
  if (/超级|开发者|超管|super/.test(s)) return 'superadmin'
  if (/管理|admin/.test(s)) return 'admin'
  return ''
}

const rolesForSelect = computed(() => {
  if (auth.isSuperAdmin) return roles.value
  return roles.value.filter((r) => r.value !== 'superadmin')
})

const titlesForSelect = computed(() => {
  if (auth.isSuperAdmin) return titles.value
  return titles.value.filter((t) => t !== '开发者' && t !== '超级管理员')
})

function splitTitles(v) {
  return String(v || '').split(/[,，、;；]/).map((t) => t.trim()).filter(Boolean)
}

function autoMatch(col) {
  const c = String(col).toLowerCase()
  if (/fanbook|fb/.test(c)) return 'fanbook_id'
  if (/名字|姓名|name/.test(c)) return 'name'
  if (/身份|职位|title|组别|角色组/.test(c)) return 'titles'
  if (/角色|role|权限/.test(c)) return 'role'
  return ''
}

function parseFile(file) {
  importError.value = ''
  importMsg.value = ''
  fileName.value = file.name
  const ext = file.name.split('.').pop().toLowerCase()
  const onRows = (rows) => {
    if (!rows.length) {
      importError.value = '文件内容为空'
      return
    }
    const columns = Object.keys(rows[0])
    parsed.value = { columns, rows }
    mapping.value = {}
    for (const c of columns) {
      const m = autoMatch(c)
      if (m && !mapping.value[m]) mapping.value[m] = c
    }
    importOpen.value = true
  }
  if (ext === 'csv' || ext === 'txt') {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => onRows(res.data)
    })
  } else {
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      onRows(XLSX.utils.sheet_to_json(ws, { defval: '' }))
    }
    reader.readAsArrayBuffer(file)
  }
}

const previewRows = computed(() => parsed.value.rows.slice(0, 5))

function buildImportList() {
  const m = mapping.value
  const list = []
  const presetTitle = identityPreset.value
  for (const row of parsed.value.rows) {
    const fanbookId = String((m.fanbook_id ? row[m.fanbook_id] : '') || '').trim()
    if (!fanbookId) continue
    const titles = [presetTitle]
    const role = m.role
      ? roleAlias(row[m.role])
      : roleAlias(presetTitle)
    list.push({
      fanbook_id: fanbookId,
      name: m.name ? String(row[m.name] || '') : '',
      titles,
      role: role || 'official'
    })
  }
  return list
}

async function doImport() {
  importError.value = ''
  importMsg.value = ''
  if (!mapping.value.fanbook_id) {
    importError.value = '请为「fanbookID」选择对应列'
    return
  }
  const list = buildImportList()
  if (!list.length) {
    importError.value = '没有可导入的数据行'
    return
  }
  try {
    const res = await importMembers(list)
    importMsg.value = res.message
    await load()
  } catch (e) {
    importError.value = e.message
  }
}

const roleLabel = (role) => {
  const r = roles.value.find((x) => x.value === role)
  return r ? r.label : role
}

const badgeClass = (role) => `badge-${role}`

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [m, r] = await Promise.all([getMembers(), getRoles()])
    members.value = m
    roles.value = r.roles
    titles.value = r.titles
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

function openCreate() {
  editing.value = null
  form.value = { fanbook_id: '', name: '', titles: [], role: 'staff', password: 'MWLC123456' }
  formError.value = ''
  showForm.value = true
}

function openEdit(m) {
  editing.value = m
  form.value = {
    fanbook_id: m.fanbook_id,
    name: m.name,
    titles: m.title ? m.title.split(',') : [],
    role: m.role,
    password: ''
  }
  formError.value = ''
  showForm.value = true
}

function toggleTitle(t) {
  const i = form.value.titles.indexOf(t)
  if (i >= 0) form.value.titles.splice(i, 1)
  else form.value.titles.push(t)
}

async function save() {
  formError.value = ''
  if (!form.value.fanbook_id) {
    formError.value = '请填写 fanbookID'
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      const isOwn = auth.user && String(auth.user.id) === String(editing.value.id)
      const canSetPassword = auth.isSuperAdmin || isOwn
      const wantsPwd = canSetPassword && form.value.password ? form.value.password : ''
      await updateMember(editing.value.id, {
        name: form.value.name,
        titles: form.value.titles,
        role: form.value.role,
        reset_password: !!wantsPwd,
        password: wantsPwd || undefined
      })
    } else {
      const payload = { ...form.value, titles: form.value.titles }
      if (!auth.isSuperAdmin) delete payload.password
      await createMember(payload)
    }
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  }
  saving.value = false
}

async function remove(m) {
  if (!confirm(`确认删除成员 ${m.name || m.fanbook_id}？`)) return
  try {
    await deleteMember(m.id)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

const selectedCount = computed(() => Object.values(selected.value).filter(Boolean).length)

function toggleSelectAll() {
  const allSelected = members.value.length > 0 && members.value.every((m) => selected.value[m.id])
  selected.value = {}
  if (!allSelected) {
    for (const m of members.value) selected.value[m.id] = true
  }
}

async function removeSelected() {
  const ids = Object.keys(selected.value).filter((id) => selected.value[id]).map(Number)
  if (!ids.length) return
  if (!confirm(`确认删除选中的 ${ids.length} 名成员？`)) return
  try {
    await batchDeleteMembers(ids)
    selected.value = {}
    await load()
  } catch (e) {
    error.value = e.message
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <span class="text-muted">主办 / 管理 / 裁判长为管理员，其他成员可按等级授予权限</span>
      <div class="actions">
        <label class="select-all">
          <input type="checkbox" :checked="members.length > 0 && members.every((m) => selected[m.id])" @change="toggleSelectAll" />
          全选
        </label>
        <span v-if="selectedCount" class="text-muted">已选 {{ selectedCount }} 人</span>
        <button v-if="selectedCount" class="btn btn-sm btn-danger" @click="removeSelected">批量删除（{{ selectedCount }}）</button>
        <label class="btn btn-sm import-btn">
          批量导入
          <input type="file" accept=".csv,.txt,.xlsx,.xls" class="hidden-input" @change="(e) => e.target.files[0] && parseFile(e.target.files[0])" />
        </label>
        <button class="btn btn-primary" @click="openCreate">＋ 添加成员</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th class="sel-head"></th>
            <th>fanbookID</th>
            <th>姓名</th>
            <th>身份</th>
            <th>角色</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id">
            <td class="sel-cell">
              <input type="checkbox" v-model="selected[m.id]" />
            </td>
            <td class="mono">{{ m.fanbook_id }}</td>
            <td>{{ m.name || '-' }}</td>
            <td>
              <span v-if="!m.title" class="text-muted">-</span>
              <span v-else v-for="t in m.title.split(',')" :key="t" class="title-pill">{{ t }}</span>
            </td>
            <td><span class="badge" :class="badgeClass(m.role)">{{ roleLabel(m.role) }}</span></td>
            <td class="ops">
              <button class="btn btn-sm" @click="openEdit(m)">编辑</button>
              <button class="btn btn-sm btn-danger" @click="remove(m)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal">
        <h3>{{ editing ? '编辑成员' : '添加成员' }}</h3>
        <div class="form-group">
          <label>fanbookID *</label>
          <input v-model="form.fanbook_id" class="form-control" :disabled="!!editing" placeholder="一串数字" />
        </div>
        <div class="form-group">
          <label>姓名</label>
          <input v-model="form.name" class="form-control" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>身份（可多选）</label>
            <div class="title-checks">
              <label v-for="t in titlesForSelect" :key="t" class="title-check">
                <input type="checkbox" :checked="form.titles.includes(t)" @change="toggleTitle(t)" />
                {{ t }}
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>角色</label>
            <select v-model="form.role" class="form-control">
              <option v-for="r in rolesForSelect" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </div>
        </div>
        <div v-if="editing ? (auth.isSuperAdmin || (auth.user && String(auth.user.id) === String(editing.id))) : auth.isSuperAdmin" class="form-group">
          <label>{{ editing ? '重置密码（留空则不修改）' : '初始密码（默认 MWLC123456）' }}</label>
          <input v-model="form.password" class="form-control" />
        </div>
        <p v-if="!editing && !auth.isSuperAdmin" class="text-muted" style="margin-bottom:10px">
          初始密码固定为 MWLC123456，仅开发者/超级管理员可自定义密码
        </p>
        <p v-if="editing && !auth.isSuperAdmin && !(auth.user && String(auth.user.id) === String(editing.id))" class="text-muted" style="margin-bottom:10px">
          仅开发者/超级管理员可修改他人密码，你只能修改自己的密码
        </p>
        <p v-if="formError" class="error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showForm = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 批量导入 -->
    <div v-if="importOpen" class="modal-mask" @click.self="importOpen = false">
      <div class="modal wide">
        <h3>批量导入裁判名单</h3>
        <p class="text-muted" style="margin-bottom:14px">文件：{{ fileName }} · 共 {{ parsed.rows.length }} 行，请将列映射到系统字段（fanbookID 为必填）。本批导入的身份统一下方选择。</p>
        <div class="form-group">
          <label>本批导入身份</label>
          <div class="title-checks">
            <label
              v-for="t in ['裁判/录像', '裁判长']"
              :key="t"
              class="title-check"
              :class="{ checked: identityPreset === t }"
              @click="identityPreset = t"
            >
              <input type="radio" :name="'importIdentity'" :checked="identityPreset === t" @change="identityPreset = t" />
              {{ t }}
            </label>
          </div>
        </div>
        <div class="map-grid">
          <div v-for="(label, field) in FIELD_LABELS" :key="field" class="form-group">
            <label>{{ label }}</label>
            <select v-model="mapping[field]" class="form-control">
              <option value="">— 不导入 —</option>
              <option v-for="c in parsed.columns" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
        <div class="preview">
          <div class="preview-head">数据预览（前 5 行）</div>
          <div v-for="(r, i) in previewRows" :key="i" class="preview-row">
            <span v-for="c in parsed.columns" :key="c" class="pv-cell" :title="c">{{ r[c] || '' }}</span>
          </div>
        </div>
        <p v-if="importMsg" class="success">{{ importMsg }}</p>
        <p v-if="importError" class="error">{{ importError }}</p>
        <div class="modal-actions">
          <button class="btn" @click="importOpen = false">取消</button>
          <button class="btn btn-primary" @click="doImport">确认导入</button>
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

.error {
  color: var(--red);
  margin-bottom: 12px;
}

.mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
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

.title-check:hover {
  border-color: var(--accent);
}

.title-check:has(input:checked) {
  background: rgba(56, 189, 248, 0.16);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
}

.title-pill {
  display: inline-block;
  background: rgba(56, 189, 248, 0.14);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: var(--accent);
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

.sel-head {
  width: 36px;
}

.sel-cell {
  text-align: center;
}

.sel-cell input,
.select-all input {
  accent-color: var(--accent);
  cursor: pointer;
}

.select-all {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-sub);
  cursor: pointer;
}

.import-btn {
  position: relative;
}

.hidden-input {
  display: none;
}

.map-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.preview {
  background: var(--bg-card-solid);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  margin: 10px 0;
  overflow-x: auto;
}

.preview-head {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.preview-row {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  border-top: 1px dashed rgba(148, 163, 184, 0.15);
  font-size: 12px;
  white-space: nowrap;
}

.pv-cell {
  min-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-sub);
}

.modal.wide {
  max-width: 760px;
}

.success {
  color: var(--green);
  margin-bottom: 12px;
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
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.1);
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
