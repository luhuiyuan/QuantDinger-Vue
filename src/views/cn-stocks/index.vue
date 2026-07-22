<template>
  <div class="cn-market-page">
    <section class="market-hero">
      <div>
        <div class="eyebrow">{{ $t('cnStocks.eyebrow') }}</div>
        <h1>{{ $t('cnStocks.title') }}</h1>
        <p>{{ $t('cnStocks.subtitle') }}</p>
      </div>
      <div class="source-state">
        <a-tag :color="freshnessColor(snapshot.freshness)">{{ $t(freshnessKey(snapshot.freshness)) }}</a-tag>
        <span>{{ snapshot.source || '-' }} · {{ formatTime(snapshot.asOf) }}</span>
        <a-button icon="reload" :loading="loading" @click="refreshAll">{{ $t('cnStocks.refresh') }}</a-button>
        <span v-if="catalogCoverage.coveredCount !== undefined">
          {{ $t('cnStocks.quoteCoverage', { covered: catalogCoverage.coveredCount, total: catalogCoverage.catalogCount || pagination.total }) }}
        </span>
      </div>
    </section>

    <a-alert
      v-if="snapshot.warning"
      class="stale-alert"
      type="warning"
      show-icon
      :message="$t('cnStocks.staleTitle')"
      :description="snapshot.warning"
    />
    <a-alert
      v-if="refreshRun.status === 'partial' || refreshRun.status === 'failed'"
      class="stale-alert"
      type="warning"
      show-icon
      :message="$t('cnStocks.refreshRunWarning')"
      :description="$t('cnStocks.refreshRunSummary', { status: refreshRun.status, succeeded: refreshRun.succeeded_symbols || 0, planned: refreshRun.planned_symbols || 0 })"
    />

    <section class="index-grid">
      <a-card v-for="item in indices" :key="item.symbol" class="index-card" :bordered="false">
        <div class="card-label">{{ item.name }}</div>
        <template v-if="item.status === 'available'">
          <div class="index-value" :class="cnChangeTone(item.changePercent)">{{ formatNumber(item.latest, 2) }}</div>
          <div :class="cnChangeTone(item.changePercent)">{{ formatCNSigned(item.change, 2) }} · {{ formatCNSigned(item.changePercent, 2, '%') }}</div>
        </template>
        <a-empty v-else :image="simpleImage" :description="$t('cnStocks.unavailable')" />
      </a-card>
    </section>

    <section class="breadth-grid">
      <div class="breadth-item"><span>{{ $t('cnStocks.totalAmount') }}</span><strong>{{ formatAmount(breadth.totalAmount) }}</strong></div>
      <div class="breadth-item rise"><span>{{ $t('cnStocks.advancing') }}</span><strong>{{ breadth.advancingCount || 0 }}</strong></div>
      <div class="breadth-item fall"><span>{{ $t('cnStocks.declining') }}</span><strong>{{ breadth.decliningCount || 0 }}</strong></div>
      <div class="breadth-item"><span>{{ $t('cnStocks.flat') }}</span><strong>{{ breadth.flatCount || 0 }}</strong></div>
      <div class="breadth-item rise"><span>{{ $t('cnStocks.limitUp') }}</span><strong>{{ breadth.limitUpCount || 0 }}</strong></div>
      <div class="breadth-item fall"><span>{{ $t('cnStocks.limitDown') }}</span><strong>{{ breadth.limitDownCount || 0 }}</strong></div>
    </section>

    <section class="stock-panel">
      <div class="filters">
        <a-input-search
          v-model="filters.keyword"
          class="keyword"
          :placeholder="$t('cnStocks.searchPlaceholder')"
          @search="applyFilters"
        />
        <a-select v-model="filters.exchange" @change="applyFilters">
          <a-select-option value="">{{ $t('cnStocks.allExchanges') }}</a-select-option>
          <a-select-option value="SH">{{ $t('cnStocks.shanghai') }}</a-select-option>
          <a-select-option value="SZ">{{ $t('cnStocks.shenzhen') }}</a-select-option>
        </a-select>
        <a-select v-model="filters.changeState" @change="applyFilters">
          <a-select-option value="">{{ $t('cnStocks.allChanges') }}</a-select-option>
          <a-select-option value="up">{{ $t('cnStocks.advancing') }}</a-select-option>
          <a-select-option value="down">{{ $t('cnStocks.declining') }}</a-select-option>
          <a-select-option value="flat">{{ $t('cnStocks.flat') }}</a-select-option>
        </a-select>
        <a-select v-model="filters.sortBy" @change="applySort">
          <a-select-option value="symbol">{{ $t('cnStocks.sort.symbol') }}</a-select-option>
          <a-select-option value="name">{{ $t('cnStocks.sort.name') }}</a-select-option>
          <a-select-option value="change_percent">{{ $t('cnStocks.sort.changePercent') }}</a-select-option>
          <a-select-option value="volume">{{ $t('cnStocks.sort.volume') }}</a-select-option>
          <a-select-option value="amount">{{ $t('cnStocks.sort.amount') }}</a-select-option>
          <a-select-option value="quote_time">{{ $t('cnStocks.sort.quoteTime') }}</a-select-option>
        </a-select>
        <a-select v-model="filters.sortOrder" @change="applySort">
          <a-select-option value="asc">{{ $t('cnStocks.sort.asc') }}</a-select-option>
          <a-select-option value="desc">{{ $t('cnStocks.sort.desc') }}</a-select-option>
        </a-select>
      </div>

      <a-table
        :columns="columns"
        :data-source="stocks"
        :loading="loading"
        :pagination="false"
        row-key="instrument"
        :scroll="{ x: 1050 }"
      >
        <template slot="identity" slot-scope="value, row">
          <a class="stock-link" @click="openStock(row)"><strong>{{ row.name }}</strong><span>{{ row.symbol }}</span></a>
        </template>
        <template slot="price" slot-scope="value, row"><span :class="cnChangeTone(row.changePercent)">{{ formatNumber(row.latest, 2) }}</span></template>
        <template slot="change" slot-scope="value, row"><span :class="cnChangeTone(row.changePercent)">{{ formatCNSigned(row.changePercent, 2, '%') }}</span></template>
        <template slot="amount" slot-scope="value, row">{{ formatAmount(row.amount) }}</template>
        <template slot="status" slot-scope="value, row">
          <a-tag :color="row.quoteStatus === 'available' ? freshnessColor(row.freshness || 'fresh') : 'default'">
            {{ $t(row.quoteStatus === 'available' ? freshnessKey(row.freshness || 'fresh') : 'cnStocks.unavailable') }}
          </a-tag>
          <small v-if="row.asOf" class="quote-time">{{ formatTime(row.asOf) }}</small>
        </template>
        <template slot="action" slot-scope="value, row">
          <a-button type="link" size="small" @click.stop="toggleWatchlist(row)">
            <a-icon :type="row.watchlisted ? 'star' : 'star-o'" />{{ $t(row.watchlisted ? 'cnStocks.removeWatchlist' : 'cnStocks.addWatchlist') }}
          </a-button>
        </template>
      </a-table>
      <a-pagination
        class="pagination"
        :current="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        show-size-changer
        :page-size-options="['20', '50', '100']"
        @change="changePage"
        @showSizeChange="changePageSize"
      />
    </section>
  </div>
</template>

<script>
import { Empty, message } from 'ant-design-vue'
import { getCNMarketOverview, getCNStocks } from '@/api/cnStocks'
import { addWatchlist, removeWatchlist } from '@/api/market'
import {
  cnChangeTone,
  formatCNSigned,
  freshnessKey,
  normalizeCNStockQuery
} from '@/utils/cnStocks'

export default {
  name: 'CNStocks',
  data () {
    return {
      loading: false,
      indices: [],
      breadth: {},
      snapshot: {},
      stocks: [],
      filters: normalizeCNStockQuery(this.$route.query),
      pagination: { page: 1, pageSize: 20, total: 0 },
      catalogCoverage: {},
      refreshRun: {},
      simpleImage: Empty.PRESENTED_IMAGE_SIMPLE
    }
  },
  computed: {
    columns () {
      return [
        { title: this.$t('cnStocks.stock'), key: 'identity', scopedSlots: { customRender: 'identity' }, width: 190 },
        { title: this.$t('cnStocks.exchange'), dataIndex: 'exchange', width: 80 },
        { title: this.$t('cnStocks.latest'), key: 'price', scopedSlots: { customRender: 'price' }, width: 110 },
        { title: this.$t('cnStocks.changePercent'), key: 'change', scopedSlots: { customRender: 'change' }, width: 110 },
        { title: this.$t('cnStocks.volume'), dataIndex: 'volume', customRender: value => this.formatNumber(value, 0), width: 130 },
        { title: this.$t('cnStocks.amount'), key: 'amount', scopedSlots: { customRender: 'amount' }, width: 130 },
        { title: this.$t('cnStocks.quoteStatus'), key: 'status', scopedSlots: { customRender: 'status' }, width: 100 },
        { title: this.$t('cnStocks.actions'), key: 'action', scopedSlots: { customRender: 'action' }, width: 130 }
      ]
    }
  },
  mounted () {
    this.refreshAll()
  },
  methods: {
    cnChangeTone,
    formatCNSigned,
    freshnessKey,
    async refreshAll () {
      this.loading = true
      try {
        const [overview, stocks] = await Promise.all([
          getCNMarketOverview(),
          getCNStocks(this.filters)
        ])
        const market = overview.data || {}
        this.indices = market.indices || []
        this.breadth = market.breadth || {}
        this.snapshot = market.snapshot || {}
        const catalog = stocks.data || {}
        this.stocks = catalog.items || []
        this.pagination = catalog.pagination || this.pagination
        this.catalogCoverage = catalog.coverage || {}
        this.refreshRun = catalog.refreshRun || {}
        if (!this.snapshot.asOf && catalog.snapshot) this.snapshot = catalog.snapshot
      } catch (error) {
        message.error(error.backendMessage || this.$t('cnStocks.loadFailed'))
      } finally {
        this.loading = false
      }
    },
    applyFilters () {
      this.filters.page = 1
      this.syncRoute()
      this.refreshAll()
    },
    applySort () {
      this.filters.page = 1
      this.syncRoute()
      this.refreshAll()
    },
    changePage (page) {
      this.filters.page = page
      this.syncRoute()
      this.refreshAll()
    },
    changePageSize (page, pageSize) {
      this.filters.page = 1
      this.filters.pageSize = pageSize
      this.syncRoute()
      this.refreshAll()
    },
    syncRoute () {
      this.$router.replace({ path: '/cn-stocks', query: { ...this.filters } }).catch(() => {})
    },
    openStock (row) {
      this.$router.push(`/cn-stocks/${row.symbol}`)
    },
    async toggleWatchlist (row) {
      try {
        if (row.watchlisted) await removeWatchlist({ market: 'CNStock', symbol: row.symbol })
        else await addWatchlist({ market: 'CNStock', symbol: row.symbol, name: row.name })
        row.watchlisted = !row.watchlisted
        message.success(this.$t(row.watchlisted ? 'cnStocks.watchlistAdded' : 'cnStocks.watchlistRemoved'))
      } catch (error) {
        message.error(error.backendMessage || this.$t('cnStocks.operationFailed'))
      }
    },
    formatNumber (value, digits = 2) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '-'
    },
    formatAmount (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '-'
      if (number >= 1e8) return `${(number / 1e8).toFixed(2)} ${this.$t('cnStocks.hundredMillion')}`
      if (number >= 1e4) return `${(number / 1e4).toFixed(2)} ${this.$t('cnStocks.tenThousand')}`
      return number.toLocaleString()
    },
    formatTime (value) {
      return value ? new Date(value).toLocaleString() : this.$t('cnStocks.unavailable')
    },
    freshnessColor (value) {
      return value === 'fresh' ? 'green' : ['stale', 'partial'].includes(value) ? 'orange' : 'default'
    }
  }
}
</script>

<style lang="less" scoped>
.cn-market-page { padding: 24px; min-height: 100%; background: var(--page-bg, #f3f6fa); }
.market-hero, .stock-panel { background: var(--component-background, #fff); border-radius: 16px; padding: 24px; box-shadow: 0 8px 28px rgba(15, 23, 42, .06); }
.market-hero { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
.market-hero h1 { margin: 4px 0 8px; font-size: 28px; }
.market-hero p { margin: 0; color: #64748b; }
.eyebrow { color: #1677ff; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.source-state { display: flex; align-items: center; gap: 10px; color: #64748b; flex-wrap: wrap; justify-content: flex-end; }
.stale-alert { margin-top: 16px; }
.index-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 18px 0; }
.index-card { border-radius: 14px; }
.card-label { color: #64748b; margin-bottom: 8px; }
.index-value { font-size: 28px; font-weight: 750; }
.breadth-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
.breadth-item { background: var(--component-background, #fff); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 6px; }
.breadth-item span { color: #64748b; }
.breadth-item strong { font-size: 20px; }
.filters { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
.filters .keyword { width: 320px; }
.filters .ant-select { width: 150px; }
.stock-link { display: flex; flex-direction: column; }
.stock-link span { color: #94a3b8; font-size: 12px; }
.quote-time { display: block; margin-top: 4px; color: #94a3b8; white-space: nowrap; }
.pagination { margin-top: 20px; text-align: right; }
.rise { color: #cf1322 !important; }
.fall { color: #389e0d !important; }
.flat { color: #64748b !important; }
@media (max-width: 1000px) { .breadth-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 720px) { .cn-market-page { padding: 12px; } .market-hero { flex-direction: column; } .source-state { justify-content: flex-start; } .index-grid, .breadth-grid { grid-template-columns: 1fr; } .filters .keyword, .filters .ant-select { width: 100%; } }
</style>
