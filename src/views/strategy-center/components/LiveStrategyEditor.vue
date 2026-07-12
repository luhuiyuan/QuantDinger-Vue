<template>
  <a-modal
    :visible="visible"
    :title="modalTitle"
    :width="880"
    :mask-closable="false"
    :confirm-loading="saving"
    class="live-strategy-editor"
    :wrap-class-name="isDarkTheme ? 'live-strategy-editor-wrap theme-dark' : 'live-strategy-editor-wrap'"
    @cancel="close">
    <a-steps :current="step" size="small" class="editor-steps">
      <a-step :title="$t('trading-assistant.form.scriptSource')" />
      <a-step :title="$t('trading-assistant.form.scriptStepParams')" />
      <a-step :title="$t('trading-assistant.form.scriptStepSignalLive')" />
    </a-steps>

    <a-spin :spinning="loading">
      <section v-show="step === 0" class="editor-section">
        <a-alert
          show-icon
          type="info"
          :message="$t('trading-assistant.form.scriptSourceTitle')"
          :description="$t('trading-assistant.form.scriptSourceHint')" />
        <a-form layout="vertical" class="editor-form editor-form--source">
          <a-form-item :label="$t('trading-assistant.form.scriptSource')" required>
            <a-select
              v-model="model.scriptSourceId"
              show-search
              option-filter-prop="children"
              :loading="loadingSources"
              :placeholder="$t('trading-assistant.form.scriptSourcePlaceholder')"
              @change="loadSourceDetail">
              <a-select-option v-for="source in sources" :key="String(source.id)" :value="String(source.id)">
                {{ source.name || source.title || source.strategy_name || `#${source.id}` }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <div v-if="model.scriptSourceId" class="source-summary">
            <div class="source-summary__icon"><a-icon type="code" /></div>
            <div>
              <div class="source-summary__title">
                <strong>{{ sourceDetail.name || sourceDetail.title || sourceDetail.strategy_name }}</strong>
                <a-tag>{{ sourceTypeLabel(sourceDetail) }}</a-tag>
              </div>
              <p>{{ sourceDetail.description || sourceMetadata.description || $t('trading-assistant.form.scriptSourceHint') }}</p>
              <span v-if="!isPortfolioStrategy">{{ $t('trading-assistant.form.timeframe') }} · {{ model.timeframe }}</span>
              <span v-else>{{ $t('portfolioDeployment.frequency') }} · {{ $t(`portfolioDeployment.${model.rebalanceFrequency}`) }}</span>
              <span v-if="parameterDefinitions.length">{{ $t('trading-assistant.editor.paramsTab') }} · {{ parameterDefinitions.length }}</span>
            </div>
          </div>
          <div v-if="parameterDefinitions.length" class="parameter-panel parameter-panel--source">
            <div class="parameter-panel__head">
              <div>
                <strong>{{ $t('trading-assistant.editor.paramsTab') }}</strong>
                <span>{{ $t('trading-assistant.editor.codeParamsDesc') }}</span>
              </div>
              <a-tag>{{ parameterDefinitions.length }}</a-tag>
            </div>
            <div class="parameter-grid">
              <a-form-item v-for="param in parameterDefinitions" :key="param.name" :label="parameterLabel(param)">
                <a-switch
                  v-if="param.type === 'boolean'"
                  :checked="Boolean(model.templateParams[param.name])"
                  @change="value => setParameter(param.name, value)" />
                <a-select
                  v-else-if="param.type === 'select' && Array.isArray(param.options)"
                  :value="model.templateParams[param.name]"
                  @change="value => setParameter(param.name, value)">
                  <a-select-option v-for="option in param.options" :key="String(option.value != null ? option.value : option)" :value="option.value != null ? option.value : option">
                    {{ option.label || option.value || option }}
                  </a-select-option>
                </a-select>
                <a-input-number
                  v-else-if="['integer', 'number', 'percent'].includes(param.type)"
                  :value="model.templateParams[param.name]"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step || (param.type === 'integer' ? 1 : 0.01)"
                  :precision="param.type === 'integer' ? 0 : undefined"
                  @change="value => setParameter(param.name, value)" />
                <a-input
                  v-else
                  :value="model.templateParams[param.name]"
                  @input="value => setParameter(param.name, value && value.target ? value.target.value : value)" />
              </a-form-item>
            </div>
          </div>
        </a-form>
      </section>

      <section v-show="step === 1" class="editor-section">
        <a-form layout="vertical" class="editor-form">
          <a-form-item :label="$t('trading-assistant.form.strategyName')" required>
            <a-input v-model.trim="model.name" :placeholder="$t('trading-assistant.placeholders.inputStrategyName')" />
          </a-form-item>
          <template v-if="isPortfolioStrategy">
            <a-form-item :label="$t('portfolioDeployment.universe')" required>
              <a-select v-model="model.universeId" show-search option-filter-prop="children" :loading="loadingUniverses">
                <a-select-option v-for="universe in portfolioUniverses" :key="Number(universe.id)" :value="Number(universe.id)">
                  {{ universeLabel(universe) }} · {{ universe.member_count || 0 }} {{ $t('portfolioDeployment.symbols') }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item :label="$t('portfolioDeployment.frequency')">
                  <a-radio-group v-model="model.rebalanceFrequency" button-style="solid" class="full-radio-group">
                    <a-radio-button value="daily">{{ $t('portfolioDeployment.daily') }}</a-radio-button>
                    <a-radio-button value="weekly">{{ $t('portfolioDeployment.weekly') }}</a-radio-button>
                    <a-radio-button value="monthly">{{ $t('portfolioDeployment.monthly') }}</a-radio-button>
                  </a-radio-group>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item :label="$t('portfolioDeployment.capital')" required>
                  <a-input-number v-model="model.initialCapital" :min="10" :max="1000000000" :precision="2" :step="1000" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="8"><a-form-item :label="$t('portfolioDeployment.maxWeight')"><a-input-number v-model="model.maxWeightPct" :min="0.1" :max="100" :step="1" :precision="2" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item :label="$t('portfolioDeployment.commission')"><a-input-number v-model="model.commissionPct" :min="0" :max="10" :step="0.01" :precision="4" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item :label="$t('portfolioDeployment.fractional')"><a-switch v-model="model.allowFractional" /></a-form-item></a-col>
            </a-row>
          </template>
          <template v-else>
            <a-form-item :label="isEdit ? $t('trading-assistant.form.symbol') : $t('trading-assistant.form.symbols')" required>
              <a-select
                v-model="model.symbols"
                :mode="isEdit ? 'default' : 'multiple'"
                :open="symbolDropdownOpen"
                show-search
                option-filter-prop="children"
                :loading="loadingWatchlist"
                :placeholder="$t(isEdit ? 'trading-assistant.placeholders.selectSymbol' : 'trading-assistant.placeholders.selectSymbols')"
                @dropdownVisibleChange="symbolDropdownOpen = $event"
                @change="handleSymbolChange">
                <a-select-option v-for="item in symbolOptions" :key="symbolValue(item)" :value="symbolValue(item)">
                  {{ item.market }} · {{ item.symbol }}<template v-if="item.name"> · {{ item.name }}</template>
                </a-select-option>
              </a-select>
              <div v-if="isCrypto" class="field-hint">{{ $t('trading-assistant.form.symbolHintCrypto') }}</div>
            </a-form-item>
            <div class="strategy-defaults">
              <span>{{ $t('strategyCenter.editor.timeframeFromStrategy') }}</span>
              <strong>{{ timeframeLabel(model.timeframe) }}</strong>
            </div>
            <a-row v-if="isCrypto" :gutter="16">
              <a-col :span="12">
                <a-form-item :label="$t('trading-assistant.form.marketType')">
                  <a-radio-group v-model="model.marketType" button-style="solid" class="full-radio-group" @change="normalizeExecutionFields">
                    <a-radio-button value="swap">{{ $t('trading-assistant.form.marketTypeFutures') }}</a-radio-button>
                    <a-radio-button value="spot">{{ $t('trading-assistant.form.marketTypeSpot') }}</a-radio-button>
                  </a-radio-group>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item :label="$t('trading-assistant.form.tradeDirection')">
                  <a-select v-model="model.tradeDirection" :disabled="model.marketType === 'spot'">
                    <a-select-option value="long">{{ $t('trading-assistant.form.tradeDirectionLong') }}</a-select-option>
                    <a-select-option value="short">{{ $t('trading-assistant.form.tradeDirectionShort') }}</a-select-option>
                    <a-select-option value="both">{{ $t('trading-assistant.form.tradeDirectionBoth') }}</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="isCrypto && model.marketType === 'swap' ? 12 : 24">
                <a-form-item :label="$t('trading-assistant.form.initialCapital')" required>
                  <a-input-number v-model="model.initialCapital" :min="1" :max="1000000000" :precision="2" :step="100" />
                </a-form-item>
              </a-col>
              <a-col v-if="isCrypto && model.marketType === 'swap'" :span="12">
                <a-form-item :label="$t('trading-assistant.form.leverage')" required>
                  <a-input-number v-model="model.leverage" :min="1" :max="125" />
                </a-form-item>
              </a-col>
            </a-row>
          </template>

        </a-form>
      </section>

      <section v-show="step === 2" class="editor-section">
        <a-form layout="vertical" class="editor-form">
          <a-form-item :label="$t('trading-assistant.form.executionMode')">
            <a-radio-group v-model="model.executionMode" button-style="solid">
              <a-radio-button value="signal">{{ $t('trading-assistant.form.executionModeSignal') }}</a-radio-button>
              <a-radio-button value="live" :disabled="!supportsLive">{{ $t('trading-assistant.form.executionModeLive') }}</a-radio-button>
            </a-radio-group>
            <div class="field-hint">{{ $t(model.executionMode === 'live' ? 'trading-assistant.form.executionModeLiveDesc' : 'trading-assistant.form.executionModeSignalDesc') }}</div>
          </a-form-item>

          <a-alert
            v-if="!isPortfolioStrategy && isCrypto && model.executionMode === 'signal'"
            show-icon
            type="info"
            :message="$t('strategyCenter.editor.defaultMarketDataSource', { exchange: exchangeName(defaultCryptoExchange) })" />

          <template v-if="model.executionMode === 'live'">
            <a-alert show-icon type="warning" :message="$t('trading-assistant.liveDisclaimer.title')" :description="$t('trading-assistant.liveDisclaimer.content')" />
            <a-checkbox v-model="model.disclaimer" class="disclaimer-check">{{ $t('trading-assistant.liveDisclaimer.agree') }}</a-checkbox>
            <a-form-item :label="$t('trading-assistant.form.savedCredential')" required>
                <a-select
                  v-model="model.credentialId"
                  :loading="loadingCredentials"
                  :placeholder="$t('trading-assistant.placeholders.selectSavedCredential')"
                  @change="handleCredentialChange">
                <a-select-option v-for="credential in compatibleCredentials" :key="credential.id" :value="credential.id">
                  {{ credentialLabel(credential) }}
                </a-select-option>
              </a-select>
              <div v-if="!compatibleCredentials.length" class="field-hint field-hint--warning">
                {{ $t('trading-assistant.noCredentialForLive.title') }}
                <router-link :to="{ path: '/broker-accounts' }">{{ $t('trading-assistant.form.goToProfile') }}</router-link>
              </div>
            </a-form-item>
            <div v-if="selectedCredentialExchange" class="execution-summary">
              <span>{{ $t('trading-assistant.form.exchange') }}</span>
              <strong>{{ exchangeName(selectedCredentialExchange) }}</strong>
            </div>
          </template>

          <a-form-item :label="$t('trading-assistant.form.notifyChannels')" required>
            <a-checkbox-group v-model="model.notifyChannels" class="notification-grid">
              <a-checkbox v-for="channel in notificationChannels" :key="channel" :value="channel">
                {{ $t(`trading-assistant.notify.${channel}`) }}
              </a-checkbox>
            </a-checkbox-group>
            <div class="field-hint">{{ $t('trading-assistant.form.notifyChannelsHint') }}</div>
          </a-form-item>
        </a-form>
      </section>
    </a-spin>

    <template #footer>
      <a-button @click="close">{{ $t('trading-assistant.form.cancel') }}</a-button>
      <a-button v-if="step > 0" @click="step -= 1">{{ $t('trading-assistant.form.prev') }}</a-button>
      <a-button v-if="step < 2" type="primary" @click="next">{{ $t('trading-assistant.form.next') }}</a-button>
      <a-button v-else type="primary" :loading="saving" @click="save">
        {{ $t(isEdit ? 'trading-assistant.form.confirmEdit' : 'trading-assistant.form.confirmCreate') }}
      </a-button>
    </template>
  </a-modal>
</template>

<script>
import { batchCreateStrategies, getScriptSourceDetail, getScriptSourceList, getStrategyDetail, updateStrategy } from '@/api/strategy'
import { mapState } from 'vuex'
import { listExchangeCredentials } from '@/api/credentials'
import { getWatchlist } from '@/api/market'
import { getNotificationSettings } from '@/api/user'
import { getPublicSettingsConfig } from '@/api/settings'
import { getUniverses } from '@/api/universe'
import { createPortfolioDeployment, listPortfolioDeployments, updatePortfolioDeployment } from '@/api/portfolioDeployment'
import { formatExchangeCredentialLabel, getExchangeDisplayName } from '@/utils/exchangeCredential'
import { extractScriptParamsFromCode } from '@/views/strategy-ide/components/scriptTemplateCatalog'

const DEFAULT_CHANNELS = ['browser', 'email']
const CRYPTO_EXCHANGES = ['binance', 'bitget', 'bybit', 'okx', 'gate', 'htx']
const LIVE_CRYPTO_EXCHANGES = new Set(CRYPTO_EXCHANGES)
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W']
const notificationTargets = settings => ({
  email: settings.email || '',
  phone: settings.phone || '',
  telegram: settings.telegram_chat_id || '',
  telegram_bot_token: settings.telegram_bot_token || '',
  discord: settings.discord_webhook || '',
  webhook: settings.webhook_url || '',
  webhook_token: settings.webhook_token || ''
})

export default {
  name: 'LiveStrategyEditor',
  props: {
    visible: { type: Boolean, default: false },
    mode: { type: String, default: 'create' },
    strategyId: { type: Number, default: null },
    initialConfig: { type: Object, default: () => ({}) }
  },
  data () {
    return {
      step: 0,
      loading: false,
      saving: false,
      loadingSources: false,
      loadingWatchlist: false,
      loadingUniverses: false,
      loadingCredentials: false,
      symbolDropdownOpen: false,
      sources: [],
      watchlist: [],
      universes: [],
      credentials: [],
      sourceDetail: {},
      originalStrategy: null,
      notificationSettings: {},
      defaultCryptoExchange: 'binance',
      notificationChannels: ['browser', 'email', 'telegram', 'discord', 'webhook', 'phone'],
      model: this.defaultModel()
    }
  },
  computed: {
    ...mapState({ navTheme: state => state.app.theme }),
    isDarkTheme () {
      return this.navTheme === 'dark' || this.navTheme === 'realdark'
    },
    isEdit () { return this.mode === 'edit' },
    modalTitle () {
      return this.$t(this.isEdit ? 'trading-assistant.editStrategy' : 'trading-assistant.createStrategy')
    },
    selectedValues () {
      if (Array.isArray(this.model.symbols)) return this.model.symbols
      return this.model.symbols ? [this.model.symbols] : []
    },
    marketCategory () {
      if (this.isPortfolioStrategy) {
        const universe = this.universes.find(item => Number(item.id) === Number(this.model.universeId))
        return String((universe && universe.market) || 'USStock')
      }
      const first = this.selectedValues[0] || ''
      return first.includes(':') ? first.slice(0, first.indexOf(':')) : 'Crypto'
    },
    isPortfolioStrategy () {
      return String(this.sourceDetail.asset_type || this.sourceMetadata.asset_type || '').toLowerCase() === 'portfolio_strategy'
    },
    portfolioUniverses () {
      const supportedMarkets = new Set(['USStock', 'HKStock', 'AStock', 'CNStock', 'Crypto', 'Cryptocurrency'])
      return this.universes.filter(item => supportedMarkets.has(String(item.market || '')) && Number(item.member_count || 0) > 0)
    },
    isCrypto () {
      return this.marketCategory === 'Crypto'
    },
    symbolOptions () {
      if (this.isEdit || !this.selectedValues.length) return this.watchlist
      const category = this.marketCategory
      return this.watchlist.filter(item => String(item.market || '') === category)
    },
    supportsLive () {
      if (this.isPortfolioStrategy) return this.marketCategory === 'USStock'
      return ['Crypto', 'USStock'].includes(this.marketCategory)
    },
    sourceMetadata () {
      return this.parseObject(this.sourceDetail.metadata)
    },
    sourceLastRun () {
      return this.parseObject(this.sourceMetadata.last_run_config)
    },
    sourceParameterValues () {
      return {
        ...this.parseObject(this.sourceMetadata.script_template_params),
        ...this.parseObject(this.sourceLastRun.script_template_params),
        ...this.parseObject(this.sourceDetail.template_params)
      }
    },
    parameterDefinitions () {
      const schema = this.parseObject(this.sourceDetail.param_schema)
      if (Array.isArray(schema.params) && schema.params.length) return schema.params.filter(item => item && item.name)
      const inferred = extractScriptParamsFromCode(this.sourceDetail.code || this.sourceDetail.strategy_code || '')
      if (inferred && Array.isArray(inferred.params) && inferred.params.length) return inferred.params
      return Object.keys(this.sourceParameterValues).map(name => ({
        name,
        type: Number.isInteger(this.sourceParameterValues[name]) ? 'integer' : (typeof this.sourceParameterValues[name] === 'number' ? 'number' : 'text'),
        default: this.sourceParameterValues[name]
      }))
    },
    compatibleCredentials () {
      return this.credentials.filter(credential => {
        const exchange = String(credential.exchange_id || '').toLowerCase()
        if (this.isPortfolioStrategy) return exchange === 'alpaca'
        if (this.marketCategory === 'Crypto') return LIVE_CRYPTO_EXCHANGES.has(exchange)
        if (this.marketCategory === 'USStock') return ['alpaca', 'ibkr'].includes(exchange)
        return false
      })
    },
    selectedCredentialExchange () {
      const credential = this.credentials.find(item => String(item.id) === String(this.model.credentialId))
      return String((credential && credential.exchange_id) || '')
    }
  },
  watch: {
    visible: {
      immediate: true,
      handler (value) {
        if (value) this.initialize()
      }
    }
  },
  methods: {
    defaultModel () {
      const config = this.initialConfig || {}
      const marketType = String(config.market_type || '').toLowerCase() === 'spot' ? 'spot' : 'swap'
      const direction = ['long', 'short', 'both'].includes(String(config.trade_direction || '').toLowerCase())
        ? String(config.trade_direction).toLowerCase()
        : 'long'
      return {
        scriptSourceId: config.source_id ? String(config.source_id) : '',
        name: '',
        symbols: this.mode === 'edit' ? '' : [],
        exchangeId: String(config.exchange_id || '').toLowerCase(),
        timeframe: TIMEFRAMES.includes(String(config.timeframe || '')) ? String(config.timeframe) : '1m',
        initialCapital: Number(config.initial_capital) > 0 ? Number(config.initial_capital) : 1000,
        leverage: marketType === 'spot' ? 1 : (Number(config.leverage) > 0 ? Number(config.leverage) : 5),
        marketType,
        tradeDirection: marketType === 'spot' ? 'long' : direction,
        executionMode: 'signal',
        credentialId: undefined,
        disclaimer: false,
        notifyChannels: [...DEFAULT_CHANNELS],
        templateParams: {},
        universeId: Number(config.universe_id || config.universeId || 0) || undefined,
        rebalanceFrequency: String(config.rebalance_frequency || 'weekly'),
        maxWeightPct: Number(config.max_weight_pct || 10),
        commissionPct: Number(config.commission_pct || 0.05),
        allowFractional: config.allow_fractional !== false,
        deploymentId: Number(config.deployment_id || 0) || undefined
      }
    },
    parseObject (value) {
      if (value && typeof value === 'object' && !Array.isArray(value)) return value
      if (typeof value !== 'string' || !value.trim()) return {}
      try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      } catch (error) {
        return {}
      }
    },
    async initialize () {
      this.step = 0
      this.symbolDropdownOpen = false
      this.model = this.defaultModel()
      this.sourceDetail = {}
      this.originalStrategy = null
      this.loading = true
      try {
        await Promise.all([
          this.loadSources(),
          this.loadWatchlist(),
          this.loadUniverses(),
          this.loadCredentials(),
          this.loadNotifications(),
          this.loadPublicConfig()
        ])
        if (this.isEdit && this.strategyId) await this.loadStrategy()
        else if (this.model.scriptSourceId) await this.loadSourceDetail(this.model.scriptSourceId)
      } finally {
        this.loading = false
      }
    },
    async loadSources () {
      this.loadingSources = true
      try {
        const res = await getScriptSourceList()
        const data = res && res.data
        this.sources = Array.isArray(data) ? data : ((data && (data.sources || data.items)) || [])
      } finally {
        this.loadingSources = false
      }
    },
    async loadWatchlist () {
      this.loadingWatchlist = true
      try {
        const res = await getWatchlist({ userid: 1 })
        const rows = res && res.code === 1 && Array.isArray(res.data) ? res.data : []
        const seen = new Set()
        this.watchlist = rows.filter(item => {
          const key = `${String(item.market || '').toLowerCase()}:${String(item.symbol || '').toUpperCase()}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      } finally {
        this.loadingWatchlist = false
      }
    },
    async loadUniverses () {
      this.loadingUniverses = true
      try {
        const res = await getUniverses()
        const data = res && Object.prototype.hasOwnProperty.call(res, 'data') ? res.data : res
        this.universes = Array.isArray(data) ? data : ((data && data.items) || [])
      } finally {
        this.loadingUniverses = false
      }
    },
    async loadPublicConfig () {
      try {
        const res = await getPublicSettingsConfig()
        const value = res && res.code === 1 && res.data && res.data.ccxt_default_exchange
        const normalized = String(value || 'binance').toLowerCase()
        this.defaultCryptoExchange = LIVE_CRYPTO_EXCHANGES.has(normalized) ? normalized : 'binance'
      } catch (error) {
        this.defaultCryptoExchange = 'binance'
      }
    },
    async loadCredentials () {
      this.loadingCredentials = true
      try {
        const res = await listExchangeCredentials({ user_id: 1 })
        this.credentials = res && res.code === 1 && res.data ? (res.data.items || []) : []
      } finally {
        this.loadingCredentials = false
      }
    },
    async loadNotifications () {
      try {
        const res = await getNotificationSettings()
        if (res && res.code === 1 && res.data) {
          this.notificationSettings = res.data
          if (Array.isArray(res.data.default_channels) && res.data.default_channels.length) {
            this.model.notifyChannels = [...res.data.default_channels]
          }
        }
      } catch (error) {}
    },
    async loadSourceDetail (id, applyDefaults = true) {
      if (!id) return
      const res = await getScriptSourceDetail(id)
      this.sourceDetail = (res && res.data) || res || {}
      if (!this.model.name || (applyDefaults && !this.isEdit)) {
        this.model.name = this.sourceDetail.name || this.sourceDetail.title || this.sourceDetail.strategy_name || ''
      }
      if (applyDefaults && !this.isEdit) {
        const run = this.sourceLastRun
        this.model.exchangeId = ''
        this.model.timeframe = this.extractSourceTimeframe() || (TIMEFRAMES.includes(String(run.timeframe || '')) ? String(run.timeframe) : this.model.timeframe)
        this.model.initialCapital = Number(run.initial_capital || run.investment_amount || this.model.initialCapital)
        this.model.marketType = run.market_type === 'spot' ? 'spot' : 'swap'
        this.model.leverage = Number(run.leverage || this.model.leverage)
        this.model.tradeDirection = run.trade_direction || this.model.tradeDirection
        this.model.universeId = Number(run.universe_id || run.universeId || this.model.universeId || 0) || undefined
        this.model.rebalanceFrequency = String(run.rebalance_frequency || this.model.rebalanceFrequency || 'weekly')
        this.model.templateParams = this.buildParameterValues(this.sourceParameterValues)
        this.normalizeExecutionFields()
      }
    },
    extractSourceTimeframe () {
      const source = String(this.sourceDetail.code || this.sourceDetail.strategy_code || '')
      const match = source.match(/(?:^|\n)\s*#\s*timeframe\s*:\s*([A-Za-z0-9_-]+)/i)
      if (!match) return ''
      const aliases = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W' }
      return aliases[String(match[1] || '').toLowerCase()] || ''
    },
    async loadStrategy () {
      const res = await getStrategyDetail(this.strategyId)
      const strategy = (res && res.data) || res || {}
      this.originalStrategy = strategy
      if (String(strategy.strategy_type || '').toLowerCase() === 'portfoliostrategy') {
        const deploymentsRes = await listPortfolioDeployments()
        const deployments = deploymentsRes && deploymentsRes.code === 1 && Array.isArray(deploymentsRes.data) ? deploymentsRes.data : []
        const deployment = deployments.find(item => Number(item.strategy_id) === Number(this.strategyId))
        if (!deployment) throw new Error('PORTFOLIO_DEPLOYMENT_NOT_FOUND')
        const portfolioConfig = deployment.config || {}
        this.model = {
          ...this.defaultModel(),
          scriptSourceId: String(deployment.source_id || ''),
          name: deployment.name || strategy.strategy_name || '',
          symbols: '',
          exchangeId: '',
          timeframe: '1D',
          initialCapital: Number(portfolioConfig.initial_capital || strategy.initial_capital || 10000),
          leverage: 1,
          marketType: 'spot',
          tradeDirection: 'long',
          executionMode: deployment.execution_mode === 'live' ? 'live' : 'signal',
          credentialId: deployment.credential_id || undefined,
          disclaimer: deployment.execution_mode === 'live',
          notifyChannels: portfolioConfig.notification_channels || [...DEFAULT_CHANNELS],
          templateParams: { ...(portfolioConfig.params || {}) },
          universeId: Number(deployment.universe_id || 0) || undefined,
          rebalanceFrequency: deployment.rebalance_frequency || 'weekly',
          maxWeightPct: Number(portfolioConfig.max_weight || 0.1) * 100,
          commissionPct: Number(portfolioConfig.commission_rate || 0.0005) * 100,
          allowFractional: portfolioConfig.allow_fractional !== false,
          deploymentId: Number(deployment.id)
        }
        await this.loadSourceDetail(this.model.scriptSourceId, false)
        this.model.templateParams = this.buildParameterValues({
          ...this.sourceParameterValues,
          ...this.model.templateParams
        })
        return
      }
      const config = strategy.trading_config || {}
      const category = strategy.market_category || 'Crypto'
      const rawSymbol = config.symbol || strategy.symbol || ''
      const symbol = rawSymbol.includes(':') ? rawSymbol : `${category}:${rawSymbol}`
      const exchangeConfig = strategy.exchange_config || {}
      this.model = {
        scriptSourceId: config.script_source_id ? String(config.script_source_id) : '',
        name: strategy.strategy_name || '',
        symbols: symbol,
        exchangeId: strategy.execution_mode === 'live' ? String(config.exchange_id || exchangeConfig.exchange_id || '').toLowerCase() : '',
        timeframe: TIMEFRAMES.includes(String(config.timeframe || strategy.timeframe || '')) ? String(config.timeframe || strategy.timeframe) : '1m',
        initialCapital: Number(config.initial_capital || config.investment_amount || strategy.initial_capital || 1000),
        leverage: Number(config.leverage || 1),
        marketType: category === 'Crypto' && config.market_type !== 'spot' ? 'swap' : 'spot',
        tradeDirection: config.trade_direction || 'long',
        executionMode: strategy.execution_mode || 'signal',
        credentialId: exchangeConfig.credential_id,
        disclaimer: strategy.execution_mode === 'live',
        notifyChannels: (strategy.notification_config && strategy.notification_config.channels) || [...DEFAULT_CHANNELS],
        templateParams: { ...this.parseObject(config.script_template_params) },
        universeId: undefined,
        rebalanceFrequency: 'weekly',
        maxWeightPct: 10,
        commissionPct: 0.05,
        allowFractional: true,
        deploymentId: undefined
      }
      this.normalizeExecutionFields()
      if (this.model.scriptSourceId) {
        await this.loadSourceDetail(this.model.scriptSourceId, false)
        this.model.timeframe = this.extractSourceTimeframe() || this.model.timeframe
        this.model.templateParams = this.buildParameterValues({
          ...this.sourceParameterValues,
          ...this.model.templateParams
        })
      }
    },
    symbolValue (item) {
      return `${item.market}:${item.symbol}`
    },
    handleSymbolChange () {
      this.model.credentialId = undefined
      this.model.exchangeId = ''
      if (this.marketCategory !== 'Crypto') {
        this.model.marketType = 'spot'
      }
      this.normalizeExecutionFields()
    },
    handleCredentialChange (credentialId) {
      const credential = this.credentials.find(item => String(item.id) === String(credentialId))
      if (credential && credential.exchange_id) this.model.exchangeId = String(credential.exchange_id).toLowerCase()
    },
    normalizeExecutionFields () {
      if (this.isPortfolioStrategy || this.marketCategory !== 'Crypto' || this.model.marketType === 'spot') {
        this.model.marketType = 'spot'
        this.model.leverage = 1
        this.model.tradeDirection = 'long'
      } else if (this.model.leverage < 1) {
        this.model.leverage = 1
      }
    },
    credentialLabel (credential) {
      return formatExchangeCredentialLabel(credential)
    },
    exchangeName (exchangeId) {
      return getExchangeDisplayName(exchangeId)
    },
    sourceTypeLabel (source) {
      return this.$t(String((source && source.asset_type) || '').toLowerCase() === 'portfolio_strategy'
        ? 'strategyCenter.editor.portfolioStrategy'
        : 'strategyCenter.editor.ctaStrategy')
    },
    universeLabel (universe) {
      const key = universe && universe.name_i18n_key
      const translated = key ? this.$t(key) : ''
      return translated && translated !== key ? translated : ((universe && (universe.name || universe.code)) || '-')
    },
    timeframeLabel (timeframe) {
      const key = `trading-assistant.form.timeframe${timeframe}`
      return this.$te && this.$te(key) ? this.$t(key) : timeframe
    },
    parameterLabel (param) {
      const key = `trading-assistant.templateParam.${param.name}.label`
      return this.$te && this.$te(key) ? this.$t(key) : String(param.name || '').replace(/_/g, ' ')
    },
    buildParameterValues (values) {
      const result = {}
      this.parameterDefinitions.forEach(param => {
        const value = values[param.name]
        result[param.name] = value !== undefined ? value : param.default
      })
      return result
    },
    setParameter (name, value) {
      this.$set(this.model.templateParams, name, value)
    },
    next () {
      if (this.step === 0 && !this.model.scriptSourceId) {
        this.$message.warning(this.$t('trading-assistant.form.scriptSourceRequired'))
        return
      }
      if (this.step === 1) {
        if (!this.model.name) {
          this.$message.warning(this.$t('trading-assistant.validation.strategyNameRequired'))
          return
        }
        if (this.isPortfolioStrategy && !this.model.universeId) {
          this.$message.warning(this.$t('portfolioDeployment.universe'))
          return
        }
        if (!this.isPortfolioStrategy && !this.selectedValues.length) {
          this.$message.warning(this.$t(this.isEdit ? 'trading-assistant.validation.symbolRequired' : 'trading-assistant.validation.symbolsRequired'))
          return
        }
        if (!this.isPortfolioStrategy && !this.model.timeframe) {
          this.$message.warning(this.$t('trading-assistant.placeholders.selectTimeframe'))
          return
        }
        if (!(Number(this.model.initialCapital) > 0)) {
          this.$message.warning(this.$t('trading-assistant.validation.initialCapitalRequired'))
          return
        }
      }
      this.symbolDropdownOpen = false
      this.step += 1
    },
    validateFinal () {
      if (!this.model.notifyChannels.length) {
        this.$message.warning(this.$t('trading-assistant.validation.notifyChannelRequired'))
        return false
      }
      if (this.model.executionMode === 'live' && !this.model.disclaimer) {
        this.$message.warning(this.$t('trading-assistant.liveDisclaimer.required'))
        return false
      }
      if (this.model.executionMode === 'live' && !this.model.credentialId) {
        this.$message.warning(this.$t('trading-assistant.validation.credentialRequired'))
        return false
      }
      return true
    },
    async save () {
      if (!this.validateFinal()) return
      this.saving = true
      try {
        if (this.isPortfolioStrategy) {
          const portfolioPayload = {
            sourceId: Number(this.model.scriptSourceId),
            universeId: Number(this.model.universeId),
            name: this.model.name,
            rebalanceFrequency: this.model.rebalanceFrequency,
            executionMode: this.model.executionMode === 'live' ? 'live' : 'notify_only',
            credentialId: this.model.executionMode === 'live' ? this.model.credentialId : undefined,
            initialCapital: Number(this.model.initialCapital),
            maxWeight: Number(this.model.maxWeightPct) / 100,
            commission: Number(this.model.commissionPct) / 100,
            allowFractional: Boolean(this.model.allowFractional),
            params: { ...this.model.templateParams },
            notificationChannels: [...this.model.notifyChannels]
          }
          const portfolioRes = this.isEdit
            ? await updatePortfolioDeployment(this.model.deploymentId, portfolioPayload)
            : await createPortfolioDeployment(portfolioPayload)
          if (!portfolioRes || portfolioRes.code !== 1) throw new Error((portfolioRes && portfolioRes.msg) || '')
          this.$message.success(this.$t(this.isEdit ? 'trading-assistant.messages.updateSuccess' : 'portfolioDeployment.created'))
          this.$emit('saved')
          return
        }
        const first = this.selectedValues[0]
        const separator = first.indexOf(':')
        const category = separator > -1 ? first.slice(0, separator) : 'Crypto'
        const symbol = separator > -1 ? first.slice(separator + 1) : first
        const sourceMetadata = this.sourceDetail.metadata || {}
        const lastRun = this.parseObject(this.parseObject(sourceMetadata).last_run_config)
        const previousConfig = (this.originalStrategy && this.originalStrategy.trading_config) || {}
        const tradingConfig = {
          ...lastRun,
          ...previousConfig,
          runtime_contract_version: 'simple_script_v1',
          exchange_id: category === 'Crypto' && this.model.executionMode === 'live' ? this.model.exchangeId : '',
          timeframe: this.model.timeframe,
          initial_capital: Number(this.model.initialCapital),
          investment_amount: Number(this.model.initialCapital),
          leverage: category === 'Crypto' && this.model.marketType === 'swap' ? Number(this.model.leverage) : 1,
          trade_direction: category === 'Crypto' && this.model.marketType === 'swap' ? this.model.tradeDirection : 'long',
          tick_interval_sec: 10,
          market_type: category === 'Crypto' ? this.model.marketType : 'spot',
          symbol,
          script_source_id: Number(this.model.scriptSourceId),
          script_role: 'runtime'
        }
        const templateKey = this.sourceDetail.template_key || lastRun.script_template_key
        const templateParams = this.model.templateParams
        if (templateKey) tradingConfig.script_template_key = templateKey
        if (templateParams && Object.keys(templateParams).length) tradingConfig.script_template_params = { ...templateParams }

        const selectedCredential = this.credentials.find(item => String(item.id) === String(this.model.credentialId))
        const payload = {
          strategy_name: this.model.name,
          strategy_type: 'ScriptStrategy',
          strategy_mode: 'script',
          strategy_code: '',
          market_category: category,
          execution_mode: this.model.executionMode,
          notification_config: {
            channels: [...this.model.notifyChannels],
            targets: notificationTargets(this.notificationSettings)
          },
          exchange_config: category === 'Crypto'
            ? (this.model.executionMode === 'live'
                ? { exchange_id: this.model.exchangeId, credential_id: this.model.credentialId }
                : undefined)
            : (this.model.executionMode === 'live'
                ? { credential_id: this.model.credentialId, exchange_id: selectedCredential && selectedCredential.exchange_id }
                : undefined),
          trading_config: tradingConfig
        }
        const res = this.isEdit
          ? await updateStrategy(this.strategyId, payload)
          : await batchCreateStrategies({ ...payload, user_id: 1, symbols: this.selectedValues })
        if (!res || res.code !== 1) throw new Error((res && res.msg) || '')
        this.$message.success(this.$t(this.isEdit ? 'trading-assistant.messages.updateSuccess' : 'trading-assistant.messages.batchCreateSuccess', { count: this.selectedValues.length }))
        this.$emit('saved')
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t(this.isEdit ? 'trading-assistant.messages.updateFailed' : 'trading-assistant.messages.createFailed'))
      } finally {
        this.saving = false
      }
    },
    close () {
      if (!this.saving) this.$emit('close')
    }
  }
}
</script>

<style lang="less">
.live-strategy-editor-wrap {
  .ant-modal { top: 4vh; height: 92vh; padding-bottom: 0; }
  .ant-modal-content { display: flex; flex-direction: column; height: 100%; overflow: hidden; border-radius: 12px; box-shadow: 0 24px 70px rgba(15, 23, 42, .22); }
  .ant-modal-header { padding: 19px 26px; border-bottom-color: #e8ebf0; }
  .ant-modal-title { color: #18202c; font-size: 18px; font-weight: 700; }
  .ant-modal,
  .ant-modal-content,
  .ant-modal-body,
  .ant-spin-nested-loading,
  .ant-spin-container,
  .editor-section { max-width: 100%; }
  .ant-modal-body { flex: 1 1 auto; min-height: 0; max-height: none; overflow-x: hidden !important; overflow-y: auto; padding: 24px 28px 20px; overscroll-behavior: contain; }
  .ant-spin-container { overflow-x: hidden; }
  .ant-modal-footer { padding: 14px 26px; border-top-color: #e8ebf0; }
  .ant-modal-footer .ant-btn { min-width: 86px; height: 36px; border-radius: 6px; }
  .editor-steps { margin: 2px 4px 24px; }
  .ant-steps-item-process .ant-steps-item-icon { border-color: var(--primary-color, #1890ff); background: var(--primary-color, #1890ff); }
  .ant-steps-item-finish .ant-steps-item-icon { border-color: var(--primary-color, #1890ff); }
  .ant-steps-item-finish .ant-steps-item-icon > .ant-steps-icon,
  .ant-alert-info .ant-alert-icon { color: var(--primary-color, #1890ff); }
  .ant-steps-item-finish > .ant-steps-item-container > .ant-steps-item-tail::after { background: var(--primary-color, #1890ff); }
  .editor-section { min-height: 360px; }
  .editor-form { margin-top: 20px; }
  .editor-form--source { max-width: 760px; margin-right: auto; margin-left: auto; }
  .editor-form .ant-form-item { margin-bottom: 17px; }
  .editor-form .ant-form-item-label { padding-bottom: 5px; font-weight: 600; }
  .editor-form .ant-input,
  .editor-form .ant-select-selection,
  .editor-form .ant-input-number { min-height: 38px; border-radius: 6px; }
  .editor-form .ant-select-selection__rendered { line-height: 36px; }
  .editor-form .ant-input-number { width: 100%; }
  .source-summary { display: flex; gap: 14px; margin: 4px 0 16px; padding: 16px; border: 1px solid #e4e8ee; border-radius: 9px; background: #f8fafc; }
  .source-summary__title { display: flex; align-items: center; gap: 8px; }
  .source-summary__icon { display: flex; align-items: center; justify-content: center; flex: 0 0 42px; height: 42px; border-radius: 9px; background: color-mix(in srgb, var(--primary-color, #1890ff) 12%, #fff); color: var(--primary-color, #1890ff); font-size: 19px; }
  .source-summary strong { display: block; margin-bottom: 4px; color: #202938; font-size: 15px; }
  .source-summary p { margin: 0 0 7px; color: #697586; font-size: 12px; line-height: 1.55; }
  .source-summary span { display: inline-flex; margin-right: 14px; color: #7c8796; font-size: 12px; }
  .field-hint { margin-top: 6px; color: #7d8794; font-size: 12px; line-height: 1.5; }
  .field-hint--warning { color: #d48806; }
  .strategy-defaults, .execution-summary { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: -2px 0 17px; padding: 11px 13px; border: 1px solid #e4e8ee; border-radius: 7px; background: #f8fafc; color: #727d8b; font-size: 12px; }
  .strategy-defaults strong, .execution-summary strong { color: #202938; font-size: 13px; }
  .full-radio-group { display: flex; width: 100%; }
  .full-radio-group .ant-radio-button-wrapper { flex: 1; text-align: center; }
  .parameter-panel { margin-top: 3px; padding: 16px 16px 2px; border: 1px solid #e4e8ee; border-radius: 9px; background: #fafbfc; }
  .parameter-panel--source { margin-top: 18px; }
  .parameter-panel__head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
  .parameter-panel__head strong { display: block; color: #202938; font-size: 14px; }
  .parameter-panel__head span { display: block; margin-top: 3px; color: #7d8794; font-size: 12px; }
  .parameter-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; }
  .disclaimer-check { margin: 16px 0 18px; }
  .notification-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 16px; }
  .notification-grid .ant-checkbox-wrapper { margin-left: 0; }
  &.theme-dark {
    .ant-modal-content,
    .ant-modal-header,
    .ant-modal-footer { border-color: #2b2f35; background: #17191c; }
    .ant-modal-title,
    .source-summary strong,
    .parameter-panel__head strong,
    .strategy-defaults strong,
    .execution-summary strong,
    .ant-form-item-label > label,
    .ant-steps-item-title { color: #eef0f3 !important; }
    .ant-steps-item-wait .ant-steps-item-title { color: #aab0b8 !important; }
    .ant-steps-item-process .ant-steps-item-title { color: #eef0f3 !important; }
    .ant-steps-item-finish .ant-steps-item-title { color: #cfd4da !important; }
    .source-summary,
    .parameter-panel,
    .strategy-defaults,
    .execution-summary { border-color: #30343a; background: #121416; }
    .source-summary__icon { background: color-mix(in srgb, var(--primary-color, #52c41a) 16%, #121416); color: var(--primary-color, #52c41a); }
    .source-summary p,
    .source-summary span,
    .field-hint,
    .parameter-panel__head span,
    .strategy-defaults,
    .execution-summary { color: #8c949f; }
    .ant-input,
    .ant-input-number,
    .ant-input-number-input,
    .ant-select-selection { border-color: #34383f; background: #1c1f23; color: #eef0f3; }
    .ant-input::placeholder,
    .ant-select-selection__placeholder { color: #6f7782; }
    .ant-select-arrow,
    .ant-input-number-handler { color: #9299a3; }
    .ant-input-number-handler-wrap { border-color: #34383f; background: #1c1f23; }
    .ant-radio-button-wrapper { border-color: #34383f; background: #1c1f23; color: #aab0b8; }
    .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) { border-color: var(--primary-color, #52c41a); background: color-mix(in srgb, var(--primary-color, #52c41a) 18%, #1c1f23); color: var(--primary-color, #52c41a); box-shadow: -1px 0 0 0 var(--primary-color, #52c41a); }
    .ant-checkbox-wrapper,
    .ant-modal-close,
    .ant-steps-item-wait .ant-steps-item-icon > .ant-steps-icon { color: #aab0b8; }
    .ant-steps-item-wait .ant-steps-item-icon { border-color: #4a4f57; background: #22262b; }
    .ant-steps-item-tail::after { background: #34383f; }
    .ant-steps-item-process .ant-steps-item-icon { border-color: var(--primary-color, #52c41a); background: var(--primary-color, #52c41a); }
    .ant-steps-item-finish .ant-steps-item-icon { border-color: var(--primary-color, #52c41a); background: color-mix(in srgb, var(--primary-color, #52c41a) 10%, #17191c); }
    .ant-steps-item-finish .ant-steps-item-icon > .ant-steps-icon,
    .ant-alert-info .ant-alert-icon { color: var(--primary-color, #52c41a); }
    .ant-steps-item-finish > .ant-steps-item-container > .ant-steps-item-tail::after { background: var(--primary-color, #52c41a); }
    .ant-alert-info { border-color: color-mix(in srgb, var(--primary-color, #52c41a) 34%, #29465d); background: color-mix(in srgb, var(--primary-color, #52c41a) 7%, #111820); }
    .ant-alert-info .ant-alert-message { color: #dfe4e9; }
    .ant-alert-info .ant-alert-description { color: #98a1ac; }
  }
}
@media (max-width: 640px) {
  .live-strategy-editor-wrap {
    .ant-modal { width: calc(100vw - 20px) !important; margin: 0 10px; }
    .ant-modal-body { padding: 18px; }
    .parameter-grid,
    .notification-grid { grid-template-columns: 1fr; }
  }
}
</style>
