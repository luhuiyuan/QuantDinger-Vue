<template>
  <div class="data-source-operations">
    <header class="operations-header">
      <div>
        <h2><a-icon type="deployment-unit" /> {{ $t('dataSources.title') }}</h2>
        <div class="status-line">
          <a-badge :status="ready ? 'success' : 'error'" :text="ready ? 'Ready' : 'Not ready'" />
          <span v-if="lastUpdated">{{ formatTime(lastUpdated) }}</span>
        </div>
      </div>
      <a-button-group>
        <a-button @click="$router.push('/external-data-request-logs')"><a-icon type="file-search" /> {{ $t('dataSources.logs') }}</a-button>
        <a-button @click="$router.push({ path: '/settings', query: { section: 'data_sources' } })"><a-icon type="setting" /> {{ $t('dataSources.settings') }}</a-button>
        <a-button type="primary" :loading="loading" @click="reload"><a-icon type="reload" /> {{ $t('dataSources.refresh') }}</a-button>
      </a-button-group>
    </header>

    <a-alert v-if="unavailable" type="info" show-icon :message="$t('dataSources.oldBackend')" />
    <template v-else>
      <a-alert
        v-if="!ready"
        class="readiness-alert"
        type="warning"
        show-icon
        :message="$t('dataSources.notReady')"
        :description="readinessReason"
      />
      <a-tabs v-model="activeTab" :animated="false">
        <a-tab-pane key="overview" :tab="$t('dataSources.overview')">
          <section class="metric-grid">
            <a-card v-for="metric in metrics" :key="metric.key" size="small">
              <a-statistic :title="metric.title" :value="metric.value" />
            </a-card>
          </section>
          <section class="overview-grid">
            <div>
              <h3>Routing outcomes · 24h</h3>
              <a-list size="small" bordered :data-source="routingOutcomes">
                <a-list-item slot="renderItem" slot-scope="item"><span>{{ item.key }}</span><strong>{{ item.value }}</strong></a-list-item>
              </a-list>
            </div>
            <div>
              <h3>Pending operations</h3>
              <a-descriptions bordered size="small" :column="1">
                <a-descriptions-item label="Pending credentials">{{ overview.pending_credentials || 0 }}</a-descriptions-item>
                <a-descriptions-item label="Capability issues">{{ overview.capability_issues || 0 }}</a-descriptions-item>
                <a-descriptions-item label="Quarantined">{{ overview.quarantined || 0 }}</a-descriptions-item>
                <a-descriptions-item label="Disabled policies">{{ overview.disabled_policies || 0 }}</a-descriptions-item>
              </a-descriptions>
            </div>
          </section>
          <section class="overview-grid secondary-overview">
            <div>
              <h3>Active incidents</h3>
              <a-table size="small" :data-source="overview.active_incidents || []" :row-key="row => row.state_id" :pagination="false">
                <a-table-column title="Instance" data-index="instance_id" />
                <a-table-column title="Capability" data-index="capability_key" />
                <a-table-column title="Health" data-index="health_status" />
                <a-table-column title="Circuit" data-index="circuit_state" />
              </a-table>
            </div>
            <div>
              <h3>Quota pressure</h3>
              <a-table size="small" :data-source="overview.quota_pressure || []" :row-key="row => `${row.instance_id}:${row.bucket_key}`" :pagination="false">
                <a-table-column title="Instance" data-index="instance_id" />
                <a-table-column title="Bucket" data-index="bucket_key" />
                <a-table-column title="Used + held" :custom-render="(_, row) => Number(row.consumed || 0) + Number(row.reserved || 0)" />
                <a-table-column title="Limit" data-index="effective_limit" />
              </a-table>
            </div>
          </section>
          <section class="fallback-band">
            <h3>Fallback trend · 24h</h3>
            <div class="trend-strip">
              <div v-for="bucket in (overview.fallback_trend_24h || [])" :key="bucket.bucket" class="trend-cell" :title="formatTime(bucket.bucket)">
                <span :style="{ height: `${Math.max(3, Math.min(48, Number(bucket.fallback_attempts || 0) * 4))}px` }" />
                <small>{{ bucket.fallback_attempts || 0 }}</small>
              </div>
              <a-empty v-if="!(overview.fallback_trend_24h || []).length" :image="simpleEmptyImage" />
            </div>
          </section>
          <section class="fallback-band">
            <h3>{{ $t('dataSources.legacyImports') }}</h3>
            <a-table size="small" :data-source="legacyImports" row-key="adapter_key" :pagination="false">
              <a-table-column title="Adapter" data-index="adapter_key" />
              <a-table-column title="Detected" :custom-render="(_, row) => row.detected ? 'Yes' : 'No'" />
              <a-table-column title="Source" :custom-render="(_, row) => (row.source_names || []).join(', ') || '-'" />
              <a-table-column title="Status" data-index="import_status" />
              <a-table-column title="Instance" data-index="instance_id" />
              <a-table-column title="" :custom-render="(_, row) => can('data_sources:credentials') && row.detected && row.import_status !== 'imported' ? $createElement('a-button', { props: { type: 'link', size: 'small' }, on: { click: () => openLegacyImport(row) } }, [$t('dataSources.import')]) : null" />
            </a-table>
          </section>
        </a-tab-pane>

        <a-tab-pane key="instances" :tab="$t('dataSources.instances')">
          <div class="table-toolbar">
            <a-input-search v-model="instanceSearch" placeholder="Instance / Adapter" allow-clear />
            <a-button v-if="can('data_sources:instances')" type="primary" @click="openCreate"><a-icon type="plus" /> {{ $t('dataSources.createInstance') }}</a-button>
          </div>
          <a-table
            :columns="instanceColumns"
            :data-source="filteredInstances"
            :loading="loading"
            row-key="id"
            :pagination="instancePagination"
            @change="onInstancePage"
          >
            <template slot="status" slot-scope="value"><a-tag :color="statusColor(value)">{{ value }}</a-tag></template>
            <template slot="credential" slot-scope="value"><a-icon :type="value ? 'check-circle' : 'minus-circle'" :class="value ? 'ok' : 'muted'" /></template>
            <template slot="actions" slot-scope="_, row"><a-button type="link" size="small" @click="openInstance(row.id)"><a-icon type="eye" /> Details</a-button></template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="policies" :tab="$t('dataSources.policies')">
          <a-table :columns="policyColumns" :data-source="policies" :loading="loading" row-key="capability_key" :pagination="false">
            <template slot="enabled" slot-scope="value"><a-badge :status="value ? 'success' : 'default'" :text="value ? 'Enabled' : 'Disabled'" /></template>
            <template slot="route" slot-scope="entries"><span v-if="entries && entries.length">{{ entries.map(item => item.display_name).join(' → ') }}</span><span v-else class="muted">No active route</span></template>
            <template slot="actions" slot-scope="_, row"><a-button type="link" size="small" @click="openPolicy(row)"><a-icon type="ordered-list" /> Manage</a-button></template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </template>

    <a-drawer title="Provider Instance" :visible="!!selectedInstance" width="720" @close="selectedInstance = null">
      <template v-if="selectedInstance">
        <div class="drawer-actions">
          <a-button v-if="can('data_sources:credentials')" @click="openCredentials"><a-icon type="key" /> {{ $t('dataSources.credentials') }}</a-button>
          <a-button v-if="can('data_sources:instances') && ['draft', 'validation_failed'].includes(selectedInstance.lifecycle_status)" @click="openAction('activate')"><a-icon type="check" /> Activate</a-button>
          <a-button v-if="can('data_sources:instances') && selectedInstance.lifecycle_status === 'active'" @click="openAction('disable')"><a-icon type="stop" /> Disable</a-button>
          <a-button v-if="can('data_sources:instances') && selectedInstance.lifecycle_status === 'disabled'" danger @click="openAction('retire')"><a-icon type="delete" /> Retire</a-button>
        </div>
        <a-alert v-if="(selectedInstance.retirement_blockers || []).length" type="warning" show-icon message="Retirement blocked by active routing policies" :description="selectedInstance.retirement_blockers.map(item => item.capability_key).join(', ')" />
        <a-descriptions bordered size="small" :column="2">
          <a-descriptions-item label="Name">{{ selectedInstance.display_name }}</a-descriptions-item>
          <a-descriptions-item label="Status"><a-tag :color="statusColor(selectedInstance.lifecycle_status)">{{ selectedInstance.lifecycle_status }}</a-tag></a-descriptions-item>
          <a-descriptions-item label="Adapter">{{ selectedInstance.adapter_key }}</a-descriptions-item>
          <a-descriptions-item label="Account">{{ selectedInstance.provider_account_identity || '-' }}</a-descriptions-item>
          <a-descriptions-item label="Credential">{{ selectedInstance.credential && selectedInstance.credential.configured ? `Configured · key ${selectedInstance.credential.encryption_key_id}` : 'Not configured' }}</a-descriptions-item>
          <a-descriptions-item label="Config version">{{ selectedInstance.config_version }}</a-descriptions-item>
        </a-descriptions>
        <h3 class="section-title">Capabilities</h3>
        <a-table size="small" :columns="capabilityColumns" :data-source="selectedInstance.capabilities || []" row-key="capability_key" :pagination="false">
          <template slot="eligibility" slot-scope="value"><a-tag :color="statusColor(value)">{{ value }}</a-tag></template>
          <template slot="capActions" slot-scope="_, row"><a-button v-if="can('data_sources:diagnostics')" type="link" size="small" @click="runDiagnostic(row.capability_key)"><a-icon type="experiment" /> Test</a-button></template>
        </a-table>
        <h3 class="section-title">Health & circuits</h3>
        <a-table size="small" :columns="healthColumns" :data-source="selectedInstance.health || []" :row-key="row => row.state_id" :pagination="false">
          <template slot="health" slot-scope="value"><a-tag :color="statusColor(value)">{{ value }}</a-tag></template>
          <template slot="healthActions" slot-scope="_, row">
            <a-dropdown v-if="can('data_sources:diagnostics')">
              <a-button type="link" size="small">Actions <a-icon type="down" /></a-button>
              <a-menu slot="overlay" @click="event => openHealthAction(event.key, row)">
                <a-menu-item key="quarantine">Quarantine</a-menu-item>
                <a-menu-item key="extend-circuit">Extend circuit</a-menu-item>
                <a-menu-item key="recovery-probe">Recovery probe</a-menu-item>
              </a-menu>
            </a-dropdown>
          </template>
        </a-table>
        <h3 class="section-title">Quota</h3>
        <a-table size="small" :columns="quotaColumns" :data-source="selectedInstance.quota || []" :row-key="row => `${row.capability_key || 'instance'}:${row.bucket_key}`" :pagination="false" />
        <h3 class="section-title">Recent health evidence</h3>
        <a-table size="small" :data-source="selectedInstance.health_evidence || []" :row-key="row => `${row.health_state_id}:${row.occurred_at}:${row.evidence_kind}`" :pagination="false">
          <a-table-column title="Time" data-index="occurred_at" />
          <a-table-column title="Capability" data-index="capability_key" />
          <a-table-column title="Evidence" data-index="evidence_kind" />
          <a-table-column title="Scope" data-index="permanence" />
          <a-table-column title="Summary" data-index="sanitized_summary" />
        </a-table>
      </template>
    </a-drawer>

    <a-drawer title="Routing Policy" :visible="!!selectedPolicy" width="680" @close="selectedPolicy = null">
      <template v-if="selectedPolicy">
        <a-descriptions bordered size="small" :column="2">
          <a-descriptions-item label="Capability">{{ selectedPolicy.capability_key }}</a-descriptions-item>
          <a-descriptions-item label="Version">{{ selectedPolicy.policy_version }}</a-descriptions-item>
        </a-descriptions>
        <div class="policy-editor">
          <div v-for="(entry, index) in policyEntries" :key="`${entry.instance_id}:${index}`" class="policy-entry">
            <span class="policy-rank">{{ index + 1 }}</span>
            <a-select v-model="entry.instance_id" show-search option-filter-prop="children">
              <a-select-option v-for="item in eligibleInstances" :key="item.id" :value="item.id">{{ item.display_name }} · {{ item.adapter_key }}</a-select-option>
            </a-select>
            <a-button icon="arrow-up" :disabled="index === 0" title="Move up" @click="movePolicyEntry(index, -1)" />
            <a-button icon="arrow-down" :disabled="index === policyEntries.length - 1" title="Move down" @click="movePolicyEntry(index, 1)" />
            <a-button icon="delete" title="Remove" @click="policyEntries.splice(index, 1)" />
          </div>
          <a-button block type="dashed" @click="policyEntries.push({ instance_id: null })"><a-icon type="plus" /> Add fallback</a-button>
        </div>
        <a-alert v-if="policyPreview" type="info" show-icon :message="policyPreviewSummary" />
        <div class="drawer-actions policy-actions">
          <a-button v-if="can('data_sources:routing')" :loading="actionLoading" @click="savePolicyDraft"><a-icon type="save" /> {{ $t('dataSources.saveDraft') }}</a-button>
          <a-button v-if="can('data_sources:routing')" @click="previewPolicy"><a-icon type="eye" /> {{ $t('dataSources.preview') }}</a-button>
          <a-button v-if="can('data_sources:routing')" type="primary" @click="openAction('publish-policy')"><a-icon type="upload" /> {{ $t('dataSources.publish') }}</a-button>
          <a-button v-if="can('data_sources:routing')" @click="openAction('disable-policy')"><a-icon type="stop" /> {{ $t('dataSources.disable') }}</a-button>
          <a-button v-if="can('data_sources:routing')" @click="openAction('restore-policy')"><a-icon type="history" /> {{ $t('dataSources.restore') }}</a-button>
        </div>
        <h3 class="section-title">Revision history</h3>
        <a-table size="small" :data-source="selectedPolicy.revisions || []" row-key="id" :pagination="false">
          <a-table-column title="Revision" data-index="revision_number" />
          <a-table-column title="Status" data-index="revision_status" />
          <a-table-column title="Published" data-index="published_at" />
          <a-table-column title="Route" :custom-render="(_, row) => (row.entries || []).map(item => item.display_name).join(' → ')" />
          <a-table-column title="" :custom-render="(_, row) => can('data_sources:routing') ? $createElement('a-button', { props: { type: 'link', size: 'small' }, on: { click: () => openAction('restore-policy', row) } }, ['Restore']) : null" />
        </a-table>
      </template>
    </a-drawer>

    <a-drawer title="Routed Data Request" :visible="!!selectedRoutedRequest" width="720" @close="selectedRoutedRequest = null">
      <template v-if="selectedRoutedRequest">
        <a-descriptions bordered size="small" :column="1">
          <a-descriptions-item label="Routed ID">{{ selectedRoutedRequest.routed_request_id }}</a-descriptions-item>
          <a-descriptions-item label="Capability">{{ selectedRoutedRequest.capability_key }}</a-descriptions-item>
          <a-descriptions-item label="Calling feature">{{ selectedRoutedRequest.calling_feature }}</a-descriptions-item>
          <a-descriptions-item label="Outcome">{{ selectedRoutedRequest.final_outcome }}</a-descriptions-item>
          <a-descriptions-item label="Policy revision">{{ selectedRoutedRequest.policy_revision_id }}</a-descriptions-item>
        </a-descriptions>
        <h3 class="section-title">Attempt chain</h3>
        <a-table size="small" :data-source="selectedRoutedRequest.attempts || []" :row-key="row => `${row.attempt_order}:${row.provider_instance_id || row.provider}`" :pagination="false">
          <a-table-column title="#" data-index="attempt_order" />
          <a-table-column title="Provider" data-index="provider" />
          <a-table-column title="Result" data-index="result" />
          <a-table-column title="Skip reason" data-index="skip_reason" />
          <a-table-column title="Quality" data-index="quality_outcome" />
        </a-table>
      </template>
    </a-drawer>

    <a-modal title="New Provider Instance" :visible="createVisible" :confirm-loading="actionLoading" @ok="createInstance" @cancel="createVisible = false">
      <a-form layout="vertical">
        <a-form-item label="Instance key"><a-input v-model="createForm.instanceKey" /></a-form-item>
        <a-form-item label="Adapter key"><a-input v-model="createForm.adapterKey" /></a-form-item>
        <a-form-item label="Display name"><a-input v-model="createForm.displayName" /></a-form-item>
        <a-form-item label="Non-secret config (JSON)"><a-textarea v-model="createForm.config" :rows="4" /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal :title="actionTitle" :visible="actionVisible" :confirm-loading="actionLoading" @ok="submitAction" @cancel="actionVisible = false">
      <a-form layout="vertical">
        <a-form-item :label="$t('dataSources.reason')"><a-textarea v-model="actionForm.reason" :rows="3" /></a-form-item>
        <a-form-item v-if="actionForm.kind === 'restore-policy'" label="Revision ID"><a-input-number v-model="actionForm.revisionId" :min="1" /></a-form-item>
        <a-form-item v-if="actionForm.kind === 'extend-circuit'" label="Circuit open until"><a-date-picker v-model="actionForm.until" show-time /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal :title="credentialForm.importAdapter ? $t('dataSources.legacyImport') : $t('dataSources.credentials')" :visible="credentialVisible" :confirm-loading="actionLoading" @ok="submitCredentials" @cancel="closeCredentials">
      <a-alert type="warning" show-icon :message="credentialForm.importAdapter ? $t('dataSources.legacyImportWarning') : 'Credentials are write-only and will not be shown again.'" />
      <a-form layout="vertical">
        <a-form-item v-if="!credentialForm.importAdapter" label="Credentials (JSON)"><a-textarea v-model="credentialForm.credentials" :rows="5" autocomplete="new-password" /></a-form-item>
        <a-form-item :label="$t('dataSources.reason')"><a-input v-model="credentialForm.reason" /></a-form-item>
        <a-form-item label="Password"><a-input-password v-model="credentialForm.password" autocomplete="current-password" /></a-form-item>
        <a-form-item label="MFA code (instead of password)"><a-input v-model="credentialForm.mfaCode" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script>
import moment from 'moment'
import { Empty } from 'ant-design-vue'
import {
  createProviderInstance, extendProviderCircuit, getDataSourceOverview, getProviderInstance, getRoutedDataRequest,
  getRoutingPolicy, importLegacyCredential, issueDataSourceStepUp, listLegacyCredentialImports, listProviderInstances, listRoutingPolicies, previewRoutingPolicyDraft,
  quarantineProviderHealth, requestRecoveryProbe, runProviderDiagnostic, runProviderInstanceAction,
  runRoutingPolicyAction, saveRoutingPolicyDraft, submitProviderCredentials
} from '@/api/dataSourceOperations'

export default {
  name: 'DataSourceOperations',
  data () {
    return {
      activeTab: this.$route.query.tab || 'overview',
      loading: false,
      actionLoading: false,
      unavailable: false,
      overview: {},
      instances: [],
      policies: [],
      legacyImports: [],
      lastUpdated: null,
      selectedInstance: null,
      selectedPolicy: null,
      selectedRoutedRequest: null,
      policyEntries: [],
      policyPreview: null,
      instanceSearch: '',
      instancePagination: { current: 1, pageSize: 50, total: 0 },
      pollTimer: null,
      createVisible: false,
      createForm: { instanceKey: '', adapterKey: '', displayName: '', config: '{}' },
      actionVisible: false,
      actionForm: { kind: '', reason: '', target: null, revisionId: null, until: null },
      credentialVisible: false,
      credentialForm: { credentials: '{}', reason: '', password: '', mfaCode: '', importAdapter: '' }
    }
  },
  computed: {
    permissions () {
      const permissions = new Set()
      for (const role of (this.$store.getters.roles || [])) for (const item of (role.permissionList || [])) permissions.add(item)
      return permissions
    },
    simpleEmptyImage () { return Empty.PRESENTED_IMAGE_SIMPLE },
    ready () { return !!(this.overview.readiness && this.overview.readiness.ready) },
    readinessReason () { return (this.overview.readiness && (this.overview.readiness.reason || (this.overview.readiness.blockers || []).join(', '))) || '' },
    metrics () {
      return [
        { key: 'instances', title: 'Provider instances', value: this.overview.instances || 0 },
        { key: 'active', title: 'Active instances', value: this.overview.active_instances || 0 },
        { key: 'circuits', title: 'Open circuits', value: this.overview.open_circuits || 0 },
        { key: 'policies', title: 'Enabled policies', value: this.overview.enabled_policies || 0 }
      ]
    },
    routingOutcomes () { return Object.entries(this.overview.routing_outcomes_24h || {}).map(([key, value]) => ({ key, value })) },
    filteredInstances () {
      const needle = this.instanceSearch.trim().toLowerCase()
      if (!needle) return this.instances
      return this.instances.filter(item => `${item.display_name} ${item.instance_key} ${item.adapter_key}`.toLowerCase().includes(needle))
    },
    eligibleInstances () { return this.instances.filter(item => item.lifecycle_status === 'active') },
    policyPreviewSummary () { return `Valid: ${this.policyPreview.valid ? 'yes' : 'no'} · ${JSON.stringify(this.policyPreview.changes || this.policyPreview)}` },
    actionTitle () { return (this.actionForm.kind || 'Management action').replace(/-/g, ' ') },
    instanceColumns () {
      return [
        { title: 'Name', dataIndex: 'display_name' }, { title: 'Adapter', dataIndex: 'adapter_key' },
        { title: 'Status', dataIndex: 'lifecycle_status', scopedSlots: { customRender: 'status' } },
        { title: 'Credential', dataIndex: 'credential_configured', scopedSlots: { customRender: 'credential' } },
        { title: 'Account', dataIndex: 'provider_account_identity' }, { title: '', scopedSlots: { customRender: 'actions' }, width: 100 }
      ]
    },
    policyColumns () {
      return [
        { title: 'Capability', dataIndex: 'capability_key' }, { title: 'Status', dataIndex: 'enabled', scopedSlots: { customRender: 'enabled' } },
        { title: 'Effective route', dataIndex: 'entries', scopedSlots: { customRender: 'route' } },
        { title: 'Version', dataIndex: 'policy_version', width: 90 }, { title: '', scopedSlots: { customRender: 'actions' }, width: 110 }
      ]
    },
    capabilityColumns () { return [{ title: 'Capability', dataIndex: 'capability_key' }, { title: 'Eligibility', dataIndex: 'eligibility_status', scopedSlots: { customRender: 'eligibility' } }, { title: 'Last verified', dataIndex: 'last_verified_at' }, { title: '', scopedSlots: { customRender: 'capActions' } }] },
    healthColumns () { return [{ title: 'Capability', dataIndex: 'capability_key', customRender: value => value || 'Instance' }, { title: 'Health', dataIndex: 'health_status', scopedSlots: { customRender: 'health' } }, { title: 'Circuit', dataIndex: 'circuit_state' }, { title: 'Reason', dataIndex: 'circuit_reason' }, { title: '', scopedSlots: { customRender: 'healthActions' }, width: 100 }] },
    quotaColumns () { return [{ title: 'Capability', dataIndex: 'capability_key' }, { title: 'Bucket', dataIndex: 'bucket_key' }, { title: 'Consumed', dataIndex: 'consumed' }, { title: 'Reserved', dataIndex: 'reserved' }, { title: 'Limit', dataIndex: 'configured_limit' }, { title: 'Reset', dataIndex: 'reset_at' }] }
  },
  watch: {
    activeTab (tab) { this.$router.replace({ query: { ...this.$route.query, tab } }).catch(() => {}) }
  },
  created () {
    this.reload()
    if (this.$route.query.routed_request_id) this.openRoutedRequest(this.$route.query.routed_request_id)
    this.pollTimer = window.setInterval(() => { if (!document.hidden) this.reload(false) }, 15000)
  },
  beforeDestroy () { window.clearInterval(this.pollTimer) },
  methods: {
    can (permission) { return this.permissions.has(permission) },
    unwrap (response) { return response && response.code !== undefined ? response.data : ((response && response.data) || response || {}) },
    formatTime (value) { return value ? moment(value).format('YYYY-MM-DD HH:mm:ss') : '-' },
    statusColor (value) { return ({ active: 'green', healthy: 'green', eligible: 'green', draft: 'blue', disabled: 'orange', quarantined: 'red', unhealthy: 'red', validation_failed: 'red', migration_required: 'purple' })[value] || 'default' },
    async reload (foreground = true) {
      if (foreground) this.loading = true
      try {
        const [overview, instances, policies, legacyImports] = await Promise.all([
          getDataSourceOverview(), listProviderInstances({ limit: this.instancePagination.pageSize, offset: (this.instancePagination.current - 1) * this.instancePagination.pageSize }), listRoutingPolicies(), listLegacyCredentialImports()
        ])
        this.overview = this.unwrap(overview); const instanceData = this.unwrap(instances); const policyData = this.unwrap(policies); const legacyData = this.unwrap(legacyImports)
        this.instances = instanceData.items || []; this.instancePagination.total = instanceData.total || this.instances.length
        this.policies = policyData.items || []; this.legacyImports = legacyData.items || []; this.unavailable = false; this.lastUpdated = new Date()
      } catch (error) {
        const status = error && error.response && error.response.status
        this.unavailable = status === 404 || status === 501
        if (!this.unavailable && foreground) this.$message.error(error.backendMessage || 'Failed to load data source operations')
      } finally { if (foreground) this.loading = false }
    },
    onInstancePage (pagination) { this.instancePagination.current = pagination.current; this.instancePagination.pageSize = pagination.pageSize; this.reload() },
    openCreate () { this.createForm = { instanceKey: '', adapterKey: '', displayName: '', config: '{}' }; this.createVisible = true },
    async createInstance () {
      this.actionLoading = true
      try {
        await createProviderInstance({ ...this.createForm, config: JSON.parse(this.createForm.config || '{}') })
        this.createVisible = false; await this.reload(); this.$message.success('Provider Instance created')
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.actionLoading = false }
    },
    async openInstance (id) { this.selectedInstance = this.unwrap(await getProviderInstance(id)) },
    async openRoutedRequest (id) {
      try { this.selectedRoutedRequest = this.unwrap(await getRoutedDataRequest(id)) } catch (error) { this.$message.error(error.backendMessage || 'Routed Data Request is unavailable') }
    },
    openAction (kind, target = null) { this.actionForm = { kind, reason: '', target, revisionId: kind === 'restore-policy' && target ? target.id : null, until: null }; this.actionVisible = true },
    async submitAction () {
      if (!this.actionForm.reason.trim()) return this.$message.warning('Reason is required')
      this.actionLoading = true
      try {
        const kind = this.actionForm.kind
        if (['activate', 'disable', 'retire'].includes(kind)) {
          await runProviderInstanceAction(this.selectedInstance.id, kind, { reason: this.actionForm.reason })
          await this.openInstance(this.selectedInstance.id)
        } else if (kind.endsWith('-policy')) {
          const action = kind.replace('-policy', '')
          await runRoutingPolicyAction(this.selectedPolicy.capability_key, action, { policyVersion: this.selectedPolicy.policy_version, revisionId: this.actionForm.revisionId, reason: this.actionForm.reason })
          this.selectedPolicy = null
        } else {
          const row = this.actionForm.target
          const body = { stateVersion: row.state_version, reason: this.actionForm.reason }
          if (kind === 'quarantine') await quarantineProviderHealth(row.state_id, body)
          if (kind === 'extend-circuit') await extendProviderCircuit(row.state_id, { ...body, until: this.actionForm.until && this.actionForm.until.toISOString() })
          if (kind === 'recovery-probe') await requestRecoveryProbe(row.state_id, body)
          await this.openInstance(this.selectedInstance.id)
        }
        this.actionVisible = false; await this.reload(false); this.$message.success('Management change applied')
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.actionLoading = false }
    },
    openHealthAction (kind, row) { this.openAction(kind, row) },
    openCredentials () { this.credentialForm = { credentials: '{}', reason: '', password: '', mfaCode: '', importAdapter: '' }; this.credentialVisible = true },
    openLegacyImport (row) { this.credentialForm = { credentials: '{}', reason: '', password: '', mfaCode: '', importAdapter: row.adapter_key }; this.credentialVisible = true },
    closeCredentials () { this.credentialVisible = false; this.credentialForm.credentials = '{}'; this.credentialForm.password = ''; this.credentialForm.mfaCode = '' },
    async submitCredentials () {
      this.actionLoading = true
      try {
        const stepUp = this.unwrap(await issueDataSourceStepUp({ password: this.credentialForm.password, mfaCode: this.credentialForm.mfaCode }))
        const importingLegacy = Boolean(this.credentialForm.importAdapter)
        if (importingLegacy) await importLegacyCredential(this.credentialForm.importAdapter, { reason: this.credentialForm.reason }, stepUp.proof)
        else await submitProviderCredentials(this.selectedInstance.id, { credentials: JSON.parse(this.credentialForm.credentials), reason: this.credentialForm.reason }, stepUp.proof)
        this.closeCredentials()
        if (!importingLegacy) await this.openInstance(this.selectedInstance.id)
        await this.reload(false)
        this.$message.success('Credentials validated and stored')
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.actionLoading = false }
    },
    async runDiagnostic (capability) {
      try { const result = this.unwrap(await runProviderDiagnostic(this.selectedInstance.id, capability)); this.$message[result.succeeded ? 'success' : 'warning'](result.succeeded ? 'Capability test passed' : 'Capability test failed') } catch (error) { this.$message.error(error.backendMessage || error.message) }
    },
    async openPolicy (policy) {
      const detail = this.unwrap(await getRoutingPolicy(policy.capability_key))
      this.selectedPolicy = { ...policy, ...detail }
      this.policyEntries = (policy.entries || []).map(item => ({ instance_id: item.instance_id }))
      this.policyPreview = null
    },
    movePolicyEntry (index, delta) { const next = index + delta; const entries = [...this.policyEntries]; [entries[index], entries[next]] = [entries[next], entries[index]]; this.policyEntries = entries },
    async savePolicyDraft () {
      this.actionLoading = true
      try {
        const response = await saveRoutingPolicyDraft(this.selectedPolicy.capability_key, { entries: this.policyEntries.map((item, index) => ({ instance_id: item.instance_id, position: index + 1 })), policyVersion: this.selectedPolicy.policy_version })
        this.selectedPolicy = { ...this.selectedPolicy, ...this.unwrap(response) }; this.$message.success('Draft saved')
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.actionLoading = false }
    },
    async previewPolicy () { try { this.policyPreview = this.unwrap(await previewRoutingPolicyDraft(this.selectedPolicy.capability_key)) } catch (error) { this.$message.error(error.backendMessage || error.message) } }
  }
}
</script>

<style scoped>
.data-source-operations { padding: 0 0 24px; }
.operations-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.operations-header h2 { margin: 0 0 5px; font-size: 22px; }
.status-line { display: flex; gap: 14px; color: rgba(0, 0, 0, .45); }
.readiness-alert { margin-bottom: 12px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
.metric-grid .ant-card { border-radius: 6px; }
.overview-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, .7fr); gap: 24px; }
.secondary-overview { margin-top: 24px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.fallback-band { margin-top: 24px; }
.trend-strip { display: flex; align-items: flex-end; min-height: 72px; gap: 7px; padding: 12px; border: 1px solid #e8e8e8; }
.trend-cell { display: flex; flex: 1 1 0; min-width: 8px; height: 58px; align-items: center; flex-direction: column; justify-content: flex-end; }
.trend-cell span { width: 100%; max-width: 18px; background: #d46b08; }
.trend-cell small { margin-top: 3px; color: rgba(0, 0, 0, .45); }
.overview-grid h3, .section-title { margin: 20px 0 10px; font-size: 15px; }
.overview-grid h3 { margin-top: 0; }
.table-toolbar { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.table-toolbar .ant-input-search { width: min(360px, 60vw); }
.drawer-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.policy-actions { margin-top: 16px; }
.policy-editor { margin: 18px 0; }
.policy-entry { display: grid; grid-template-columns: 28px minmax(0, 1fr) 32px 32px 32px; align-items: center; gap: 6px; margin-bottom: 8px; }
.policy-entry .ant-select { width: 100%; }
.policy-rank { color: rgba(0, 0, 0, .45); text-align: center; }
.ok { color: #389e0d; }.muted { color: rgba(0, 0, 0, .35); }
@media (max-width: 900px) {
  .operations-header { align-items: stretch; flex-direction: column; }
  .operations-header .ant-btn-group { display: flex; overflow-x: auto; }
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .overview-grid { grid-template-columns: 1fr; }
}
</style>
