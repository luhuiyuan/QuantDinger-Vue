<template>
  <div class="coverage-failure" role="alert">
    <div class="failure-heading">
      <a-icon type="database" />
      <div>
        <h3>{{ text('title', 'A-share history coverage is incomplete') }}</h3>
        <p>{{ text('description', 'The strategy was not executed. Complete and validate every requested and warm-up range before retrying.') }}</p>
      </div>
    </div>
    <div v-for="item in instruments" :key="item.instrument" class="instrument-failure">
      <div class="instrument-title">
        <strong>{{ item.instrument }}</strong>
        <a-tag color="orange">{{ item.adjustmentMode || 'raw' }}</a-tag>
        <span>{{ text('availableThrough', 'Available through') }}: {{ item.availableThrough || '-' }}</span>
      </div>
      <div class="range-grid">
        <div><span>{{ text('requestedRange', 'Requested range') }}</span><strong>{{ range(item.requestedRange) }}</strong></div>
        <div><span>{{ text('warmupRange', 'Warm-up range') }}</span><strong>{{ range(item.warmupRange) }}</strong></div>
        <div><span>{{ text('syncRange', 'Suggested sync') }}</span><strong>{{ suggestedRange(item) }}</strong></div>
      </div>
      <div v-for="(issue, index) in item.issues || []" :key="`${item.instrument}-${index}`" class="issue-line">
        <a-tag :color="issue.scope === 'market_rules' || issue.scope === 'quality' ? 'red' : 'orange'">{{ issue.scope || 'coverage' }}</a-tag>
        <strong>{{ issue.type }}</strong>
        <span>{{ issue.startDate || '-' }} - {{ issue.endDate || '-' }}</span>
      </div>
    </div>
    <a-alert
      type="info"
      show-icon
      :message="text('adminHint', 'Ask an administrator to run a targeted sync from Settings → Market Data. The backtest never fills these gaps from a remote fallback.')" />
    <div v-if="assumptions.marketRuleVersion" class="failure-assumptions">
      <span>{{ text('ruleVersion', 'Market rules') }}: <strong>{{ assumptions.marketRuleVersion }}</strong></span>
      <span>{{ text('settlement', 'Settlement') }}: <strong>{{ assumptions.settlement }}</strong></span>
      <span>{{ text('lotSize', 'Buy lot') }}: <strong>{{ assumptions.buyLotSize }}</strong></span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CNHistoryCoverageFailure',
  props: { failure: { type: Object, required: true } },
  computed: {
    instruments () { return this.failure.instruments || [] },
    assumptions () { return this.failure.executionAssumptions || {} }
  },
  methods: {
    text (key, fallback) {
      const path = `strategyV2.cnHistory.${key}`
      const value = this.$t(path)
      return value && value !== path ? value : fallback
    },
    range (value) { return value && value.startDate ? `${value.startDate} - ${value.endDate}` : '-' },
    suggestedRange (item) {
      const action = item.suggestedAction || {}
      return action.startDate ? `${action.startDate} - ${action.endDate}` : '-'
    }
  }
}
</script>

<style scoped>
.coverage-failure { padding: 18px; }
.failure-heading { display: flex; gap: 12px; padding: 16px; border: 1px solid #ffe58f; border-radius: 8px; background: #fffbe6; color: #ad6800; }
.failure-heading > i { margin-top: 3px; font-size: 22px; }
.failure-heading h3 { margin: 0 0 4px; color: #874d00; }
.failure-heading p { margin: 0; color: #8c6d1f; }
.instrument-failure { margin: 12px 0; padding: 14px; border: 1px solid #e8e8e8; border-radius: 8px; }
.instrument-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.instrument-title span { margin-left: auto; color: #8c8c8c; font-size: 12px; }
.range-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
.range-grid div { padding: 9px; background: #fafafa; }
.range-grid span { display: block; color: #8c8c8c; font-size: 11px; }
.range-grid strong { font-size: 12px; }
.issue-line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 4px 0; }
.issue-line span { color: #8c8c8c; }
.failure-assumptions { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 12px; color: #64748b; font-size: 12px; }
.theme-dark .failure-heading { border-color: #664d03; background: #211b08; }
.theme-dark .failure-heading h3 { color: #ffc53d; }
.theme-dark .failure-heading p { color: rgba(255, 255, 255, .65); }
.theme-dark .instrument-failure { border-color: #303030; }
.theme-dark .range-grid div { background: #0d0d0d; }
@media (max-width: 720px) { .range-grid { grid-template-columns: 1fr; } .instrument-title span { width: 100%; margin-left: 0; } }
</style>
