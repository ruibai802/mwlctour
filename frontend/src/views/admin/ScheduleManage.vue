<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getSchedules, getGroups, getSettings, getTeams,
  createSchedule, updateSchedule, deleteSchedule
} from '../../api'

const schedules = ref([])
const groups = ref([])
const settings = ref({ tournament_name: 'MWLC赛事', maps: [] })
const teams = ref([])
const loading = ref(true)
const error = ref('')

const groupFilter = ref('')
const statusFilter = ref('')
const showForm = ref(false)
const editing = ref(null)
const saving = ref(false)
const formError = ref('')

const emptyForm = () => ({
  group_name: '',
  round: 1,
  seq: 1,
  matchup: '',
  room: '',
  time: '',
  team_a_name: '', t1_a_name: '', t1_a_fb: '', t1_a_id: '', t2_a_name: '', t2_a_id: '', sub_a_name: '', sub_a_id: '',
  team_b_name: '', t1_b_name: '', t1_b_fb: '', t1_b_id: '', t2_b_name: '', t2_b_id: '', sub_b_name: '', sub_b_id: '',
  team_a_lineup: [],
  team_b_lineup: [],
  map: '',
  remark: ''
})

const form = ref(emptyForm())

const filtered = computed(() => {
  let list = schedules.value
  if (groupFilter.value) list = list.filter((s) => s.group_name === groupFilter.value)
  if (statusFilter.value) list = list.filter((s) => s.status === statusFilter.value)
  return list
})

function briefLabel(s) {
  return `${settings.value.tournament_name} | ${s.group_name || '无组别'} | ${s.round}-${s.seq} | ${s.matchup || '未填写对阵'}`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [s, g, set, t] = await Promise.all([getSchedules(), getGroups(), getSettings(), getTeams()])
    schedules.value = s
    groups.value = g
    settings.value = set
    teams.value = t
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

const allTeams = computed(() => teams.value.map((t) => t.team))

const SLOT_KEYS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']

function lineupOf(players) {
  const slotted = players.filter((p) => p.slot && SLOT_KEYS.includes(p.slot))
  const unslotted = players.filter((p) => !p.slot || !SLOT_KEYS.includes(p.slot))
  const bySlot = {}
  for (const p of slotted) {
    if (!bySlot[p.slot]) bySlot[p.slot] = p
  }
  const lineup = SLOT_KEYS.filter((s) => bySlot[s]).map((s) => ({
    slot: s,
    name: bySlot[s].name || '',
    fanbook: bySlot[s].fanbook || '',
    game_id: bySlot[s].game_id || ''
  }))
  for (const p of unslotted.slice(0, SLOT_KEYS.length - lineup.length)) {
    lineup.push({
      slot: `P${lineup.length + 1}`,
      name: p.name || '',
      fanbook: p.fanbook || '',
      game_id: p.game_id || ''
    })
  }
  return lineup.slice(0, 7)
}

function applyTeam(side, teamName) {
  if (!teamName) return
  const team = teams.value.find((t) => t.team === teamName)
  if (!team) return
  const lineup = lineupOf(team.players)
  // 依次将名单中 P1-P7 填入：P1 的 fanbookID/游戏名/游戏ID，P2..P7 的游戏名/游戏ID
  const get = (i) => (i < lineup.length ? lineup[i] : null)
  const p1 = get(0)
  const p2 = get(1)
  const p3 = get(2)
  if (side === 'a') {
    form.value.team_a_name = teamName
    form.value.team_a_lineup = [...lineup]
    form.value.t1_a_name = p1?.name || ''
    form.value.t1_a_fb = p1?.fanbook || ''
    form.value.t1_a_id = p1?.game_id || ''
    form.value.t2_a_name = p2?.name || ''
    form.value.t2_a_id = p2?.game_id || ''
    form.value.sub_a_name = p3?.name || ''
    form.value.sub_a_id = p3?.game_id || ''
  } else {
    form.value.team_b_name = teamName
    form.value.team_b_lineup = [...lineup]
    form.value.t1_b_name = p1?.name || ''
    form.value.t1_b_fb = p1?.fanbook || ''
    form.value.t1_b_id = p1?.game_id || ''
    form.value.t2_b_name = p2?.name || ''
    form.value.t2_b_id = p2?.game_id || ''
    form.value.sub_b_name = p3?.name || ''
    form.value.sub_b_id = p3?.game_id || ''
  }
}

function lineupSlot(entry, field) {
  if (!entry || !entry[field]) return ''
  return entry[field]
}

function setLineupField(side, index, field, value) {
  const key = side === 'a' ? 'team_a_lineup' : 'team_b_lineup'
  if (!form.value[key][index]) form.value[key][index] = { slot: SLOT_KEYS[index] || '', name: '', fanbook: '', game_id: '' }
  form.value[key][index][field] = value
}

function openCreate() {
  editing.value = null
  form.value = emptyForm()
  formError.value = ''
  showForm.value = true
}

function openEdit(s) {
  editing.value = s
  form.value = { ...s }
  formError.value = ''
  showForm.value = true
}

function autoRoom() {
  if (form.value.round && form.value.seq) {
    form.value.room = `R${form.value.round}${form.value.seq}`
  }
}

function setMap(m) {
  form.value.map = m
}

async function save() {
  formError.value = ''
  if (!form.value.group_name || !form.value.matchup) {
    formError.value = '请填写组别和对阵'
    return
  }
  if (!form.value.room) autoRoom()
  saving.value = true
  try {
    if (editing.value) {
      await updateSchedule(editing.value.id, form.value)
    } else {
      await createSchedule(form.value)
    }
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  }
  saving.value = false
}

async function remove(s) {
  if (!confirm(`确认删除日程？\n${briefLabel(s)}`)) return
  try {
    await deleteSchedule(s.id)
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
      <div class="filters">
        <select v-model="groupFilter" class="form-control filter">
          <option value="">全部组别</option>
          <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
        </select>
        <select v-model="statusFilter" class="form-control filter">
          <option value="">全部状态</option>
          <option value="pending">待完成</option>
          <option value="completed">已完成</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="openCreate">＋ 创建日程</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!filtered.length" class="empty">暂无日程</div>
    <div v-else class="table-wrap card">
      <table class="table">
        <thead>
          <tr>
            <th>日程</th>
            <th>时间</th>
            <th>房间</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in filtered" :key="s.id">
            <td class="brief-cell">
              <div class="brief">{{ briefLabel(s) }}</div>
              <div class="sub" v-if="s.result">比分 {{ s.result.score }} · 胜者 {{ s.result.winner }}</div>
            </td>
            <td>{{ s.time }}</td>
            <td>{{ s.room }}</td>
            <td>
              <span class="badge" :class="s.status === 'completed' ? 'badge-completed' : 'badge-pending'">
                {{ s.status === 'completed' ? '已完成' : '待完成' }}
              </span>
            </td>
            <td class="ops">
              <button class="btn btn-sm" @click="openEdit(s)">编辑</button>
              <button class="btn btn-sm btn-danger" @click="remove(s)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal wide">
        <h3>{{ editing ? '编辑日程' : '创建日程' }}</h3>
        <div class="form-section">基本信息</div>
        <div class="form-row">
          <div class="form-group">
            <label>组别 *</label>
            <input v-model="form.group_name" class="form-control" placeholder="如 A" />
          </div>
          <div class="form-group">
            <label>轮次</label>
            <input v-model.number="form.round" class="form-control" type="number" min="1" />
          </div>
          <div class="form-group">
            <label>序号</label>
            <input v-model.number="form.seq" class="form-control" type="number" min="1" @change="autoRoom" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>对阵 *</label>
            <input v-model="form.matchup" class="form-control" placeholder="如 红队 vs 蓝队" />
          </div>
          <div class="form-group">
            <label>房间号</label>
            <input v-model="form.room" class="form-control" placeholder="留空自动生成 R<轮次><序号>" />
          </div>
          <div class="form-group">
            <label>比赛时间</label>
            <input v-model="form.time" class="form-control" placeholder="YYYY-MM-DD HH:MM" />
          </div>
        </div>
        <div class="form-group">
          <label>地图</label>
          <div class="map-options">
            <button
              v-for="m in settings.maps"
              :key="m"
              class="map-pill"
              :class="{ active: form.map === m }"
              @click="setMap(m)"
            >{{ m }}</button>
            <input v-model="form.map" class="form-control map-input" placeholder="或手动输入地图名" />
          </div>
        </div>

        <div class="form-section">队伍信息 <span class="text-muted">（选择队伍后自动填入 P1-P7 所有信息）</span></div>
        <div class="team-form">
          <div class="team-form-block">
            <div class="team-select-row">
              <h4>A 队</h4>
              <select class="form-control team-select" @change="applyTeam('a', $event.target.value)">
                <option value="">← 从名单选择队伍</option>
                <option v-for="t in allTeams" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>队伍名</label>
              <input v-model="form.team_a_name" class="form-control" />
            </div>
            <div class="lineup-editor">
              <div v-for="(row, i) in SLOT_KEYS" :key="row" class="lineup-row">
                <span class="lineup-slot">{{ row }}</span>
                <input class="form-control" placeholder="fanbookID"
                  :value="form.team_a_lineup[i]?.fanbook || ''"
                  @input="setLineupField('a', i, 'fanbook', $event.target.value)" />
                <input class="form-control" placeholder="游戏名"
                  :value="form.team_a_lineup[i]?.name || ''"
                  @input="setLineupField('a', i, 'name', $event.target.value)" />
                <input class="form-control" placeholder="游戏ID"
                  :value="form.team_a_lineup[i]?.game_id || ''"
                  @input="setLineupField('a', i, 'game_id', $event.target.value)" />
              </div>
            </div>
          </div>
          <div class="team-form-block">
            <div class="team-select-row">
              <h4>B 队</h4>
              <select class="form-control team-select" @change="applyTeam('b', $event.target.value)">
                <option value="">← 从名单选择队伍</option>
                <option v-for="t in allTeams" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>队伍名</label>
              <input v-model="form.team_b_name" class="form-control" />
            </div>
            <div class="lineup-editor">
              <div v-for="(row, i) in SLOT_KEYS" :key="row" class="lineup-row">
                <span class="lineup-slot">{{ row }}</span>
                <input class="form-control" placeholder="fanbookID"
                  :value="form.team_b_lineup[i]?.fanbook || ''"
                  @input="setLineupField('b', i, 'fanbook', $event.target.value)" />
                <input class="form-control" placeholder="游戏名"
                  :value="form.team_b_lineup[i]?.name || ''"
                  @input="setLineupField('b', i, 'name', $event.target.value)" />
                <input class="form-control" placeholder="游戏ID"
                  :value="form.team_b_lineup[i]?.game_id || ''"
                  @input="setLineupField('b', i, 'game_id', $event.target.value)" />
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>备注</label>
          <textarea v-model="form.remark" class="form-control" rows="2" placeholder="后端会自动追加：创建于<时间>,来自于<创建人>"></textarea>
        </div>
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
  gap: 10px;
}

.filter {
  width: 140px;
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

.brief {
  font-weight: 500;
}

.sub {
  font-size: 12px;
  color: var(--text-sub);
  margin-top: 4px;
}

.ops {
  display: flex;
  gap: 6px;
  white-space: nowrap;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow-y: auto;
  padding: 30px 16px;
  z-index: 200;
}

.modal {
  background: var(--bg-card-solid);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 14px;
  padding: 26px;
  width: 100%;
  max-width: 900px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.1);
}

.modal.wide {
  max-width: 920px;
}

.modal h3 {
  margin-bottom: 16px;
}

.form-section {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  margin: 18px 0 14px;
}

.map-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.map-pill {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-elev);
  font-size: 13px;
  color: var(--text-main);
}

.map-pill:hover {
  border-color: var(--accent);
}

.map-pill.active {
  background: var(--accent-grad);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.35);
}

.map-input {
  width: 200px;
}

.team-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.team-form-block {
  background: rgba(148, 163, 184, 0.06);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
}

.team-form-block h4 {
  margin-bottom: 12px;
  color: var(--text-main);
}

.team-select-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.team-select-row h4 {
  margin: 0;
  white-space: nowrap;
}

.team-select {
  flex: 1;
}

.lineup-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lineup-row {
  display: grid;
  grid-template-columns: 34px 1fr 1fr 1fr;
  gap: 6px;
  align-items: center;
}

.lineup-slot {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 6px;
  text-align: center;
  padding: 5px 0;
  width: 34px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

@media (max-width: 760px) {
  .team-form {
    grid-template-columns: 1fr;
  }
}
</style>
