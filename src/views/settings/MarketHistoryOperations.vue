<template>
  <section class="history-ops">
    <div class="ops-heading">
      <div>
        <h4>{{ t('title', 'A-share history operations') }}</h4>
        <p>{{ t('description', 'Inspect durable daily history, provider health, coverage, and controlled sync runs.') }}</p>
      </div>
      <a-button icon="reload" :loading="loading" :disabled="!isAdmin" @click="refreshAll">
        {{ t('refresh', 'Refresh') }}
      </a-button>
    </div>

    <a-alert
      v-if="availability !== 'available'"
      show-icon
      :type="availability === 'forbidden' ? 'warning' : 'info'"
      :message="availabilityMessage"
      class="ops-alert" />

    <template v-else>
      <div class="ops-status-grid">
        <div class="ops-status"><span>{{ t('historyFeature', 'History feature') }}</span><strong><a-tag :color="capabilities.historyEnabled ? 'green' : 'orange'">{{ yesNo(capabilities.historyEnabled) }}</a-tag></strong></div>
        <div class="ops-status"><span>{{ t('syncFeature', 'Sync feature') }}</span><strong><a-tag :color="capabilities.syncEnabled ? 'green' : 'orange'">{{ yesNo(capabilities.syncEnabled) }}</a-tag></strong></div>
        <div class="ops-status"><span>{{ t('provider', 'Provider') }}</span><strong>{{ provider.provider || capabilities.provider || '-' }}</strong></div>
        <div class="ops-status"><span>{{ t('selectedNode', 'Selected node') }}</span><strong>{{ provider.selectedHost || '-' }}</strong></div>
        <div class="ops-status"><span>{{ t('diskProtection', 'Disk protection') }}</span><strong><a-tag :color="diskColor">{{ disk.level || '-' }}</a-tag></strong></div>
        <div class="ops-status"><span>{{ t('freeDisk', 'Free disk') }}</span><strong>{{ formatBytes(disk.freeBytes) }}</strong></div>
        <div class="ops-status"><span>{{ t('coveredSymbols', 'Covered symbols') }}</span><strong>{{ Number(coverageSummary.totalInstruments || 0) }}</strong></div>
        <div class="ops-status"><span>{{ t('completeRaw', 'Complete raw coverage') }}</span><strong>{{ Number(coverageSummary.completeRaw || 0) }}</strong></div>
      </div>

      <a-alert
        v-if="!disk.allowsNewSync"
        type="error"
        show-icon
        class="ops-alert"
        :message="t('diskBlocked', 'New sync runs are blocked by disk protection.')"
        :description="t('diskAction', 'Free disk space manually, then refresh this status. No project or Docker data is deleted automatically.')" />

      <div class="ops-section-title">{{ t('providerNodes', 'Provider nodes') }}</div>
      <a-table
        :columns="providerColumns"
        :data-source="provider.nodes || []"
        :row-key="row => row.host"
        size="small"
        :pagination="false"
        :locale="{ emptyText: t('noProviderData', 'No provider probes have been recorded.') }">
        <template slot="health" slot-scope="value, row">
          <a-tag :color="row.healthy ? 'green' : 'red'">{{ row.healthy ? t('healthy', 'Healthy') : t('unhealthy', 'Unavailable') }}</a-tag>
          <a-tag v-if="row.selected" color="blue">{{ t('selected', 'Selected') }}</a-tag>
        </template>
      </a-table>

      <div class="ops-section-title">{{ t('targetedSync', 'Targeted sync') }}</div>
      <div class="sync-form">
        <a-textarea v-model="syncForm.instruments" :rows="2" :placeholder="t('instrumentPlaceholder', 'CNStock:600519.SH, CNStock:000001.SZ')" />
        <a-range-picker v-model="syncForm.range" value-format="YYYY-MM-DD" />
        <a-button
          type="primary"
          icon="cloud-download"
          :loading="submitting"
          :disabled="!canStartSync"
          @click="startSync">
          {{ t('startSync', 'Start sync') }}
        </a-button>
      </div>

      <div class="ops-section-title ops-title-row">
        <span>{{ t('syncRuns', 'Sync runs') }}</span>
        <a-button type="link" icon="reload" @click="loadRuns">{{ t('refresh', 'Refresh') }}</a-button>
      </div>
      <a-table
        :columns="runColumns"
        :data-source="runs"
        :row-key="row => row.runId"
        size="small"
        :pagination="{ pageSize: 8 }"
        :scroll="{ x: 1050 }">
        <template slot="runStatus" slot-scope="value, row">
          <a-tag :color="statusColor(row.status)">{{ row.status }}</a-tag>
        </template>
        <template slot="progress" slot-scope="value, row">
          <a-progress :percent="runProgress(row)" size="small" :status="row.status === 'failed' ? 'exception' : 'normal'" />
        </template>
        <template slot="actions" slot-scope="value, row">
          <a-button v-if="canRetry(row)" type="link" size="small" icon="redo" @click="retryRun(row)">{{ t('retry', 'Retry') }}</a-button>
          <a-button v-if="canCancel(row)" type="link" size="small" icon="stop" @click="cancelRun(row)">{{ t('cancel', 'Cancel') }}</a-button>
        </template>
      </a-table>

      <div class="ops-section-title">{{ t('coverageDetail', 'Instrument coverage') }}</div>
      <div class="coverage-form">
        <a-input v-model="coverageForm.instrument" :placeholder="t('singleInstrument', 'CNStock:600519.SH')" />
        <a-range-picker v-model="coverageForm.range" value-format="YYYY-MM-DD" />
        <a-button icon="search" :loading="coverageLoading" :disabled="!coverageForm.instrument || !coverageRangeReady" @click="loadCoverage">
          {{ t('query', 'Query') }}
        </a-button>
      </div>
      <template v-if="coverage">
        <a-alert
          show-icon
          :type="coverage.assessment && coverage.assessment.complete ? 'success' : 'warning'"
          :message="`${coverage.instrument} · ${coverage.assessment && coverage.assessment.complete ? t('complete', 'Complete') : t('incomplete', 'Incomplete')}`"
          :description="coverageDescription" />
        <div class="adjustment-grid">
          <div v-for="mode in adjustmentRows" :key="mode.name" class="adjustment-row">
            <span>{{ mode.name }}</span>
            <a-tag :color="mode.complete ? 'green' : 'orange'">{{ mode.complete ? t('complete', 'Complete') : t('incomplete', 'Incomplete') }}</a-tag>
            <strong>{{ mode.firstTradeDate || '-' }} - {{ mode.lastTradeDate || '-' }}</strong>
            <small>{{ t('missing', 'Missing') }}: {{ Number(mode.missingSessions || 0) }} · {{ t('blocking', 'Blocking') }}: {{ Number(mode.blockingFindings || 0) }}</small>
          </div>
        </div>
        <a-collapse v-if="coverageGaps.length || coverage.findings.length" class="coverage-issues">
          <a-collapse-panel key="issues" :header="t('issues', 'Gaps and quality issues')">
            <div v-for="(gap, index) in coverageGaps" :key="`gap-${index}`" class="issue-row">
              <a-tag color="orange">{{ gap.reason || 'gap' }}</a-tag><span>{{ gap.startDate }} - {{ gap.endDate }}</span>
            </div>
            <div v-for="finding in coverage.findings" :key="finding.fingerprint" class="issue-row">
              <a-tag :color="finding.severity === 'blocking' ? 'red' : 'orange'">{{ finding.severity }}</a-tag><span>{{ finding.findingType }} · {{ finding.startDate }} - {{ finding.endDate }}</span>
            </div>
          </a-collapse-panel>
        </a-collapse>
      </template>
    </template>
  </section>
</template>

<script>
import moment from 'moment'
import {
  cancelMarketHistorySyncRun,
  createMarketHistorySyncRun,
  getMarketHistoryCapabilities,
  getMarketHistoryCoverage,
  getMarketHistoryDiskStatus,
  getMarketHistoryProviderHealth,
  listMarketHistorySyncRuns,
  retryMarketHistorySyncRun
} from '@/api/marketHistory'
import { marketHistoryUnavailableReason } from '@/utils/marketHistory'

export default {
  name: 'MarketHistoryOperations',
  data () {
    return {
      loading: false,
      submitting: false,
      coverageLoading: false,
      availability: 'loading',
      capabilities: {},
      provider: {},
      disk: {},
      runs: [],
      coverage: null,
      syncForm: { instruments: '', range: [moment().subtract(1, 'year').format('YYYY-MM-DD'), moment().format('YYYY-MM-DD')] },
      coverageForm: { instrument: '', range: [moment().subtract(1, 'year').format('YYYY-MM-DD'), moment().format('YYYY-MM-DD')] }
    }
  },
  computed: {
    roles () { return this.$store.getters.roles || [] },
    isAdmin () {
      return this.roles.some(role => String((role && role.id) || role).toLowerCase() === 'admin')
    },
    coverageSummary () { return this.capabilities.coverageSummary || {} },
    availabilityMessage () {
      if (this.availability === 'forbidden' || (!this.isAdmin && this.availability === 'loading')) return this.t('adminOnly', 'Administrator permission is required for market history operations.')
      if (this.availability === 'disabled') return this.t('backendDisabled', 'The backend has not enabled A-share history sync. Status is unavailable and sync controls are disabled.')
      if (this.availability === 'unsupported') return this.t('backendUnsupported', 'This backend version does not provide A-share history operations. Upgrade the backend to use this panel.')
      if (this.availability === 'error') return this.t('loadFailed', 'Market history status could not be loaded. No health or coverage state is being assumed.')
      return this.t('loading', 'Loading market history status...')
    },
    diskColor () {
      return ({ ok: 'green', soft: 'orange', hard: 'red' })[this.disk.level] || 'default'
    },
    canStartSync () {
      return this.isAdmin && this.capabilities.syncEnabled && this.disk.allowsNewSync && this.parsedInstruments.length > 0 && this.syncRangeReady
    },
    syncRangeReady () { return Array.isArray(this.syncForm.range) && this.syncForm.range.length === 2 },
    coverageRangeReady () { return Array.isArray(this.coverageForm.range) && this.coverageForm.range.length === 2 },
    parsedInstruments () {
      return this.syncForm.instruments.split(/[\s,;]+/).map(item => item.trim()).filter(Boolean)
    },
    providerColumns () {
      return [
        { title: this.t('node', 'Node'), dataIndex: 'host' },
        { title: this.t('status', 'Status'), key: 'health', scopedSlots: { customRender: 'health' } },
        { title: this.t('latency', 'Latency'), dataIndex: 'latencyMs', customRender: value => value === null || value === undefined ? '-' : `${Number(value).toFixed(0)} ms` },
        { title: this.t('failures', 'Failures'), dataIndex: 'consecutiveFailures' },
        { title: this.t('lastChecked', 'Last checked'), dataIndex: 'lastCheckedAt', customRender: this.formatTime },
        { title: this.t('lastSuccess', 'Last success'), dataIndex: 'lastSuccessAt', customRender: this.formatTime }
      ]
    },
    runColumns () {
      return [
        { title: 'Run ID', dataIndex: 'runId', width: 150, customRender: value => String(value || '').slice(0, 12) },
        { title: this.t('status', 'Status'), key: 'status', width: 100, scopedSlots: { customRender: 'runStatus' } },
        { title: this.t('range', 'Range'), key: 'range', width: 190, customRender: (value, row) => `${row.targetStart} - ${row.targetEnd}` },
        { title: this.t('progress', 'Progress'), key: 'progress', width: 150, scopedSlots: { customRender: 'progress' } },
        { title: this.t('currentInstrument', 'Current instrument'), dataIndex: 'currentInstrument', width: 170 },
        { title: this.t('lastError', 'Last error'), dataIndex: 'lastError', width: 220, ellipsis: true },
        { title: this.t('createdAt', 'Created'), dataIndex: 'createdAt', width: 165, customRender: this.formatTime },
        { title: this.t('actions', 'Actions'), key: 'actions', fixed: 'right', width: 140, scopedSlots: { customRender: 'actions' } }
      ]
    },
    adjustmentRows () {
      return Object.keys((this.coverage && this.coverage.adjustments) || {}).map(name => ({ name, ...(this.coverage.adjustments[name] || {}) }))
    },
    coverageGaps () {
      const report = this.coverage && this.coverage.assessment
      return (report && report.gaps) || []
    },
    coverageDescription () {
      const report = (this.coverage && this.coverage.assessment) || {}
      return `${this.t('expected', 'Expected')}: ${Number(report.expectedSessions || 0)} · ${this.t('actual', 'Actual')}: ${Number(report.actualSessions || 0)} · ${this.t('missing', 'Missing')}: ${this.coverageGaps.length}`
    }
  },
  mounted () {
    if (!this.isAdmin) {
      this.availability = 'forbidden'
      return
    }
    this.refreshAll()
  },
  watch: {
    isAdmin (value) {
      if (value && this.availability === 'forbidden') this.refreshAll()
    }
  },
  methods: {
    t (key, fallback) {
      const path = `settings.marketHistory.${key}`
      const translated = this.$t(path)
      return translated && translated !== path ? translated : fallback
    },
    async refreshAll () {
      this.loading = true
      try {
        this.capabilities = await getMarketHistoryCapabilities()
        this.availability = 'available'
        const results = await Promise.allSettled([
          getMarketHistoryProviderHealth(),
          getMarketHistoryDiskStatus(),
          listMarketHistorySyncRuns()
        ])
        if (results[0].status === 'fulfilled') this.provider = results[0].value
        if (results[1].status === 'fulfilled') this.disk = results[1].value
        if (results[2].status === 'fulfilled') this.runs = results[2].value || []
      } catch (error) {
        this.availability = marketHistoryUnavailableReason(error) || 'error'
      } finally {
        this.loading = false
      }
    },
    async loadRuns () {
      try { this.runs = await listMarketHistorySyncRuns() } catch (error) { this.$message.error(error.backendMessage || this.t('loadRunsFailed', 'Could not load sync runs.')) }
    },
    async startSync () {
      if (!this.canStartSync) return
      this.submitting = true
      try {
        const result = await createMarketHistorySyncRun({ instruments: this.parsedInstruments, startDate: this.syncForm.range[0], endDate: this.syncForm.range[1], requestKind: 'targeted' })
        this.$message.success(`${this.t('syncCreated', 'Sync run created')}: ${result.runId}`)
        await this.loadRuns()
      } catch (error) {
        this.$message.error(error.backendMessage || this.t('syncFailed', 'Could not create the sync run.'))
      } finally { this.submitting = false }
    },
    async retryRun (row) {
      try { await retryMarketHistorySyncRun(row.runId); this.$message.success(this.t('retryCreated', 'Retry run created.')); await this.loadRuns() } catch (error) { this.$message.error(error.backendMessage || this.t('retryFailed', 'Could not retry this run.')) }
    },
    async cancelRun (row) {
      try { await cancelMarketHistorySyncRun(row.runId); this.$message.success(this.t('cancelled', 'Run cancelled.')); await this.loadRuns() } catch (error) { this.$message.error(error.backendMessage || this.t('cancelFailed', 'Could not cancel this run.')) }
    },
    async loadCoverage () {
      this.coverageLoading = true
      try {
        this.coverage = await getMarketHistoryCoverage(this.coverageForm.instrument.trim(), { startDate: this.coverageForm.range[0], endDate: this.coverageForm.range[1] })
      } catch (error) {
        this.coverage = null
        this.$message.error(error.backendMessage || this.t('coverageFailed', 'Could not load instrument coverage.'))
      } finally { this.coverageLoading = false }
    },
    yesNo (value) { return value ? this.t('enabled', 'Enabled') : this.t('disabled', 'Disabled') },
    formatBytes (value) {
      const bytes = Number(value)
      if (!Number.isFinite(bytes)) return '-'
      const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
      let size = bytes
      let index = 0
      while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1 }
      return `${size.toFixed(index > 1 ? 1 : 0)} ${units[index]}`
    },
    formatTime (value) { return value ? moment(value).format('YYYY-MM-DD HH:mm') : '-' },
    statusColor (status) { return ({ pending: 'blue', running: 'blue', succeeded: 'green', partial: 'orange', failed: 'red', paused: 'orange', cancelled: 'default' })[status] || 'default' },
    runProgress (row) {
      const total = Number(row.totalSymbols || 0)
      const done = Number(row.succeededSymbols || 0) + Number(row.failedSymbols || 0) + Number(row.skippedSymbols || 0)
      return total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0
    },
    canRetry (row) { return this.isAdmin && ['failed', 'partial', 'paused'].includes(row.status) },
    canCancel (row) { return this.isAdmin && ['pending', 'running', 'paused'].includes(row.status) }
  }
}
</script>

<style scoped>
.history-ops { margin-top: 24px; padding-top: 24px; border-top: 1px solid #e8e8e8; }
.ops-heading, .ops-title-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.ops-heading h4 { margin: 0 0 4px; color: #1f2937; font-size: 16px; }
.ops-heading p { margin: 0; color: #6b7280; }
.ops-alert { margin-top: 16px; }
.ops-status-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 16px; border: 1px solid #e8e8e8; }
.ops-status { min-width: 0; padding: 12px; border-right: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8; }
.ops-status span { display: block; color: #8c8c8c; font-size: 12px; }
.ops-status strong { display: block; overflow: hidden; margin-top: 4px; color: #262626; text-overflow: ellipsis; white-space: nowrap; }
.ops-section-title { margin: 24px 0 10px; color: #262626; font-size: 14px; font-weight: 600; }
.sync-form, .coverage-form { display: grid; grid-template-columns: minmax(260px, 1fr) 250px auto; align-items: start; gap: 10px; }
.adjustment-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.adjustment-row { display: grid; grid-template-columns: 1fr auto; gap: 5px 8px; padding: 10px; border: 1px solid #e8e8e8; }
.adjustment-row strong, .adjustment-row small { grid-column: 1 / -1; }
.adjustment-row small { color: #8c8c8c; }
.coverage-issues { margin-top: 10px; }
.issue-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
.theme-dark .history-ops { border-top-color: #303030; }
.theme-dark .ops-heading h4, .theme-dark .ops-section-title, .theme-dark .ops-status strong { color: #f0f0f0; }
.theme-dark .ops-heading p { color: rgba(255, 255, 255, .52); }
.theme-dark .ops-status-grid, .theme-dark .ops-status, .theme-dark .adjustment-row { border-color: #303030; }
@media (max-width: 1000px) { .ops-status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .adjustment-grid { grid-template-columns: 1fr; } }
@media (max-width: 720px) { .ops-heading { align-items: flex-start; flex-direction: column; } .sync-form, .coverage-form { grid-template-columns: 1fr; } .ops-status-grid { grid-template-columns: 1fr; } }
</style>
