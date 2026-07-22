<template>
  <div class="stock-detail-page">
    <div class="top-actions">
      <a-button icon="arrow-left" @click="$router.push('/cn-stocks')">{{ $t('cnStocks.backToMarket') }}</a-button>
      <div>
        <a-button :loading="watchlistLoading" @click="toggleWatchlist">
          <a-icon type="star" :theme="detail.watchlisted ? 'filled' : 'outlined'" />
          {{ $t(detail.watchlisted ? 'cnStocks.removeWatchlist' : 'cnStocks.addWatchlist') }}
        </a-button>
        <a-button type="primary" icon="bar-chart" @click="openBacktest">{{ $t('cnStocks.openBacktest') }}</a-button>
      </div>
    </div>

    <a-spin :spinning="loading">
      <section v-if="detail.instrument" class="quote-hero">
        <div>
          <span class="exchange-badge">{{ detail.exchange }}</span>
          <h1>{{ detail.name }} <small>{{ detail.symbol }}</small></h1>
          <div class="quote-price" :class="cnChangeTone(quote.changePercent)">{{ formatNumber(quote.latest, 2) }}</div>
          <div :class="cnChangeTone(quote.changePercent)">{{ formatCNSigned(quote.change, 2) }} · {{ formatCNSigned(quote.changePercent, 2, '%') }}</div>
        </div>
        <div class="quote-meta">
          <a-tag :color="freshnessColor(detail.snapshot && detail.snapshot.freshness)">{{ $t(freshnessKey(detail.snapshot && detail.snapshot.freshness)) }}</a-tag>
          <span>{{ (detail.snapshot && detail.snapshot.source) || '-' }}</span>
          <span>{{ formatTime(detail.snapshot && detail.snapshot.asOf) }}</span>
        </div>
      </section>

      <a-alert
        v-if="detail.quoteStatus === 'unavailable'"
        type="warning"
        show-icon
        :message="$t('cnStocks.quoteUnavailableTitle')"
        :description="$t('cnStocks.quoteUnavailableDesc')"
      />

      <section class="quote-grid">
        <div v-for="item in quoteMetrics" :key="item.key"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div>
      </section>

      <section class="chart-panel">
        <div class="panel-heading">
          <div><h2>{{ $t('cnStocks.dailyChart') }}</h2><p>{{ $t('cnStocks.dailyChartHint') }}</p></div>
          <div class="provenance-tags">
            <a-tag :color="provenance.backtestEligible ? 'green' : 'orange'">{{ $t(provenance.backtestEligible ? 'cnStocks.authoritativeHistory' : 'cnStocks.displayHistory') }}</a-tag>
            <a-tag>{{ provenance.adjustmentMode || '-' }}</a-tag>
          </div>
        </div>
        <a-alert
          v-if="provenance.warning"
          class="history-warning"
          type="warning"
          show-icon
          :message="$t('cnStocks.historyFallbackTitle')"
          :description="$t('cnStocks.historyFallbackDesc')"
        />
        <div v-if="bars.length" ref="chart" class="kline-chart"></div>
        <a-empty v-else :description="$t('cnStocks.historyUnavailable')" />
        <div class="data-caption">
          <span>{{ $t('cnStocks.provider') }}: {{ provenance.provider || '-' }}</span>
          <span>{{ $t('cnStocks.lastTradeDate') }}: {{ provenance.lastTradeDate || '-' }}</span>
          <span>{{ $t('cnStocks.dataVersion') }}: {{ shortVersion(provenance.dataVersion) }}</span>
        </div>
      </section>

      <section class="indicator-section">
        <div class="panel-heading"><div><h2>{{ $t('cnStocks.technicalIndicators') }}</h2><p>{{ $t('cnStocks.indicatorHint') }}</p></div></div>
        <div class="indicator-grid">
          <a-card v-for="indicator in indicatorCards" :key="indicator.key" :bordered="false" class="indicator-card">
            <div class="indicator-title"><strong>{{ indicator.title }}</strong><a-tag v-if="indicator.available" color="blue">{{ indicator.params }}</a-tag></div>
            <template v-if="indicator.available">
              <div class="indicator-value">{{ indicator.value }}</div>
              <div class="indicator-signal">{{ indicator.signal }}</div>
            </template>
            <div v-else class="indicator-unavailable">
              {{ $t('cnStocks.insufficientHistory', { actual: indicator.actualBars, required: indicator.requiredBars }) }}
            </div>
          </a-card>
        </div>
      </section>
    </a-spin>
  </div>
</template>

<script>
import * as echarts from 'echarts'
import { message } from 'ant-design-vue'
import { getCNStock, getCNStockHistory } from '@/api/cnStocks'
import { addWatchlist, removeWatchlist } from '@/api/market'
import {
  cnChangeTone,
  cnStockBacktestLocation,
  formatCNSigned,
  freshnessKey
} from '@/utils/cnStocks'

export default {
  name: 'CNStockDetail',
  data () {
    return {
      loading: false,
      watchlistLoading: false,
      detail: {},
      bars: [],
      indicators: { values: {}, availability: {}, parameters: {} },
      provenance: {},
      chart: null
    }
  },
  computed: {
    quote () { return this.detail.quote || {} },
    quoteMetrics () {
      return [
        { key: 'open', label: this.$t('cnStocks.open'), value: this.formatNumber(this.quote.open, 2) },
        { key: 'high', label: this.$t('cnStocks.high'), value: this.formatNumber(this.quote.high, 2) },
        { key: 'low', label: this.$t('cnStocks.low'), value: this.formatNumber(this.quote.low, 2) },
        { key: 'previous', label: this.$t('cnStocks.previousClose'), value: this.formatNumber(this.quote.previousClose, 2) },
        { key: 'volume', label: this.$t('cnStocks.volume'), value: this.formatNumber(this.quote.volume, 0) },
        { key: 'amount', label: this.$t('cnStocks.amount'), value: this.formatAmount(this.quote.amount) }
      ]
    },
    indicatorCards () {
      const values = this.indicators.values || {}
      const availability = this.indicators.availability || {}
      const parameters = this.indicators.parameters || {}
      const configs = [
        ['ma', 'MA', () => this.maValue(values.moving_averages), values.moving_averages && values.moving_averages.trend],
        ['macd', 'MACD', () => this.formatNumber(values.macd && values.macd.value, 4), values.macd && values.macd.signal],
        ['rsi', 'RSI', () => this.formatNumber(values.rsi && values.rsi.value, 2), values.rsi && values.rsi.signal],
        ['kdj', 'KDJ', () => this.kdjValue(values.kdj), values.kdj && values.kdj.signal],
        ['boll', 'BOLL', () => this.bollValue(values.bollinger), values.trend],
        ['atr', 'ATR', () => this.formatNumber(values.volatility && values.volatility.atr, 4), values.volatility && values.volatility.level]
      ]
      return configs.map(([key, title, formatter, signal]) => ({
        key,
        title,
        value: formatter(),
        signal: signal || '-',
        params: (parameters[key] || []).join(', '),
        ...(availability[key] || { available: false, actualBars: this.bars.length, requiredBars: 0 })
      }))
    }
  },
  watch: {
    '$route.params.symbol': 'loadAll'
  },
  mounted () {
    this.loadAll()
    window.addEventListener('resize', this.resizeChart)
  },
  beforeDestroy () {
    window.removeEventListener('resize', this.resizeChart)
    if (this.chart) this.chart.dispose()
  },
  methods: {
    cnChangeTone,
    formatCNSigned,
    freshnessKey,
    async loadAll () {
      this.loading = true
      try {
        const symbol = this.$route.params.symbol
        const [detail, history] = await Promise.all([
          getCNStock(symbol),
          getCNStockHistory(symbol, { limit: 260, adjustment: 'forward' })
        ])
        this.detail = detail.data || {}
        const data = history.data || {}
        this.bars = data.bars || []
        this.indicators = data.indicators || { values: {}, availability: {}, parameters: {} }
        this.provenance = data.provenance || {}
        this.$nextTick(this.renderChart)
      } catch (error) {
        message.error(error.backendMessage || this.$t('cnStocks.loadFailed'))
      } finally {
        this.loading = false
      }
    },
    renderChart () {
      if (!this.$refs.chart || !this.bars.length) return
      if (!this.chart) this.chart = echarts.init(this.$refs.chart)
      const dates = this.bars.map(item => item.date)
      const candle = this.bars.map(item => [item.open, item.close, item.low, item.high])
      const volume = this.bars.map(item => ({
        value: item.volume,
        itemStyle: { color: Number(item.close) >= Number(item.open) ? '#cf1322' : '#389e0d' }
      }))
      this.chart.setOption({
        animation: false,
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        grid: [{ left: 55, right: 20, top: 24, height: '62%' }, { left: 55, right: 20, top: '73%', height: '16%' }],
        xAxis: [
          { type: 'category', data: dates, boundaryGap: false, axisLine: { onZero: false }, min: 'dataMin', max: 'dataMax' },
          { type: 'category', gridIndex: 1, data: dates, boundaryGap: false, axisLabel: { show: false }, min: 'dataMin', max: 'dataMax' }
        ],
        yAxis: [{ scale: true, splitArea: { show: true } }, { scale: true, gridIndex: 1, splitNumber: 2 }],
        dataZoom: [{ type: 'inside', xAxisIndex: [0, 1], start: 35, end: 100 }, { show: true, xAxisIndex: [0, 1], bottom: 0, start: 35, end: 100 }],
        series: [
          { name: this.$t('cnStocks.dailyChart'), type: 'candlestick', data: candle, itemStyle: { color: '#cf1322', color0: '#389e0d', borderColor: '#cf1322', borderColor0: '#389e0d' } },
          { name: this.$t('cnStocks.volume'), type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: volume }
        ]
      })
    },
    resizeChart () { if (this.chart) this.chart.resize() },
    async toggleWatchlist () {
      this.watchlistLoading = true
      try {
        if (this.detail.watchlisted) await removeWatchlist({ market: 'CNStock', symbol: this.detail.symbol })
        else await addWatchlist({ market: 'CNStock', symbol: this.detail.symbol, name: this.detail.name })
        this.detail = { ...this.detail, watchlisted: !this.detail.watchlisted }
        message.success(this.$t(this.detail.watchlisted ? 'cnStocks.watchlistAdded' : 'cnStocks.watchlistRemoved'))
      } catch (error) {
        message.error(error.backendMessage || this.$t('cnStocks.operationFailed'))
      } finally {
        this.watchlistLoading = false
      }
    },
    openBacktest () { this.$router.push(cnStockBacktestLocation(this.detail)) },
    formatNumber (value, digits = 2) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '-'
    },
    formatAmount (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '-'
      return number >= 1e8 ? `${(number / 1e8).toFixed(2)} ${this.$t('cnStocks.hundredMillion')}` : number.toLocaleString()
    },
    formatTime (value) { return value ? new Date(value).toLocaleString() : '-' },
    freshnessColor (value) { return value === 'fresh' ? 'green' : value === 'stale' ? 'orange' : 'default' },
    shortVersion (value) { return value ? `${String(value).slice(0, 12)}…` : '-' },
    maValue (value) { return value ? `MA5 ${this.formatNumber(value.ma5, 2)} · MA20 ${this.formatNumber(value.ma20, 2)}` : '-' },
    kdjValue (value) { return value ? `K ${this.formatNumber(value.k, 2)} · D ${this.formatNumber(value.d, 2)} · J ${this.formatNumber(value.j, 2)}` : '-' },
    bollValue (value) { return value ? `${this.formatNumber(value.BB_lower, 2)} / ${this.formatNumber(value.BB_middle, 2)} / ${this.formatNumber(value.BB_upper, 2)}` : '-' }
  }
}
</script>

<style lang="less" scoped>
.stock-detail-page { padding: 24px; min-height: 100%; background: var(--page-bg, #f3f6fa); }
.top-actions { display: flex; justify-content: space-between; margin-bottom: 16px; }
.top-actions > div { display: flex; gap: 10px; }
.quote-hero, .chart-panel, .indicator-section { background: var(--component-background, #fff); border-radius: 16px; padding: 24px; box-shadow: 0 8px 28px rgba(15, 23, 42, .06); }
.quote-hero { display: flex; justify-content: space-between; align-items: flex-start; }
.quote-hero h1 { margin: 8px 0; font-size: 28px; }.quote-hero h1 small { color: #94a3b8; font-size: 14px; }
.exchange-badge { background: #e6f4ff; color: #1677ff; border-radius: 6px; padding: 3px 8px; font-weight: 700; }
.quote-price { font-size: 36px; font-weight: 800; }.quote-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; color: #64748b; }
.quote-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin: 16px 0; }
.quote-grid > div { background: var(--component-background, #fff); padding: 16px; border-radius: 12px; display: flex; flex-direction: column; gap: 5px; }.quote-grid span { color: #64748b; }
.chart-panel { margin-bottom: 16px; }.panel-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }.panel-heading h2 { margin-bottom: 4px; }.panel-heading p { color: #64748b; }
.provenance-tags { display: flex; gap: 6px; }.history-warning { margin: 12px 0; }.kline-chart { height: 520px; width: 100%; }
.data-caption { display: flex; flex-wrap: wrap; gap: 18px; color: #64748b; font-size: 12px; margin-top: 10px; }
.indicator-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }.indicator-card { border-radius: 12px; background: var(--page-bg, #f8fafc); }.indicator-title { display: flex; justify-content: space-between; }.indicator-value { font-size: 18px; font-weight: 700; margin-top: 16px; }.indicator-signal, .indicator-unavailable { color: #64748b; margin-top: 6px; }
.rise { color: #cf1322 !important; }.fall { color: #389e0d !important; }.flat { color: #64748b !important; }
@media (max-width: 1000px) { .quote-grid { grid-template-columns: repeat(3, 1fr); }.indicator-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 720px) { .stock-detail-page { padding: 12px; }.top-actions, .quote-hero, .panel-heading { flex-direction: column; }.quote-meta { align-items: flex-start; }.quote-grid, .indicator-grid { grid-template-columns: 1fr 1fr; }.kline-chart { height: 400px; } }
</style>
