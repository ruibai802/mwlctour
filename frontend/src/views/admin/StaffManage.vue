<script setup>
import { ref, onMounted } from 'vue'
import {
  getStaff, createStaff, updateStaff, deleteStaff,
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
              <th>电话</th>
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
            <label>电话</label>
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
  </div>
</template>

<style scoped>
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