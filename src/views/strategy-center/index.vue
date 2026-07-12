<template>
  <div class="strategy-center" :class="{ 'theme-dark': isDarkTheme }">
    <header class="sc-header">
      <div>
        <div class="sc-title-row">
          <h1>{{ $t('strategyCenter.console.title') }}</h1>
          <span class="system-health" :class="{ 'is-warning': loadError }">
            <i></i>{{ loadError ? $t('strategyCenter.console.systemDegraded') : $t('strategyCenter.console.systemHealthy') }}
          </span>
        </div>
        <p>{{ $t('strategyCenter.console.subtitle') }}</p>
      </div>
      <div class="sc-refresh">
        <span v-if="refreshedAt">{{ $t('systemOverview.colUpdatedAt') }} · {{ formatTime(refreshedAt) }}</span>
        <a-button type="primary" icon="plus" @click="openCreateLive">{{ $t('strategyCenter.stats.createLive') }}</a-button>
        <a-button icon="reload" :loading="loading" @click="loadStrategies">{{ $t('common.refresh') }}</a-button>
      </div>
    </header>

    <live-operations-table
      :strategies="strategies"
      :loading="loading"
      :load-error="loadError"
      :dark="isDarkTheme"
      :initial-strategy-id="initialStrategyId"
      :control-loading-id="controlLoadingId"
      @start="handleStart"
      @run="handleRun"
      @stop="handleStop"
      @edit="openEditLive"
      @delete="handleDelete"
      @open-workspace="openStrategyWorkspace"
    />

    <live-strategy-editor
      v-if="editorOpen"
      :visible="editorOpen"
      :mode="editorMode"
      :strategy-id="editorStrategyId"
      :initial-config="$route.query"
      @close="closeLiveEditor"
      @saved="handleEditorSaved"
    />
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { deleteStrategy, getStrategyList, startStrategy, stopStrategy } from '@/api/strategy'
import { deletePortfolioDeployment, listPortfolioDeployments, runPortfolioDeployment, startPortfolioDeployment, stopPortfolioDeployment } from '@/api/portfolioDeployment'
import LiveOperationsTable from './components/LiveOperationsTable.vue'
import LiveStrategyEditor from './components/LiveStrategyEditor.vue'

export default {
  name: 'StrategyCenter',
  components: { LiveOperationsTable, LiveStrategyEditor },
  data () {
    return {
      strategies: [],
      loading: false,
      loadError: false,
      refreshedAt: '',
      refreshTimer: null,
      controlLoadingId: null,
      editorOpen: false,
      editorMode: '',
      editorStrategyId: null
    }
  },
  computed: {
    ...mapState({ navTheme: state => state.app.theme }),
    isDarkTheme () {
      return this.navTheme === 'dark' || this.navTheme === 'realdark'
    },
    initialStrategyId () {
      const value = Number(this.$route.query.strategy_id || 0)
      return Number.isFinite(value) ? value : 0
    }
  },
  mounted () {
    this.loadStrategies()
    this.startRefreshTimer()
    this.openEditorFromRoute()
  },
  activated () {
    this.startRefreshTimer()
  },
  deactivated () {
    this.stopRefreshTimer()
  },
  beforeDestroy () {
    this.stopRefreshTimer()
  },
  methods: {
    parseList (res) {
      if (!res || res.code !== 1 || !res.data) return []
      if (Array.isArray(res.data)) return res.data
      return res.data.strategies || res.data.items || []
    },
    async loadStrategies () {
      if (this.loading) return
      this.loading = true
      this.loadError = false
      try {
        const [res, portfolioRes] = await Promise.all([getStrategyList(), listPortfolioDeployments()])
        if (!res || res.code !== 1) throw new Error('STRATEGY_LIST_LOAD_FAILED')
        const deployments = portfolioRes && portfolioRes.code === 1 && Array.isArray(portfolioRes.data) ? portfolioRes.data : []
        const deploymentsByStrategy = new Map(deployments.map(item => [Number(item.strategy_id), item]))
        this.strategies = this.parseList(res).map(strategy => {
          const deployment = deploymentsByStrategy.get(Number(strategy.id))
          return deployment
            ? { ...strategy, deployment_id: Number(deployment.id), portfolio_deployment: deployment, asset_type: 'portfolio_strategy' }
            : strategy
        })
        this.refreshedAt = new Date()
      } catch (error) {
        this.loadError = true
      } finally {
        this.loading = false
      }
    },
    async handleStart (strategy) {
      if (!strategy || !strategy.id || this.controlLoadingId) return
      this.controlLoadingId = strategy.id
      try {
        const res = strategy.deployment_id
          ? await startPortfolioDeployment(strategy.deployment_id)
          : await startStrategy(strategy.id)
        if (res && res.code === 1) {
          this.$message.success(this.$t('trading-assistant.messages.startSuccess'))
          await this.loadStrategies()
        } else {
          this.$message.error((res && res.msg) || this.$t('trading-assistant.messages.startFailed'))
        }
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('trading-assistant.messages.startFailed'))
      } finally {
        this.controlLoadingId = null
      }
    },
    async handleRun (strategy) {
      if (!strategy || !strategy.deployment_id || this.controlLoadingId) return
      this.controlLoadingId = strategy.id
      try {
        const res = await runPortfolioDeployment(strategy.deployment_id)
        if (res && res.code === 1) {
          this.$message.success(this.$t('portfolioDeployment.runQueued'))
          await this.loadStrategies()
        } else {
          this.$message.error((res && res.msg) || this.$t('portfolioDeployment.runFailed'))
        }
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('portfolioDeployment.runFailed'))
      } finally {
        this.controlLoadingId = null
      }
    },
    async handleStop (strategy) {
      if (!strategy || !strategy.id || this.controlLoadingId) return
      this.controlLoadingId = strategy.id
      try {
        const res = strategy.deployment_id
          ? await stopPortfolioDeployment(strategy.deployment_id)
          : await stopStrategy(strategy.id)
        if (res && res.code === 1) {
          this.$message.success(this.$t('trading-assistant.messages.stopSuccess'))
          await this.loadStrategies()
        } else {
          this.$message.error((res && res.msg) || this.$t('trading-assistant.messages.stopFailed'))
        }
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('trading-assistant.messages.stopFailed'))
      } finally {
        this.controlLoadingId = null
      }
    },
    openCreateLive () {
      this.editorMode = 'create'
      this.editorStrategyId = null
      this.editorOpen = true
    },
    openEditLive (strategy) {
      if (!strategy || !strategy.id) return
      this.editorMode = 'edit'
      this.editorStrategyId = Number(strategy.id)
      this.editorOpen = true
    },
    openEditorFromRoute () {
      const mode = String(this.$route.query.mode || '')
      if (mode === 'create') {
        this.openCreateLive()
        return
      }
      if (mode === 'edit' && this.$route.query.strategy_id) {
        this.editorMode = 'edit'
        this.editorStrategyId = Number(this.$route.query.strategy_id)
        this.editorOpen = true
      }
    },
    closeLiveEditor () {
      this.editorOpen = false
      this.editorMode = ''
      this.editorStrategyId = null
      this.clearEditorRouteState()
    },
    async handleEditorSaved () {
      this.closeLiveEditor()
      await this.loadStrategies()
    },
    clearEditorRouteState () {
      if (!this.$route.query.mode) return
      const query = { ...this.$route.query }
      delete query.mode
      delete query.source_id
      delete query.exchange_id
      delete query.market_type
      delete query.trade_direction
      delete query.initial_capital
      delete query.leverage
      delete query.asset_type
      delete query.universe_id
      this.$router.replace({ path: '/strategy-center', query }).catch(() => {})
    },
    async handleDelete (strategy) {
      if (!strategy || !strategy.id || this.controlLoadingId) return
      this.controlLoadingId = strategy.id
      try {
        const res = strategy.deployment_id
          ? await deletePortfolioDeployment(strategy.deployment_id)
          : await deleteStrategy(strategy.id)
        if (res && res.code === 1) {
          this.$message.success(this.$t('trading-assistant.messages.deleteSuccess'))
          await this.loadStrategies()
        } else {
          this.$message.error((res && res.msg) || this.$t('trading-assistant.messages.deleteFailed'))
        }
      } catch (error) {
        this.$message.error((error && (error.backendMessage || error.message)) || this.$t('trading-assistant.messages.deleteFailed'))
      } finally {
        this.controlLoadingId = null
      }
    },
    openStrategyWorkspace () {
      this.openCreateLive()
    },
    startRefreshTimer () {
      if (this.refreshTimer) return
      this.refreshTimer = window.setInterval(() => {
        if (!document.hidden) this.loadStrategies()
      }, 30000)
    },
    stopRefreshTimer () {
      if (this.refreshTimer) window.clearInterval(this.refreshTimer)
      this.refreshTimer = null
    },
    formatTime (value) {
      if (!value) return '-'
      const date = value instanceof Date ? value : new Date(value)
      return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
    }
  }
}
</script>

<style lang="less" scoped>
.strategy-center {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
  min-height: 0;
  overflow: hidden;
  padding: 18px 20px 24px !important;
  background: #f6f7f9;
  color: #18202c;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.strategy-center > .operations-workspace { flex: 1 1 auto; min-height: 0; }
.sc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;
  h1 { margin: 0; font-size: 27px; font-weight: 700; line-height: 1.25; letter-spacing: -.02em; color: #111827; }
  p { margin: 7px 0 0; color: #667085; font-size: 14px; line-height: 1.55; }
}
.sc-title-row { display: flex; align-items: center; gap: 14px; }
.system-health {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #3f7c57;
  font-size: 13px;
  font-weight: 500;
  i { width: 7px; height: 7px; border-radius: 50%; background: #22a95a; box-shadow: 0 0 0 4px rgba(34, 169, 90, 0.12); }
  &.is-warning { color: #b06b18; i { background: #d68a24; box-shadow: 0 0 0 4px rgba(214, 138, 36, 0.12); } }
}
.sc-refresh { display: flex; align-items: center; gap: 12px; color: #667085; font-size: 13px; font-variant-numeric: tabular-nums; }
.theme-dark {
  background: #0d0f11;
  color: #e7e9ed;
  .sc-header h1 { color: #f3f4f6; }
  .sc-header p, .sc-refresh { color: #7f8793; }
  .system-health { color: #61c885; }
}
@media (max-width: 720px) {
  .strategy-center { height: auto; min-height: calc(100vh - 64px); overflow: visible; padding: 12px !important; }
  .sc-header { flex-direction: column; }
  .sc-refresh { width: 100%; justify-content: space-between; }
}
</style>
