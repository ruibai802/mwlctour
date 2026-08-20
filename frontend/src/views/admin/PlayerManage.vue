<script setup>
import { ref, computed, onMounted } from 'vue'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { getTeams, createPlayer, updatePlayer, deletePlayer, importPlayers, batchDeletePlayers } from '../../api'

const teams = ref([])
const loading = ref(true)
const error = ref('')

const filter = ref('')
const selected = ref({})
const showForm = ref(false)
const editing = ref(null)
const form = ref({ team: '', name: '', fanbook: '', game_id: '', slot: 'P1' })
const saving = ref(false)
const formError = ref('')

const SLOTS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']
const SLOT_COLORS = { P1: 'badge-referee', P2: 'badge-admin', P3: 'badge-recorder', P4: 'badge-staff', P5: 'badge-staff', P6: 'badge-staff', P7: 'badge-staff' }

const importOpen = ref(false)
const fileName = ref('')
const parsed = ref({ columns: [], rows: [] })
const mapping = ref({ team: '', name: '', fanbook: '', game_id: '', slot: '' })
const defaultSlot = ref('')
const importError = ref('')
const importMsg = ref('')

function normalizeSlot(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  if (/^P\d$/i.test(s)) return s.toUpperCase()
  const m = s.match(/^(\d)$/)
  if (m && m[1] >= 1 && m[1] <= 7) return `P${m[1]}`
  const cn = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7 }
  const cm = s.match(/^([一二三四五六七])/)
  if (cm && cn[cm[1]]) return `P${cn[cm[1]]}`
  return s.toUpperCase()
}

const FIELD_LABELS = {
  team: '队伍名',
  name: '选手姓名',
  fanbook: 'fanbookID',
  game_id: '游戏ID',
  slot: '位置(P1-P7)'
}

const filteredTeams = computed(() => {
  if (!filter.value) return teams.value
  return teams.value.filter((t) => t.team === filter.value)
})

const selectedCount = computed(() => Object.values(selected.value).filter(Boolean).length)

const allPlayers = computed(() => teams.value.flatMap((t) => t.players))

function toggleSelectAll() {
  const visible = allPlayers.value
  const allSelected = visible.length > 0 && visible.every((p) => selected.value[p.id])
  selected.value = {}
  if (!allSelected) {
    for (const p of visible) selected.value[p.id] = true
  }
}

async function removeSelected() {
  const ids = Object.keys(selected.value).filter((id) => selected.value[id]).map(Number)
  if (!ids.length) return
  if (!confirm(`确认删除选中的 ${ids.length} 名选手？`)) return
  try {
    await batchDeletePlayers(ids)
    selected.value = {}
    await load()
  } catch (e) {
    error.value = e.message
  }
}

const allTeams = computed(() => teams.value.map((t) => t.team))

const autoMatch = (col) => {
  const c = String(col).toLowerCase()
  if (/队/.test(c) || c.includes('team') || c.includes('club')) return 'team'
  if (/名字|姓名|名称|选手|player|name/.test(c)) return 'name'
  if (/fanbook|fb|粉丝号/.test(c)) return 'fanbook'
  if (/id|编号|账号|游戏id|uid/.test(c) && !/fanbook/.test(c)) return 'game_id'
  if (/身份|位置|角色|slot|替补|队长/.test(c)) return 'slot'
  return ''
}

function parseFile(file) {
  importError.value = ''
  importMsg.value = ''
  defaultSlot.value = ''
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
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      onRows(rows)
    }
    reader.readAsArrayBuffer(file)
  }
}

const previewRows = computed(() => parsed.value.rows.slice(0, 5))

function buildImportList() {
  const m = mapping.value
  const list = []
  for (const row of parsed.value.rows) {
    const item = {}
    for (const field of Object.keys(m)) {
      const col = m[field]
      if (col) item[field] = row[col]
    }
    if (!item.team && !item.name && !item.fanbook && !item.game_id) continue
    const slot = normalizeSlot(item.slot)
    if (SLOTS.includes(slot)) {
      item.slot = slot
    } else if (defaultSlot.value && SLOTS.includes(normalizeSlot(defaultSlot.value))) {
      item.slot = normalizeSlot(defaultSlot.value)
    } else {
      item.slot = ''
    }
    list.push(item)
  }
  return list
}

async function doImport() {
  importError.value = ''
  importMsg.value = ''
  const required = ['team', 'name']
  for (const f of required) {
    if (!mapping.value[f]) {
      importError.value = `请为「${FIELD_LABELS[f]}」选择对应列`
      return
    }
  }
  const list = buildImportList()
  if (!list.length) {
    importError.value = '没有可导入的数据行'
    return
  }
  try {
    const res = await importPlayers(list)
    importMsg.value = res.message
    await load()
  } catch (e) {
    importError.value = e.message
  }
}

function openCreate() {
  editing.value = null
  form.value = { team: filter.value || '', name: '', fanbook: '', game_id: '', slot: 'P1' }
  formError.value = ''
  showForm.value = true
}

function openEdit(p) {
  editing.value = p
  form.value = { team: p.team, name: p.name, fanbook: p.fanbook, game_id: p.game_id, slot: p.slot }
  formError.value = ''
  showForm.value = true
}

async function save() {
  formError.value = ''
  if (!form.value.team || (!form.value.name && !form.value.fanbook && !form.value.game_id)) {
    formError.value = '请填写队伍名和至少一项选手信息'
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await updatePlayer(editing.value.id, form.value)
    } else {
      await createPlayer(form.value)
    }
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  }
  saving.value = false
}

async function remove(p) {
  if (!confirm(`确认删除选手 ${p.name || p.fanbook}（${p.team}）？`)) return
  try {
    await deletePlayer(p.id)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    teams.value = await getTeams()
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <div class="filters">
        <select v-model="filter" class="form-control filter">
          <option value="">全部队伍</option>
          <option v-for="t in allTeams" :key="t" :value="t">{{ t }}</option>
        </select>
        <label class="select-all">
          <input type="checkbox" :checked="allPlayers.length > 0 && allPlayers.every((p) => selected[p.id])"
            @change="toggleSelectAll" />
          全选
        </label>
        <span v-if="selectedCount" class="text-muted">已选 {{ selectedCount }} 人</span>
      </div>
      <div class="actions">
        <button v-if="selectedCount" class="btn btn-sm btn-danger" @click="removeSelected">批量删除（{{ selectedCount }}）</button>
        <label class="btn btn-sm import-btn">
          批量导入
          <input type="file" accept=".csv,.txt,.xlsx,.xls" class="hidden-input" @change="(e) => e.target.files[0] && parseFile(e.target.files[0])" />
        </label>
        <button class="btn btn-sm btn-primary" @click="openCreate">＋ 新增选手</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!filteredTeams.length" class="empty">暂无选手名单，请批量导入或单个新增</div>
    <div v-else class="team-list">
      <div v-for="t in filteredTeams" :key="t.team" class="card team-card">
        <div class="team-head">
          <h3 class="team-name">{{ t.team }}</h3>
          <span class="text-muted">{{ t.players.length }} 人</span>
        </div>
        <div class="player-table">
          <div v-for="p in t.players" :key="p.id" class="player-row">
            <span class="select-cell">
              <input type="checkbox" v-model="selected[p.id]" />
            </span>
            <span class="badge" :class="SLOT_COLORS[p.slot] || 'badge-guest'">{{ p.slot || '未分' }}</span>
            <span class="p-name">{{ p.name || '-' }}</span>
            <span class="p-fb mono">@{{ p.fanbook || '-' }}</span>
            <span class="p-id mono">{{ p.game_id || '-' }}</span>
            <span class="p-ops">
              <button class="btn btn-sm" @click="openEdit(p)">编辑</button>
              <button class="btn btn-sm btn-danger" @click="remove(p)">删除</button>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 单条表单 -->
    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal">
        <h3>{{ editing ? '编辑选手' : '新增选手' }}</h3>
        <div class="form-group">
          <label>队伍名 *</label>
          <input v-model="form.team" class="form-control" list="team-list-options" placeholder="输入或选择队伍" />
          <datalist id="team-list-options">
            <option v-for="t in allTeams" :key="t" :value="t" />
          </datalist>
        </div>
        <div class="form-group">
          <label>选手姓名</label>
          <input v-model="form.name" class="form-control" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>fanbookID</label>
            <input v-model="form.fanbook" class="form-control" />
          </div>
          <div class="form-group">
            <label>游戏ID</label>
            <input v-model="form.game_id" class="form-control" />
          </div>
        </div>
        <div class="form-group">
          <label>位置（P1-P7）</label>
          <div class="slot-options">
            <button v-for="s in SLOTS" :key="s" class="slot-btn" :class="{ active: form.slot === s }" @click="form.slot = s">{{ s }}</button>
          </div>
        </div>
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
        <h3>批量导入选手名单</h3>
        <p class="text-muted" style="margin-bottom:14px">文件：{{ fileName }} · 共 {{ parsed.rows.length }} 行，请将列映射到系统字段。<b>导入后按「队伍名」自动同步到队伍管理（自动建队并关联队员）。</b></p>
        <div class="map-grid">
          <div v-for="(label, field) in FIELD_LABELS" :key="field" class="form-group">
            <label>{{ label }} <span v-if="field === 'team' || field === 'name'" class="req">*</span></label>
            <select v-model="mapping[field]" class="form-control">
              <option value="">— 不导入 —</option>
              <option v-for="c in parsed.columns" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>位置缺失时默认填入（P1-P7，留空则保持未分）</label>
          <div class="slot-options">
            <button v-for="s in SLOTS" :key="s" class="slot-btn" :class="{ active: defaultSlot === s }" @click="defaultSlot = s === defaultSlot ? '' : s">{{ s }}</button>
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

.filters {
  display: flex;
  gap: 10px;
}

.filter {
  width: 160px;
}

.actions {
  display: flex;
  gap: 8px;
}

.import-btn {
  position: relative;
}

.hidden-input {
  display: none;
}

.error {
  color: var(--red);
  margin-bottom: 12px;
}

.success {
  color: var(--green);
  margin-bottom: 12px;
}

.team-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.team-card {
  padding: 16px;
}

.team-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.team-name {
  background: linear-gradient(90deg, #e0f2fe, var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 18px;
}

.player-row {
  display: grid;
  grid-template-columns: 36px 70px 1fr 130px 120px auto;
  gap: 10px;
  align-items: center;
  padding: 9px 12px;
  border-top: 1px solid var(--border);
  font-size: 14px;
}

.select-cell {
  display: flex;
  align-items: center;
}

.select-cell input,
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

.player-row:hover {
  background: rgba(56, 189, 248, 0.05);
}

.p-name {
  font-weight: 500;
}

.mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: var(--text-sub);
  font-size: 13px;
}

.p-ops {
  display: flex;
  gap: 6px;
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
  max-width: 520px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.1);
}

.modal.wide {
  max-width: 760px;
}

.modal h3 {
  margin-bottom: 16px;
}

.req {
  color: var(--red);
}

.slot-options {
  display: flex;
  gap: 8px;
}

.slot-btn {
  padding: 7px 18px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-elev);
  color: var(--text-sub);
  font-size: 13px;
  transition: all 0.15s;
}

.slot-btn:hover {
  border-color: var(--accent);
}

.slot-btn.active {
  background: var(--accent-grad);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.35);
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

@media (max-width: 760px) {
  .player-row {
    grid-template-columns: 36px 60px 1fr auto;
  }
  .p-fb, .p-id {
    display: none;
  }
}
</style>
