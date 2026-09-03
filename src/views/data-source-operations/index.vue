<template>
  <div class="data-source-operations">
    <header class="operations-header">
      <div>
        <h2><a-icon type="deployment-unit" /> {{ $t('dataSources.title') }}</h2>
        <div class="status-line">
          <a-badge :status="ready ? 'success' : 'error'" :text="ready ? $t('dataSources.ready') : $t('dataSources.notReadyStatus')" />
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
              <h3>{{ $t('dataSources.routingOutcomes24h') }}</h3>
              <a-list size="small" bordered :data-source="routingOutcomes">
                <a-list-item slot="renderItem" slot-scope="item"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></a-list-item>
              </a-list>
            </div>
            <div>
              <h3>{{ $t('dataSources.pendingOperations') }}</h3>
              <a-descriptions bordered size="small" :column="1">
                <a-descriptions-item :label="$t('dataSources.pendingCredentials')">{{ overview.pending_credentials || 0 }}</a-descriptions-item>
                <a-descriptions-item :label="$t('dataSources.capabilityIssues')">{{ overview.capability_issues || 0 }}</a-descriptions-item>
                <a-descriptions-item :label="$t('dataSources.quarantined')">{{ overview.quarantined || 0 }}</a-descriptions-item>
                <a-descriptions-item :label="$t('dataSources.disabledPolicies')">{{ overview.disabled_policies || 0 }}</a-descriptions-item>
              </a-descriptions>
            </div>
          </section>
          <section class="overview-grid secondary-overview">
            <div>
              <h3>{{ $t('dataSources.activeIncidents') }}</h3>
              <a-table size="small" :data-source="overview.active_incidents || []" :row-key="row => row.state_id" :pagination="false">
                <a-table-column :title="$t('dataSources.instance')" data-index="instance_id" />
                <a-table-column :title="$t('dataSources.capability')" :custom-render="capabilityLabel" />
                <a-table-column :title="$t('dataSources.health')" :custom-render="value => statusLabel(value)" />
                <a-table-column :title="$t('dataSources.circuit')" :custom-render="value => statusLabel(value)" />
              </a-table>
            </div>
            <div>
              <h3>{{ $t('dataSources.quotaPressure') }}</h3>
              <a-table size="small" :data-source="overview.quota_pressure || []" :row-key="row => `${row.instance_id}:${row.bucket_key}`" :pagination="false">
                <a-table-column :title="$t('dataSources.instance')" data-index="instance_id" />
                <a-table-column :title="$t('dataSources.bucket')" :custom-render="bucketLabel" />
                <a-table-column :title="$t('dataSources.usedAndHeld')" :custom-render="(_, row) => Number(row.consumed || 0) + Number(row.reserved || 0)" />
                <a-table-column :title="$t('dataSources.limit')" data-index="effective_limit" />
              </a-table>
            </div>
          </section>
          <section class="fallback-band">
            <h3>{{ $t('dataSources.fallbackTrend24h') }}</h3>
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
              <a-table-column :title="$t('dataSources.adapter')" :custom-render="(_, row) => adapterLabel(row.adapter_key)" />
              <a-table-column :title="$t('dataSources.detected')" :custom-render="(_, row) => row.detected ? $t('dataSources.yes') : $t('dataSources.no')" />
              <a-table-column :title="$t('dataSources.source')" :custom-render="(_, row) => (row.source_names || []).join(', ') || '-'" />
              <a-table-column :title="$t('dataSources.status')" :custom-render="value => statusLabel(value)" />
              <a-table-column :title="$t('dataSources.instance')" data-index="instance_id" />
              <a-table-column title="" :custom-render="(_, row) => can('data_sources:credentials') && row.detected && row.import_status !== 'imported' ? $createElement('a-button', { props: { type: 'link', size: 'small' }, on: { click: () => openLegacyImport(row) } }, [$t('dataSources.import')]) : null" />
            </a-table>
          </section>
        </a-tab-pane>

        <a-tab-pane key="instances" :tab="$t('dataSources.instances')">
          <div class="table-toolbar">
            <a-input-search v-model="instanceSearch" :placeholder="$t('dataSources.instanceSearch')" allow-clear />
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
            <template slot="status" slot-scope="value"><a-tag :color="statusColor(value)">{{ statusLabel(value) }}</a-tag></template>
            <template slot="credential" slot-scope="value"><a-icon :type="value ? 'check-circle' : 'minus-circle'" :class="value ? 'ok' : 'muted'" /></template>
            <template slot="actions" slot-scope="_, row"><a-button type="link" size="small" @click="openInstance(row.id)"><a-icon type="eye" /> {{ $t('dataSources.details') }}</a-button></template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="policies" :tab="$t('dataSources.policies')">
          <a-table :columns="policyColumns" :data-source="policies" :loading="loading" row-key="capability_key" :pagination="false">
            <template slot="enabled" slot-scope="value"><a-badge :status="value ? 'success' : 'default'" :text="value ? $t('dataSources.enabled') : $t('dataSources.disabled')" /></template>
            <template slot="route" slot-scope="entries"><span v-if="entries && entries.length">{{ entries.map(item => item.display_name).join(' → ') }}</span><span v-else class="muted">{{ $t('dataSources.noActiveRoute') }}</span></template>
            <template slot="actions" slot-scope="_, row"><a-button type="link" size="small" @click="openPolicy(row)"><a-icon type="ordered-list" /> {{ $t('dataSources.manage') }}</a-button></template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </template>

    <a-drawer :title="$t('dataSources.providerInstance')" :visible="!!selectedInstance" width="720" @close="closeInstance">
      <template v-if="selectedInstance">
        <div class="drawer-actions">
          <a-button v-if="can('data_sources:credentials')" @click="openCredentials"><a-icon type="key" /> {{ $t('dataSources.credentials') }}</a-button>
          <a-button v-if="can('data_sources:instances') && ['draft', 'validation_failed'].includes(selectedInstance.lifecycle_status)" @click="openAction('activate')"><a-icon type="check" /> {{ $t('dataSources.activate') }}</a-button>
          <a-button v-if="can('data_sources:instances') && selectedInstance.lifecycle_status === 'active'" @click="openAction('disable')"><a-icon type="stop" /> {{ $t('dataSources.disable') }}</a-button>
          <a-button v-if="can('data_sources:instances') && selectedInstance.lifecycle_status === 'disabled'" danger @click="openAction('retire')"><a-icon type="delete" /> {{ $t('dataSources.retire') }}</a-button>
        </div>
        <a-alert v-if="(selectedInstance.retirement_blockers || []).length" type="warning" show-icon :message="$t('dataSources.retirementBlocked')" :description="selectedInstance.retirement_blockers.map(item => capabilityLabel(item.capability_key)).join(', ')" />
        <a-descriptions bordered size="small" :column="2">
          <a-descriptions-item :label="$t('dataSources.name')">{{ instanceName(selectedInstance) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.status')"><a-tag :color="statusColor(selectedInstance.lifecycle_status)">{{ statusLabel(selectedInstance.lifecycle_status) }}</a-tag></a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.adapter')">{{ adapterLabel(selectedInstance.adapter_key) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.account')">{{ selectedInstance.provider_account_identity || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.credential')">{{ selectedInstance.credential && selectedInstance.credential.configured ? `${this.$t('dataSources.configured')} · ${this.$t('dataSources.key')} ${selectedInstance.credential.encryption_key_id}` : $t('dataSources.notConfigured') }}</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.configVersion')">{{ selectedInstance.config_version }}</a-descriptions-item>
        </a-descriptions>
        <h3 class="section-title">{{ $t('dataSources.capabilities') }}</h3>
        <a-table size="small" :columns="capabilityColumns" :data-source="selectedInstance.capabilities || []" row-key="capability_key" :pagination="false">
          <template slot="eligibility" slot-scope="value"><a-tag :color="statusColor(value)">{{ statusLabel(value) }}</a-tag></template>
          <template slot="verification" slot-scope="value"><span>{{ formatVerificationEvidence(value) }}</span></template>
          <template slot="capActions" slot-scope="_, row">
            <a-button v-if="can('data_sources:diagnostics')" type="link" size="small" :loading="diagnosticLoadingCapability === row.capability_key" @click="runDiagnostic(row.capability_key)"><a-icon type="experiment" /> {{ $t('dataSources.test') }}</a-button>
            <a-button v-if="diagnosticResults[row.capability_key]" type="link" size="small" @click="openDiagnostic(row.capability_key)"><a-icon type="eye" /> {{ $t('dataSources.viewTestResult') }}</a-button>
          </template>
        </a-table>
        <h3 class="section-title">{{ $t('dataSources.healthAndCircuits') }}</h3>
        <a-table size="small" :columns="healthColumns" :data-source="selectedInstance.health || []" :row-key="row => row.state_id" :pagination="false">
          <template slot="health" slot-scope="value"><a-tag :color="statusColor(value)">{{ statusLabel(value) }}</a-tag></template>
          <template slot="healthActions" slot-scope="_, row">
            <a-dropdown v-if="can('data_sources:diagnostics')">
              <a-button type="link" size="small">{{ $t('dataSources.actions') }} <a-icon type="down" /></a-button>
              <a-menu slot="overlay" @click="event => openHealthAction(event.key, row)">
                <a-menu-item key="quarantine">{{ $t('dataSources.quarantine') }}</a-menu-item>
                <a-menu-item key="extend-circuit">{{ $t('dataSources.extendCircuit') }}</a-menu-item>
                <a-menu-item key="recovery-probe">{{ $t('dataSources.recoveryProbe') }}</a-menu-item>
              </a-menu>
            </a-dropdown>
          </template>
        </a-table>
        <h3 class="section-title">{{ $t('dataSources.quota') }}</h3>
        <a-table size="small" :columns="quotaColumns" :data-source="selectedInstance.quota || []" :row-key="row => `${row.capability_key || 'instance'}:${row.bucket_key}`" :pagination="false" />
        <h3 class="section-title">{{ $t('dataSources.recentHealthEvidence') }}</h3>
        <a-table size="small" :data-source="selectedInstance.health_evidence || []" :row-key="row => `${row.health_state_id}:${row.occurred_at}:${row.evidence_kind}`" :pagination="false">
          <a-table-column :title="$t('dataSources.time')" data-index="occurred_at" />
          <a-table-column :title="$t('dataSources.capability')" :custom-render="capabilityLabel" />
          <a-table-column :title="$t('dataSources.evidence')" data-index="evidence_kind" />
          <a-table-column :title="$t('dataSources.scope')" data-index="permanence" />
          <a-table-column :title="$t('dataSources.summary')" data-index="sanitized_summary" />
        </a-table>
      </template>
    </a-drawer>

    <a-drawer :title="$t('dataSources.routingPolicy')" :visible="!!selectedPolicy" width="680" @close="selectedPolicy = null">
      <template v-if="selectedPolicy">
        <a-descriptions bordered size="small" :column="2">
          <a-descriptions-item :label="$t('dataSources.capability')">{{ capabilityLabel(selectedPolicy.capability_key) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.version')">{{ selectedPolicy.policy_version }}</a-descriptions-item>
        </a-descriptions>
        <div class="policy-editor">
          <div v-for="(entry, index) in policyEntries" :key="`${entry.instance_id}:${index}`" class="policy-entry">
            <span class="policy-rank">{{ index + 1 }}</span>
            <a-select v-model="entry.instance_id" show-search option-filter-prop="children">
              <a-select-option v-for="item in eligibleInstancesForPolicy" :key="item.id" :value="item.id">{{ item.display_name }} · {{ adapterLabel(item.adapter_key) }}</a-select-option>
            </a-select>
            <a-button icon="arrow-up" :disabled="index === 0" :title="$t('dataSources.moveUp')" @click="movePolicyEntry(index, -1)" />
            <a-button icon="arrow-down" :disabled="index === policyEntries.length - 1" :title="$t('dataSources.moveDown')" @click="movePolicyEntry(index, 1)" />
            <a-button icon="delete" :title="$t('dataSources.remove')" @click="policyEntries.splice(index, 1)" />
          </div>
          <a-button block type="dashed" @click="policyEntries.push({ instance_id: null })"><a-icon type="plus" /> {{ $t('dataSources.addFallback') }}</a-button>
        </div>
        <a-alert v-if="policyPreview" type="info" show-icon :message="policyPreviewSummary" />
        <div class="drawer-actions policy-actions">
          <a-button v-if="can('data_sources:routing')" :loading="actionLoading" @click="savePolicyDraft"><a-icon type="save" /> {{ $t('dataSources.saveDraft') }}</a-button>
          <a-button v-if="can('data_sources:routing')" @click="previewPolicy"><a-icon type="eye" /> {{ $t('dataSources.preview') }}</a-button>
          <a-button v-if="can('data_sources:routing')" type="primary" @click="openAction('publish-policy')"><a-icon type="upload" /> {{ $t('dataSources.publish') }}</a-button>
          <a-button v-if="can('data_sources:routing')" @click="openAction('disable-policy')"><a-icon type="stop" /> {{ $t('dataSources.disable') }}</a-button>
          <a-button v-if="can('data_sources:routing')" @click="openAction('restore-policy')"><a-icon type="history" /> {{ $t('dataSources.restore') }}</a-button>
        </div>
        <h3 class="section-title">{{ $t('dataSources.revisionHistory') }}</h3>
        <a-table size="small" :data-source="selectedPolicy.revisions || []" row-key="id" :pagination="false">
          <a-table-column :title="$t('dataSources.revision')" data-index="revision_number" />
          <a-table-column :title="$t('dataSources.status')" :custom-render="value => statusLabel(value)" />
          <a-table-column :title="$t('dataSources.published')" data-index="published_at" />
          <a-table-column :title="$t('dataSources.route')" :custom-render="(_, row) => (row.entries || []).map(item => item.display_name).join(' → ')" />
          <a-table-column title="" :custom-render="(_, row) => can('data_sources:routing') ? $createElement('a-button', { props: { type: 'link', size: 'small' }, on: { click: () => openAction('restore-policy', row) } }, [$t('dataSources.restore')]) : null" />
        </a-table>
      </template>
    </a-drawer>

    <a-drawer :title="$t('dataSources.routedDataRequest')" :visible="!!selectedRoutedRequest" width="720" @close="selectedRoutedRequest = null">
      <template v-if="selectedRoutedRequest">
        <a-descriptions bordered size="small" :column="1">
          <a-descriptions-item :label="$t('dataSources.routedId')">{{ selectedRoutedRequest.routed_request_id }}</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.capability')">{{ capabilityLabel(selectedRoutedRequest.capability_key) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.callingFeature')">{{ selectedRoutedRequest.calling_feature }}</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.outcome')">{{ selectedRoutedRequest.final_outcome }}</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.policyRevision')">{{ selectedRoutedRequest.policy_revision_id }}</a-descriptions-item>
        </a-descriptions>
        <h3 class="section-title">{{ $t('dataSources.attemptChain') }}</h3>
        <a-table size="small" :data-source="selectedRoutedRequest.attempts || []" :row-key="row => `${row.attempt_order}:${row.provider_instance_id || row.provider}`" :pagination="false">
          <a-table-column title="#" data-index="attempt_order" />
          <a-table-column :title="$t('dataSources.provider')" :custom-render="(_, row) => adapterLabel(row.provider)" />
          <a-table-column :title="$t('dataSources.result')" :custom-render="value => statusLabel(value)" />
          <a-table-column :title="$t('dataSources.skipReason')" data-index="skip_reason" />
          <a-table-column :title="$t('dataSources.quality')" data-index="quality_outcome" />
        </a-table>
      </template>
    </a-drawer>

    <a-modal :title="$t('dataSources.newProviderInstance')" :visible="createVisible" :confirm-loading="actionLoading" @ok="createInstance" @cancel="createVisible = false">
      <a-form layout="vertical">
        <a-form-item :label="$t('dataSources.instanceKey')"><a-input v-model="createForm.instanceKey" /></a-form-item>
        <a-form-item :label="$t('dataSources.adapterKey')"><a-input v-model="createForm.adapterKey" /></a-form-item>
        <a-form-item :label="$t('dataSources.displayName')"><a-input v-model="createForm.displayName" /></a-form-item>
        <a-form-item :label="$t('dataSources.nonSecretConfig')"><a-textarea v-model="createForm.config" :rows="4" /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal :title="actionTitle" :visible="actionVisible" :confirm-loading="actionLoading" @ok="submitAction" @cancel="actionVisible = false">
      <a-form layout="vertical">
        <a-form-item :label="$t('dataSources.reason')"><a-textarea v-model="actionForm.reason" :rows="3" /></a-form-item>
        <a-form-item v-if="actionForm.kind === 'restore-policy'" :label="$t('dataSources.revisionId')"><a-input-number v-model="actionForm.revisionId" :min="1" /></a-form-item>
        <a-form-item v-if="actionForm.kind === 'extend-circuit'" :label="$t('dataSources.circuitOpenUntil')"><a-date-picker v-model="actionForm.until" show-time /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal :title="credentialForm.importAdapter ? $t('dataSources.legacyImport') : $t('dataSources.credentials')" :visible="credentialVisible" :confirm-loading="actionLoading" @ok="submitCredentials" @cancel="closeCredentials">
      <a-alert type="warning" show-icon :message="credentialForm.importAdapter ? $t('dataSources.legacyImportWarning') : $t('dataSources.credentialsWriteOnly')" />
      <a-form layout="vertical">
        <a-form-item v-if="!credentialForm.importAdapter" :label="$t('dataSources.credentialsJson')"><a-textarea v-model="credentialForm.credentials" :rows="5" autocomplete="new-password" /></a-form-item>
        <a-form-item :label="$t('dataSources.reason')"><a-input v-model="credentialForm.reason" /></a-form-item>
        <a-form-item :label="$t('dataSources.password')"><a-input-password v-model="credentialForm.password" autocomplete="current-password" /></a-form-item>
        <a-form-item :label="$t('dataSources.mfaCode')"><a-input v-model="credentialForm.mfaCode" /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal :title="$t('dataSources.diagnosticResult')" :visible="diagnosticVisible" width="900px" :footer="null" @cancel="diagnosticVisible = false">
      <template v-if="diagnosticResult">
        <div class="diagnostic-actions">
          <a-button size="small" @click="copyDiagnosticReport"><a-icon type="copy" /> {{ $t('dataSources.copyTestInfo') }}</a-button>
        </div>
        <a-alert :type="diagnosticResult.succeeded ? 'success' : 'warning'" show-icon :message="diagnosticResult.succeeded ? $t('dataSources.capabilityTestPassed') : $t('dataSources.capabilityTestFailed')" />
        <a-descriptions bordered size="small" :column="2" class="diagnostic-summary">
          <a-descriptions-item :label="$t('dataSources.capability')">{{ capabilityLabel(diagnosticResult.capability_key) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.result')"><a-tag :color="diagnosticResult.succeeded ? 'green' : 'red'">{{ diagnosticResult.succeeded ? $t('dataSources.passed') : $t('dataSources.failed') }}</a-tag></a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.testTime')">{{ formatTime(diagnosticResult.acquired_at) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.duration')">{{ diagnosticResult.duration_ms || 0 }} ms</a-descriptions-item>
          <a-descriptions-item :label="$t('dataSources.diagnosticId')" :span="2">{{ diagnosticResult.diagnostic_id }}</a-descriptions-item>
          <a-descriptions-item v-if="diagnosticResult.error_category" :label="$t('dataSources.errorCategory')" :span="2">{{ diagnosticResult.error_category }}</a-descriptions-item>
        </a-descriptions>
        <h3 class="section-title">{{ $t('dataSources.testRequest') }}</h3>
        <pre class="diagnostic-json">{{ JSON.stringify(diagnosticResult.request_summary || {}, null, 2) }}</pre>
        <div class="diagnostic-sample-heading">
          <h3 class="section-title">{{ $t('dataSources.sampleData') }}</h3>
          <a-button v-if="diagnosticResult.sample" size="small" @click="copyDiagnosticSample"><a-icon type="copy" /> {{ $t('dataSources.copyJson') }}</a-button>
        </div>
        <a-table
          v-if="diagnosticResult.sample && diagnosticResult.sample.rows && diagnosticResult.sample.rows.length"
          size="small"
          :columns="diagnosticSampleColumns"
          :data-source="diagnosticResult.sample.rows"
          :pagination="false"
          :scroll="{ x: true }"
          row-key="__sampleRow">
          <template slot="sampleValue" slot-scope="value"><span>{{ formatDiagnosticValue(value) }}</span></template>
        </a-table>
        <a-empty v-else :description="$t('dataSources.noSampleData')" :image="simpleEmptyImage" />
        <a-alert v-if="diagnosticResult.sample && diagnosticResult.sample.truncated" class="diagnostic-truncated" type="info" show-icon :message="$t('dataSources.sampleTruncated')" />
        <a-alert
          v-if="(diagnosticResult.quality_failures || []).length || (diagnosticResult.warnings || []).length"
          class="diagnostic-truncated"
          type="warning"
          show-icon
          :message="$t('dataSources.diagnosticWarnings')"
          :description="[...(diagnosticResult.quality_failures || []), ...(diagnosticResult.warnings || []).map(item => item.message || item.code)].join(' · ')" />
      </template>
    </a-modal>
  </div>
</template>

<script>
import moment from 'moment'
import { Empty } from 'ant-design-vue'
import { validateProviderInstanceDraft, validateRoutingPolicyEntries } from '@/utils/dataSourceOperationsValidation'
import {
  createProviderInstance, extendProviderCircuit, getDataSourceOverview, getProviderInstance, getRoutedDataRequest,
  getRoutingPolicy, importLegacyCredential, issueDataSourceStepUp, listLatestProviderDiagnostics, listLegacyCredentialImports, listProviderInstances, listRoutingPolicies, previewRoutingPolicyDraft,
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
      credentialForm: { credentials: '{}', reason: '', password: '', mfaCode: '', importAdapter: '' },
      diagnosticVisible: false,
      diagnosticResult: null,
      diagnosticLoadingCapability: '',
      diagnosticResults: {}
    }
  },
  computed: {
    permissions () {
      const permissions = new Set()
      for (const role of (this.$store.getters.roles || [])) for (const item of (role.permissions || [])) permissions.add(item)
      return permissions
    },
    simpleEmptyImage () { return Empty.PRESENTED_IMAGE_SIMPLE },
    ready () { return !!(this.overview.readiness && this.overview.readiness.ready) },
    readinessReason () { return (this.overview.readiness && (this.overview.readiness.reason || (this.overview.readiness.blockers || []).join(', '))) || '' },
    metrics () {
      return [
        { key: 'instances', title: this.$t('dataSources.metric.instances'), value: this.overview.instances || 0 },
        { key: 'active', title: this.$t('dataSources.metric.active'), value: this.overview.active_instances || 0 },
        { key: 'circuits', title: this.$t('dataSources.metric.circuits'), value: this.overview.open_circuits || 0 },
        { key: 'policies', title: this.$t('dataSources.metric.policies'), value: this.overview.enabled_policies || 0 }
      ]
    },
    routingOutcomes () { return Object.entries(this.overview.routing_outcomes_24h || {}).map(([key, value]) => ({ key, label: this.statusLabel(key), value })) },
    filteredInstances () {
      const needle = this.instanceSearch.trim().toLowerCase()
      if (!needle) return this.instances
      return this.instances.filter(item => `${item.display_name} ${item.instance_key} ${item.adapter_key}`.toLowerCase().includes(needle))
    },
    eligibleInstances () { return this.instances.filter(item => item.lifecycle_status === 'active') },
    eligibleInstancesForPolicy () { return this.eligibleInstances.filter(item => (item.capabilities || {})[this.selectedPolicy.capability_key] === 'eligible') },
    policyPreviewSummary () { return `${this.$t('dataSources.valid')}: ${this.policyPreview.valid ? this.$t('dataSources.yes') : this.$t('dataSources.no')} · ${JSON.stringify(this.policyPreview.changes || this.policyPreview)}` },
    actionTitle () { return this.$t(`dataSources.action.${this.actionForm.kind || 'management'}`) },
    instanceColumns () {
      return [
        { title: this.$t('dataSources.name'), dataIndex: 'display_name', customRender: (_, row) => this.instanceName(row) }, { title: this.$t('dataSources.adapter'), dataIndex: 'adapter_key', customRender: this.adapterLabel },
        { title: this.$t('dataSources.status'), dataIndex: 'lifecycle_status', scopedSlots: { customRender: 'status' } },
        { title: this.$t('dataSources.credential'), dataIndex: 'credential_configured', scopedSlots: { customRender: 'credential' } },
        { title: this.$t('dataSources.account'), dataIndex: 'provider_account_identity' }, { title: '', scopedSlots: { customRender: 'actions' }, width: 100 }
      ]
    },
    policyColumns () {
      return [
        { title: this.$t('dataSources.capability'), dataIndex: 'capability_key', customRender: this.capabilityLabel }, { title: this.$t('dataSources.status'), dataIndex: 'enabled', scopedSlots: { customRender: 'enabled' } },
        { title: this.$t('dataSources.effectiveRoute'), dataIndex: 'entries', scopedSlots: { customRender: 'route' } },
        { title: this.$t('dataSources.version'), dataIndex: 'policy_version', width: 90 }, { title: '', scopedSlots: { customRender: 'actions' }, width: 110 }
      ]
    },
    capabilityColumns () { return [{ title: this.$t('dataSources.capability'), dataIndex: 'capability_key', customRender: this.capabilityLabel }, { title: this.$t('dataSources.eligibility'), dataIndex: 'eligibility_status', scopedSlots: { customRender: 'eligibility' } }, { title: this.$t('dataSources.verification'), dataIndex: 'verification_evidence', scopedSlots: { customRender: 'verification' } }, { title: this.$t('dataSources.lastVerified'), dataIndex: 'last_verified_at' }, { title: '', scopedSlots: { customRender: 'capActions' } }] },
    healthColumns () { return [{ title: this.$t('dataSources.capability'), dataIndex: 'capability_key', customRender: value => value ? this.capabilityLabel(value) : this.$t('dataSources.instance') }, { title: this.$t('dataSources.health'), dataIndex: 'health_status', scopedSlots: { customRender: 'health' } }, { title: this.$t('dataSources.circuit'), dataIndex: 'circuit_state', customRender: value => this.statusLabel(value) }, { title: this.$t('dataSources.reason'), dataIndex: 'circuit_reason' }, { title: '', scopedSlots: { customRender: 'healthActions' }, width: 100 }] },
    quotaColumns () { return [{ title: this.$t('dataSources.capability'), dataIndex: 'capability_key', customRender: this.capabilityLabel }, { title: this.$t('dataSources.bucket'), dataIndex: 'bucket_key', customRender: this.bucketLabel }, { title: this.$t('dataSources.consumed'), dataIndex: 'consumed' }, { title: this.$t('dataSources.reserved'), dataIndex: 'reserved' }, { title: this.$t('dataSources.limit'), dataIndex: 'configured_limit' }, { title: this.$t('dataSources.reset'), dataIndex: 'reset_at' }] },
    diagnosticSampleColumns () {
      return ((this.diagnosticResult && this.diagnosticResult.sample && this.diagnosticResult.sample.columns) || []).map(column => ({ title: column, dataIndex: column, scopedSlots: { customRender: 'sampleValue' }, ellipsis: true }))
    }
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
    localizedLabel (prefix, value) {
      const raw = String(value || '')
      const key = `dataSources.${prefix}.${raw}`
      return raw && this.$te && this.$te(key) ? this.$t(key) : (raw || '-')
    },
    capabilityLabel (capabilityKey) {
      const key = `dataSources.capabilityName.${String(capabilityKey || '')}`
      return capabilityKey && this.$te && this.$te(key) ? this.$t(key) : (capabilityKey || '-')
    },
    adapterLabel (adapterKey) { return this.localizedLabel('adapterName', adapterKey) },
    statusLabel (status) { return this.localizedLabel('statusName', status) },
    bucketLabel (bucketKey) { return this.localizedLabel('bucketName', bucketKey) },
    instanceName (instance) {
      const adapterKey = instance && instance.adapter_key
      const defaultName = `Default ${adapterKey ? adapterKey.charAt(0).toUpperCase() + adapterKey.slice(1).replace(/_/g, ' ') : ''}`
      if (instance && instance.display_name === defaultName) {
        const key = `dataSources.defaultInstanceName.${adapterKey}`
        if (this.$te && this.$te(key)) return this.$t(key)
      }
      return (instance && instance.display_name) || '-'
    },
    can (permission) { return this.permissions.has(permission) },
    unwrap (response) { return response && response.code !== undefined ? response.data : ((response && response.data) || response || {}) },
    formatTime (value) { return value ? moment(value).format('YYYY-MM-DD HH:mm:ss') : '-' },
    formatVerificationEvidence (value) {
      if (!value || typeof value !== 'object') return '-'
      const code = value.code || value.status
      if (!code) return '-'
      if (code === 'upstream_http_403') return this.$t('dataSources.evidenceName.upstream_http_403')
      if (code === 'transport_error') return this.$t('dataSources.evidenceName.transport_error')
      return this.localizedLabel('evidenceName', code)
    },
    formatDiagnosticValue (value) { return value && typeof value === 'object' ? JSON.stringify(value) : (value === null || value === undefined ? '-' : String(value)) },
    diagnosticReport () {
      const result = this.diagnosticResult || {}
      const adapter = this.selectedInstance || {}
      return [
        `${this.$t('dataSources.adapter')}: ${this.adapterLabel(adapter.adapter_key)}`,
        `${this.$t('dataSources.capability')}: ${this.capabilityLabel(result.capability_key)}`,
        `${this.$t('dataSources.diagnosticId')}: ${result.diagnostic_id || '-'}`,
        `${this.$t('dataSources.result')}: ${result.succeeded ? this.$t('dataSources.passed') : this.$t('dataSources.failed')}`,
        `${this.$t('dataSources.testTime')}: ${this.formatTime(result.acquired_at)}`,
        `${this.$t('dataSources.duration')}: ${result.duration_ms || 0} ms`,
        `${this.$t('dataSources.errorCategory')}: ${result.error_category || '-'}`,
        '',
        `${this.$t('dataSources.testRequest')}:`,
        JSON.stringify(result.request_summary || {}, null, 2),
        '',
        `${this.$t('dataSources.testResponse')}:`,
        JSON.stringify(result.sample || {}, null, 2),
        '',
        `${this.$t('dataSources.diagnosticDetails')}:`,
        JSON.stringify(result, null, 2)
      ].join('\n')
    },
    async copyDiagnosticReport () {
      const value = this.diagnosticReport()
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value)
        else {
          const textarea = document.createElement('textarea'); textarea.value = value; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove()
        }
        this.$message.success(this.$t('dataSources.copied'))
      } catch (_) { this.$message.error(this.$t('dataSources.copyFailed')) }
    },
    async copyDiagnosticSample () {
      const value = JSON.stringify(this.diagnosticResult.sample, null, 2)
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value)
        else {
          const textarea = document.createElement('textarea'); textarea.value = value; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove()
        }
        this.$message.success(this.$t('dataSources.copied'))
      } catch (_) { this.$message.error(this.$t('dataSources.copyFailed')) }
    },
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
        if (!this.unavailable && foreground) this.$message.error(error.backendMessage || this.$t('dataSources.loadFailed'))
      } finally { if (foreground) this.loading = false }
    },
    onInstancePage (pagination) { this.instancePagination.current = pagination.current; this.instancePagination.pageSize = pagination.pageSize; this.reload() },
    openCreate () { this.createForm = { instanceKey: '', adapterKey: '', displayName: '', config: '{}' }; this.createVisible = true },
    async createInstance () {
      let config
      try { config = JSON.parse(this.createForm.config || '{}') } catch (_) { return this.$message.warning(this.$t('dataSources.validation.configJsonInvalid')) }
      const validation = validateProviderInstanceDraft({ ...this.createForm, config })
      if (validation) return this.$message.warning(this.$t(`dataSources.validation.${validation}`))
      this.actionLoading = true
      try {
        await createProviderInstance({ ...this.createForm, config })
        this.createVisible = false; await this.reload(); this.$message.success(this.$t('dataSources.instanceCreated'))
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.actionLoading = false }
    },
    async openInstance (id) {
      const changingInstance = !this.selectedInstance || this.selectedInstance.id !== id
      this.selectedInstance = this.unwrap(await getProviderInstance(id))
      if (changingInstance) { this.diagnosticResults = {}; this.diagnosticResult = null; this.diagnosticVisible = false }
      if (!this.can('data_sources:diagnostics')) return
      try {
        const diagnostics = this.unwrap(await listLatestProviderDiagnostics(id))
        if (this.selectedInstance && this.selectedInstance.id === id) {
          this.diagnosticResults = (diagnostics.items || []).reduce((results, item) => ({ ...results, [item.capability_key]: this.prepareDiagnosticResult(item) }), {})
        }
      } catch (error) { this.$message.error(error.backendMessage || error.message) }
    },
    closeInstance () { this.selectedInstance = null; this.diagnosticResults = {}; this.diagnosticResult = null; this.diagnosticVisible = false },
    openDiagnostic (capability) { this.diagnosticResult = this.diagnosticResults[capability] || null; this.diagnosticVisible = !!this.diagnosticResult },
    async openRoutedRequest (id) {
      try { this.selectedRoutedRequest = this.unwrap(await getRoutedDataRequest(id)) } catch (error) { this.$message.error(error.backendMessage || this.$t('dataSources.routedRequestUnavailable')) }
    },
    openAction (kind, target = null) {
      if (kind === 'publish-policy') {
        const validation = validateRoutingPolicyEntries(this.policyEntries, this.instances, this.selectedPolicy.capability_key)
        if (validation) return this.$message.warning(this.$t(`dataSources.validation.${validation}`))
      }
      this.actionForm = { kind, reason: '', target, revisionId: kind === 'restore-policy' && target ? target.id : null, until: null }; this.actionVisible = true
    },
    async submitAction () {
      if (!this.actionForm.reason.trim()) return this.$message.warning(this.$t('dataSources.validation.reasonRequired'))
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
        this.actionVisible = false; await this.reload(false); this.$message.success(this.$t('dataSources.managementApplied'))
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
        this.$message.success(this.$t('dataSources.credentialsStored'))
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.actionLoading = false }
    },
    async runDiagnostic (capability) {
      this.diagnosticLoadingCapability = capability
      try {
        const result = this.unwrap(await runProviderDiagnostic(this.selectedInstance.id, capability))
        this.diagnosticResults = { ...this.diagnosticResults, [capability]: this.prepareDiagnosticResult(result) }
        // A successful diagnostic is also current capability verification
        // evidence. Reload the drawer so eligibility and its message no longer
        // show the stale pre-diagnostic result.
        await this.openInstance(this.selectedInstance.id)
        this.$message[result.succeeded ? 'success' : 'warning'](result.succeeded ? this.$t('dataSources.capabilityTestPassed') : this.$t('dataSources.capabilityTestFailed'))
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.diagnosticLoadingCapability = '' }
    },
    prepareDiagnosticResult (result) {
      const prepared = { ...result }
      if (prepared.sample && Array.isArray(prepared.sample.rows)) prepared.sample = { ...prepared.sample, rows: prepared.sample.rows.map((row, index) => ({ ...row, __sampleRow: index })) }
      return prepared
    },
    async openPolicy (policy) {
      const detail = this.unwrap(await getRoutingPolicy(policy.capability_key))
      this.selectedPolicy = { ...policy, ...detail }
      this.policyEntries = (policy.entries || []).map(item => ({ instance_id: item.instance_id }))
      this.policyPreview = null
    },
    movePolicyEntry (index, delta) { const next = index + delta; const entries = [...this.policyEntries]; [entries[index], entries[next]] = [entries[next], entries[index]]; this.policyEntries = entries },
    async savePolicyDraft () {
      const validation = validateRoutingPolicyEntries(this.policyEntries, this.instances, this.selectedPolicy.capability_key)
      if (validation) return this.$message.warning(this.$t(`dataSources.validation.${validation}`))
      this.actionLoading = true
      try {
        const response = await saveRoutingPolicyDraft(this.selectedPolicy.capability_key, { entries: this.policyEntries.map((item, index) => ({ instance_id: item.instance_id, position: index + 1 })), policyVersion: this.selectedPolicy.policy_version })
        this.selectedPolicy = { ...this.selectedPolicy, ...this.unwrap(response) }; this.$message.success(this.$t('dataSources.draftSaved'))
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
.diagnostic-summary { margin-top: 16px; }
.diagnostic-actions { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.diagnostic-json { max-height: 180px; margin: 0; padding: 10px; overflow: auto; border: 1px solid #e8e8e8; border-radius: 4px; background: #fafafa; font-size: 12px; }
.diagnostic-sample-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.diagnostic-truncated { margin-top: 12px; }
@media (max-width: 900px) {
  .operations-header { align-items: stretch; flex-direction: column; }
  .operations-header .ant-btn-group { display: flex; overflow-x: auto; }
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .overview-grid { grid-template-columns: 1fr; }
}
</style>
