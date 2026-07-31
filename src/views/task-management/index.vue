<template>
  <div class="task-management-page">
    <div class="page-header">
      <div>
        <h2><a-icon type="schedule" /> {{ $t('taskManagement.title') }}</h2>
        <p>{{ $t('taskManagement.description') }}</p>
      </div>
      <div class="header-actions">
        <a-tag color="blue"><a-icon type="sync" spin /> {{ $t('taskManagement.polling') }}</a-tag>
        <a-button :loading="loading" @click="refreshActive"><a-icon type="reload" /> {{ $t('taskManagement.refresh') }}</a-button>
        <a-button v-if="isAdmin" type="primary" @click="openRunModal"><a-icon type="play-circle" /> {{ $t('taskManagement.startRun') }}</a-button>
      </div>
    </div>

    <a-tabs v-model="activeTab" @change="onTabChange">
      <a-tab-pane key="overview" :tab="$t('taskManagement.overview')">
        <a-row :gutter="16" class="summary-grid">
          <a-col v-for="card in overviewCards" :key="card.key" :xs="12" :sm="8" :lg="4">
            <a-card :bordered="false" class="summary-card">
              <a-statistic :title="card.title" :value="card.value" :value-style="{ color: card.color }">
                <template #prefix><a-icon :type="card.icon" /></template>
              </a-statistic>
            </a-card>
          </a-col>
        </a-row>
        <a-card :bordered="false" :title="$t('taskManagement.recentEvents')">
          <a-table :columns="logColumns" :data-source="overview.recent_events || []" :row-key="row => row.id" :pagination="false" size="middle">
            <template slot="severity" slot-scope="value"><a-tag :color="severityColor(value)">{{ value }}</a-tag></template>
            <template slot="externalRequest" slot-scope="value"><a class="request-link" v-if="isAdmin && value" @click="openExternalRequest(value)">{{ value }}</a><span v-else>-</span></template>
          </a-table>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="schedules" :tab="$t('taskManagement.schedules')">
        <a-alert v-if="!isAdmin" type="info" show-icon :message="$t('taskManagement.adminOnly')" />
        <a-card v-else :bordered="false">
          <div class="toolbar">
            <div class="filters">
              <a-select v-model="scheduleFilters.taskKey" allow-clear :placeholder="$t('taskManagement.task')" style="width: 260px" @change="loadSchedules">
                <a-select-option v-for="item in definitions" :key="item.task_key" :value="item.task_key">{{ item.display_name || item.task_key }}</a-select-option>
              </a-select>
              <a-select v-model="scheduleFilters.enabled" allow-clear :placeholder="$t('taskManagement.status')" style="width: 150px" @change="loadSchedules">
                <a-select-option value="true">{{ $t('taskManagement.enable') }}</a-select-option>
                <a-select-option value="false">{{ $t('taskManagement.pause') }}</a-select-option>
              </a-select>
            </div>
            <a-button type="primary" @click="openScheduleModal()"><a-icon type="plus" /> {{ $t('taskManagement.createSchedule') }}</a-button>
          </div>
          <a-table :columns="scheduleColumns" :data-source="schedules" :row-key="row => row.id" :pagination="false" :loading="scheduleLoading">
            <template slot="enabled" slot-scope="value"><a-badge :status="value ? 'success' : 'default'" :text="value ? $t('taskManagement.enable') : $t('taskManagement.pause')" /></template>
            <template slot="scheduleActions" slot-scope="_, row">
              <a-button type="link" size="small" @click="openScheduleModal(row)">{{ $t('taskManagement.edit') }}</a-button>
              <a-divider type="vertical" />
              <a-popconfirm :title="row.enabled ? $t('taskManagement.pause') : $t('taskManagement.enable')" @confirm="toggleSchedule(row)">
                <a-button type="link" size="small">{{ row.enabled ? $t('taskManagement.pause') : $t('taskManagement.enable') }}</a-button>
              </a-popconfirm>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="runs" :tab="$t('taskManagement.runs')">
        <a-card :bordered="false">
          <div class="filters run-filters">
            <a-select v-model="runFilters.taskKey" allow-clear :placeholder="$t('taskManagement.task')" style="width: 240px" @change="resetRuns">
              <a-select-option v-for="item in taskOptions" :key="item.task_key" :value="item.task_key">{{ item.display_name || item.task_key }}</a-select-option>
            </a-select>
            <a-select v-model="runFilters.status" allow-clear :placeholder="$t('taskManagement.status')" style="width: 160px" @change="resetRuns">
              <a-select-option v-for="status in runStatuses" :key="status" :value="status">{{ status }}</a-select-option>
            </a-select>
            <a-input v-model="runFilters.errorCode" allow-clear :placeholder="$t('taskManagement.errorCode')" style="width: 190px" @pressEnter="resetRuns" />
            <a-input v-if="isAdmin" v-model="runFilters.ownerUserId" allow-clear :placeholder="$t('taskManagement.owner')" style="width: 140px" @pressEnter="resetRuns" />
            <a-button type="primary" @click="resetRuns"><a-icon type="search" /></a-button>
          </div>
          <a-table :columns="runColumns" :data-source="runs" :row-key="row => row.run_id" :loading="runLoading" :pagination="runPagination" @change="onRunPageChange">
            <template slot="runStatus" slot-scope="value"><a-tag :color="statusColor(value)">{{ value }}</a-tag></template>
            <template slot="runProgress" slot-scope="_, row">
              <a-progress v-if="row.progress_total" :percent="progressPercent(row)" size="small" />
              <span v-else>{{ row.progress_current || 0 }} {{ row.progress_unit || '' }}</span>
            </template>
            <template slot="runError" slot-scope="_, row"><span class="error-code">{{ row.error_code || '-' }}</span></template>
            <template slot="runActions" slot-scope="_, row">
              <a-button type="link" size="small" @click="showRun(row.run_id)">{{ $t('taskManagement.details') }}</a-button>
              <template v-if="isAdmin && cancellable(row)">
                <a-divider type="vertical" />
                <a-popconfirm :title="$t('taskManagement.confirmCancel')" @confirm="cancelRun(row)"><a-button type="link" size="small">{{ $t('taskManagement.cancel') }}</a-button></a-popconfirm>
              </template>
              <template v-if="isAdmin && retryable(row)">
                <a-divider type="vertical" />
                <a-popconfirm :title="$t('taskManagement.confirmRetry')" @confirm="retryRun(row)"><a-button type="link" size="small">{{ $t('taskManagement.retry') }}</a-button></a-popconfirm>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="logs" :tab="$t('taskManagement.logs')">
        <a-card :bordered="false">
          <div class="filters log-filters">
            <a-select v-model="logFilters.taskKey" allow-clear :placeholder="$t('taskManagement.task')" style="width: 220px" @change="resetLogs">
              <a-select-option v-for="item in taskOptions" :key="item.task_key" :value="item.task_key">{{ item.display_name || item.task_key }}</a-select-option>
            </a-select>
            <a-select v-model="logFilters.status" allow-clear :placeholder="$t('taskManagement.status')" style="width: 150px" @change="resetLogs">
              <a-select-option v-for="status in runStatuses" :key="status" :value="status">{{ status }}</a-select-option>
            </a-select>
            <a-input v-model="logFilters.errorCode" allow-clear :placeholder="$t('taskManagement.errorCode')" style="width: 180px" @pressEnter="resetLogs" />
            <a-select v-model="logFilters.provider" allow-clear :placeholder="$t('taskManagement.provider')" style="width: 170px" @change="resetLogs">
              <a-select-option v-for="provider in providers" :key="provider" :value="provider">{{ provider }}</a-select-option>
            </a-select>
            <a-input v-if="isAdmin" v-model="logFilters.ownerUserId" allow-clear :placeholder="$t('taskManagement.owner')" style="width: 130px" @pressEnter="resetLogs" />
            <a-range-picker show-time @change="onLogRangeChange" />
            <a-button type="primary" @click="resetLogs"><a-icon type="search" /></a-button>
          </div>
          <a-table :columns="logColumns" :data-source="logs" :row-key="row => row.id" :loading="logLoading" :pagination="false">
            <template slot="severity" slot-scope="value"><a-tag :color="severityColor(value)">{{ value }}</a-tag></template>
            <template slot="externalRequest" slot-scope="value"><a class="request-link" v-if="isAdmin && value" @click="openExternalRequest(value)">{{ value }}</a><span v-else>-</span></template>
          </a-table>
          <div class="cursor-footer"><span>{{ $t('taskManagement.cursor') }}: {{ logCursor }}</span></div>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <a-modal v-model="scheduleModal" :title="scheduleForm.id ? $t('taskManagement.edit') : $t('taskManagement.createSchedule')" :confirm-loading="saving" width="640px" @ok="saveSchedule">
      <a-form-model layout="vertical">
        <a-form-model-item :label="$t('taskManagement.task')" required>
          <a-select v-model="scheduleForm.taskKey" :disabled="!!scheduleForm.id">
            <a-select-option v-for="item in definitions" :key="item.task_key" :value="item.task_key">{{ item.display_name || item.task_key }}</a-select-option>
          </a-select>
        </a-form-model-item>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-model-item :label="$t('taskManagement.cron')" required><a-input v-model="scheduleForm.cron" placeholder="0 2 * * *" /></a-form-model-item></a-col>
          <a-col :span="12"><a-form-model-item :label="$t('taskManagement.timezone')" required><a-input v-model="scheduleForm.timezone" /></a-form-model-item></a-col>
        </a-row>
        <a-form-model-item :label="$t('taskManagement.parameters')"><a-textarea v-model="scheduleForm.parametersText" :rows="7" /></a-form-model-item>
        <a-form-model-item :label="$t('taskManagement.reason')"><a-input v-model="scheduleForm.reason" /></a-form-model-item>
        <a-switch v-if="scheduleForm.id" v-model="scheduleForm.enabled" />
      </a-form-model>
    </a-modal>

    <a-modal v-model="runModal" :title="$t('taskManagement.startRun')" :confirm-loading="saving" width="620px" @ok="submitRun">
      <a-form-model layout="vertical">
        <a-form-model-item :label="$t('taskManagement.task')" required>
          <a-select v-model="runForm.taskKey" @change="useDefinitionDefaults">
            <a-select-option v-for="item in definitions" :key="item.task_key" :value="item.task_key">{{ item.display_name || item.task_key }}</a-select-option>
          </a-select>
        </a-form-model-item>
        <a-form-model-item :label="$t('taskManagement.parameters')"><a-textarea v-model="runForm.parametersText" :rows="8" /></a-form-model-item>
        <a-form-model-item :label="$t('taskManagement.reason')"><a-input v-model="runForm.reason" /></a-form-model-item>
      </a-form-model>
    </a-modal>

    <a-drawer :visible="!!runDetail" width="720" :title="runDetail ? `${$t('taskManagement.details')} · ${runDetail.run_id}` : ''" @close="closeRunDetail">
      <template v-if="runDetail">
        <a-descriptions bordered :column="1" size="small">
          <a-descriptions-item :label="$t('taskManagement.task')">{{ runDetail.task_key }}</a-descriptions-item>
          <a-descriptions-item :label="$t('taskManagement.status')"><a-tag :color="statusColor(runDetail.status)">{{ runDetail.status }}</a-tag></a-descriptions-item>
          <a-descriptions-item :label="$t('taskManagement.progress')">{{ progressText(runDetail) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('taskManagement.heartbeat')">{{ formatTime(runDetail.heartbeat_at) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('taskManagement.domainReference')">{{ domainText(runDetail) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('taskManagement.errorCode')">{{ runDetail.error_code || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('taskManagement.errorDetail')"><pre>{{ runDetail.error_summary || '-' }}</pre></a-descriptions-item>
          <a-descriptions-item :label="$t('taskManagement.result')"><pre>{{ pretty(runDetail.result_summary) }}</pre></a-descriptions-item>
          <a-descriptions-item label="checkpoint">{{ runDetail.checkpoint_ref || '-' }}</a-descriptions-item>
          <a-descriptions-item label="retryOfRunId">{{ runDetail.retry_of_run_id || '-' }}</a-descriptions-item>
        </a-descriptions>
        <div class="drawer-actions" v-if="isAdmin">
          <a-button v-if="cancellable(runDetail)" type="danger" @click="cancelRun(runDetail)">{{ $t('taskManagement.cancel') }}</a-button>
          <a-button v-if="retryable(runDetail)" @click="retryRun(runDetail)">{{ $t('taskManagement.retry') }}</a-button>
        </div>
        <a-divider>{{ $t('taskManagement.recentEvents') }}</a-divider>
        <a-timeline>
          <a-timeline-item v-for="event in runDetail.recent_events || []" :key="event.id" :color="severityColor(event.severity)">
            <strong>{{ event.event_type }}</strong> · {{ formatTime(event.occurred_at) }}<br>
            <span>{{ event.message || event.error_code || '-' }}</span>
          </a-timeline-item>
        </a-timeline>
      </template>
    </a-drawer>
  </div>
</template>

<script>
import {
  cancelTaskRun, createTaskSchedule, getTaskOverview, getTaskRun, listTaskDefinitions,
  listTaskLogs, listTaskRuns, listTaskSchedules, retryTaskRun, startTaskRun, updateTaskSchedule
} from '@/api/taskManagement'

const RUN_STATUSES = ['queued', 'running', 'retry_wait', 'cancel_requested', 'succeeded', 'failed', 'cancelled']
const PROVIDERS = ['eastmoney', 'tencent', 'akshare_wallstreetcn', 'finnhub', 'fred', 'tradingeconomics', 'yfinance', 'bybit', 'binance', 'gate', 'okx', 'bitget', 'htx']

function dataOf (response) {
  return response && response.data !== undefined ? response.data : response
}

export default {
  name: 'TaskManagement',
  data () {
    return {
      activeTab: 'overview', loading: false, saving: false,
      overview: {}, definitions: [], schedules: [], runs: [], logs: [], runDetail: null,
      scheduleLoading: false, runLoading: false, logLoading: false,
      scheduleModal: false, runModal: false, pollTimer: null, logCursor: 0,
      refreshInFlight: false, refreshGeneration: 0,
      overviewRequestSeq: 0, definitionRequestSeq: 0, scheduleRequestSeq: 0, runRequestSeq: 0,
      logRequestSeq: 0, runDetailRequestSeq: 0,
      runStatuses: RUN_STATUSES, providers: PROVIDERS,
      scheduleFilters: { taskKey: '', enabled: undefined },
      runFilters: { taskKey: '', status: '', errorCode: '', ownerUserId: '' },
      logFilters: { taskKey: '', status: '', errorCode: '', provider: '', ownerUserId: '', occurredFrom: '', occurredTo: '' },
      runPagination: { current: 1, pageSize: 50, total: 0, showSizeChanger: true },
      scheduleForm: this.emptyScheduleForm(), runForm: this.emptyRunForm()
    }
  },
  computed: {
    isAdmin () { return (this.$store.getters.roles || []).includes('admin') },
    taskOptions () {
      if (this.definitions.length) return this.definitions
      const keys = [...new Set(this.runs.map(item => item.task_key).filter(Boolean))]
      return keys.map(task_key => ({ task_key, display_name: task_key }))
    },
    overviewCards () {
      return [
        { key: 'queued', title: this.$t('taskManagement.queued'), value: Number(this.overview.queued || 0), icon: 'clock-circle', color: '#1677ff' },
        { key: 'running', title: this.$t('taskManagement.running'), value: Number(this.overview.running || 0), icon: 'loading', color: '#13c2c2' },
        { key: 'failed', title: this.$t('taskManagement.failed'), value: Number(this.overview.failed || 0), icon: 'close-circle', color: '#cf1322' },
        { key: 'workerLost', title: this.$t('taskManagement.workerLost'), value: Number(this.overview.worker_lost || 0), icon: 'disconnect', color: '#d46b08' },
        { key: 'schedules', title: this.$t('taskManagement.enabledSchedules'), value: Number((this.overview.schedules || {}).enabled || 0), icon: 'calendar', color: '#722ed1' },
        { key: 'events', title: this.$t('taskManagement.recentEvents'), value: (this.overview.recent_events || []).length, icon: 'profile', color: '#389e0d' }
      ]
    },
    scheduleColumns () {
      return [
        { title: 'ID', dataIndex: 'id', width: 80 },
        { title: this.$t('taskManagement.task'), dataIndex: 'task_key' },
        { title: this.$t('taskManagement.cron'), dataIndex: 'cron_expression' },
        { title: this.$t('taskManagement.timezone'), dataIndex: 'timezone' },
        { title: this.$t('taskManagement.status'), dataIndex: 'enabled', scopedSlots: { customRender: 'enabled' } },
        { title: 'revision', dataIndex: 'revision', width: 90 },
        { title: this.$t('taskManagement.nextRun'), dataIndex: 'next_scheduled_at', customRender: value => this.formatTime(value) },
        { title: '', scopedSlots: { customRender: 'scheduleActions' }, width: 170 }
      ]
    },
    runColumns () {
      return [
        { title: 'Run ID', dataIndex: 'run_id', width: 190, ellipsis: true },
        { title: this.$t('taskManagement.task'), dataIndex: 'task_key', width: 210 },
        { title: this.$t('taskManagement.status'), dataIndex: 'status', scopedSlots: { customRender: 'runStatus' }, width: 130 },
        { title: this.$t('taskManagement.progress'), scopedSlots: { customRender: 'runProgress' }, width: 180 },
        { title: this.$t('taskManagement.errorCode'), scopedSlots: { customRender: 'runError' }, width: 170 },
        { title: this.$t('taskManagement.owner'), dataIndex: 'owner_user_id', width: 90 },
        { title: this.$t('taskManagement.createdAt'), dataIndex: 'created_at', customRender: value => this.formatTime(value), width: 180 },
        { title: '', scopedSlots: { customRender: 'runActions' }, width: 220, fixed: 'right' }
      ]
    },
    logColumns () {
      return [
        { title: 'ID', dataIndex: 'id', width: 80 },
        { title: this.$t('taskManagement.createdAt'), dataIndex: 'occurred_at', customRender: value => this.formatTime(value), width: 180 },
        { title: this.$t('taskManagement.task'), dataIndex: 'task_key', width: 190 },
        { title: this.$t('taskManagement.eventType'), dataIndex: 'event_type', width: 170 },
        { title: this.$t('taskManagement.severity'), dataIndex: 'severity', scopedSlots: { customRender: 'severity' }, width: 100 },
        { title: this.$t('taskManagement.message'), dataIndex: 'message', ellipsis: true },
        { title: this.$t('taskManagement.errorCode'), dataIndex: 'error_code', width: 160 },
        { title: this.$t('taskManagement.externalRequest'), dataIndex: 'external_request_id', scopedSlots: { customRender: 'externalRequest' }, width: 180 }
      ]
    }
  },
  created () {
    this.bootstrap()
    this.startPolling()
  },
  beforeDestroy () { this.stopPolling() },
  activated () { this.startPolling() },
  deactivated () { this.stopPolling() },
  methods: {
    emptyScheduleForm () { return { id: null, taskKey: '', cron: '0 2 * * *', timezone: 'Asia/Shanghai', enabled: true, parametersText: '{}', reason: '' } },
    emptyRunForm () { return { taskKey: '', parametersText: '{}', reason: '' } },
    async bootstrap () {
      this.loading = true
      try {
        await this.loadOverview()
        if (this.isAdmin) await Promise.all([this.loadDefinitions(), this.loadSchedules()])
        await Promise.all([this.loadRuns(), this.loadLogs(true)])
      } catch (error) { this.showError(error, 'taskManagement.loadFailed') } finally { this.loading = false }
    },
    startPolling () {
      if (this.pollTimer) return
      this.pollTimer = window.setInterval(() => this.refreshActive(true), 5000)
    },
    stopPolling () {
      if (this.pollTimer) window.clearInterval(this.pollTimer)
      this.pollTimer = null
      this.refreshGeneration += 1
      this.refreshInFlight = false
      this.overviewRequestSeq += 1
      this.definitionRequestSeq += 1
      this.scheduleRequestSeq += 1
      this.runRequestSeq += 1
      this.logRequestSeq += 1
      this.runDetailRequestSeq += 1
    },
    async refreshActive (silent = false) {
      if (this.refreshInFlight) return
      const generation = this.refreshGeneration
      this.refreshInFlight = true
      if (!silent) this.loading = true
      try {
        await this.loadOverview()
        if (this.activeTab === 'schedules' && this.isAdmin) await this.loadSchedules()
        if (this.activeTab === 'runs') await this.loadRuns()
        if (this.activeTab === 'logs') await this.loadLogs(false)
        if (this.runDetail) await this.showRun(this.runDetail.run_id, true)
      } catch (error) { if (!silent) this.showError(error, 'taskManagement.loadFailed') } finally {
        if (generation === this.refreshGeneration) {
          if (!silent) this.loading = false
          this.refreshInFlight = false
        }
      }
    },
    onTabChange () { this.refreshActive(true) },
    async loadOverview () {
      const requestSeq = ++this.overviewRequestSeq
      const data = dataOf(await getTaskOverview()) || {}
      if (requestSeq !== this.overviewRequestSeq) return
      this.overview = data
    },
    async loadDefinitions () {
      const requestSeq = ++this.definitionRequestSeq
      const definitions = dataOf(await listTaskDefinitions()) || []
      if (requestSeq !== this.definitionRequestSeq) return
      this.definitions = definitions
    },
    async loadSchedules () {
      if (!this.isAdmin) return
      const requestSeq = ++this.scheduleRequestSeq
      this.scheduleLoading = true
      try {
        const data = dataOf(await listTaskSchedules({ ...this.scheduleFilters, limit: 500 })) || {}
        if (requestSeq !== this.scheduleRequestSeq) return
        this.schedules = data.items || []
      } finally {
        if (requestSeq === this.scheduleRequestSeq) this.scheduleLoading = false
      }
    },
    async loadRuns () {
      const requestSeq = ++this.runRequestSeq
      this.runLoading = true
      try {
        const params = { ...this.runFilters, limit: this.runPagination.pageSize, offset: (this.runPagination.current - 1) * this.runPagination.pageSize }
        Object.keys(params).forEach(key => { if (params[key] === '') delete params[key] })
        const data = dataOf(await listTaskRuns(params)) || {}
        if (requestSeq !== this.runRequestSeq) return
        this.runs = data.items || []
        this.runPagination.total = Number(data.total || 0)
      } finally {
        if (requestSeq === this.runRequestSeq) this.runLoading = false
      }
    },
    async loadLogs (reset) {
      const requestSeq = ++this.logRequestSeq
      this.logLoading = true
      try {
        if (reset) { this.logCursor = 0; this.logs = [] }
        const params = { ...this.logFilters, cursor: this.logCursor, limit: 100, tail: reset }
        Object.keys(params).forEach(key => { if (params[key] === '') delete params[key] })
        const data = dataOf(await listTaskLogs(params)) || {}
        if (requestSeq !== this.logRequestSeq) return
        const incoming = data.items || []
        const byId = new Map(this.logs.map(item => [item.id, item]))
        incoming.forEach(item => byId.set(item.id, item))
        this.logs = [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id)).slice(-500)
        this.logCursor = Number(data.nextCursor || this.logCursor || 0)
      } finally {
        if (requestSeq === this.logRequestSeq) this.logLoading = false
      }
    },
    resetRuns () { this.runPagination.current = 1; this.loadRuns() },
    resetLogs () { this.loadLogs(true) },
    onRunPageChange (pagination) { this.runPagination.current = pagination.current; this.runPagination.pageSize = pagination.pageSize; this.loadRuns() },
    onLogRangeChange (_dates, strings) { this.logFilters.occurredFrom = strings[0] || ''; this.logFilters.occurredTo = strings[1] || ''; this.resetLogs() },
    openScheduleModal (row) {
      this.scheduleForm = row ? {
        id: row.id, taskKey: row.task_key, cron: row.cron_expression, timezone: row.timezone,
        enabled: !!row.enabled, parametersText: this.pretty(row.parameters), reason: ''
      } : this.emptyScheduleForm()
      this.scheduleModal = true
    },
    parseParameters (value) {
      try {
        const parsed = JSON.parse(value || '{}')
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('object required')
        return parsed
      } catch (error) { this.$message.error(this.$t('taskManagement.invalidJson')); throw error }
    },
    async saveSchedule () {
      if (!this.scheduleForm.taskKey || !this.scheduleForm.cron || !this.scheduleForm.timezone) return
      this.saving = true
      try {
        const payload = { taskKey: this.scheduleForm.taskKey, cron: this.scheduleForm.cron, timezone: this.scheduleForm.timezone, enabled: this.scheduleForm.enabled, parameters: this.parseParameters(this.scheduleForm.parametersText), reason: this.scheduleForm.reason }
        if (this.scheduleForm.id) await updateTaskSchedule(this.scheduleForm.id, payload)
        else await createTaskSchedule(payload)
        this.scheduleModal = false
        this.$message.success(this.$t('taskManagement.saved'))
        await Promise.all([this.loadSchedules(), this.loadOverview()])
      } catch (error) { if (!(error instanceof SyntaxError)) this.showError(error) } finally { this.saving = false }
    },
    async toggleSchedule (row) {
      try {
        await updateTaskSchedule(row.id, { cron: row.cron_expression, timezone: row.timezone, enabled: !row.enabled, parameters: row.parameters || {}, reason: row.enabled ? 'pause from Task Management' : 'enable from Task Management' })
        await Promise.all([this.loadSchedules(), this.loadOverview()])
      } catch (error) { this.showError(error) }
    },
    openRunModal () { this.runForm = this.emptyRunForm(); this.runModal = true },
    useDefinitionDefaults (taskKey) {
      const definition = this.definitions.find(item => item.task_key === taskKey)
      this.runForm.parametersText = this.pretty((definition && definition.default_parameters) || {})
    },
    async submitRun () {
      if (!this.runForm.taskKey) return
      this.saving = true
      try {
        const data = dataOf(await startTaskRun({ taskKey: this.runForm.taskKey, parameters: this.parseParameters(this.runForm.parametersText), reason: this.runForm.reason })) || {}
        this.runModal = false
        this.$message.success(data.created === false ? this.$t('taskManagement.duplicate') : this.$t('taskManagement.started'))
        this.activeTab = 'runs'
        await this.loadRuns()
        if (data.runId) await this.showRun(data.runId)
      } catch (error) { if (!(error instanceof SyntaxError)) this.showError(error) } finally { this.saving = false }
    },
    async showRun (runId, silent = false) {
      const requestSeq = ++this.runDetailRequestSeq
      try {
        const detail = dataOf(await getTaskRun(runId))
        if (requestSeq === this.runDetailRequestSeq) this.runDetail = detail
      } catch (error) { if (!silent && requestSeq === this.runDetailRequestSeq) this.showError(error) }
    },
    closeRunDetail () { this.runDetailRequestSeq += 1; this.runDetail = null },
    async cancelRun (row) {
      try {
        await cancelTaskRun(row.run_id, { reason: 'safe cancellation requested from Task Management' })
        this.$message.success(this.$t('taskManagement.cancelRequested'))
        await this.loadRuns()
        if (this.runDetail && this.runDetail.run_id === row.run_id) await this.showRun(row.run_id, true)
      } catch (error) { this.showError(error) }
    },
    async retryRun (row) {
      try {
        const data = dataOf(await retryTaskRun(row.run_id, { checkpointRef: row.checkpoint_ref || '', reason: 'manual retry from Task Management' })) || {}
        this.$message.success(this.$t('taskManagement.retryCreated'))
        await this.loadRuns()
        if (data.runId) await this.showRun(data.runId)
      } catch (error) { this.showError(error) }
    },
    cancellable (row) { return ['queued', 'running', 'retry_wait', 'cancel_requested'].includes(row.status) && row.status !== 'cancel_requested' },
    retryable (row) { return ['failed', 'cancelled'].includes(row.status) },
    progressPercent (row) { return row.progress_total ? Math.min(100, Math.round(Number(row.progress_current || 0) * 100 / Number(row.progress_total))) : 0 },
    progressText (row) { return row.progress_total == null ? `${row.progress_current || 0} ${row.progress_unit || ''}` : `${row.progress_current || 0} / ${row.progress_total} ${row.progress_unit || ''}` },
    domainText (row) { return row.domain_kind && row.domain_run_id ? `${row.domain_kind}:${row.domain_run_id}` : '-' },
    pretty (value) { try { return JSON.stringify(value || {}, null, 2) } catch (error) { return String(value || '') } },
    formatTime (value) { return value ? this.$options.filters.moment ? this.$options.filters.moment(value) : new Date(value).toLocaleString() : '-' },
    statusColor (status) { return ({ queued: 'blue', running: 'cyan', retry_wait: 'orange', cancel_requested: 'gold', succeeded: 'green', failed: 'red', cancelled: 'default' })[status] || 'default' },
    severityColor (severity) { return ({ debug: 'default', info: 'blue', warning: 'orange', error: 'red' })[severity] || 'default' },
    openExternalRequest (requestId) { window.open(this.$router.resolve({ path: '/external-data-request-logs', query: { request_id: requestId } }).href, '_blank') },
    showError (error, key = 'taskManagement.actionFailed') { this.$message.error((error && error.backendMessage) || this.$t(key)) }
  }
}
</script>

<style scoped>
.task-management-page { padding-bottom: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 12px; }
.page-header h2 { margin-bottom: 4px; }
.page-header p { margin: 0; color: rgba(0, 0, 0, 0.45); }
.header-actions, .toolbar, .filters, .drawer-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.toolbar { justify-content: space-between; margin-bottom: 16px; }
.summary-grid { margin-bottom: 18px; }
.summary-card { margin-bottom: 12px; border-radius: 8px; }
.run-filters, .log-filters { margin-bottom: 16px; }
.error-code { color: #cf1322; font-family: monospace; }
.request-link { font-family: monospace; }
.cursor-footer { display: flex; justify-content: flex-end; color: rgba(0, 0, 0, 0.45); padding-top: 12px; }
.drawer-actions { margin-top: 16px; }
pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 12px; }
@media (max-width: 768px) { .page-header { flex-direction: column; } .header-actions { width: 100%; } }
</style>
