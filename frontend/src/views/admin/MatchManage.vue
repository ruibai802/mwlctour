<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  getMatches, createMatch, updateMatch, deleteMatch,
  getGroupList, getTeamList, getStaff, getSettings
} from '../../api'

const router = useRouter()

const STATUS_OPTIONS = [
  { value: 'scheduled', label: '待开赛' },
  { value: 'ongoing', label: '进行中' },
  { value: 'completed', label: '已结束' },
  { value: 'cancelled', label: '已取消' }
]

const matches = ref([])
const groups = ref([])
const teams = ref([])
const staffList = ref([])
const settings = ref({ tournament_names: [] })
const loading = ref(true)
const error = ref('')
const filter = ref({ group_id: '', status: '', keyword: '' })

const showForm = ref(false)
const editing = ref(null)
const form = ref({})
const saving = ref(false)
const formError = ref('')

const statusLabel = (v) => (STATUS_OPTIONS.find((s) => s.value === v) || {}).label || v
const statusClass = (v) => `badge-${v}`

async function loadMeta() {
  try {
    const [g, t, s, set] = await Promise.all([getGroupList(), getTeamList(), getStaff(), getSettings()])
    groups.value = g
    teams.value = t
    staffList.value = s
    settings.value = set
  } catch (e) {
    // 元数据加载失败不阻塞列表
  }
}

async function load() {
  loading.value = true
  error.value = ''
  const params = {}
  if (filter.value.group_id) params.group_id = filter.value.group_id
  if (filter.value.status) params.status = filter.value.status
  if (filter.value.keyword) params.keyword = filter.value.keyword
  try {
    matches.value = await getMatches(params)
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

function defaultForm() {
  return {
    tournament_name: '',
    group_id: '',
    round: 1,
    seq: 1,
    matchup: '',
    start_time: '',
    end_time: '',
    team_a_id: '',
    team_b_id: '',
    team_a_name: '',
    team_b_name: '',
    map: '',
    status: 'scheduled',
    remark: ''
  }
}

function openCreate() {
  editing.value = null
  form.value = defaultForm()
  formError.value = ''
  showForm.value = true
}

function openEdit(m) {
  editing.value = m
  form.value = {
    group_id: m.group_id || '',
    round: m.round,
    seq: m.seq,
    matchup: m.matchup,
    start_time: m.start_time || '',
    end_time: m.end_time || '',
    team_a_id: m.team_a_id || '',
    team_b_id: m.team_b_id || '',
    team_a_name: m.team_a_name,
    team_b_name: m.team_b_name,
    map: m.map || '',
    status: m.status,
    remark: m.remark || ''
  }
  formError.value = ''
  showForm.value = true
}

async function save() {
  formError.value = ''
  if (form.value.team_a_id && form.value.team_b_id && form.value.team_a_id === form.value.team_b_id) {
    formError.value = '对阵双方不能是同一支队伍'
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await updateMatch(editing.value.id, form.value)
    } else {
      await createMatch(form.value)
    }
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  }
  saving.value = false
}

async function remove(m) {
  if (!confirm(`确认删除比赛 ${m.team_a_name} vs ${m.team_b_name}？相关分配、视频、罚单将一并删除`)) return
  try {
    await deleteMatch(m.id)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

function goDetail(m) {
  router.push(`/admin/matches/${m.id}`)
}

function groupName(id) {
  if (!id) return '—'
  const g = groups.value.find((x) => x.id === Number(id))
  return g ? g.name : '—'
}

onMounted(() => {
  load()
  loadMeta()
})
</script>

<template>
  <div>
    <div class="toolbar">
      <div class="filters">
        <select v-model="filter.group_id" class="form-control" style="width: 160px" @change="load">
          <option value="">全部分组</option>
          <option v-for="g in groups" :key="g.id" :value="String(g.id)">{{ g.name }}</option>
        </select>
        <select v-model="filter.status" class="form-control" style="width: 130px" @change="load">
          <option value="">全部状态</option>
          <option v-for="s in STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
        <input
          v-model="filter.keyword"
          class="form-control"
          style="width: 200px"
          placeholder="搜索对阵/队伍/房间"
          @keyup.enter="load"
        />
        <button class="btn" @click="load">查询</button>
      </div>
      <div class="actions">
        <button class="btn btn-primary" @click="openCreate">＋ 创建比赛</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>分组</th>
            <th>轮次-序号</th>
            <th>房间</th>
            <th>对阵</th>
            <th>时间</th>
            <th>地图</th>
            <th>比分</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in matches" :key="m.id" @click="goDetail(m)" class="clickable">
            <td>{{ groupName(m.group_id) }}</td>
            <td class="mono">{{ m.round }}-{{ m.seq }}</td>
            <td class="mono">{{ m.room || '-' }}</td>
            <td class="matchup">{{ m.team_a_name }} <span class="vs">VS</span> {{ m.team_b_name }}</td>
            <td>{{ m.start_time || '-' }}</td>
            <td>{{ m.map || '-' }}</td>
            <td class="mono">{{ m.score || '-' }}</td>
            <td><span class="badge" :class="statusClass(m.status)">{{ statusLabel(m.status) }}</span></td>
            <td class="ops" @click.stop>
              <button class="btn btn-sm" @click="openEdit(m)">编辑</button>
              <button class="btn btn-sm btn-danger" @click="remove(m)">删除</button>
            </td>
          </tr>
          <tr v-if="!matches.length">
            <td colspan="9" class="empty-tip">暂无比赛</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 创建/编辑比赛 -->
    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal wide">
        <h3>{{ editing ? '编辑比赛' : '创建比赛' }}</h3>
        <div class="form-row">
          <div class="form-group">
            <label>赛事名称</label>
            <select v-model="form.tournament_name" class="form-control">
              <option value="">— 不指定 —</option>
              <option v-for="n in settings.tournament_names" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>分组</label>
            <select v-model="form.group_id" class="form-control">
              <option value="">— 无分组 —</option>
              <option v-for="g in groups" :key="g.id" :value="String(g.id)">{{ g.name }}</option>
            </select>
          </div>
          <div class="form-group" style="max-width: 110px">
            <label>轮次</label>
            <input v-model.number="form.round" type="number" class="form-control" />
          </div>
          <div class="form-group" style="max-width: 110px">
            <label>序号</label>
            <input v-model.number="form.seq" type="number" class="form-control" />
          </div>
          <div class="form-group">
            <label>对局名称（可选）</label>
            <input v-model="form.matchup" class="form-control" placeholder="如：小组赛 A1 vs B2" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>A 队 *</label>
            <select v-model="form.team_a_id" class="form-control">
              <option value="">— 选择队伍 —</option>
              <option v-for="t in teams" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>B 队 *</label>
            <select v-model="form.team_b_id" class="form-control">
              <option value="">— 选择队伍 —</option>
              <option v-for="t in teams" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>开始时间</label>
            <input v-model="form.start_time" class="form-control" placeholder="如 2026-08-21 19:00" />
          </div>
          <div class="form-group">
            <label>结束时间</label>
            <input v-model="form.end_time" class="form-control" placeholder="可后补" />
          </div>
          <div class="form-group">
            <label>地图</label>
            <input v-model="form.map" class="form-control" />
          </div>
        </div>
        <div class="form-group">
          <label>备注</label>
          <input v-model="form.remark" class="form-control" />
        </div>
        <p class="text-muted" style="margin-bottom: 8px">创建后可在详情页分配裁判等工作人员、添加上场选手、视频链接与罚单</p>
        <p v-if="formError" class="error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showForm = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
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

tr.clickable {
  cursor: pointer;
  transition: background 0.15s;
}

tr.clickable:hover td {
  background: rgba(56, 189, 248, 0.06);
}

.matchup {
  font-weight: 500;
}

.vs {
  color: var(--text-dim);
  font-size: 12px;
  margin: 0 4px;
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

.mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
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
  max-width: 540px;
  max-height: 86vh;
  overflow-y: auto;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.1);
}

.modal.wide {
  max-width: 720px;
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