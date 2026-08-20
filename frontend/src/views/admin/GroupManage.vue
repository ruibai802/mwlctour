<script setup>
import { ref, onMounted } from 'vue'
import { getGroupList, createGroup, updateGroup, deleteGroup } from '../../api'

const groups = ref([])
const loading = ref(true)
const error = ref('')
const showForm = ref(false)
const editing = ref(null)
const form = ref({ name: '', description: '', sort: 0 })
const saving = ref(false)
const formError = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    groups.value = await getGroupList()
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}

function openCreate() {
  editing.value = null
  form.value = { name: '', description: '', sort: groups.value.length }
  formError.value = ''
  showForm.value = true
}

function openEdit(g) {
  editing.value = g
  form.value = { name: g.name, description: g.description || '', sort: g.sort }
  formError.value = ''
  showForm.value = true
}

async function save() {
  formError.value = ''
  if (!form.value.name.trim()) {
    formError.value = '请填写分组名称'
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await updateGroup(editing.value.id, form.value)
    } else {
      await createGroup(form.value)
    }
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  }
  saving.value = false
}

async function remove(g) {
  if (!confirm(`确认删除分组「${g.name}」？`)) return
  try {
    await deleteGroup(g.id)
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
      <span class="text-muted">按赛事组织比赛分组（如小组赛 A 组、淘汰赛等），创建比赛时可选</span>
      <div class="actions">
        <button class="btn btn-primary" @click="openCreate">＋ 添加分组</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>排序</th>
            <th>名称</th>
            <th>描述</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in groups" :key="g.id">
            <td class="mono">{{ g.sort }}</td>
            <td>{{ g.name }}</td>
            <td class="text-muted">{{ g.description || '-' }}</td>
            <td class="ops">
              <button class="btn btn-sm" @click="openEdit(g)">编辑</button>
              <button class="btn btn-sm btn-danger" @click="remove(g)">删除</button>
            </td>
          </tr>
          <tr v-if="!groups.length">
            <td colspan="4" class="empty-tip">暂无分组，点击右上角添加</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal">
        <h3>{{ editing ? '编辑分组' : '添加分组' }}</h3>
        <div class="form-row">
          <div class="form-group">
            <label>分组名称 *</label>
            <input v-model="form.name" class="form-control" placeholder="如：小组赛 A 组" />
          </div>
          <div class="form-group" style="max-width: 120px">
            <label>排序</label>
            <input v-model.number="form.sort" type="number" class="form-control" />
          </div>
        </div>
        <div class="form-group">
          <label>描述</label>
          <input v-model="form.description" class="form-control" placeholder="可选" />
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

.error {
  color: var(--red);
  margin-bottom: 12px;
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
  max-width: 460px;
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