<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Image from '../../editor/imageExtension'
import { getRules, createRule as apiCreateRule, updateRule as apiUpdateRule, deleteRule as apiDeleteRule, uploadEditorImage, getUploads, deleteUpload } from '../../api'

const rulesList = ref([])
const currentRuleId = ref(null)
const currentRule = computed(() => rulesList.value.find((r) => String(r.id) === String(currentRuleId.value)) || rulesList.value[0] || null)
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const err = ref('')
const colorVal = ref('#000000')
const bgColorVal = ref('#ffffff')
const background = ref('')

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({ link: false }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https'
    }),
    Table.configure({
      resizable: false,
      allowTableNodeSelection: true
    }),
    TableRow,
    TableHeader,
    TableCell,
    Image
  ],
  editorProps: {
    attributes: {
      class: 'rules-editor-content'
    }
  }
})

const bgPresets = [
  { label: '默认', value: '' },
  { label: '白色', value: '#ffffff' },
  { label: '米色', value: '#fdf6e3' },
  { label: '浅蓝', value: '#e8f1fb' },
  { label: '浅绿', value: '#eef7ee' },
  { label: '浅粉', value: '#fbeef3' }
]

function isActive(name) {
  return editor.value?.isActive(name) ?? false
}

function setLink() {
  if (!editor.value) return
  const prev = editor.value.getAttributes('link').href
  const url = window.prompt('请输入链接地址', prev || 'https://')
  if (url === null) return
  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

function insertTable() {
  if (!editor.value) return
  editor.value
    .chain()
    .focus()
    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
    .run()
}

// 光标在表格单元格内时插入即为内嵌表格（TableCell 内容为 block+，天然支持嵌套）
function insertNestedTable() {
  if (!editor.value) return
  editor.value
    .chain()
    .focus()
    .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    .run()
}

// ---- 内嵌图片 ----
const imageInput = ref(null)
const uploadingImage = ref(false)
const imgError = ref('')

function pickImage() {
  imgError.value = ''
  imageInput.value?.click()
}

async function onInsertImage(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    imgError.value = '仅支持图片文件'
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    imgError.value = '图片不能超过 10MB'
    return
  }
  uploadingImage.value = true
  imgError.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    const up = await uploadEditorImage(fd)
    editor.value?.chain().focus().setImage({ src: up.path, alt: file.name }).run()
    msg.value = '图片已插入，可选中图片调整宽度'
    setTimeout(() => (msg.value = ''), 2500)
  } catch (err) {
    imgError.value = err.message
  }
  uploadingImage.value = false
}

const currentImageWidth = computed(() => {
  if (!editor.value) return ''
  return editor.value.getAttributes('image').width || ''
})

function applyImageWidth(e) {
  if (!editor.value) return
  const v = e.target.value
  editor.value.chain().focus().updateImage({ width: v || null }).run()
}

function removeImageOnly() {
  if (!editor.value) return
  editor.value.chain().focus().deleteNode('image').run()
}

async function removeImageFile() {
  const src = editor.value?.getAttributes('image').src || ''
  editor.value?.chain().focus().deleteNode('image').run()
  if (!src) return
  try {
    const list = await getUploads('editor-image')
    const rec = list.find((u) => u.path === src)
    if (rec) {
      await deleteUpload(rec.id)
      msg.value = '图片已从规则与服务器删除'
    }
    setTimeout(() => (msg.value = ''), 2500)
  } catch (err) {
    err.value = err.message
  }
}

function applyColor(e) {
  colorVal.value = e.target.value
  editor.value?.chain().focus().setColor(e.target.value).run()
}

function applyBgColor(e) {
  bgColorVal.value = e.target.value
  editor.value?.chain().focus().setHighlight({ color: e.target.value }).run()
}

async function save() {
  if (!currentRule.value) return
  saving.value = true
  msg.value = ''
  err.value = ''
  try {
    await apiUpdateRule(currentRule.value.id, {
      title: currentRule.value.title,
      content: editor.value?.getHTML() || '',
      background: background.value
    })
    msg.value = '保存成功 ✅'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) {
    err.value = e.message
  }
  saving.value = false
}

async function saveBg(value) {
  background.value = value
  try {
    await save()
    msg.value = '背景已更新 ✅'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) {
    err.value = e.message
  }
}

function applyRuleToEditor() {
  const r = currentRule.value
  background.value = (r && r.background) || ''
  if (editor.value) {
    editor.value.commands.setContent((r && r.content) || '')
  }
}

async function saveRuleContent(rule) {
  if (!rule || !editor.value) return
  await apiUpdateRule(rule.id, {
    title: rule.title,
    content: editor.value.getHTML() || '',
    background: background.value
  })
}

async function switchRule(id) {
  if (String(id) === String(currentRuleId.value)) return
  err.value = ''
  try {
    if (currentRule.value && editor.value) await saveRuleContent(currentRule.value)
    currentRuleId.value = String(id)
    applyRuleToEditor()
  } catch (e) {
    err.value = e.message
  }
}

async function createRule() {
  err.value = ''
  const title = window.prompt('请输入新规则的标题', '')
  if (title === null) return
  const t = String(title).trim()
  if (!t) { err.value = '标题不能为空'; return }
  try {
    if (currentRule.value && editor.value) await saveRuleContent(currentRule.value)
    const row = await apiCreateRule({ title: t })
    await loadRules()
    currentRuleId.value = String(row.id)
    applyRuleToEditor()
    msg.value = '规则已创建，可直接编辑内容'
    setTimeout(() => (msg.value = ''), 2500)
  } catch (e) {
    err.value = e.message
  }
}

async function renameRule() {
  if (!currentRule.value) return
  err.value = ''
  const title = window.prompt('请输入新的规则标题', currentRule.value.title)
  if (title === null) return
  const t = String(title).trim()
  if (!t) { err.value = '标题不能为空'; return }
  try {
    await saveRuleContent(currentRule.value)
    const r = currentRule.value
    await apiUpdateRule(r.id, { title: t })
    const idx = rulesList.value.findIndex((x) => x.id === r.id)
    if (idx >= 0) rulesList.value[idx] = { ...rulesList.value[idx], title: t }
    msg.value = '标题已更新'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) {
    err.value = e.message
  }
}

async function deleteRule() {
  if (!currentRule.value) return
  if (!window.confirm(`确定删除规则「${currentRule.value.title}」？删除后不可恢复。`)) return
  err.value = ''
  try {
    const id = currentRule.value.id
    await apiDeleteRule(id)
    await loadRules()
    currentRuleId.value = rulesList.value.length ? String(rulesList.value[0].id) : null
    applyRuleToEditor()
    msg.value = '规则已删除'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) {
    err.value = e.message
  }
}

async function loadRules() {
  const list = await getRules()
  rulesList.value = Array.isArray(list) ? list : []
  if (!rulesList.value.some((r) => String(r.id) === String(currentRuleId.value))) {
    currentRuleId.value = rulesList.value.length ? String(rulesList.value[0].id) : null
  }
}

onMounted(async () => {
  try {
    await loadRules()
    applyRuleToEditor()
  } catch (e) {
    err.value = e.message
  }
  loading.value = false
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div>
    <div class="toolbar-row">
      <div class="left">
        <span class="text-muted">富文本编辑，支持加粗/颜色/下划线/删除线等</span>
      </div>
      <div class="right">
        <span v-if="msg" class="success">{{ msg }}</span>
        <span v-if="err" class="error">{{ err }}</span>
        <span v-if="imgError" class="error">{{ imgError }}</span>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存规则' }}</button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else class="editor-wrap card">
      <div class="rules-manage">
        <div class="rules-manage-head">
          <span class="bg-label">规则：</span>
          <div class="rules-tabs">
            <button
              v-for="r in rulesList"
              :key="r.id"
              class="bg-preset"
              :class="{ active: String(currentRuleId) === String(r.id) }"
              @click="switchRule(r.id)"
            >{{ r.title }}</button>
            <span v-if="!rulesList.length" class="text-muted">暂无规则</span>
          </div>
          <div class="rules-actions">
            <button class="btn btn-sm btn-primary" @click="createRule">＋ 新建</button>
            <button class="btn btn-sm" @click="renameRule" :disabled="!currentRule">改名</button>
            <button class="btn btn-sm btn-danger" @click="deleteRule" :disabled="!currentRule">删除</button>
          </div>
        </div>
      </div>

      <div class="bg-config">
        <span class="bg-label">页面背景：</span>
        <button
          v-for="p in bgPresets"
          :key="p.value"
          class="bg-preset"
          :class="{ active: background === p.value }"
          :style="p.value ? { background: p.value } : {}"
          @click="saveBg(p.value)"
        >{{ p.label }}</button>
        <input type="color" :value="bgColorVal" class="color-input" title="自定义背景色"
          @input="saveBg($event.target.value)" />
      </div>

      <div v-if="editor" class="editor-toolbar">
        <button class="tool-btn" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()" title="加粗"><b>B</b></button>
        <button class="tool-btn" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()" title="斜体"><i>I</i></button>
        <button class="tool-btn" :class="{ active: editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()" title="下划线"><u>U</u></button>
        <button class="tool-btn" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()" title="删除线"><s>S</s></button>
        <span class="tool-sep"></span>
        <select class="tool-select" @change="editor.chain().focus().setTextAlign($event.target.value).run()" title="对齐">
          <option value="left">左对齐</option>
          <option value="center">居中</option>
          <option value="right">右对齐</option>
        </select>
        <span class="tool-sep"></span>
        <input type="color" :value="colorVal" class="color-input" title="文字颜色" @input="applyColor" />
        <input type="color" :value="bgColorVal" class="color-input" title="高亮颜色" @input="applyBgColor" />
        <span class="tool-sep"></span>
        <select class="tool-select" :value="editor.getAttributes('heading').level || 0"
          @change="editor.chain().focus().setParagraph().run(); editor.chain().focus().toggleHeading({ level: Number($event.target.value) || undefined }).run()">
          <option :value="0">正文</option>
          <option :value="1">H1</option>
          <option :value="2">H2</option>
          <option :value="3">H3</option>
        </select>
        <button class="tool-btn" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()">• 列表</button>
        <button class="tool-btn" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()">1. 列表</button>
        <button class="tool-btn" :class="{ active: editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()">引用</button>
        <span class="tool-sep"></span>
        <button class="tool-btn" :class="{ active: editor.isActive('table') }" @click="insertTable" title="插入表格（光标在单元格内时插入即为内嵌表格）">表格</button>
        <template v-if="editor.isActive('table')">
          <button class="tool-btn" @click="insertNestedTable" title="在当前单元格内插入内嵌表格">⤵内嵌</button>
          <button class="tool-btn" @click="editor.chain().focus().addRowBefore().run()" title="上方加行">⬆行</button>
          <button class="tool-btn" @click="editor.chain().focus().addRowAfter().run()" title="下方加行">⬇行</button>
          <button class="tool-btn" @click="editor.chain().focus().deleteRow().run()" title="删除行">✕行</button>
          <button class="tool-btn" @click="editor.chain().focus().addColumnBefore().run()" title="左侧加列">⬅列</button>
          <button class="tool-btn" @click="editor.chain().focus().addColumnAfter().run()" title="右侧加列">➡列</button>
          <button class="tool-btn" @click="editor.chain().focus().deleteColumn().run()" title="删除列">✕列</button>
          <button class="tool-btn" @click="editor.chain().focus().toggleHeaderRow().run()" title="切换表头行">表头</button>
          <button class="tool-btn" @click="editor.chain().focus().deleteTable().run()" title="删除表格">✕表格</button>
        </template>
        <span class="tool-sep"></span>
        <button class="tool-btn" :class="{ active: editor.isActive('image') }" @click="pickImage" title="插入图片（上传后嵌入正文，可调宽度）" :disabled="uploadingImage">{{ uploadingImage ? '上传中...' : '🖼 图片' }}</button>
        <input ref="imageInput" type="file" accept="image/*" class="hidden-input" @change="onInsertImage" />
        <template v-if="editor.isActive('image')">
          <select class="tool-select" :value="currentImageWidth" @change="applyImageWidth" title="图片宽度">
            <option value="">原尺寸</option>
            <option value="25%">25%</option>
            <option value="50%">50%</option>
            <option value="75%">75%</option>
            <option value="100%">100%</option>
          </select>
          <button class="tool-btn" @click="removeImageOnly" title="从正文移除图片（保留服务器文件）">✕图片</button>
          <button class="tool-btn" @click="removeImageFile" title="从正文移除并删除服务器文件">🗑文件</button>
        </template>
        <button class="tool-btn" :class="{ active: editor.isActive('link') }" @click="setLink">链接</button>
        <button class="tool-btn" @click="editor.chain().focus().unsetAllMarks().clearNodes().run()">清除</button>
      </div>

      <div class="editor-body">
        <EditorContent :editor="editor" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 10px;
  flex-wrap: wrap;
}

.right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.success { color: var(--green); }
.error { color: var(--red); }

.editor-wrap {
  padding: 16px;
}

.rules-manage {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
}

.rules-manage-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.rules-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.rules-actions {
  display: flex;
  gap: 8px;
}

.bg-config {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
}

.bg-label {
  font-size: 13px;
  color: var(--text-sub);
}

.bg-preset {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 12px;
  background: var(--bg-elev);
  color: var(--text-main);
  transition: all 0.15s;
}

.bg-preset:hover {
  border-color: var(--accent);
}

.bg-preset.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25), 0 0 12px rgba(56, 189, 248, 0.25);
}

.color-input {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2px;
  cursor: pointer;
  background: var(--bg-input);
}

.hidden-input {
  display: none;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  padding: 8px;
  background: rgba(148, 163, 184, 0.06);
  border: 1px solid var(--border);
  border-radius: 10px 10px 0 0;
}

.tool-btn {
  min-width: 32px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid transparent;
  background: none;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-main);
  transition: all 0.15s;
}

.tool-btn:hover {
  background: rgba(148, 163, 184, 0.15);
}

.tool-btn.active {
  background: rgba(56, 189, 248, 0.16);
  color: var(--accent);
  border-color: rgba(56, 189, 248, 0.35);
}

.tool-select {
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card-solid);
  color: var(--text-main);
  font-size: 12px;
  padding: 0 4px;
}

.tool-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
}

.editor-body {
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 10px 10px;
  background: var(--bg-input);
  min-height: 500px;
  padding: 16px;
}

.editor-body :deep(.rules-editor-content) {
  min-height: 460px;
  outline: none;
  font-size: 16px;
  line-height: 1.9;
  color: var(--text-main);
}

.editor-body :deep(.rules-editor-content h1) { font-size: 28px; margin: 24px 0 16px; color: var(--text-main); }
.editor-body :deep(.rules-editor-content h2) { font-size: 24px; margin: 22px 0 14px; color: var(--text-main); }
.editor-body :deep(.rules-editor-content h3) { font-size: 20px; margin: 20px 0 12px; color: var(--text-main); }
.editor-body :deep(.rules-editor-content p) { margin: 10px 0; }
.editor-body :deep(.rules-editor-content ul),
.editor-body :deep(.rules-editor-content ol) { margin: 10px 0; padding-left: 26px; }
.editor-body :deep(.rules-editor-content blockquote) {
  border-left: 4px solid var(--accent);
  background: rgba(56, 189, 248, 0.08);
  padding: 10px 14px;
  margin: 12px 0;
}
.editor-body :deep(.rules-editor-content a) { color: var(--accent); text-decoration: underline; }
.editor-body :deep(.rules-editor-content table) {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  margin: 12px 0;
  overflow: hidden;
  border-radius: 8px;
}
.editor-body :deep(.rules-editor-content th),
.editor-body :deep(.rules-editor-content td) {
  border: 1px solid var(--border);
  padding: 8px 10px;
  vertical-align: top;
  min-width: 60px;
  position: relative;
  color: var(--text-main);
}
.editor-body :deep(.rules-editor-content th) {
  background: rgba(56, 189, 248, 0.12);
  font-weight: 700;
}
.editor-body :deep(.rules-editor-content .selectedCell) {
  background: rgba(56, 189, 248, 0.18);
}
.editor-body :deep(.rules-editor-content img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  display: block;
  margin: 8px 0;
}
.editor-body :deep(.rules-editor-content img.ProseMirror-selectednode) {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

/* 深色主题下：编辑器内已有的黑色内联文字转为主题文字色，保证编辑时可见 */
:root[data-theme="dark"] .editor-body :deep(.rules-editor-content span[style*="color"]),
:root[data-theme="dark"] .editor-body :deep(.rules-editor-content p[style*="color"]),
:root[data-theme="dark"] .editor-body :deep(.rules-editor-content h1[style*="color"]),
:root[data-theme="dark"] .editor-body :deep(.rules-editor-content h2[style*="color"]),
:root[data-theme="dark"] .editor-body :deep(.rules-editor-content h3[style*="color"]),
:root[data-theme="dark"] .editor-body :deep(.rules-editor-content li[style*="color"]) {
  color: var(--text-main) !important;
}
</style>
