<template>
  <div class="external-request-logs-page">
    <div class="page-header">
      <h2><a-icon type="file-search" /> {{ $t('externalRequestLogs.title') || 'Data Request Logs' }}</h2>
      <p>{{ $t('externalRequestLogs.description') || 'Read-only health and diagnostic records for external data providers.' }}</p>
    </div>
    <a-alert v-if="capabilityUnavailable" type="info" show-icon :message="$t('externalRequestLogs.unavailable') || 'This backend has not enabled data request logs yet.'" />
    <template v-else>
      <a-row :gutter="16" class="summary" v-if="overview">
        <a-col :span="6"><a-card><a-statistic title="External calls (24h)" :value="overview.external_calls" /></a-card></a-col>
        <a-col :span="6"><a-card><a-statistic title="Success rate" :value="overview.success_rate || 0" suffix="%" /></a-card></a-col>
        <a-col :span="6"><a-card><a-statistic title="Cache hit rate" :value="overview.cache_hit_rate || 0" suffix="%" /></a-card></a-col>
        <a-col :span="6"><a-card><a-statistic title="Timeouts" :value="(overview.result_counts || {}).timeout || 0" /></a-card></a-col>
      </a-row>
      <a-card :bordered="false" class="log-card">
        <div class="filters">
          <a-input v-model="filters.provider" placeholder="Provider" allow-clear @pressEnter="reload" />
          <a-input v-model="filters.data_domain" placeholder="Data domain" allow-clear @pressEnter="reload" />
          <a-select v-model="filters.result" allow-clear placeholder="Result" style="width: 160px">
            <a-select-option v-for="value in results" :key="value" :value="value">{{ value }}</a-select-option>
          </a-select>
          <a-button type="primary" @click="reload"><a-icon type="search" /> Filter</a-button>
        </div>
        <a-table :columns="columns" :data-source="items" :loading="loading" :row-key="row => row.id" :pagination="pagination" @change="onTableChange">
          <template slot="result" slot-scope="value"><a-tag :color="value === 'success' ? 'green' : 'red'">{{ value }}</a-tag></template>
          <template slot="duration" slot-scope="value">{{ value }} ms</template>
          <template slot="logId" slot-scope="value">#{{ value }}</template>
          <template slot="callingFeature" slot-scope="value">{{ formatCallingFeature(value) }}</template>
          <template slot="action" slot-scope="_, row"><a-button type="link" size="small" @click="showDetail(row)">Details</a-button></template>
        </a-table>
      </a-card>
      <a-drawer title="Data Request Log" :visible="!!detail" width="560" @close="detail = null">
        <a-descriptions v-if="detail" bordered :column="1" size="small">
          <a-descriptions-item v-for="key in detailKeys" :key="key" :label="key">{{ detail[key] || '-' }}</a-descriptions-item>
        </a-descriptions>
      </a-drawer>
    </template>
  </div>
</template>

<script>
import { getExternalDataRequestLog, getExternalDataRequestOverview, listExternalDataRequestLogs } from '@/api/externalDataRequestLogs'

export default {
  name: 'ExternalDataRequestLogs',
  data () {
    return { loading: false, capabilityUnavailable: false, overview: null, items: [], detail: null, filters: { provider: '', data_domain: '', result: '' }, results: ['success', 'timeout', 'rate_limited', 'provider_error', 'network_error', 'invalid_response', 'disabled', 'skipped'], pagination: { current: 1, pageSize: 20, total: 0 }, detailKeys: ['id', 'occurred_at', 'provider', 'data_domain', 'operation', 'call_source', 'subject_summary', 'fallback_index', 'retry_count', 'duration_ms', 'result', 'http_status', 'error_summary', 'request_id'] }
  },
  computed: {
    columns () {
      return [
        { title: this.$t('externalRequestLogs.logId'), dataIndex: 'id', scopedSlots: { customRender: 'logId' } },
        { title: this.$t('externalRequestLogs.time'), dataIndex: 'occurred_at' },
        { title: this.$t('externalRequestLogs.provider'), dataIndex: 'provider' },
        { title: this.$t('externalRequestLogs.domain'), dataIndex: 'data_domain' },
        { title: this.$t('externalRequestLogs.operation'), dataIndex: 'operation' },
        { title: this.$t('externalRequestLogs.callingFeature'), dataIndex: 'call_source', scopedSlots: { customRender: 'callingFeature' } },
        { title: this.$t('externalRequestLogs.requestId'), dataIndex: 'request_id' },
        { title: this.$t('externalRequestLogs.result'), dataIndex: 'result', scopedSlots: { customRender: 'result' } },
        { title: this.$t('externalRequestLogs.duration'), dataIndex: 'duration_ms', scopedSlots: { customRender: 'duration' } },
        { title: '', scopedSlots: { customRender: 'action' } }
      ]
    }
  },
  created () { this.reload() },
  methods: {
    formatCallingFeature (featureCode) {
      const key = `externalRequestLogs.features.${featureCode || 'notRecorded'}`
      const translated = this.$t(key)
      return translated === key ? this.$t('externalRequestLogs.features.notRecorded') : translated
    },
    async reload () {
      this.loading = true
      try {
        const [overviewResp, logsResp] = await Promise.all([getExternalDataRequestOverview(), listExternalDataRequestLogs({ ...this.filters, page: this.pagination.current, page_size: this.pagination.pageSize })])
        const overviewData = overviewResp.data || overviewResp
        const logsData = logsResp.data || logsResp
        this.overview = overviewData.overview || overviewData
        this.items = logsData.items || []
        this.pagination.total = logsData.total || 0
      } catch (error) {
        if (error && error.response && error.response.status === 503) this.capabilityUnavailable = true
        else this.$message.error((error && error.backendMessage) || 'Failed to load data request logs')
      } finally { this.loading = false }
    },
    onTableChange (pagination) { this.pagination.current = pagination.current; this.pagination.pageSize = pagination.pageSize; this.reload() },
    async showDetail (row) { const response = await getExternalDataRequestLog(row.id); this.detail = response.data || response }
  }
}
</script>

<style scoped>
.page-header { margin-bottom: 16px; } .summary { margin-bottom: 16px; } .log-card { margin-top: 16px; } .filters { display: flex; gap: 12px; margin-bottom: 16px; } .filters .ant-input { width: 180px; }
</style>
