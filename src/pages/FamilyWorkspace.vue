<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import FamilyTreeChart from '../components/FamilyTreeChart.vue'
import MemberDetail from '../components/MemberDetail.vue'
import EventManager from '../components/EventManager.vue'
import MemberEditorModal from '../components/MemberEditorModal.vue'
import MemberList from '../components/MemberList.vue'
import OcrImportManager from '../components/OcrImportManager.vue'
import PartDataImportPanel from '../components/PartDataImportPanel.vue'
import StatsDashboard from '../components/StatsDashboard.vue'
import { exportAsJson } from '../services/importExport'
import { computeGenerations } from '../services/generationService'
import { useFamilyStore } from '../stores/familyStore'
import type { FamilyEventInput, Gender, MemberInput } from '../types/member'
import type { DuplicateAction, TempMember } from '../types/ocr'

const store = useFamilyStore()
const fileInputRef = ref<HTMLInputElement | null>(null)
const treeChartRef = ref<InstanceType<typeof FamilyTreeChart> | null>(null)
const searchKeyword = ref('')
const isBootstrapping = ref(true)
const bootstrapError = ref('')
const editorVisible = ref(false)

type ToastType = 'success' | 'error' | 'info'

const toast = ref<{ visible: boolean; message: string; type: ToastType }>({
  visible: false,
  message: '',
  type: 'info',
})
let toastTimerId: number | null = null

function showToast(message: string, type: ToastType = 'info'): void {
  toast.value = { visible: true, message, type }

  if (toastTimerId !== null) {
    window.clearTimeout(toastTimerId)
  }

  toastTimerId = window.setTimeout(() => {
    toast.value.visible = false
  }, 2200)
}

function notifySuccess(message: string): void {
  showToast(message, 'success')
}

function notifyError(message: string): void {
  showToast(message, 'error')
}

function notifyInfo(message: string): void {
  showToast(message, 'info')
}

async function bootstrapStore(): Promise<void> {
  bootstrapError.value = ''
  isBootstrapping.value = true
  try {
    await store.init()
  } catch (error) {
    bootstrapError.value = error instanceof Error ? error.message : '本地族谱数据初始化失败'
  } finally {
    isBootstrapping.value = false
  }
}

onMounted(() => {
  void bootstrapStore()
})

onBeforeUnmount(() => {
  if (toastTimerId !== null) {
    window.clearTimeout(toastTimerId)
  }
})

const members = computed(() => store.members.value)
const events = computed(() => store.events.value)
const aliases = computed(() => store.aliases.value)
const relations = computed(() => store.relations.value)
const temporals = computed(() => store.temporals.value)
const burials = computed(() => store.burials.value)
const selectedMember = computed(() => store.selectedMember.value)

const selectedAliases = computed(() => {
  const id = store.selectedId.value
  return id === null ? [] : aliases.value.filter((alias) => alias.memberId === id)
})

const selectedRelations = computed(() => {
  const id = store.selectedId.value
  return id === null
    ? []
    : relations.value.filter((relation) => relation.fromMemberId === id || relation.toMemberId === id)
})

const selectedBurials = computed(() => {
  const id = store.selectedId.value
  return id === null ? [] : burials.value.filter((burial) => burial.memberId === id)
})

const generationMap = computed(() => computeGenerations(members.value))

const selectedGeneration = computed(() => {
  const id = store.selectedId.value
  if (id === null) return null
  return generationMap.value.get(id) ?? null
})

const highlightedIds = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return [] as number[]
  }

  return members.value
    .filter((member) => member.name.toLowerCase().includes(keyword) || String(member.id).includes(keyword))
    .map((member) => member.id)
})

function countDeletionImpact(rootId: number): number {
  const byParent = new Map<number, number[]>()

  for (const member of members.value) {
    const parentIds = [member.parentId, member.motherId ?? null].filter((parentId): parentId is number => parentId !== null)
    for (const parentId of parentIds) {
      const children = byParent.get(parentId) ?? []
      if (!children.includes(member.id)) {
        children.push(member.id)
      }
      byParent.set(parentId, children)
    }
  }

  const seen = new Set<number>()
  const stack = [rootId]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (seen.has(current)) {
      continue
    }
    seen.add(current)
    stack.push(...(byParent.get(current) ?? []))
  }

  return seen.size
}

function findParentName(parentId: number | null): string {
  if (parentId === null) {
    return '始祖'
  }
  const parent = members.value.find((member) => member.id === parentId)
  return parent?.name ?? '未知'
}

function resolveMemberName(id: number): string {
  const target = members.value.find((member) => member.id === id)
  return target?.name ?? `成员#${id}`
}

function createEmptyMemberInput(name: string, gender: Gender, parentId: number | null = null, motherId: number | null = null): MemberInput {
  return {
    name,
    parentId,
    motherId,
    gender,
    birthDate: '',
    deathDate: '',
    photoUrl: '',
    biography: '',
    generationLabelRaw: '',
    generationNumber: 0,
    lineageBranch: '',
    rawNotes: '',
    uncertaintyFlags: [],
  }
}

function openEditorFor(id: number): void {
  store.selectMember(id)
  editorVisible.value = true
}

function handleTreeSelect(id: number): void {
  openEditorFor(id)
}

function handleEdit(id: number): void {
  openEditorFor(id)
}

function handleAddRoot(): void {
  const result = store.addMember(createEmptyMemberInput('新族人', '男'))
  if (!result.ok || typeof result.id !== 'number') {
    notifyError(result.message ?? '新增失败')
    return
  }
  openEditorFor(result.id)
  notifySuccess('已新增族人')
}

function handleRemove(id: number): void {
  const target = members.value.find((member) => member.id === id)
  if (!target) {
    return
  }

  const impactCount = countDeletionImpact(id)
  const confirmed = window.confirm(`确认删除 ${target.name} 及其全部后代吗？预计删除 ${impactCount} 位成员。`)
  if (!confirmed) {
    return
  }

  const result = store.deleteMember(id)
  if (!result.ok) {
    notifyError(result.message ?? '删除失败')
    return
  }

  notifySuccess(result.message ?? '删除成功')
}

function handleAddChild(parentId: number): void {
  const parent = members.value.find((member) => member.id === parentId)
  const result = store.addMember(createEmptyMemberInput('新子女', '男', parent?.gender === '男' ? parentId : null, parent?.gender === '女' ? parentId : null))
  if (!result.ok || typeof result.id !== 'number') {
    notifyError(result.message ?? '新增子女失败')
    return
  }
  openEditorFor(result.id)
  notifyInfo('已新增子女，请在弹窗中完善资料')
}

function handleExport(): void {
  const json = exportAsJson(store.exportData())
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'family-tree-backup.json'
  anchor.click()
  URL.revokeObjectURL(url)
  notifySuccess('导出 JSON 成功')
}

function handleExportTreePng(): void {
  treeChartRef.value?.exportAsPng()
  notifySuccess('族谱树图已导出为 PNG')
}

function openImportDialog(): void {
  fileInputRef.value?.click()
}

async function handleImport(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
    const text = await file.text()
    const preview = store.previewDataFromMarkdown(text)
    if (!preview.ok) {
      notifyError(preview.message ?? 'Markdown 预览失败')
      input.value = ''
      return
    }

    const summary = preview.summary
    const summaryText = summary
      ? `成员 ${summary.memberCount}，始祖分支 ${summary.rootCount}，别名 ${summary.aliasCount}，时间表达 ${summary.temporalCount}，葬地 ${summary.burialCount}`
      : '未生成统计信息'
    const warningPreview =
      preview.warnings.length > 0
        ? preview.warnings.slice(0, 4).map((item, index) => `${index + 1}. ${item}`).join('\n')
        : '未检测到明显结构风险'

    const confirmCover = window.confirm(
      `Markdown 预览结果：\n${summaryText}\n\n风险提示（最多展示 4 条）：\n${warningPreview}\n\n导入将覆盖当前数据，是否继续？`,
    )
    if (!confirmCover) {
      input.value = ''
      return
    }

    const result = await store.importDataFromMarkdown(text)
    if (!result.ok) {
      notifyError(result.message ?? 'Markdown 导入失败')
    } else {
      notifySuccess(result.message ?? 'Markdown 导入成功')
    }
    input.value = ''
    return
  }

  const confirmCover = window.confirm('导入 JSON 将覆盖当前本地数据，是否继续？')
  if (!confirmCover) {
    input.value = ''
    return
  }

  const text = await file.text()
  const result = await store.importDataFromJson(text)
  if (!result.ok) {
    notifyError(result.message ?? '导入失败')
  } else {
    editorVisible.value = false
    notifySuccess(result.message ?? '导入成功')
  }

  input.value = ''
}

function handleOcrImport(payload: { members: TempMember[]; duplicateAction: DuplicateAction }): void {
  const result = store.importOcrMembers(payload.members, {
    duplicateAction: payload.duplicateAction,
  })
  if (!result.ok) {
    notifyError(result.message ?? 'OCR 导入失败')
    return
  }
  notifySuccess(result.message ?? 'OCR 导入成功')
}

function handleEventAdd(payload: FamilyEventInput): void {
  const result = store.addEvent(payload)
  if (!result.ok) {
    notifyError(result.message ?? '事件新增失败')
    return
  }
  notifySuccess(result.message ?? '事件新增成功')
}

function handleEventUpdate(payload: { id: number; input: FamilyEventInput }): void {
  const result = store.updateEvent(payload.id, payload.input)
  if (!result.ok) {
    notifyError(result.message ?? '事件更新失败')
    return
  }
  notifySuccess(result.message ?? '事件更新成功')
}

function handleEventRemove(id: number): void {
  const result = store.deleteEvent(id)
  if (!result.ok) {
    notifyError(result.message ?? '事件删除失败')
    return
  }
  notifySuccess(result.message ?? '事件已删除')
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="topbar-main">
        <div>
          <h1>家族云谱</h1>
          <p>记录家族世系，传承家族文脉</p>
        </div>
      </div>

      <div class="top-actions">
        <button class="btn-primary" type="button" @click="handleAddRoot">新增成员</button>
        <button class="btn-ghost" type="button" @click="openImportDialog">导入 JSON/Markdown</button>
        <button class="btn-ghost" type="button" @click="handleExport">导出 JSON</button>
        <button class="btn-ghost" type="button" @click="handleExportTreePng">导出树图 PNG</button>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="application/json,text/markdown,.json,.md,.markdown"
        class="hidden-input"
        @change="handleImport"
      />
    </header>

    <section v-if="isBootstrapping" class="status-panel">
      <h3>正在读取本地族谱</h3>
      <p>请稍候，系统正在从浏览器本地数据恢复内容。</p>
    </section>

    <section v-else-if="bootstrapError" class="status-panel status-panel-error">
      <h3>初始化失败</h3>
      <p>{{ bootstrapError }}</p>
      <button class="btn-primary" type="button" @click="bootstrapStore">重试</button>
    </section>

    <main v-if="!isBootstrapping && !bootstrapError" class="main-layout">
      <section class="left-pane">
        <FamilyTreeChart
          ref="treeChartRef"
          :members="members"
          :selected-id="store.selectedId.value"
          :highlight-ids="highlightedIds"
          @select="handleTreeSelect"
        />
      </section>

      <aside class="right-pane">
        <StatsDashboard
          :members="members"
          :events="events"
        />

        <MemberList
          :members="members"
          :selected-id="store.selectedId.value"
          :find-parent-name="findParentName"
          :generation-map="generationMap"
          @select="store.selectMember"
          @edit="handleEdit"
          @remove="handleRemove"
          @search="searchKeyword = $event"
        />

        <EventManager
          :events="events"
          :members="members"
          @add="handleEventAdd"
          @update="handleEventUpdate"
          @remove="handleEventRemove"
        />

        <OcrImportManager
          :members="members"
          @import-members="handleOcrImport"
        />

        <section class="manage-section">
          <PartDataImportPanel />
        </section>

        <MemberDetail
          :member="selectedMember"
          :find-parent-name="findParentName"
          :generation="selectedGeneration"
          :aliases="selectedAliases"
          :relations="selectedRelations"
          :temporals="temporals"
          :burials="selectedBurials"
          :resolve-member-name="resolveMemberName"
          @edit="handleEdit"
          @remove="handleRemove"
          @add-child="handleAddChild"
        />
      </aside>
    </main>

    <footer class="footer">
      <p>数据保存在当前浏览器 localStorage 中，请定期导出 JSON 备份。</p>
    </footer>

    <MemberEditorModal
      :visible="editorVisible"
      :member="selectedMember"
      :members="members"
      @close="editorVisible = false"
      @deleted="editorVisible = false"
      @notify="showToast"
    />

    <transition name="toast-fade">
      <div
        v-if="toast.visible"
        class="app-toast"
        :class="`app-toast-${toast.type}`"
        role="status"
        aria-live="polite"
      >
        {{ toast.message }}
      </div>
    </transition>
  </div>
</template>
