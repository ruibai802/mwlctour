<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getMatch, updateMatch,
  getGroupList, getTeamList, getStaff, getPlayers,
  addMatchStaff, updateMatchStaff, removeMatchStaff,
  addMatchPlayer, removeMatchPlayer,
  addMatchVideo, updateVideo, deleteVideo
} from '../../api'

const route = useRoute()
const router = useRouter()

// 返回：优先历史记录，否则管理员回比赛列表、其他身份回工作台
function backToList() {
  const canBack = router.options.history.state.back
  if (canBack) router.back()
  else router.push('/dashboard')
}

const STATUS_OPTIONS = [
  { value: 'scheduled', label: '待开赛' },
  { value: 'ongoing', label: '进行中' },
  { value: 'completed', label: '已结束' },
  { value: 'cancelled', label: '已取消' }
]

const STAFF_ROLES = [
  { value: 'referee', label: '裁判' },
  { value: 'recorder', label: '录像' },
  { value: 'referee_chief', label: '裁判长' },
  { value: 'coordinator', label: '统筹' },
  { value: 'other', label: '其他' }
]

const match = ref(null)
const groups = ref([])
const teams = ref([])

// 对阵双方名字：优先从对阵名（如 "左卫门 VS 王"）解析，回退队伍字段名
const matchupParts = computed(() => {
  const m = String((match.value && match.value.matchup) || '').match(/^\s*(.+?)\s*(?:VS|vs|对)\s*(.+?)\s*$/)
  if (m && m[1].trim() && m[2].trim()) return [m[1].trim(), m[2].trim()]
  return [match.value && match.value.team_a_name, match.value && match.value.team_b_name]
})
const staffList = ref([])
const players = ref([])
const loading = ref(true)
const error = ref('')

const showForm = ref(false)
const form = ref({})
const saving = ref(false)
const formError = ref('')

const showStaffForm = ref(false)
const staffForm = ref({ staff_id: '', role: 'referee', remark: '' })
const staffSaving = ref(false)
const staffError = ref('')

const showPlayerForm = ref(false)
const playerForm = ref({ player_id: '', side: 'a', slot: '' })
const playerSaving = ref(false)
const playerError = ref('')

const showVideoForm = ref(false)
const editVideo = ref(null)
const videoForm = ref({ game_number: 1, title: '', url: '', platform: '' })
const videoSaving = ref(false)
const videoError = ref('')

const showPenaltyForm = ref(false)
const editPenalty = ref(null)

const roleLabel = (v) => (STAFF_ROLES.find((r) => r.value === v) || {}).label || v
const statusLabel = (v) => (STATUS_OPTIONS.find((s) => s.value === v) || {}).label || v
const groupName = (id) => {
  if (!id) return '—'
  const g = groups.value.find((x) => x.id === Number(id))
  return g ? g.name : '—'
}
const teamName = (id) => {
  if (!id) return '—'
  const t = teams.value.find((x) => x.id === Number(id))
  return t ? t.name : '—'
}
const fplayerName = (id) => {
  if (!id) return '—'
  const p = players.value.find((x) => x.id === Number(id))
  return p ? p.name : '—'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [m, g, t, s, p] = await Promise.all([
      getMatch(route.params.id),
      getGroupList(),
      getTeamList(),
      getStaff(),
      getPlayers()
    ])
    match.value = m
    groups.value = g
    teams.value = t
    staffList.value = s
    players.value = p
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

function openEdit() {
  const m = match.value
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
    score: m.score || '',
    winner: m.winner || '',
    status: m.status,
    remark: m.remark || ''
  }
  formError.value = ''
  showForm.value = true
}

async function save() {
  formError.value = ''
  saving.value = true
  try {
    await updateMatch(match.value.id, form.value)
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  }
  saving.value = false
}

function openStaffForm() {
  staffForm.value = { staff_id: '', role: 'referee', remark: '' }
  staffError.value = ''
  showStaffForm.value = true
}

async function saveStaff() {
  staffError.value = ''
  if (!staffForm.value.staff_id) {
    staffError.value = '请选择工作人员'
    return
  }
  staffSaving.value = true
  try {
    await addMatchStaff(match.value.id, staffForm.value)
    showStaffForm.value = false
    await load()
  } catch (e) {
    staffError.value = e.message
  }
  staffSaving.value = false
}

async function toggleStaffConfirm(ms) {
  try {
    await updateMatchStaff(match.value.id, ms.id, { confirmed: !ms.confirmed })
    await load()
  } catch (e) {
    error.value = e.message
  }
}

async function removeStaff(ms) {
  if (!confirm(`确认移除 ${ms.staff_name} 的本场${roleLabel(ms.role)}分配？`)) return
  try {
    await removeMatchStaff(match.value.id, ms.id)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

function openPlayerForm() {
  playerForm.value = { player_id: '', side: 'a', slot: '' }
  playerError.value = ''
  showPlayerForm.value = true
}

async function savePlayer() {
  playerError.value = ''
  if (!playerForm.value.player_id) {
    playerError.value = '请选择选手'
    return
  }
  playerSaving.value = true
  try {
    const payload = { ...playerForm.value }
    payload.team_id = playerForm.value.side === 'a' ? match.value.team_a_id : match.value.team_b_id
    await addMatchPlayer(match.value.id, payload)
    showPlayerForm.value = false
    await load()
  } catch (e) {
    playerError.value = e.message
  }
  playerSaving.value = false
}

async function removePlayer(mp) {
  if (!confirm(`确认将 ${mp.player_name} 移出本场出场名单？`)) return
  try {
    await removeMatchPlayer(match.value.id, mp.id)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

function openVideoCreate() {
  editVideo.value = null
  videoForm.value = { game_number: Math.max(1, (match.value.videos || []).length + 1), title: '', url: '', platform: '' }
  videoError.value = ''
  showVideoForm.value = true
}

function openVideoEdit(v) {
  editVideo.value = v
  videoForm.value = {
    game_number: v.game_number,
    title: v.title || '',
    url: v.url,
    platform: v.platform || ''
  }
  videoError.value = ''
  showVideoForm.value = true
}

async function saveVideo() {
  videoError.value = ''
  if (!videoForm.value.url.trim()) {
    videoError.value = '请填写视频链接'
    return
  }
  videoSaving.value = true
  try {
    if (editVideo.value) {
      await updateVideo(editVideo.value.id, videoForm.value)
    } else {
      await addMatchVideo(match.value.id, videoForm.value)
    }
    showVideoForm.value = false
    await load()
  } catch (e) {
    videoError.value = e.message
  }
  videoSaving.value = false
}

async function removeVideo(v) {
  if (!confirm(`确认删除视频链接「${v.title || v.url}」？`)) return
  try {
    await deleteVideo(v.id)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

onMounted(load)
</script>

<template>
  <div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="loading">加载中...</div>
    <template v-else-if="match">
      <div class="back-row">
        <button class="btn btn-sm" @click="backToList">← 返回</button>
        <span class="text-muted">分组：{{ groupName(match.group_id) }} · {{ match.round }}-{{ match.seq }} · 房间 {{ match.room || '—' }}</span>
        <span class="badge" :class="`badge-${match.status}`">{{ statusLabel(match.status) }}</span>
      </div>

      <div class="card match-head">
        <div class="matchup">
          <span class="team">{{ matchupParts[0] }}</span>
          <span class="vs">VS</span>
          <span class="team">{{ matchupParts[1] }}</span>
        </div>
        <div class="meta">
          <span v-if="match.matchup && !/VS|vs|对/.test(match.matchup)">{{ match.matchup }}</span>
          <span>{{ match.start_time || '时间待定' }}{{ match.end_time ? ' ~ ' + match.end_time : '' }}</span>
          <span v-if="match.map">地图：{{ match.map }}</span>
          <span v-if="match.score">比分：<b class="mono">{{ match.score }}</b></span>
          <span v-if="match.winner">胜者：{{ match.winner }}</span>
          <span v-if="match.remark">备注：{{ match.remark }}</span>
        </div>
        <button class="btn btn-sm" @click="openEdit">编辑比赛 / 录入比分</button>
      </div>

      <!-- 双方名单（自动提取自上传的选手名单） -->
      <div class="card-block roster-block">
        <div class="block-head">
          <h3>双方名单</h3>
          <span class="text-muted">自动提取自上传的选手名单（队伍管理）</span>
        </div>
        <div class="roster-grid">
          <div class="roster-team">
            <h4>{{ matchupParts[0] || 'A 队' }}</h4>
            <table v-if="match.team_a_players && match.team_a_players.length" class="table roster-table">
              <thead>
                <tr><th>位置</th><th>姓名</th><th>fanbook</th><th>游戏ID</th></tr>
              </thead>
              <tbody>
                <tr v-for="p in match.team_a_players" :key="p.id">
                  <td>{{ p.team_slot || p.slot || '—' }}</td>
                  <td>{{ p.name || '—' }}</td>
                  <td class="mono">{{ p.fanbook || '—' }}</td>
                  <td class="mono">{{ p.game_id || '—' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-muted">未关联队伍或暂无名单</p>
          </div>
          <div class="roster-team">
            <h4>{{ matchupParts[1] || 'B 队' }}</h4>
            <table v-if="match.team_b_players && match.team_b_players.length" class="table roster-table">
              <thead>
                <tr><th>位置</th><th>姓名</th><th>fanbook</th><th>游戏ID</th></tr>
              </thead>
              <tbody>
                <tr v-for="p in match.team_b_players" :key="p.id">
                  <td>{{ p.team_slot || p.slot || '—' }}</td>
                  <td>{{ p.name || '—' }}</td>
                  <td class="mono">{{ p.fanbook || '—' }}</td>
                  <td class="mono">{{ p.game_id || '—' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-muted">未关联队伍或暂无名单</p>
          </div>
        </div>
      </div>

      <!-- 工作人员 -->
      <div class="card-block">
        <div class="block-head">
          <h3>裁判 / 工作人员</h3>
          <button class="btn btn-sm btn-primary" @click="openStaffForm">＋ 分配工作人员</button>
        </div>
        <table v-if="match.staff.length" class="table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>岗位</th>
              <th>已确认</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ms in match.staff" :key="ms.id">
              <td>{{ ms.staff_name }}</td>
              <td>{{ roleLabel(ms.role) }}</td>
              <td>
                <label class="check-inline">
                  <input type="checkbox" :checked="!!ms.confirmed" @change="toggleStaffConfirm(ms)" />
                  {{ ms.confirmed ? '已确认' : '未确认' }}
                </label>
              </td>
              <td class="text-muted">{{ ms.ms_remark || '-' }}</td>
              <td class="ops">
                <button class="btn btn-sm btn-danger" @click="removeStaff(ms)">移除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty-tip">尚未分配工作人员</p>
      </div>

      <!-- 出场选手 -->
      <div class="card-block">
        <div class="block-head">
          <h3>出场选手</h3>
          <button class="btn btn-sm btn-primary" @click="openPlayerForm">＋ 添加出场选手</button>
        </div>
        <table v-if="match.players.length" class="table">
          <thead>
            <tr>
              <th>阵营</th>
              <th>选手</th>
              <th>fanbook</th>
              <th>队伍</th>
              <th>位置</th>
              <th>确认</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="mp in match.players" :key="mp.id">
              <td>
                <span class="side-pill" :class="mp.side === 'a' ? 'side-a' : 'side-b'">{{ mp.side === 'a' ? 'A' : 'B' }}</span>
              </td>
              <td>{{ mp.player_name }}</td>
              <td class="mono">{{ mp.fanbook || '-' }}</td>
              <td>{{ mp.team_name || '-' }}</td>
              <td class="mono">{{ mp.slot || '-' }}</td>
              <td><span class="text-muted">{{ mp.confirmed ? '已确认' : '未确认' }}</span></td>
              <td class="ops">
                <button class="btn btn-sm btn-danger" @click="removePlayer(mp)">移除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty-tip">尚未添加上场选手（可从选手名单选择）</p>
      </div>

      <!-- 视频链接 -->
      <div class="card-block">
        <div class="block-head">
          <h3>视频链接</h3>
          <button class="btn btn-sm btn-primary" @click="openVideoCreate">＋ 添加视频</button>
        </div>
        <table v-if="match.videos.length" class="table">
          <thead>
            <tr>
              <th>局数</th>
              <th>标题</th>
              <th>链接</th>
              <th>平台</th>
              <th>上传人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in match.videos" :key="v.id">
              <td class="mono">第 {{ v.game_number }} 局</td>
              <td>{{ v.title || '-' }}</td>
              <td><a :href="v.url" target="_blank" rel="noopener" class="link">{{ v.url }}</a></td>
              <td>{{ v.platform || '-' }}</td>
              <td class="text-muted">{{ v.uploaded_by || '-' }}</td>
              <td class="ops">
                <button class="btn btn-sm" @click="openVideoEdit(v)">编辑</button>
                <button class="btn btn-sm btn-danger" @click="removeVideo(v)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty-tip">暂无视频链接</p>
      </div>

      <!-- 编辑比赛 -->
      <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
        <div class="modal wide">
          <h3>编辑比赛</h3>
          <div class="form-row">
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
              <label>对局名称</label>
              <input v-model="form.matchup" class="form-control" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>A 队</label>
              <select v-model="form.team_a_id" class="form-control">
                <option value="">— 无 —</option>
                <option v-for="t in teams" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>B 队</label>
              <select v-model="form.team_b_id" class="form-control">
                <option value="">— 无 —</option>
                <option v-for="t in teams" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>开始时间</label>
              <input v-model="form.start_time" class="form-control" />
            </div>
            <div class="form-group">
              <label>结束时间</label>
              <input v-model="form.end_time" class="form-control" />
            </div>
            <div class="form-group">
              <label>地图</label>
              <input v-model="form.map" class="form-control" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="max-width: 160px">
              <label>比分（如 3:2；1:0 或 0:1 自动标记弃权）</label>
              <input v-model="form.score" class="form-control" />
            </div>
            <div class="form-group">
              <label>结束时间</label>
              <input v-model="form.end_time" class="form-control" />
            </div>
          </div>
          <p class="text-muted" style="margin-bottom: 8px">填写比分保存后，将自动判定胜者并填入胜者栏、状态自动变为「已完成」</p>
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

      <!-- 分配工作人员 -->
      <div v-if="showStaffForm" class="modal-mask" @click.self="showStaffForm = false">
        <div class="modal">
          <h3>分配工作人员</h3>
          <div class="form-group">
            <label>工作人员 *</label>
            <select v-model="staffForm.staff_id" class="form-control">
              <option value="">— 选择 —</option>
              <option v-for="s in staffList" :key="s.id" :value="String(s.id)">{{ s.name }}（{{ s.title || '未填身份' }}）</option>
            </select>
          </div>
          <div class="form-group">
            <label>岗位</label>
            <select v-model="staffForm.role" class="form-control">
              <option v-for="r in STAFF_ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>备注</label>
            <input v-model="staffForm.remark" class="form-control" />
          </div>
          <p v-if="staffError" class="error">{{ staffError }}</p>
          <div class="modal-actions">
            <button class="btn" @click="showStaffForm = false">取消</button>
            <button class="btn btn-primary" :disabled="staffSaving" @click="saveStaff">{{ staffSaving ? '保存中...' : '分配' }}</button>
          </div>
        </div>
      </div>

      <!-- 添加出场选手 -->
      <div v-if="showPlayerForm" class="modal-mask" @click.self="showPlayerForm = false">
        <div class="modal">
          <h3>添加出场选手</h3>
          <div class="form-group">
            <label>选手 *</label>
            <select v-model="playerForm.player_id" class="form-control">
              <option value="">— 选择 —</option>
              <option v-for="p in players" :key="p.id" :value="String(p.id)">
                {{ p.name }}{{ p.fanbook ? `（${p.fanbook}）` : '' }} · {{ p.team || '未分队' }}
              </option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>阵营</label>
              <select v-model="playerForm.side" class="form-control">
                <option value="a">A 队（{{ match.team_a_name }}）</option>
                <option value="b">B 队（{{ match.team_b_name }}）</option>
              </select>
            </div>
            <div class="form-group">
              <label>位置</label>
              <input v-model="playerForm.slot" class="form-control" placeholder="如 P1" />
            </div>
          </div>
          <p v-if="playerError" class="error">{{ playerError }}</p>
          <div class="modal-actions">
            <button class="btn" @click="showPlayerForm = false">取消</button>
            <button class="btn btn-primary" :disabled="playerSaving" @click="savePlayer">{{ playerSaving ? '保存中...' : '添加' }}</button>
          </div>
        </div>
      </div>

      <!-- 视频表单 -->
      <div v-if="showVideoForm" class="modal-mask" @click.self="showVideoForm = false">
        <div class="modal">
          <h3>{{ editVideo ? '编辑视频链接' : '添加视频链接' }}</h3>
          <div class="form-row">
            <div class="form-group" style="max-width: 130px">
              <label>局数</label>
              <input v-model.number="videoForm.game_number" type="number" class="form-control" />
            </div>
            <div class="form-group">
              <label>平台</label>
              <input v-model="videoForm.platform" class="form-control" placeholder="如 B站/抖音" />
            </div>
          </div>
          <div class="form-group">
            <label>标题</label>
            <input v-model="videoForm.title" class="form-control" placeholder="如：第一局回放" />
          </div>
          <div class="form-group">
            <label>视频链接 *</label>
            <input v-model="videoForm.url" class="form-control" placeholder="https://..." />
          </div>
          <p v-if="videoError" class="error">{{ videoError }}</p>
          <div class="modal-actions">
            <button class="btn" @click="showVideoForm = false">取消</button>
            <button class="btn btn-primary" :disabled="videoSaving" @click="saveVideo">{{ videoSaving ? '保存中...' : '保存' }}</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.error {
  color: var(--red);
  margin-bottom: 12px;
}

.back-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.match-head {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.matchup {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 600;
}

.roster-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.roster-team h4 {
  margin-bottom: 8px;
  color: var(--accent);
}

.roster-table {
  font-size: 13px;
}

.roster-table .mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: var(--text-sub);
  font-size: 12px;
}

.vs {
  color: var(--text-dim);
  font-size: 13px;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  color: var(--text-sub);
  font-size: 13px;
  flex: 1;
}

.card-block {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 14px;
  overflow-x: auto;
}

.block-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.block-head h3 {
  font-size: 15px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.table th {
  text-align: left;
  padding: 10px 14px;
  background: rgba(148, 163, 184, 0.08);
  color: var(--text-sub);
  font-weight: 500;
  white-space: nowrap;
}

.table td {
  padding: 10px 14px;
  border-top: 1px solid var(--border);
}

.ops {
  display: flex;
  gap: 6px;
}

.empty-tip {
  color: var(--text-dim);
  text-align: center;
  padding: 20px 0;
}

.mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.link {
  color: var(--accent);
  word-break: break-all;
}

.check-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
}

.check-inline input {
  accent-color: var(--accent);
}

.side-pill {
  display: inline-block;
  width: 26px;
  height: 26px;
  line-height: 26px;
  text-align: center;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.side-a {
  background: linear-gradient(135deg, #38bdf8, #2563eb);
}

.side-b {
  background: linear-gradient(135deg, #f472b6, #a855f7);
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