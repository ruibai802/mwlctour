<script setup>
import { ref, onMounted } from 'vue'
import { getSettings, updateSettings } from '../../api'

const settings = ref({ tournament_name: '', rules_background: '', maps: [] })
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const err = ref('')

async function load() {
  loading.value = true
  try {
    settings.value = await getSettings()
  } catch (e) {
    err.value = e.message
  }
  loading.value = false
}

async function saveName() {
  saving.value = true
  msg.value = ''
  err.value = ''
  try {
    await updateSettings({ tournament_name: settings.value.tournament_name })
    msg.value = '赛事名称已保存 ✅'
    document.title = `${settings.value.tournament_name} - MWLC赛事协助系统`
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) {
    err.value = e.message
  }
  saving.value = false
}

onMounted(load)
</script>

<template>
  <div>
    <div class="card settings-card">
      <h3>赛事名称</h3>
      <p class="text-muted" style="margin-bottom:14px">自定义比赛名称，将显示在规则页顶部、日程简略版与详情页中</p>
      <div class="name-row">
        <input v-model="settings.tournament_name" class="form-control name-input" placeholder="输入赛事名称" @keyup.enter="saveName" />
        <button class="btn btn-primary" :disabled="saving" @click="saveName">{{ saving ? '保存中...' : '保存' }}</button>
      </div>
      <p v-if="msg" class="success">{{ msg }}</p>
      <p v-if="err" class="error">{{ err }}</p>
    </div>

    <div class="card settings-card">
      <h3>使用提示</h3>
      <ul class="tips">
        <li>在「选手名单」页批量导入或单个录入选手，创建日程时可一键选择队伍自动填充队员信息</li>
        <li>在「成员管理」页可批量导入裁判/录像名单（支持 fanbookID、姓名、身份、角色列）</li>
        <li>在「数据上传」页上传横幅、选手名单文件，并管理比赛地图</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.settings-card {
  margin-bottom: 16px;
}

.settings-card h3 {
  margin-bottom: 12px;
}

.name-row {
  display: flex;
  gap: 10px;
}

.name-input {
  max-width: 380px;
}

.success {
  color: var(--green);
  margin-top: 12px;
}

.error {
  color: var(--red);
  margin-top: 12px;
}

.tips {
  padding-left: 20px;
  color: var(--text-sub);
  line-height: 2;
  font-size: 14px;
}
</style>
