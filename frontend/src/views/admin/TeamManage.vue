<script setup>
import { ref, onMounted } from 'vue'
import {
  getTeamList, getTeamDetail, createTeam, updateTeam, deleteTeam,
  addTeamPlayer, updateTeamPlayer, removeTeamPlayer
} from '../../api'

const teams = ref([])
const loading = ref(true)
const error = ref('')

const selected = ref(null)
const detail = ref(null)
const detailLoading = ref(false)

const showForm = ref(false)
const editing = ref(null)
const form = ref({ name: '', short_name: '', captain: '', color: '', sort: 0, status: 'active', remark: '' })
const saving = ref(false)
const formError = ref('')

const showAddPlayer = ref(false)
const addForm = ref({ player_id: '', slot: '' })
const addSaving = ref(false)
const addError = ref('')

const editSlotOf = ref(null)
const slotValue = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    teams.value = await getTeamList()
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

async function selectTeam(t) {
  selected.value = t
  detailLoading.value = true
  try {
    detail.value = await getTeamDetail(t.id)
  } catch (e) {
    error.value = e.message
    detail.value = null
  }
  detailLoading.value = false
}

function openCreate() {
  editing.value = null
  form.value = { name: '', short_name: '', captain: '', color: '', sort: teams.value.length, status: 'active', remark: '' }
  formError.value = ''
  showForm.value = true
}

function openEdit(t) {
  editing.value = t
  form.value = {
    name: t.name,
    short_name: t.short_name || '',
    captain: t.captain || '',
    color: t.color || '',
    sort: t.sort,
    status: t.status || 'active',
    remark: t.remark || ''
  }
  formError.value = ''
  showForm.value = true
}

async function save() {
  formError.value = ''
  if (!form.value.name.trim()) {
    formError.value = '请填写队伍名称'
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await updateTeam(editing.value.id, form.value)
    } else {
      await createTeam(form.value)
    }
    showForm.value = false
    await load()
    if (selected.value) await selectTeam(teams.value.find((t) => t.id === selected.value.id))
  } catch (e) {
    formError.value = e.message
  }
  saving.value = false
}

async function remove(t) {
  if (!confirm(`确认删除队伍「${t.name}」？`)) return
  try {
    await deleteTeam(t.id)
    if (selected.value && selected.value.id === t.id) {
      selected.value = null
      detail.value = null
    }
    await load()
  } catch (e) {
    error.value = e.message
  }
}

function openAddPlayer() {
  addForm.value = { player_id: '', slot: '' }
  addError.value = ''
  showAddPlayer.value = true
}

async function saveAddPlayer() {
  addError.value = ''
  if (!addForm.value.player_id) {
    addError.value = '请选择选手'
    return
  }
  addSaving.value = true
  try {
    await addTeamPlayer(selected.value.id, addForm.value)
    showAddPlayer.value = false
    await selectTeam(selected.value)
  } catch (e) {
    addError.value = e.message
  }
  addSaving.value = false
}

function openSlotEdit(tp) {
  editSlotOf.value = tp
  slotValue.value = tp.slot
}

async function saveSlot(tp) {
  try {
    await updateTeamPlayer(tp.team_player_id, { slot: slotValue.value, remark: tp.tp_remark })
    editSlotOf.value = null
    await selectTeam(selected.value)
  } catch (e) {
    error.value = e.message
  }
}

async function removePlayer(tp) {
  if (!confirm(`确认将 ${tp.name} 移出队伍？`)) return
  try {
    await removeTeamPlayer(tp.team_player_id)
    await selectTeam(selected.value)
  } catch (e) {
    error.value = e.message
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="toolbar">
      <span class="text-muted">赛事参赛队伍；队员从「选手名单」中挑选加入并指定位置</span>
      <div class="actions">
        <button class="btn btn-primary" @click="openCreate">＋ 添加队伍</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="team-layout">
      <!-- 队伍列表 -->
      <div class="card table-wrap left">
        <table class="table">
          <thead>
            <tr>
              <th>队伍</th>
              <th>人数</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="t in teams"
              :key="t.id"
              :class="{ rowActive: selected && selected.id === t.id }"
              @click="selectTeam(t)"
            >
              <td>
                {{ t.name }}
                <span v-if="t.short_name" class="short-pill">{{ t.short_name }}</span>
              </td>
              <td class="mono">{{ t.player_count }}</td>
              <td><span class="badge" :class="`badge-${t.status}`">{{ t.status === 'active' ? '参赛' : '停用' }}</span></td>
              <td class="ops" @click.stop>
                <button class="btn btn-sm" @click="openEdit(t)">编辑</button>
                <button class="btn btn-sm btn-danger" @click="remove(t)">删除</button>
              </td>
            </tr>
            <tr v-if="!teams.length">
              <td colspan="4" class="empty-tip">暂无队伍</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 队伍详情 -->
      <div class="card right">
        <template v-if="!selected">
          <div class="empty-tip">← 点击左侧队伍查看队员</div>
        </template>
        <template v-else-if="detailLoading">
          <div class="loading">加载中...</div>
        </template>
        <template v-else>
          <div class="detail-head">
            <h3>{{ detail.team.name }}</h3>
            <button class="btn btn-sm btn-primary" @click="openAddPlayer">＋ 加入选手</button>
          </div>
          <p class="text-muted" style="margin-bottom: 12px">
            {{ detail.team.short_name ? '简称 ' + detail.team.short_name + ' · ' : '' }}队长：{{ detail.team.captain || '未设置' }}
          </p>
          <table class="table">
            <thead>
              <tr>
                <th>选手</th>
                <th>fanbook</th>
                <th>名单位置</th>
                <th>队伍位置</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in detail.players" :key="p.team_player_id">
                <td>{{ p.name }}</td>
                <td class="mono">{{ p.fanbook || '-' }}</td>
                <td class="mono">{{ p.player_slot || '-' }}</td>
                <td>
                  <template v-if="editSlotOf && editSlotOf.team_player_id === p.team_player_id">
                    <input v-model="slotValue" class="form-control slot-input" placeholder="如 A1 / P1" @keyup.enter="saveSlot(p)" />
                    <button class="btn btn-sm btn-primary" @click="saveSlot(p)">确定</button>
                  </template>
                  <template v-else>
                    <span class="mono">{{ p.slot || '-' }}</span>
                    <button class="btn btn-sm" @click="openSlotEdit(p)">改</button>
                  </template>
                </td>
                <td class="ops">
                  <button class="btn btn-sm btn-danger" @click="removePlayer(p)">移出</button>
                </td>
              </tr>
              <tr v-if="!detail.players.length">
                <td colspan="5" class="empty-tip">队伍暂无队员</td>
              </tr>
            </tbody>
          </table>
          <p v-if="detail.candidates.length" class="text-muted cand-tip">另有 {{ detail.candidates.length }} 名未入队选手可加入</p>
        </template>
      </div>
    </div>

    <!-- 队伍表单 -->
    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal">
        <h3>{{ editing ? '编辑队伍' : '添加队伍' }}</h3>
        <div class="form-row">
          <div class="form-group">
            <label>队伍名称 *</label>
            <input v-model="form.name" class="form-control" />
          </div>
          <div class="form-group" style="max-width: 140px">
            <label>简称</label>
            <input v-model="form.short_name" class="form-control" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>队长</label>
            <input v-model="form.captain" class="form-control" />
          </div>
          <div class="form-group" style="max-width: 160px">
            <label>队伍颜色</label>
            <input v-model="form.color" type="color" class="form-control" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="max-width: 120px">
            <label>排序</label>
            <input v-model.number="form.sort" type="number" class="form-control" />
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="form.status" class="form-control">
              <option value="active">参赛</option>
              <option value="inactive">停用</option>
            </select>
          </div>
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

    <!-- 加入选手 -->
    <div v-if="showAddPlayer" class="modal-mask" @click.self="showAddPlayer = false">
      <div class="modal">
        <h3>加入选手到「{{ selected ? selected.name : '' }}」</h3>
        <div class="form-group">
          <label>选手 *</label>
          <select v-model="addForm.player_id" class="form-control">
            <option value="">— 选择 —</option>
            <option v-for="c in detail.candidates" :key="c.id" :value="String(c.id)">
              {{ c.name }}{{ c.fanbook ? `（${c.fanbook}）` : '' }} · {{ c.team || '未分队' }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>队伍位置（如 A1 / P1，可选）</label>
          <input v-model="addForm.slot" class="form-control" placeholder="如 P1" />
        </div>
        <p v-if="addError" class="error">{{ addError }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showAddPlayer = false">取消</button>
          <button class="btn btn-primary" :disabled="addSaving" @click="saveAddPlayer">{{ addSaving ? '保存中...' : '加入' }}</button>
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

.team-layout {
  display: grid;
  grid-template-columns: minmax(320px, 380px) 1fr;
  gap: 14px;
  align-items: start;
}

@media (max-width: 900px) {
  .team-layout {
    grid-template-columns: 1fr;
  }
}

.left {
  padding: 0;
  overflow-x: auto;
}

.right {
  min-height: 200px;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.detail-head h3 {
  font-size: 16px;
}

.short-pill {
  display: inline-block;
  background: rgba(56, 189, 248, 0.14);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: var(--accent);
  font-size: 12px;
  padding: 0 8px;
  border-radius: 999px;
  margin-left: 6px;
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

tr.rowActive td {
  background: rgba(56, 189, 248, 0.08);
}

tr.rowActive {
  cursor: pointer;
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

.cand-tip {
  margin-top: 10px;
  font-size: 13px;
}

.slot-input {
  display: inline-block;
  width: 80px;
  margin-right: 6px;
  padding: 4px 8px;
}

.mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
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