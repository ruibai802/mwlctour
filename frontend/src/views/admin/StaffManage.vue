<script setup>
import { ref, computed, onMounted } from 'vue'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  getStaff, createStaff, updateStaff, deleteStaff, importStaff,
  getAttendance, recordAttendance, deleteAttendance,
  getMembers
} from '../../api'

const STATUS_OPTIONS = [
  { value: 'active', label: '在岗' },
  { value: 'inactive', label: '休假' },
  { value: 'left', label: '已离职' }
]

const ATD_STATUS_OPTIONS = [
  { value: 'present', label: '出勤' },
  { value: 'absent', label: '缺勤' },
  { value: 'late', label: '迟到' },
  { value: 'leave', label: '请假' },
  { value: 'off', label: '休息' }
]

const tab = ref('staff')
const staffList = ref([])
const members = ref([])
const loading = ref(true)
const error = ref('')

const showForm = ref(false)
const editing = ref(null)
const form = ref({ name: '', fanbook_id: '', title: '', department: '', phone: '', status: 'active', user_id: '', remark: '' })
const saving = ref(false)
const formError = ref('')

const atdList = ref([])
const atdFilter = ref({ staff_id: '', month: '' })
const atdLoading = ref(false)
const atdError = ref('')
const showAtdForm = ref(false)
const atdForm = ref({ staff_id: '', date: '', check_in: '', check_out: '', status: 'present', remark: '' })
const atdSaving = ref(false)
const atdFormError = ref('')
const atdMsg = ref('')

const statusLabel = (v) => (STATUS_OPTIONS.find((s) => s.value === v) || {}).label || v
const atdStatusLabel = (v) => (ATD_STATUS_OPTIONS.find((s) => s.value === v) || {}).label || v

// ===== 批量导入 =====
const importOpen = ref(false)
const fileName = ref('')
const parsed = ref({ columns: [], rows: [] })
const mapping = ref({ name: '', fanbook_id: '', title: '', department: '', phone: '', status: '' })
const importError = ref('')
const importMsg = ref('')

const STAFF_FIELD_LABELS = {
  name: '姓名 *',
  fanbook_id: 'fanbookID',
  title: '身份',
  department: '部门',
  phone: 'QQ号',
  status: '状态(active/inactive/left)'
}

function autoMatch(col) {
  const c = String(col).toLowerCase()
  if (/名字|姓名|name/.test(c)) return 'name'
  if (/fanbook|fb/.test(c)) return 'fanbook_id'
  if (/身份|职位|title/.test(c)) return 'title'
  if (/部门|department/.test(c)) return 'department'
  if (/电话|手机|qq|phone/.test(c)) return 'phone'
  if (/状态|status/.test(c)) return 'status'
  return ''
}

function parseStaffFile(file) {
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

const staffPreviewRows = computed(() => parsed.value.rows.slice(0, 5))

function buildStaffImportList() {
  const m = mapping.value
  const list = []
  for (const row of parsed.value.rows) {
    const item = {}
    for (const field of Object.keys(m)) {
      const col = m[field]
      if (col) item[field] = row[col]
    }
    if (!item.name) continue
    list.push(item)
  }
  return list
}

async function doStaffImport() {
  importError.value = ''
  importMsg.value = ''
  if (!mapping.value.name) {
    importError.value = '请为「姓名」选择对应列'
    return
  }
  const list = buildStaffImportList()
  if (!list.length) {
    importError.value = '没有可导入的数据行（姓名必填）'
    return
  }
  try {
    const res = await importStaff(list)
    importMsg.value = res.message
    importOpen.value = false
    await load()
  } catch (e) {
    importError.value = e.message
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [s, m] = await Promise.all([getStaff(), getMembers()])
    staffList.value = s
    members.value = m
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

async function loadAtd() {
  atdLoading.value = true
  atdError.value = ''
  const params = {}
  if (atdFilter.value.staff_id) params.staff_id = atdFilter.value.staff_id
  if (atdFilter.value.month) params.month = atdFilter.value.month
  try {
    atdList.value = await getAttendance(params)
  } catch (e) {
    atdError.value = e.message
  }
  atdLoading.value = false
}

function switchTab(t) {
  tab.value = t
  if (t === 'atd') loadAtd()
}

function openCreate() {
  editing.value = null
  form.value = { name: '', fanbook_id: '', title: '', department: '', phone: '', status: 'active', user_id: '', remark: '' }
  formError.value = ''
  showForm.value = true
}

function openEdit(s) {
  editing.value = s
  form.value = {
    name: s.name,
    fanbook_id: s.fanbook_id || '',
    title: s.title || '',
    department: s.department || '',
    phone: s.phone || '',
    status: s.status || 'active',
    user_id: s.user_id || '',
    remark: s.remark || ''
  }
  formError.value = ''
  showForm.value = true
}

async function save() {
  formError.value = ''
  if (!form.value.name.trim()) {
    formError.value = '请填写姓名'
    return
  }
  saving.value = true
  try {
    const payload = { ...form.value }
    if (!payload.user_id) payload.user_id = ''
    if (editing.value) {
      await updateStaff(editing.value.id, payload)
    } else {
      await createStaff(payload)
    }
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  }
  saving.value = false
}

async function remove(s) {
  if (!confirm(`确认删除工作人员 ${s.name}？`)) return
  try {
    await deleteStaff(s.id)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

function openAtdCreate() {
  atdForm.value = {
    staff_id: atdFilter.value.staff_id || '',
    date: new Date().toISOString().slice(0, 10),
    check_in: '',
    check_out: '',
    status: 'present',
    remark: ''
  }
  atdFormError.value = ''
  atdMsg.value = ''
  showAtdForm.value = true
}

function openAtdEdit(a) {
  atdForm.value = {
    staff_id: String(a.staff_id),
    date: a.date,
    check_in: a.check_in,
    check_out: a.check_out,
    status: a.status,
    remark: a.remark
  }
  atdFormError.value = ''
  atdMsg.value = ''
  showAtdForm.value = true
}

async function saveAtd() {
  atdFormError.value = ''
  atdMsg.value = ''
  if (!atdForm.value.staff_id) {
    atdFormError.value = '请选择工作人员'
    return
  }
  if (!atdForm.value.date) {
    atdFormError.value = '请选择日期'
    return
  }
  atdSaving.value = true
  try {
    await recordAttendance(atdForm.value)
    atdMsg.value = '考勤已保存（同人同日会覆盖更新）'
    showAtdForm.value = false
    await loadAtd()
  } catch (e) {
    atdFormError.value = e.message
  }
  atdSaving.value = false
}

async function removeAtd(a) {
  if (!confirm(`确认删除 ${a.staff_name || a.staff_id} 在 ${a.date} 的考勤记录？`)) return
  try {
    await deleteAttendance(a.id)
    await loadAtd()
  } catch (e) {
    atdError.value = e.message
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="sub-tabs">
      <button class="sub-tab" :class="{ active: tab === 'staff' }" @click="switchTab('staff')">工作人员</button>
      <button class="sub-tab" :class="{ active: tab === 'atd' }" @click="switchTab('atd')">考勤记录</button>
    </div>

    <!-- 工作人员列表 -->
    <template v-if="tab === 'staff'">
      <div class="toolbar">
        <span class="text-muted">赛事工作人员档案；关联登录成员后，该成员可确认本人负责的比赛任务</span>
        <div class="actions">
          <label class="btn btn-sm import-btn">
            批量导入
            <input type="file" accept=".csv,.txt,.xlsx,.xls" class="hidden-input" @change="(e) => e.target.files[0] && parseStaffFile(e.target.files[0])" />
          </label>
          <button class="btn btn-primary" @click="openCreate">＋ 添加工作人员</button>
        </div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else class="card table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>fanbookID</th>
              <th>身份</th>
              <th>部门</th>
              <th>QQ号</th>
              <th>状态</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in staffList" :key="s.id">
              <td>{{ s.name }}</td>
              <td class="mono">{{ s.fanbook_id || '-' }}</td>
              <td>{{ s.title || '-' }}</td>
              <td>{{ s.department || '-' }}</td>
              <td>{{ s.phone || '-' }}</td>
              <td><span class="badge" :class="`badge-${s.status}`">{{ statusLabel(s.status) }}</span></td>
              <td class="text-muted">{{ s.remark || '-' }}</td>
              <td class="ops">
                <button class="btn btn-sm" @click="openEdit(s)">编辑</button>
                <button class="btn btn-sm btn-danger" @click="remove(s)">删除</button>
              </td>
            </tr>
            <tr v-if="!staffList.length">
              <td colspan="8" class="empty-tip">暂无工作人员，点击右上角添加</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 考勤记录 -->
    <template v-else>
      <div class="toolbar">
        <div class="filters">
          <select v-model="atdFilter.staff_id" class="form-control" style="width: 180px">
            <option value="">全部工作人员</option>
            <option v-for="s in staffList" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </select>
          <input v-model="atdFilter.month" type="month" class="form-control" style="width: 160px" />
          <button class="btn" @click="loadAtd">查询</button>
        </div>
        <div class="actions">
          <button class="btn btn-primary" @click="openAtdCreate">＋ 记录考勤</button>
        </div>
      </div>
      <p v-if="atdError" class="error">{{ atdError }}</p>
      <div v-if="atdLoading" class="loading">加载中...</div>
      <div v-else class="card table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>日期</th>
              <th>工作人员</th>
              <th>签到</th>
              <th>签退</th>
              <th>状态</th>
              <th>备注</th>
              <th>记录人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in atdList" :key="a.id">
              <td class="mono">{{ a.date }}</td>
              <td>{{ a.staff_name || ('#' + a.staff_id) }}</td>
              <td class="mono">{{ a.check_in || '-' }}</td>
              <td class="mono">{{ a.check_out || '-' }}</td>
              <td><span class="badge" :class="`badge-${a.status}`">{{ atdStatusLabel(a.status) }}</span></td>
              <td class="text-muted">{{ a.remark || '-' }}</td>
              <td class="text-muted">{{ a.recorded_by || '-' }}</td>
              <td class="ops">
                <button class="btn btn-sm" @click="openAtdEdit(a)">编辑</button>
                <button class="btn btn-sm btn-danger" @click="removeAtd(a)">删除</button>
              </td>
            </tr>
            <tr v-if="!atdList.length">
              <td colspan="8" class="empty-tip">暂无考勤记录（可按工作人员/月份查询）</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="atdMsg" class="success">{{ atdMsg }}</p>
    </template>

    <!-- 工作人员表单 -->
    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal">
        <h3>{{ editing ? '编辑工作人员' : '添加工作人员' }}</h3>
        <div class="form-row">
          <div class="form-group">
            <label>姓名 *</label>
            <input v-model="form.name" class="form-control" />
          </div>
          <div class="form-group">
            <label>fanbookID</label>
            <input v-model="form.fanbook_id" class="form-control mono" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>身份</label>
            <input v-model="form.title" class="form-control" placeholder="如：裁判 / 裁判长" />
          </div>
          <div class="form-group">
            <label>部门</label>
            <input v-model="form.department" class="form-control" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>QQ号</label>
            <input v-model="form.phone" class="form-control" />
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="form.status" class="form-control">
              <option v-for="s in STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>关联登录成员（可选，用于本人确认比赛任务）</label>
          <select v-model="form.user_id" class="form-control">
            <option value="">— 不关联 —</option>
            <option v-for="m in members" :key="m.id" :value="String(m.id)">{{ m.name || m.fanbook_id }}（{{ m.fanbook_id }}）</option>
          </select>
        </div>
        <div class="form-group">
          <label>备注</label>
          <input v-model="form.remark" class="form-control" />
        </div>
        <p v-if="formError" class="error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showForm = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 考勤表单 -->
    <div v-if="showAtdForm" class="modal-mask" @click.self="showAtdForm = false">
      <div class="modal">
        <h3>记录考勤</h3>
        <div class="form-group">
          <label>工作人员 *</label>
          <select v-model="atdForm.staff_id" class="form-control">
            <option value="">— 选择 —</option>
            <option v-for="s in staffList" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>日期 *</label>
          <input v-model="atdForm.date" type="date" class="form-control" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>签到</label>
            <input v-model="atdForm.check_in" type="time" class="form-control" />
          </div>
          <div class="form-group">
            <label>签退</label>
            <input v-model="atdForm.check_out" type="time" class="form-control" />
          </div>
        </div>
        <div class="form-group">
          <label>状态</label>
          <select v-model="atdForm.status" class="form-control">
            <option v-for="s in ATD_STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>备注</label>
          <input v-model="atdForm.remark" class="form-control" />
        </div>
        <p class="text-muted" style="margin-bottom: 8px">同一人同一日期重复保存会覆盖更新</p>
        <p v-if="atdFormError" class="error">{{ atdFormError }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showAtdForm = false">取消</button>
          <button class="btn btn-primary" :disabled="atdSaving" @click="saveAtd">{{ atdSaving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 批量导入工作人员 -->
    <div v-if="importOpen" class="modal-mask" @click.self="importOpen = false">
      <div class="modal wide">
        <h3>批量导入工作人员</h3>
        <p class="text-muted" style="margin-bottom:14px">文件：{{ fileName }} · 共 {{ parsed.rows.length }} 行，请将列映射到系统字段（姓名必填；同 fanbookID 自动跳过）</p>
        <div class="map-grid">
          <div v-for="(label, field) in STAFF_FIELD_LABELS" :key="field" class="form-group">
            <label>{{ label }}</label>
            <select v-model="mapping[field]" class="form-control">
              <option value="">— 不导入 —</option>
              <option v-for="c in parsed.columns" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
        <div class="preview">
          <div class="preview-head">数据预览（前 5 行）</div>
          <div v-for="(r, i) in staffPreviewRows" :key="i" class="preview-row">
            <span v-for="c in parsed.columns" :key="c" class="pv-cell" :title="c">{{ r[c] || '' }}</span>
          </div>
        </div>
        <p v-if="importMsg" class="success">{{ importMsg }}</p>
        <p v-if="importError" class="error">{{ importError }}</p>
        <div class="modal-actions">
          <button class="btn" @click="importOpen = false">取消</button>
          <button class="btn btn-primary" @click="doStaffImport">确认导入</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hidden-input {
  display: none;
}

.import-btn {
  position: relative;
}

.map-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
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

.sub-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
}

.sub-tab {
  padding: 7px 18px;
  border-radius: 999px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  font-size: 14px;
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.18s;
}

.sub-tab:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.sub-tab.active {
  background: var(--accent-grad);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.35);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  gap: 10px;
  flex-wrap: wrap;
}

.filters {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.error {
  color: var(--red);
  margin-bottom: 12px;
}

.success {
  color: var(--green);
  margin-top: 10px;
}

.mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
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

.empty-tip {
  text-align: center;
  color: var(--text-dim);
  padding: 28px 0;
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