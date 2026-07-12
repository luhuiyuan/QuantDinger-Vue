<template>
  <div class="strategy-ide-shell" :class="{ 'theme-dark': isDarkTheme }">
    <div class="strategy-ide-layout">
      <section class="script-panel script-panel--editor">
        <strategy-editor
          ref="scriptEditor"
          :key="editorKey"
          v-model="scriptCode"
          :is-dark="isDarkTheme"
          :visible="true"
          :user-id="userId"
          :strategy-id="currentSourceId"
          :script-source-id="currentSourceId"
          :asset-type="currentAssetType"
          :initial-template-key="scriptTemplateKey || editorInitialTemplateKey"
          :initial-param-schema="currentSourceParamSchema"
          :initial-param-values="scriptTemplateParams"
          :hidden-source="scriptCodeHidden"
          :readonly="false"
          :consume-copilot-draft="false"
          side-mode="split"
          @verified="scriptVerified = true"
          @template-change="handleTemplateChange"
        >
          <template #toolbar>
            <div class="ide-toolbar">
              <div class="toolbar-left">
                <div class="strategy-workspace-switcher">
                  <div class="strategy-workspace-copy">
                    <strong>{{ currentWorkspaceTitle }}</strong>
                    <span>{{ currentWorkspaceDescription }}</span>
                  </div>
                  <a-radio-group
                    :value="currentAssetType"
                    button-style="solid"
                  >
                    <a-radio-button value="script" @click="handleAssetTypeChange('script')">{{ text.ctaStrategy }}</a-radio-button>
                    <a-radio-button value="portfolio_strategy" @click="handleAssetTypeChange('portfolio_strategy')">{{ text.portfolioStrategy }}</a-radio-button>
                  </a-radio-group>
                </div>
                <a-select
                  class="script-select"
                  show-search
                  allow-clear
                  option-filter-prop="children"
                  :value="selectedScriptId"
                  :loading="loadingScripts"
                  :placeholder="text.selectScriptPlaceholder"
                  @change="handleScriptSelect"
                >
                  <a-select-option
                    v-for="item in scriptOptions"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.optionLabel }}
                  </a-select-option>
                </a-select>

                <a-tooltip :title="currentNewScriptLabel">
                  <a-button class="ide-icon-btn" @click="createNewDraft({ openTemplate: true })">
                    <a-icon type="plus" />
                  </a-button>
                </a-tooltip>
                <a-tooltip :title="text.refreshScripts">
                  <a-button class="ide-icon-btn" :loading="loadingScripts" @click="refreshSources">
                    <a-icon type="reload" />
                  </a-button>
                </a-tooltip>
                <a-tooltip :title="text.versionHistory">
                  <a-button
                    class="ide-icon-btn"
                    :disabled="!currentSourceId || scriptCodeHidden"
                    :loading="scriptVersionLoading"
                    @click="openVersionDrawer"
                  >
                    <a-icon type="history" />
                  </a-button>
                </a-tooltip>
                <a-tooltip v-if="currentSourceId" :title="text.saveAsNew">
                  <a-button
                    class="ide-icon-btn"
                    :loading="savingScriptMode === 'copy'"
                    :disabled="scriptCodeHidden || savingScript || deletingScript"
                    @click="saveScript(true)"
                  >
                    <a-icon type="copy" />
                  </a-button>
                </a-tooltip>
                <a-tooltip v-if="currentSourceId" :title="text.publishScript">
                  <a-button
                    class="ide-icon-btn"
                    :loading="savingScriptMode === 'publish' || publishingScript"
                    :disabled="scriptCodeHidden || savingScript || deletingScript"
                    @click="openPublishModal"
                  >
                    <a-icon type="shop" />
                  </a-button>
                </a-tooltip>
                <a-tooltip v-if="currentSourceId" :title="text.deleteScript">
                  <a-button
                    class="ide-icon-btn ide-icon-btn--danger"
                    :loading="deletingScript"
                    :disabled="savingScript"
                    @click="deleteCurrentSource"
                  >
                    <a-icon type="delete" />
                  </a-button>
                </a-tooltip>
                <a-button
                  class="script-save-button"
                  type="primary"
                  :loading="savingScriptMode === 'save'"
                  :disabled="scriptCodeHidden || savingScript || deletingScript || !hasUnsavedScriptChanges"
                  @click="saveScript(false)"
                >
                  {{ text.saveScript }}
                </a-button>
              </div>

              <div class="toolbar-right">
                <a-button
                  v-if="currentAssetType === 'portfolio_strategy'"
                  class="universe-library-button"
                  :class="{ 'universe-library-button--selected': currentAssetType === 'portfolio_strategy' && !!selectedUniverseId }"
                  @click="showUniverseLibrary = true"
                >
                  <a-icon type="cluster" />
                  {{ currentUniverseSummary || text.universeLibrary }}
                </a-button>
                <a-button
                  v-if="currentAssetType === 'script'"
                  class="robot-template-button"
                  @click="showRobotBuilder = true"
                >
                  <a-icon type="control" />
                  {{ text.robotTemplates }}
                </a-button>
                <a-button class="factor-library-button" @click="showFactorLibrary = true">
                  <a-icon type="database" />
                  {{ text.factorLibrary }}
                </a-button>
                <a-button
                  v-if="currentAssetType === 'script'"
                  class="indicator-convert-button"
                  :loading="indicatorConvertIndicatorLoading"
                  @click="openIndicatorConvertPicker"
                >
                  <a-icon type="branches" />
                  {{ text.indicatorConvertEntry }}
                </a-button>
                <a-button class="script-backtest-button" @click="openBacktestCenter">
                  <a-icon type="bar-chart" />
                  {{ text.backtestTitle }}
                </a-button>
                <a-button
                  class="script-live-button"
                  type="primary"
                  :loading="savingScriptMode === 'live'"
                  :disabled="(!currentSourceId && scriptCodeHidden) || (savingScript && savingScriptMode !== 'live') || deletingScript"
                  @click="createLiveFromScript"
                >
                  <a-icon type="thunderbolt" />
                  {{ text.createLive }}
                </a-button>
              </div>
            </div>
          </template>
        </strategy-editor>
      </section>
    </div>

    <a-modal
      :visible="showPublishModal"
      :title="text.publishModalTitle"
      :width="620"
      :confirmLoading="publishingScript"
      :ok-text="text.publishConfirm"
      :cancel-text="text.cancel"
      :wrap-class-name="isDarkTheme ? 'script-publish-modal script-publish-modal--dark' : 'script-publish-modal'"
      @ok="confirmPublish"
      @cancel="closePublishModal"
    >
      <div class="publish-form">
        <div class="publish-summary-card">
          <div class="publish-summary-icon">
            <a-icon type="shop" />
          </div>
          <div class="publish-summary-main">
            <div class="publish-summary-label">{{ text.publishModalTitle }}</div>
            <div class="publish-summary-name">{{ publishForm.name || deriveScriptName() }}</div>
          </div>
          <a-tag class="publish-summary-tag" color="red">{{ text.marketTag }}</a-tag>
        </div>

        <div class="publish-note">
          <a-icon type="info-circle" />
          <span>{{ text.publishHint }}</span>
        </div>

        <div class="publish-section">
          <div class="publish-section-title">{{ text.publishName }}</div>
          <a-input v-model="publishForm.name" :placeholder="text.publishNamePlaceholder" />
        </div>

        <div class="publish-section">
          <div class="publish-section-title">{{ text.publishPricingType }}</div>
          <a-radio-group v-model="publishForm.pricingType" class="publish-pricing-group">
            <a-radio-button value="free">
              <a-icon type="gift" />
              {{ text.publishFree }}
            </a-radio-button>
            <a-radio-button value="paid">
              <a-icon type="pay-circle" />
              {{ text.publishPaid }}
            </a-radio-button>
          </a-radio-group>
          <div v-if="publishForm.pricingType === 'paid'" class="publish-price-box">
            <div class="field-label">{{ text.publishPrice }}</div>
            <a-input-number v-model="publishForm.price" :min="0" :precision="2" class="publish-price-input" />
          </div>
        </div>

        <div class="publish-option-grid">
          <div class="publish-option-card" :class="{ active: publishForm.pricingType === 'paid' && publishForm.vipFree }">
            <div class="publish-option-head">
              <span>{{ text.publishVipFree }}</span>
              <a-switch v-model="publishForm.vipFree" :disabled="publishForm.pricingType !== 'paid'" />
            </div>
            <div class="publish-hint">{{ text.publishVipFreeHint }}</div>
          </div>
          <div class="publish-option-card" :class="{ active: publishForm.codeHidden }">
            <div class="publish-option-head">
              <span>{{ text.publishHideCode }}</span>
              <a-switch v-model="publishForm.codeHidden" />
            </div>
            <div class="publish-hint">{{ text.publishHideCodeHint }}</div>
          </div>
        </div>

        <div class="publish-section">
          <div class="publish-section-title">{{ text.publishDescription }}</div>
          <a-textarea
            v-model="publishForm.description"
            class="publish-description-input"
            :placeholder="text.publishDescriptionPlaceholder"
            :auto-size="{ minRows: 4, maxRows: 7 }"
          />
        </div>
      </div>
    </a-modal>

    <a-modal
      :visible="showIndicatorConvertModal"
      :title="text.indicatorConvertTitle"
      :confirmLoading="indicatorConvertLoading"
      :ok-text="text.indicatorConvertConfirm"
      :cancel-text="text.cancel"
      :wrap-class-name="isDarkTheme ? 'indicator-convert-modal indicator-convert-modal--dark' : 'indicator-convert-modal'"
      @ok="confirmIndicatorToStrategy"
      @cancel="closeIndicatorConvertModal"
    >
      <div class="indicator-convert-box">
        <div class="indicator-convert-selector">
          <label class="field-label">{{ text.indicatorConvertSelect }}</label>
          <a-select
            v-model="selectedIndicatorConvertId"
            show-search
            option-filter-prop="children"
            style="width: 100%"
            :loading="indicatorConvertIndicatorLoading"
            :placeholder="text.indicatorConvertSelectPlaceholder"
            @change="handleIndicatorConvertSelect"
          >
            <a-select-option
              v-for="item in indicatorConvertIndicators"
              :key="String(item.indicatorId)"
              :value="String(item.indicatorId)"
              :disabled="item.codeHidden || !item.code"
            >
              {{ item.name || text.defaultIndicatorName }}
              <template v-if="item.symbol"> - {{ item.symbol }}</template>
              <template v-if="item.codeHidden || !item.code"> - {{ text.indicatorConvertNoCodeShort }}</template>
            </a-select-option>
          </a-select>
        </div>

        <div v-if="indicatorConvertContext" class="indicator-convert-current">
          <div>
            <span>{{ text.indicatorConvertSource }}</span>
            <strong>{{ indicatorConvertContext.name || text.defaultIndicatorName }}</strong>
          </div>
          <small>
            {{ marketLabel(indicatorConvertContext.market) }}
            <template v-if="indicatorConvertContext.symbol"> / {{ indicatorConvertContext.symbol }}</template>
            <template v-if="indicatorConvertContext.timeframe"> / {{ indicatorConvertContext.timeframe }}</template>
          </small>
        </div>

        <a-alert
          v-else
          type="info"
          show-icon
          :message="text.indicatorConvertSelectFirst"
        />

        <label class="field-label field-label--spaced">{{ text.indicatorConvertInstruction }}</label>
        <a-textarea
          v-model="indicatorConvertInstruction"
          :auto-size="{ minRows: 5, maxRows: 8 }"
          :placeholder="text.indicatorConvertPlaceholder"
        />
        <div class="indicator-convert-note">
          <a-icon type="info-circle" />
          <span>{{ text.indicatorConvertBoundary }}</span>
        </div>
        <a-alert
          v-if="indicatorConvertError"
          type="error"
          show-icon
          :message="indicatorConvertError"
        />
      </div>
    </a-modal>

    <factor-library-modal
      :visible="showFactorLibrary"
      :is-dark="isDarkTheme"
      :asset-type="currentAssetType"
      @close="showFactorLibrary = false"
    />

    <universe-library-modal
      :visible="showUniverseLibrary"
      :is-dark="isDarkTheme"
      :asset-type="currentAssetType"
      :selected-universe-id="selectedUniverseId"
      @use="handleUniverseUse"
      @close="showUniverseLibrary = false"
    />

    <a-drawer
      :visible="showRobotBuilder"
      :title="text.robotTemplates"
      width="96vw"
      :destroy-on-close="true"
      :wrap-class-name="isDarkTheme ? 'robot-builder-drawer robot-builder-drawer--dark' : 'robot-builder-drawer'"
      @close="showRobotBuilder = false"
    >
      <div class="robot-builder-intro">{{ text.robotTemplatesDesc }}</div>
      <executor-strategies embedded @generated="applyGeneratedRobot" />
    </a-drawer>

    <a-drawer
      :visible="showVersionDrawer"
      :title="text.versionHistory"
      :width="640"
      :wrap-class-name="isDarkTheme ? 'script-version-drawer script-version-drawer--dark' : 'script-version-drawer'"
      @close="showVersionDrawer = false"
    >
      <a-spin :spinning="scriptVersionLoading">
        <div class="code-version-toolbar">
          <span>{{ currentSourceName || text.defaultName }}</span>
          <a-button size="small" icon="reload" @click="loadScriptVersions">{{ text.refreshScripts }}</a-button>
        </div>
        <a-empty v-if="!scriptVersions.length" :description="text.versionEmpty" />
        <div v-else class="code-version-list">
          <div v-for="item in scriptVersions" :key="item.id" class="code-version-item">
            <div class="code-version-item__main">
              <strong>{{ text.versionNo.replace('{version}', item.version_no) }}</strong>
              <span>{{ item.name || currentSourceName }}</span>
              <small>{{ formatTime(item.created_at) }}</small>
            </div>
            <div class="code-version-item__actions">
              <a-button
                size="small"
                :disabled="scriptCodeHidden || item.code_hidden || item.hidden_source"
                @click="previewScriptVersion(item)"
              >
                {{ text.versionPreview }}
              </a-button>
              <a-button
                size="small"
                type="primary"
                :loading="restoringScriptVersionId === item.id"
                :disabled="scriptCodeHidden || item.code_hidden || item.hidden_source || item.restore_disabled"
                @click="confirmRestoreScriptVersion(item)"
              >
                {{ text.versionRestore }}
              </a-button>
            </div>
          </div>
        </div>
      </a-spin>

      <div v-if="scriptVersionPreview" class="code-version-preview">
        <div class="code-version-preview__head">
          <strong>{{ text.versionPreviewTitle.replace('{version}', scriptVersionPreview.version_no) }}</strong>
          <a-button size="small" icon="close" @click="scriptVersionPreview = null" />
        </div>
        <div v-if="scriptVersionPreview.code_hidden || scriptVersionPreview.hidden_source" class="code-version-hidden">
          <a-icon type="lock" />
          <strong>{{ text.hiddenScriptTitle }}</strong>
          <span>{{ text.versionHiddenBlocked }}</span>
        </div>
        <pre v-else>{{ scriptVersionPreview.code }}</pre>
      </div>
    </a-drawer>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import StrategyEditor from './components/StrategyEditor.vue'
import FactorLibraryModal from './FactorLibraryModal.vue'
import UniverseLibraryModal from './UniverseLibraryModal.vue'
import ExecutorStrategies from '@/views/executor-strategies'
import {
  aiGenerateStrategy,
  createScriptSource,
  deleteScriptSource,
  getUnifiedBacktestHistory,
  getIndicatorListForStrategy,
  getScriptSourceDetail,
  getScriptSourceList,
  getScriptSourceVersion,
  getScriptSourceVersions,
  publishScriptSource,
  restoreScriptSourceVersion,
  updateScriptSource,
  verifyStrategyCode
} from '@/api/strategy'

const DEFAULT_SCRIPT_CODE = `"""
My Custom Strategy

Describe the strategy logic, supported markets, entry/exit rules, and risk controls here.
"""

def on_init(ctx):
    # Declare strategy-owned parameters here.
    # Symbol, investment amount, market type, leverage and direction come from the run panel.
    pass

def on_bar(ctx, bar):
    # Core trading logic, called on each K-line bar.
    # bar: { open, high, low, close, volume, timestamp }
    pass
`

const DEFAULT_PORTFOLIO_CODE = `"""
My Portfolio Strategy

Rank the eligible point-in-time universe by momentum and hold an equal-weight Top-N portfolio.
"""

def on_init(ctx):
    ctx.param("top_n", 10, min=1, max=100, step=1)
    ctx.param("lookback", 126, min=20, max=252, step=1)

def on_rebalance(ctx, panel):
    top_n = int(ctx.param("top_n", 10))
    lookback = int(ctx.param("lookback", 126))
    scores = {}
    for symbol, frame in panel.items():
        if len(frame) <= lookback:
            continue
        start = float(frame["close"].iloc[-lookback - 1])
        end = float(frame["close"].iloc[-1])
        if start > 0:
            scores[symbol] = end / start - 1.0
    ctx.long_only_top_n(scores, n=top_n)
`

export default {
  name: 'StrategyIde',
  components: {
    StrategyEditor,
    FactorLibraryModal,
    UniverseLibraryModal,
    ExecutorStrategies
  },
  data () {
    return {
      scriptSources: [],
      loadingScripts: false,
      selectedScriptId: undefined,
      currentSourceId: null,
      currentSource: null,
      currentAssetType: 'script',
      scriptCode: DEFAULT_SCRIPT_CODE,
      scriptCodeHidden: false,
      scriptTemplateKey: '',
      scriptTemplateParams: {},
      scriptParamSchema: {},
      editorInitialTemplateKey: '',
      editorKeySeed: 0,
      scriptVerified: false,
      savingScript: false,
      savingScriptMode: '',
      deletingScript: false,
      publishingScript: false,
      showPublishModal: false,
      publishForm: {
        name: '',
        description: '',
        pricingType: 'free',
        price: 0,
        vipFree: false,
        codeHidden: false
      },
      showVersionDrawer: false,
      scriptVersionLoading: false,
      scriptVersions: [],
      scriptVersionPreview: null,
      restoringScriptVersionId: null,
      showFactorLibrary: false,
      showUniverseLibrary: false,
      showRobotBuilder: false,
      showIndicatorConvertModal: false,
      indicatorConvertLoading: false,
      indicatorConvertIndicatorLoading: false,
      indicatorConvertIndicators: [],
      selectedIndicatorConvertId: undefined,
      indicatorConvertContext: null,
      indicatorConvertInstruction: '',
      indicatorConvertError: '',
      runConfig: {
        market_category: 'Crypto',
        exchange_id: 'binance',
        symbol: 'BTC/USDT',
        timeframe: '1m',
        market_type: 'swap',
        trade_direction: 'long',
        initial_capital: 10000,
        leverage: 5
      },
      lastSavedSnapshot: ''
    }
  },
  computed: {
    ...mapState({
      navTheme: state => state.app.theme
    }),
    isDarkTheme () {
      const body = typeof document !== 'undefined' ? document.body : null
      return this.navTheme === 'dark' ||
        this.navTheme === 'realdark' ||
        !!(body && (body.classList.contains('dark') || body.classList.contains('realdark')))
    },
    isZh () {
      return String((this.$i18n && this.$i18n.locale) || '').toLowerCase().startsWith('zh')
    },
    userId () {
      const userInfo = this.$store && this.$store.getters && this.$store.getters.userInfo
      return (userInfo && userInfo.id) || 1
    },
    editorKey () {
      return `script-editor-${this.currentSourceId || 'draft'}-${this.editorKeySeed}`
    },
    currentSourceName () {
      return (this.currentSource && (this.currentSource.name || this.currentSource.strategy_name)) ||
        this.extractScriptMetadataFromCode(this.scriptCode).name ||
        ''
    },
    currentSourceParamSchema () {
      if (this.scriptParamSchema && Array.isArray(this.scriptParamSchema.params) && this.scriptParamSchema.params.length) {
        return this.scriptParamSchema
      }
      const source = this.currentSource || {}
      const direct = this.parseObject(source.param_schema || source.paramSchema)
      if (Array.isArray(direct.params) && direct.params.length) return direct
      if (Array.isArray(source.params) && source.params.length) return { params: source.params }
      const metadata = this.parseObject(source.metadata)
      const metaSchema = this.parseObject(metadata.param_schema || metadata.paramSchema)
      if (Array.isArray(metaSchema.params) && metaSchema.params.length) return metaSchema
      return direct
    },
    allScriptOptions () {
      return (this.scriptSources || []).map(item => {
        const id = this.getScriptSourceId(item)
        return {
          ...item,
          id,
          optionLabel: item.name || item.strategy_name || `Script #${id}`
        }
      }).filter(item => item.id)
    },
    scriptOptions () {
      return this.allScriptOptions.filter(item => item.asset_type === this.currentAssetType)
    },
    selectedUniverseId () {
      return Number(this.runConfig && (this.runConfig.universe_id || this.runConfig.universeId)) || undefined
    },
    currentUniverseSummary () {
      if (this.currentAssetType !== 'portfolio_strategy' || !this.selectedUniverseId) return ''
      const label = String((this.runConfig && (this.runConfig.universe_name || this.runConfig.universeName || this.runConfig.universe_code || this.runConfig.universeCode)) || this.selectedUniverseId)
      return this.text.universeSelected.replace('{name}', label)
    },
    currentWorkspaceTitle () {
      return this.currentAssetType === 'portfolio_strategy' ? this.text.portfolioWorkspaceTitle : this.text.ctaWorkspaceTitle
    },
    currentWorkspaceDescription () {
      return this.currentAssetType === 'portfolio_strategy' ? this.text.portfolioWorkspaceDescription : this.text.ctaWorkspaceDescription
    },
    currentNewScriptLabel () {
      return this.currentAssetType === 'portfolio_strategy' ? this.text.newPortfolioStrategy : this.text.newCtaStrategy
    },
    hasUnsavedScriptChanges () {
      if (this.scriptCodeHidden) return false
      if (!this.currentSourceId) return !!String(this.scriptCode || '').trim()
      return this.lastSavedSnapshot !== this.scriptSnapshot()
    },
    text () {
      return [
        'selectScriptLabel',
        'selectScriptPlaceholder',
        'ctaStrategy',
        'portfolioStrategy',
        'newScript',
        'refreshScripts',
        'saveScript',
        'saveAsNew',
        'publishScript',
        'deleteScript',
        'createLive',
        'backtestTitle',
        'cancel',
        'defaultName',
        'autoNameSuffix',
        'codeRequired',
        'hiddenScriptTitle',
        'hiddenScriptDesc',
        'loadScriptsFailed',
        'loadScriptFailed',
        'saveSuccess',
        'saveFailed',
        'deleteSuccess',
        'deleteFailed',
        'deleteConfirmTitle',
        'deleteConfirmDesc',
        'runningEditBlocked',
        'verifyPassed',
        'verifyBlocked',
        'verifyFailed',
        'publishSuccess',
        'publishFailed',
        'publishBacktestRequired',
        'publishModalTitle',
        'publishConfirm',
        'marketTag',
        'publishHint',
        'publishName',
        'publishNamePlaceholder',
        'publishPricingType',
        'publishFree',
        'publishPaid',
        'publishPrice',
        'publishDescription',
        'publishDescriptionPlaceholder',
        'priceRequired',
        'publishVipFree',
        'publishVipFreeHint',
        'publishHideCode',
        'publishHideCodeHint',
        'versionHistory',
        'versionEmpty',
        'versionNo',
        'versionPreview',
        'versionRestore',
        'versionRestoreTitle',
        'versionRestoreContent',
        'versionPreviewTitle',
        'versionRestored',
        'versionHiddenBlocked',
        'versionLoadFailed',
        'versionRestoreFailed',
        'indicatorConvertEntry',
        'indicatorConvertTitle',
        'indicatorConvertConfirm',
        'indicatorConvertSelect',
        'indicatorConvertSelectPlaceholder',
        'indicatorConvertSelectFirst',
        'indicatorConvertSource',
        'indicatorConvertInstruction',
        'indicatorConvertPlaceholder',
        'indicatorConvertBoundary',
        'indicatorConvertNoCodeShort',
        'indicatorConvertNoCode',
        'indicatorConvertHiddenBlocked',
        'indicatorConvertFailed',
        'indicatorConvertSuccess',
        'defaultIndicatorName',
        'noChangesToSave',
        'factorLibrary',
        'universeLibrary',
        'universeSelected',
        'workspaceLabel',
        'ctaWorkspaceTitle',
        'ctaWorkspaceDescription',
        'portfolioWorkspaceTitle',
        'portfolioWorkspaceDescription',
        'newCtaStrategy',
        'newPortfolioStrategy',
        'switchWorkspaceTitle',
        'switchWorkspaceContent',
        'universeApplied',
        'robotTemplates',
        'robotTemplatesDesc',
        'robotGenerated'
      ].reduce((acc, key) => {
        acc[key] = this.$t(`strategyIde.${key}`)
        return acc
      }, {})
    }
  },
  watch: {
    scriptCode () {
      this.scriptVerified = false
    }
  },
  mounted () {
    this._saveShortcut = (event) => this.handleSaveShortcut(event)
    window.addEventListener('keydown', this._saveShortcut, true)
    this.initPage()
  },
  beforeDestroy () {
    if (this._saveShortcut) {
      window.removeEventListener('keydown', this._saveShortcut, true)
      this._saveShortcut = null
    }
  },
  methods: {
    async initPage () {
      await this.loadSources()
      if (this.isDraftRoute() || this.hasCopilotScriptDraft()) {
        this.createNewDraft({
          openTemplate: this.shouldOpenTemplateFromRoute(),
          updateRoute: false,
          assetType: this.getRouteAssetType()
        })
        this.applyCopilotScriptDraft()
        if (this.isLegacyAiDraftRoute() || this.hasRouteSourceId()) {
          this.writeDraftRoute({ openTemplate: this.shouldOpenTemplateFromRoute() })
        }
        this.applyIndicatorConvertRouteOnce()
        return
      }
      const routeId = this.getInitialRouteSourceId()
      const hasRouteSource = routeId && this.allScriptOptions.some(item => String(item.id) === String(routeId))
      const firstId = this.scriptOptions.length ? this.scriptOptions[0].id : ''
      if (hasRouteSource) {
        await this.openSource(routeId, { updateRoute: false })
      } else if (firstId) {
        await this.openSource(firstId, { updateRoute: true })
      } else {
        this.createNewDraft({ openTemplate: false })
      }
      this.applyIndicatorConvertRouteOnce()
    },
    async loadSources () {
      this.loadingScripts = true
      try {
        const res = await getScriptSourceList()
        this.scriptSources = this.extractSources(res)
      } catch (e) {
        this.$message.warning(this.text.loadScriptsFailed)
      } finally {
        this.loadingScripts = false
      }
    },
    async refreshSources () {
      await this.loadSources()
      if (this.currentSourceId) {
        await this.openSource(this.currentSourceId, { updateRoute: false })
      }
    },
    extractSources (res) {
      const data = res && res.data
      if (Array.isArray(data)) return data
      if (data && Array.isArray(data.sources)) return data.sources
      if (data && Array.isArray(data.strategies)) return data.strategies
      if (data && Array.isArray(data.items)) return data.items
      return []
    },
    getInitialRouteSourceId () {
      const query = this.$route.query || {}
      const value = query.source_id || query.sourceId || query.strategy_id || query.strategyId
      return value ? String(value).trim() : ''
    },
    getRouteAssetType () {
      const query = this.$route.query || {}
      return String(query.asset_type || query.assetType || '').trim() === 'portfolio_strategy' ? 'portfolio_strategy' : 'script'
    },
    isDraftRoute () {
      const query = this.$route.query || {}
      return String(query.draft || '') === '1' || this.isLegacyAiDraftRoute()
    },
    isLegacyAiDraftRoute () {
      const query = this.$route.query || {}
      return String(query.aiDraft || '') === '1'
    },
    hasRouteSourceId () {
      return !!this.getInitialRouteSourceId()
    },
    hasCopilotScriptDraft () {
      if (typeof sessionStorage === 'undefined') return false
      try {
        return !!String(sessionStorage.getItem('qd_copilot_script_strategy_code') || '').trim()
      } catch (_) {
        return false
      }
    },
    applyCopilotScriptDraft () {
      if (typeof sessionStorage === 'undefined') return
      let code = ''
      let meta = {}
      try {
        code = String(sessionStorage.getItem('qd_copilot_script_strategy_code') || '').trim()
        const rawMeta = sessionStorage.getItem('qd_copilot_script_strategy_meta') || ''
        meta = rawMeta ? JSON.parse(rawMeta) : {}
        if (code) {
          sessionStorage.removeItem('qd_copilot_script_strategy_code')
          sessionStorage.removeItem('qd_copilot_script_strategy_meta')
        }
      } catch (_) {
        meta = {}
      }
      if (!code) return
      this.currentSource = null
      this.currentSourceId = null
      this.selectedScriptId = undefined
      this.scriptCodeHidden = false
      this.scriptCode = code
      this.scriptTemplateKey = ''
      this.scriptTemplateParams = {}
      this.scriptParamSchema = {}
      this.editorInitialTemplateKey = ''
      this.scriptVerified = false
      this.lastSavedSnapshot = ''
      this.runConfig = {
        ...this.runConfig,
        market_category: meta.market || this.runConfig.market_category,
        symbol: meta.symbol || this.runConfig.symbol
      }
    },
    shouldOpenTemplateFromRoute () {
      const query = this.$route.query || {}
      return String(query.template_picker || '') === '1'
    },
    getScriptSourceId (item) {
      if (!item) return ''
      return String(item.id || item.source_id || item.sourceId || '').trim()
    },
    async handleScriptSelect (id) {
      if (!id) {
        this.createNewDraft({ openTemplate: false })
        return
      }
      await this.openSource(id, { updateRoute: true })
    },
    async openSource (id, options = {}) {
      const sourceId = String(id || '').trim()
      if (!sourceId) return
      try {
        const res = await getScriptSourceDetail(sourceId)
        const source = (res && res.data) || res
        if (!source || !this.getScriptSourceId(source)) {
          throw new Error(this.text.loadScriptFailed)
        }
        this.applySource(source)
        if (options.updateRoute !== false) {
          this.writeRouteSource(this.currentSourceId)
        }
      } catch (e) {
        this.$message.error(e.backendMessage || e.message || this.text.loadScriptFailed)
      }
    },
    applySource (source) {
      const metadata = this.parseObject(source.metadata)
      const runConfig = this.parseObject(metadata.last_run_config)
      this.currentSource = source
      this.currentAssetType = source.asset_type === 'portfolio_strategy' ? 'portfolio_strategy' : 'script'
      this.currentSourceId = this.getScriptSourceId(source)
      this.selectedScriptId = this.currentSourceId ? String(this.currentSourceId) : undefined
      this.scriptCodeHidden = !!(source.code_hidden || metadata.code_hidden || metadata.hide_code)
      this.scriptCode = this.scriptCodeHidden
        ? ''
        : String(source.code || source.strategy_code || (this.currentAssetType === 'portfolio_strategy' ? DEFAULT_PORTFOLIO_CODE : DEFAULT_SCRIPT_CODE))
      this.scriptTemplateKey = source.template_key || runConfig.script_template_key || ''
      this.scriptTemplateParams = {
        ...this.parseObject(metadata.script_template_params),
        ...this.parseObject(runConfig.script_template_params)
      }
      this.scriptParamSchema = this.parseObject(source.param_schema || source.paramSchema)
      this.runConfig = {
        ...this.runConfig,
        ...runConfig
      }
      const universeReference = this.extractUniverseReferenceFromCode(this.scriptCode)
      if (universeReference.id && !this.runConfig.universe_id) {
        this.runConfig = {
          ...this.runConfig,
          universe_id: universeReference.id,
          universe_code: universeReference.code
        }
      }
      this.editorInitialTemplateKey = ''
      this.editorKeySeed += 1
      this.scriptVerified = !!(metadata.lifecycle_verified || metadata.script_verified)
      this.lastSavedSnapshot = this.scriptSnapshot()
    },
    createNewDraft ({ openTemplate = false, updateRoute = true, assetType = this.currentAssetType } = {}) {
      this.currentSource = null
      this.currentSourceId = null
      this.selectedScriptId = undefined
      this.currentAssetType = assetType === 'portfolio_strategy' ? 'portfolio_strategy' : 'script'
      this.scriptCode = this.currentAssetType === 'portfolio_strategy' ? DEFAULT_PORTFOLIO_CODE : DEFAULT_SCRIPT_CODE
      this.scriptCodeHidden = false
      this.scriptTemplateKey = ''
      this.scriptTemplateParams = {}
      this.scriptParamSchema = {}
      this.editorInitialTemplateKey = ''
      this.scriptVerified = false
      this.runConfig = {
        ...this.runConfig,
        universe_id: undefined,
        universe_code: '',
        universe_name: ''
      }
      this.lastSavedSnapshot = ''
      this.editorKeySeed += 1
      if (updateRoute) this.writeDraftRoute({ openTemplate })
      if (openTemplate) {
        this.$nextTick(() => {
          const editor = this.$refs.scriptEditor
          if (editor && typeof editor.openTemplatePicker === 'function') {
            editor.openTemplatePicker()
          }
        })
      }
    },
    handleAssetTypeChange (assetType) {
      const target = assetType === 'portfolio_strategy' ? 'portfolio_strategy' : 'script'
      if (target === this.currentAssetType) return
      const switchWorkspace = async () => {
        this.currentAssetType = target
        const first = this.allScriptOptions.find(item => item.asset_type === target)
        if (first) await this.openSource(first.id, { updateRoute: true })
        else this.createNewDraft({ openTemplate: false, updateRoute: true, assetType: target })
      }
      const defaultCode = this.currentAssetType === 'portfolio_strategy' ? DEFAULT_PORTFOLIO_CODE : DEFAULT_SCRIPT_CODE
      const shouldConfirm = this.currentSourceId
        ? this.hasUnsavedScriptChanges
        : String(this.scriptCode || '').trim() !== String(defaultCode).trim()
      if (shouldConfirm) {
        this.$confirm({
          title: this.text.switchWorkspaceTitle,
          content: this.text.switchWorkspaceContent,
          okText: this.text.switchWorkspaceTitle,
          cancelText: this.text.cancel,
          onOk: switchWorkspace
        })
        return
      }
      switchWorkspace()
    },
    extractUniverseReferenceFromCode (code) {
      const match = String(code || '').match(/^\s*#\s*@universe\s+(\d+)(?:\s+([^\s#]+))?/im)
      return match ? { id: Number(match[1]), code: String(match[2] || '').trim() } : { id: undefined, code: '' }
    },
    applyUniverseReferenceToCode (item) {
      if (this.scriptCodeHidden) return
      const line = `# @universe ${Number(item.id)} ${String(item.code || '').trim()}`
      const pattern = /^\s*#\s*@universe\s+\d+(?:\s+[^\s#]+)?\s*$/im
      const code = String(this.scriptCode || '')
      if (pattern.test(code)) {
        this.scriptCode = code.replace(pattern, line)
        return
      }
      const initPattern = /^def\s+on_init\s*\(/m
      this.scriptCode = initPattern.test(code) ? code.replace(initPattern, `${line}\n\ndef on_init(`) : `${line}\n${code}`
    },
    handleUniverseUse (item) {
      if (!item || this.currentAssetType !== 'portfolio_strategy') return
      this.runConfig = {
        ...this.runConfig,
        universe_id: Number(item.id),
        universe_code: item.code || '',
        universe_name: item.name || item.code || ''
      }
      this.applyUniverseReferenceToCode(item)
      this.showUniverseLibrary = false
      this.$message.success(this.text.universeApplied.replace('{name}', item.name || item.code || ''))
    },
    async applyGeneratedRobot (generated) {
      if (!generated || !generated.strategy_code) return
      const generatedCode = String(generated.strategy_code)
      this.currentSource = null
      this.currentSourceId = null
      this.selectedScriptId = undefined
      this.currentAssetType = 'script'
      this.scriptCodeHidden = false
      this.scriptTemplateKey = ''
      this.scriptTemplateParams = {}
      this.scriptParamSchema = {}
      this.editorInitialTemplateKey = ''
      this.scriptVerified = false
      this.runConfig = {
        ...this.runConfig,
        ...(generated.trading_config || {}),
        universe_id: undefined,
        universe_code: '',
        universe_name: '',
        market_category: generated.market_category || 'Crypto',
        symbol: generated.symbol || this.runConfig.symbol,
        timeframe: generated.timeframe || this.runConfig.timeframe,
        market_type: generated.market_type || this.runConfig.market_type,
        trade_direction: generated.trade_direction || this.runConfig.trade_direction,
        leverage: Number(generated.leverage || this.runConfig.leverage || 1),
        initial_capital: Number(generated.initial_capital || this.runConfig.initial_capital || 10000)
      }
      this.scriptCode = generatedCode
      this.editorKeySeed += 1
      await this.$nextTick()
      const editor = this.$refs.scriptEditor
      if (editor && typeof editor.setCode === 'function') {
        editor.setCode(generatedCode)
      }
      this.lastSavedSnapshot = ''
      this.showRobotBuilder = false
      this.$message.success(this.text.robotGenerated.replace('{name}', generated.strategy_name || ''))
    },
    writeRouteSource (sourceId) {
      if (!sourceId) return
      const query = { ...(this.$route.query || {}), tab: 'script', source_id: String(sourceId) }
      delete query.draft
      delete query.template_picker
      delete query.aiDraft
      delete query.symbol
      delete query.market
      delete query.sourceId
      delete query.strategy_id
      delete query.strategyId
      delete query.convert
      delete query.convert_key
      delete query.source_indicator_id
      delete query.indicator_id
      delete query.indicatorId
      delete query.timeframe
      delete query.asset_type
      delete query.assetType
      this.replaceRouteQuery(query)
    },
    writeDraftRoute ({ openTemplate = false } = {}) {
      const query = {
        ...(this.$route.query || {}),
        tab: 'script',
        draft: '1',
        asset_type: this.currentAssetType
      }
      delete query.assetType
      if (openTemplate) query.template_picker = '1'
      else delete query.template_picker
      delete query.source_id
      delete query.sourceId
      delete query.strategy_id
      delete query.strategyId
      delete query.aiDraft
      delete query.symbol
      delete query.market
      delete query.convert
      delete query.convert_key
      delete query.source_indicator_id
      delete query.indicator_id
      delete query.indicatorId
      delete query.timeframe
      this.replaceRouteQuery(query)
    },
    replaceRouteQuery (query) {
      const clean = {}
      Object.keys(query || {}).forEach(key => {
        const value = query[key]
        if (value !== undefined && value !== null && String(value) !== '') {
          clean[key] = value
        }
      })
      const current = JSON.stringify(this.$route.query || {})
      const next = JSON.stringify(clean)
      if (current !== next) {
        this.$router.replace({ path: '/strategy-ide', query: clean }).catch(() => {})
      }
    },
    parseObject (value) {
      if (!value) return {}
      if (typeof value === 'object' && !Array.isArray(value)) return { ...value }
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
        } catch (_) {
          return {}
        }
      }
      return {}
    },
    handleTemplateChange (payload) {
      this.scriptTemplateKey = (payload && payload.key) || ''
      this.scriptTemplateParams = payload && payload.params && typeof payload.params === 'object'
        ? { ...payload.params }
        : {}
      this.scriptParamSchema = payload && payload.param_schema && typeof payload.param_schema === 'object'
        ? { ...payload.param_schema }
        : {}
      if (this.scriptCodeHidden) {
        this.runConfig = {
          ...this.runConfig,
          script_template_key: this.scriptTemplateKey,
          script_template_params: { ...this.scriptTemplateParams }
        }
      }
      this.scriptVerified = false
    },
    handleSaveShortcut (event) {
      if (!event || !(event.ctrlKey || event.metaKey) || String(event.key || '').toLowerCase() !== 's') return
      event.preventDefault()
      this.saveScript(false)
    },
    extractScriptMetadataFromCode (code) {
      const source = String(code || '')
      const doc = source.match(/^\s*(?:[rubfRUBF]*)("""|''')([\s\S]*?)\1/)
      if (doc) {
        const lines = String(doc[2] || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
        if (lines.length) {
          return {
            name: lines[0],
            description: lines.slice(1).join('\n')
          }
        }
      }
      const nameMatch = source.match(/^\s*(?:my_strategy_name|strategy_name)\s*=\s*(['"])(.*?)\1\s*$/m)
      const descMatch = source.match(/^\s*(?:my_strategy_description|strategy_description)\s*=\s*(['"])(.*?)\1\s*$/m)
      return {
        name: nameMatch ? nameMatch[2] : '',
        description: descMatch ? descMatch[2] : ''
      }
    },
    deriveScriptName () {
      const meta = this.extractScriptMetadataFromCode(this.scriptCode)
      if (meta.name) return meta.name
      if (this.currentSource && this.currentSource.name) return this.currentSource.name
      return this.text.defaultName
    },
    getCurrentScriptCode () {
      const editor = this.$refs.scriptEditor
      if (editor && typeof editor.getCode === 'function') {
        return String(editor.getCode() || '')
      }
      return String(this.scriptCode || '')
    },
    extractScriptTimeframeFromCode (code) {
      const source = String(code || '')
      const match = source.match(/(?:^|\n)\s*#\s*timeframe\s*:\s*([A-Za-z0-9_-]+)/i)
      if (!match) return ''
      const raw = String(match[1] || '').trim()
      const aliases = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1H',
        '4h': '4H',
        '1d': '1D',
        '1w': '1W'
      }
      return aliases[raw.toLowerCase()] || ''
    },
    buildTradingConfig () {
      const cfg = this.runConfig || {}
      const marketCategory = cfg.market_category || cfg.marketCategory || 'Crypto'
      const marketType = marketCategory === 'Crypto' && cfg.market_type === 'swap' ? 'swap' : 'spot'
      const tradeDirection = marketType === 'spot' ? 'long' : (cfg.trade_direction || 'long')
      const investmentAmount = Number(cfg.initial_capital || cfg.investment_amount || 10000)
      const codeTimeframe = this.extractScriptTimeframeFromCode(this.getCurrentScriptCode())
      const out = {
        runtime_contract_version: 'simple_script_v1',
        market_category: marketCategory,
        exchange_id: marketCategory === 'Crypto' ? String(cfg.exchange_id || 'binance').toLowerCase() : '',
        symbol: String(cfg.symbol || 'BTC/USDT').trim(),
        timeframe: codeTimeframe || cfg.timeframe || '1m',
        tick_interval_sec: 10,
        market_type: marketType,
        trade_direction: tradeDirection,
        initial_capital: investmentAmount,
        investment_amount: investmentAmount,
        leverage: marketType === 'spot' ? 1 : Number(cfg.leverage || 5)
      }
      ;['strategy_family', 'executor_type', 'executor_config', 'executor_preview', 'bot_type', 'bot_params'].forEach(key => {
        if (cfg[key] !== undefined && cfg[key] !== null) out[key] = cfg[key]
      })
      if (cfg.tick_interval_sec) out.tick_interval_sec = Number(cfg.tick_interval_sec)
      if (this.scriptTemplateKey) out.script_template_key = this.scriptTemplateKey
      if (this.scriptTemplateParams && Object.keys(this.scriptTemplateParams).length) {
        out.script_template_params = { ...this.scriptTemplateParams }
      }
      if (this.currentAssetType === 'portfolio_strategy') {
        const universeReference = this.extractUniverseReferenceFromCode(this.getCurrentScriptCode())
        const universeId = Number(universeReference.id || cfg.universe_id || cfg.universeId) || undefined
        if (universeId) {
          out.universe_id = universeId
          out.universe_code = universeReference.code || cfg.universe_code || cfg.universeCode || ''
          out.universe_name = cfg.universe_name || cfg.universeName || ''
        }
      }
      return out
    },
    buildPayload () {
      const currentCode = this.getCurrentScriptCode()
      const meta = this.extractScriptMetadataFromCode(currentCode)
      const description = meta.description || (this.currentSource && this.currentSource.description) || ''
      return {
        user_id: this.userId,
        name: meta.name || this.deriveScriptName(),
        description,
        code: currentCode,
        asset_type: this.currentAssetType,
        template_key: this.scriptTemplateKey,
        param_schema: this.currentSourceParamSchema,
        template_params: { ...this.scriptTemplateParams },
        metadata: {
          description,
          last_run_config: this.buildTradingConfig(),
          script_template_params: { ...this.scriptTemplateParams },
          lifecycle_verified: this.scriptVerified,
          script_verified: this.scriptVerified
        }
      }
    },
    buildHiddenParamPayload () {
      const existingMeta = this.parseObject(this.currentSource && this.currentSource.metadata)
      const description = (this.currentSource && this.currentSource.description) || ''
      const lastRunConfig = this.buildTradingConfig()
      return {
        user_id: this.userId,
        name: this.currentSourceName || this.text.defaultName,
        description,
        asset_type: this.currentAssetType,
        template_key: this.scriptTemplateKey || (this.currentSource && this.currentSource.template_key) || '',
        param_schema: this.currentSourceParamSchema,
        metadata: {
          ...existingMeta,
          description,
          code_hidden: true,
          hide_code: true,
          last_run_config: lastRunConfig,
          script_template_params: { ...this.scriptTemplateParams }
        }
      }
    },
    scriptSnapshot () {
      if (this.scriptCodeHidden) {
        return JSON.stringify({
          id: this.currentSourceId,
          code_hidden: true,
          template_key: this.scriptTemplateKey || '',
          template_params: { ...(this.scriptTemplateParams || {}) },
          universe_id: this.selectedUniverseId || null
        })
      }
      return JSON.stringify({
        code: String(this.scriptCode || ''),
        asset_type: this.currentAssetType,
        template_key: this.scriptTemplateKey || '',
        template_params: { ...(this.scriptTemplateParams || {}) },
        universe_id: this.selectedUniverseId || null
      })
    },
    validateScriptCode () {
      if (this.scriptCodeHidden) return true
      if (!String(this.scriptCode || '').trim()) {
        this.$message.warning(this.text.codeRequired)
        return false
      }
      return true
    },
    async verifyScriptCode (options = {}) {
      const code = String(this.scriptCode || '').trim()
      if (!code) {
        this.$message.error(this.text.verifyBlocked.replace('{reason}', this.text.codeRequired))
        return false
      }
      try {
        const res = await verifyStrategyCode({
          code,
          assetType: this.currentAssetType,
          user_id: this.userId,
          strategyId: this.currentSourceId || undefined,
          scriptSourceId: this.currentSourceId || undefined
        })
        const hints = Array.isArray(res && res.hints) ? res.hints : []
        const blockers = hints.filter(item => {
          const severity = String((item && item.severity) || '').toLowerCase()
          return severity === 'error' || severity === 'fatal'
        })
        if (!(res && res.success) || blockers.length) {
          const reason = this.formatVerifyHint(blockers[0]) || (res && (res.msg || res.message)) || this.text.verifyFailed
          this.$message.error(this.text.verifyBlocked.replace('{reason}', reason))
          return false
        }
        this.scriptVerified = true
        if (!options.silentSuccess) this.$message.success(this.text.verifyPassed)
        return true
      } catch (e) {
        this.$message.error(`${this.text.verifyFailed}: ${e.backendMessage || e.message || ''}`)
        return false
      }
    },
    formatVerifyHint (hint) {
      if (!hint || !hint.code) return ''
      const params = hint.params || {}
      const calls = Array.isArray(params.calls) ? params.calls : []
      const names = calls.map(item => item && item.name).filter(Boolean).join(', ')
      const key = `strategyIde.verifyHints.${hint.code}`
      const translated = this.$t(key, {
        count: params.count || 0,
        names
      })
      return translated && translated !== key ? translated : hint.code
    },
    async saveScript (forceCreate = false, options = {}) {
      if (this.scriptCodeHidden) {
        if (!options.silent) this.$message.info(this.text.hiddenScriptDesc)
        return null
      }
      this.scriptCode = this.getCurrentScriptCode()
      if (!this.validateScriptCode()) return null
      if (!forceCreate && this.currentSource && this.currentSource.status === 'running') {
        this.$message.warning(this.text.runningEditBlocked)
        return null
      }
      if (!forceCreate && this.currentSourceId && !this.hasUnsavedScriptChanges) {
        if (!options.silent && !options.skipUnchanged) {
          this.$message.info(this.text.noChangesToSave)
        }
        return this.currentSourceId
      }
      if (this.savingScript) return null
      this.savingScript = true
      this.savingScriptMode = options.loadingMode || (forceCreate ? 'copy' : 'save')
      try {
        const payload = this.buildPayload()
        const res = (!forceCreate && this.currentSourceId)
          ? await updateScriptSource(this.currentSourceId, payload)
          : await createScriptSource(payload)
        if (res && res.code === 1) {
          const saved = (res && res.data) || {}
          const savedId = this.getScriptSourceId(saved) || this.currentSourceId
          await this.loadSources()
          await this.openSource(savedId, { updateRoute: true })
          if (!options.silent) this.$message.success(this.text.saveSuccess)
          return this.currentSourceId
        }
        this.$message.error((res && res.msg) || this.text.saveFailed)
        return null
      } catch (e) {
        this.$message.error(e.backendMessage || e.message || this.text.saveFailed)
        return null
      } finally {
        this.savingScript = false
        this.savingScriptMode = ''
      }
    },
    async saveHiddenScriptParams (options = {}) {
      if (!this.scriptCodeHidden || !this.currentSourceId) return this.currentSourceId
      if (this.savingScript) return null
      this.savingScript = true
      this.savingScriptMode = options.loadingMode || 'params'
      try {
        const res = await updateScriptSource(this.currentSourceId, this.buildHiddenParamPayload())
        if (res && res.code === 1) {
          const saved = (res && res.data) || {}
          const metadata = this.parseObject(saved.metadata || (this.currentSource && this.currentSource.metadata))
          this.currentSource = {
            ...(this.currentSource || {}),
            ...saved,
            code: '',
            code_hidden: 1,
            metadata: {
              ...metadata,
              code_hidden: true,
              hide_code: true
            }
          }
          this.lastSavedSnapshot = this.scriptSnapshot()
          if (!options.silent) this.$message.success(this.text.saveSuccess)
          return this.currentSourceId
        }
        if (!options.silent) this.$message.error((res && res.msg) || this.text.saveFailed)
        return null
      } catch (e) {
        if (!options.silent) this.$message.error(e.backendMessage || e.message || this.text.saveFailed)
        return null
      } finally {
        this.savingScript = false
        this.savingScriptMode = ''
      }
    },
    async openPublishModal () {
      if (this.scriptCodeHidden) {
        this.$message.warning(this.text.hiddenScriptDesc)
        return
      }
      if (!await this.verifyScriptCode()) return
      const sourceId = await this.saveScript(false, { silent: true, loadingMode: 'publish' })
      if (!sourceId) return
      if (!await this.hasSuccessfulBacktest(sourceId)) {
        this.$message.warning(this.text.publishBacktestRequired)
        return
      }
      const meta = this.extractScriptMetadataFromCode(this.scriptCode)
      this.publishForm = {
        name: meta.name || this.deriveScriptName(),
        description: meta.description || (this.currentSource && this.currentSource.description) || '',
        pricingType: 'free',
        price: 0,
        vipFree: false,
        codeHidden: false
      }
      this.showPublishModal = true
    },
    async hasSuccessfulBacktest (sourceId) {
      const id = Number(sourceId || 0)
      if (!id) return false
      try {
        const res = await getUnifiedBacktestHistory({
          assetType: 'script',
          assetId: id,
          status: 'success',
          limit: 1
        })
        const rows = Array.isArray(res && res.data) ? res.data : []
        return res && res.code === 1 && rows.length > 0
      } catch (_) {
        return false
      }
    },
    closePublishModal () {
      if (!this.publishingScript) this.showPublishModal = false
    },
    async confirmPublish () {
      const sourceId = this.currentSourceId || await this.saveScript(false, { silent: true, loadingMode: 'publish' })
      if (!sourceId) return
      const pricingType = this.publishForm.pricingType === 'paid' ? 'paid' : 'free'
      const price = Number(this.publishForm.price || 0)
      if (pricingType === 'paid' && price <= 0) {
        this.$message.warning(this.text.priceRequired)
        return
      }
      this.publishingScript = true
      try {
        if (!await this.verifyScriptCode({ silentSuccess: true })) return
        const res = await publishScriptSource({
          sourceId,
          name: String(this.publishForm.name || '').trim() || this.deriveScriptName(),
          description: String(this.publishForm.description || '').trim(),
          pricingType,
          price: pricingType === 'paid' ? price : 0,
          vipFree: pricingType === 'paid' ? !!this.publishForm.vipFree : false,
          codeHidden: !!this.publishForm.codeHidden
        })
        if (res && res.code === 1) {
          this.$message.success(this.text.publishSuccess)
          this.showPublishModal = false
        } else {
          this.$message.error((res && res.msg) || this.text.publishFailed)
        }
      } catch (e) {
        this.$message.error(e.backendMessage || e.message || this.text.publishFailed)
      } finally {
        this.publishingScript = false
      }
    },
    deleteCurrentSource () {
      if (!this.currentSourceId) return
      this.$confirm({
        title: this.text.deleteConfirmTitle,
        content: this.text.deleteConfirmDesc,
        okType: 'danger',
        onOk: async () => {
          this.deletingScript = true
          try {
            const res = await deleteScriptSource(this.currentSourceId)
            if (res && res.code === 1) {
              this.$message.success(this.text.deleteSuccess)
              await this.loadSources()
              const firstId = this.scriptOptions.length ? this.scriptOptions[0].id : ''
              if (firstId) {
                await this.openSource(firstId, { updateRoute: true })
              } else {
                this.createNewDraft({ openTemplate: false })
              }
            } else {
              this.$message.error((res && res.msg) || this.text.deleteFailed)
            }
          } catch (e) {
            this.$message.error(e.backendMessage || e.message || this.text.deleteFailed)
          } finally {
            this.deletingScript = false
          }
        }
      })
    },
    openBacktestCenter () {
      const go = async () => {
        const sourceId = this.scriptCodeHidden && this.currentSourceId
          ? await this.saveHiddenScriptParams({ silent: true, loadingMode: 'backtest' })
          : await this.saveScript(false, { skipUnchanged: true, silent: true, loadingMode: 'backtest' })
        if (!sourceId) return
        const cfg = this.buildTradingConfig()
        this.$router.push({
          path: '/backtest-center',
          query: {
            asset_type: this.currentAssetType,
            source_id: String(sourceId),
            exchange_id: cfg.exchange_id || '',
            market_type: cfg.market_type,
            universe_id: cfg.universe_id || ''
          }
        }).catch(() => {})
      }
      go()
    },
    async createLiveFromScript () {
      const sourceId = this.scriptCodeHidden && this.currentSourceId
        ? await this.saveHiddenScriptParams({ silent: true, loadingMode: 'live' })
        : await this.saveScript(false, { skipUnchanged: true, silent: true, loadingMode: 'live' })
      if (!sourceId) return
      const cfg = this.buildTradingConfig()
      if (this.currentAssetType === 'portfolio_strategy') {
        this.$router.push({
          path: '/strategy-center',
          query: {
            mode: 'create',
            asset_type: 'portfolio_strategy',
            source_id: String(sourceId),
            universe_id: cfg.universe_id || ''
          }
        }).catch(() => {})
        return
      }
      this.$router.push({
        path: '/strategy-center',
        query: {
          mode: 'create',
          source_id: String(sourceId),
          exchange_id: cfg.exchange_id || '',
          market_type: cfg.market_type,
          trade_direction: cfg.trade_direction,
          initial_capital: String(cfg.initial_capital || 10000),
          leverage: String(cfg.leverage || 1)
        }
      }).catch(() => {})
    },
    openVersionDrawer () {
      if (!this.currentSourceId) return
      if (this.scriptCodeHidden) {
        this.$message.info(this.text.versionHiddenBlocked)
        return
      }
      this.showVersionDrawer = true
      this.scriptVersionPreview = null
      this.loadScriptVersions()
    },
    async loadScriptVersions () {
      if (!this.currentSourceId) return
      this.scriptVersionLoading = true
      try {
        const res = await getScriptSourceVersions(this.currentSourceId)
        if (res && res.code === 1) {
          this.scriptVersions = Array.isArray(res.data) ? res.data : []
        } else {
          this.$message.error((res && res.msg) || this.text.versionLoadFailed)
        }
      } catch (e) {
        this.$message.error(e.backendMessage || e.message || this.text.versionLoadFailed)
      } finally {
        this.scriptVersionLoading = false
      }
    },
    async previewScriptVersion (item) {
      if (!item || !item.id) return
      if (this.scriptCodeHidden || item.code_hidden || item.hidden_source) {
        this.$message.info(this.text.versionHiddenBlocked)
        return
      }
      try {
        const res = await getScriptSourceVersion(item.id)
        if (res && res.code === 1) {
          this.scriptVersionPreview = res.data || null
        } else {
          this.$message.error((res && res.msg) || this.text.versionLoadFailed)
        }
      } catch (e) {
        this.$message.error(e.backendMessage || e.message || this.text.versionLoadFailed)
      }
    },
    confirmRestoreScriptVersion (item) {
      if (!item || !item.id) return
      if (this.scriptCodeHidden || item.code_hidden || item.hidden_source || item.restore_disabled) {
        this.$message.info(this.text.versionHiddenBlocked)
        return
      }
      this.$confirm({
        title: this.text.versionRestoreTitle,
        content: this.text.versionRestoreContent.replace('{version}', item.version_no),
        okText: this.text.versionRestore,
        cancelText: this.text.cancel,
        onOk: () => this.restoreScriptVersion(item)
      })
    },
    async restoreScriptVersion (item) {
      if (!item || !item.id) return
      if (this.scriptCodeHidden || item.code_hidden || item.hidden_source || item.restore_disabled) {
        this.$message.info(this.text.versionHiddenBlocked)
        return
      }
      this.restoringScriptVersionId = item.id
      try {
        const res = await restoreScriptSourceVersion(item.id)
        if (res && res.code === 1 && res.data) {
          this.applySource(res.data)
          await this.loadSources()
          await this.loadScriptVersions()
          this.scriptVersionPreview = null
          this.$message.success(this.text.versionRestored)
        } else {
          this.$message.error((res && res.msg) || this.text.versionRestoreFailed)
        }
      } catch (e) {
        this.$message.error(e.backendMessage || e.message || this.text.versionRestoreFailed)
      } finally {
        this.restoringScriptVersionId = null
      }
    },
    async openIndicatorConvertPicker () {
      this.indicatorConvertContext = null
      this.selectedIndicatorConvertId = undefined
      this.indicatorConvertInstruction = ''
      this.indicatorConvertError = ''
      this.showIndicatorConvertModal = true
      await this.loadIndicatorOptions()
    },
    async loadIndicatorOptions () {
      this.indicatorConvertIndicatorLoading = true
      try {
        const res = await getIndicatorListForStrategy({ userid: this.userId })
        const list = this.extractIndicatorList(res)
          .map(item => this.normalizeIndicator(item))
          .filter(Boolean)
        this.indicatorConvertIndicators = list
      } catch (e) {
        this.indicatorConvertIndicators = []
        this.indicatorConvertError = e.backendMessage || e.message || this.text.indicatorConvertFailed
      } finally {
        this.indicatorConvertIndicatorLoading = false
      }
    },
    extractIndicatorList (res) {
      const data = res && res.data
      if (Array.isArray(data)) return data
      if (data && Array.isArray(data.items)) return data.items
      if (data && Array.isArray(data.indicators)) return data.indicators
      return []
    },
    normalizeIndicator (raw) {
      if (!raw || typeof raw !== 'object') return null
      const codeHidden = this.toBool(raw.codeHidden) || this.toBool(raw.code_hidden) || this.toBool(raw.is_encrypted)
      return {
        indicatorId: String(raw.indicatorId || raw.id || raw.indicator_id || '').trim(),
        name: String(raw.name || raw.indicator_name || this.defaultIndicatorNameFromCode(raw.code || '') || '').trim(),
        description: String(raw.description || '').trim(),
        code: codeHidden ? '' : String(raw.code || '').trim(),
        params: raw.params || {},
        market: raw.market || raw.marketCategory || raw.market_category || 'Crypto',
        symbol: raw.symbol || '',
        exchangeId: raw.exchange_id || raw.exchangeId || '',
        marketType: raw.market_type || raw.marketType || 'spot',
        instrumentId: raw.instrument_id || raw.instrumentId || '',
        timeframe: raw.timeframe || '1m',
        codeHidden
      }
    },
    toBool (value) {
      if (value === true || value === 1) return true
      return ['1', 'true', 'yes', 'y'].includes(String(value || '').trim().toLowerCase())
    },
    defaultIndicatorNameFromCode (code) {
      const match = String(code || '').match(/^\s*my_indicator_name\s*=\s*(['"])(.*?)\1\s*$/m)
      return match ? match[2] : ''
    },
    handleIndicatorConvertSelect (id) {
      const target = (this.indicatorConvertIndicators || []).find(item => String(item.indicatorId) === String(id))
      this.indicatorConvertContext = target || null
      this.indicatorConvertError = ''
      if (target) {
        this.runConfig = {
          ...this.runConfig,
          market_category: target.market || 'Crypto',
          exchange_id: target.exchangeId || this.runConfig.exchange_id,
          market_type: target.marketType || this.runConfig.market_type,
          symbol: target.symbol || this.runConfig.symbol,
          timeframe: target.timeframe || '1m'
        }
      }
    },
    buildIndicatorConversionPrompt () {
      const ctx = this.indicatorConvertContext || {}
      const params = ctx.params && Object.keys(ctx.params).length ? JSON.stringify(ctx.params, null, 2) : '{}'
      const instruction = String(this.indicatorConvertInstruction || '').trim() ||
        'Convert the visible indicator signals into a conservative, event-based strategy. Confirm signals on closed bars and execute on the next bar to avoid look-ahead bias.'
      return [
        'Convert this QuantDinger chart-only indicator into executable QuantDinger Python ScriptStrategy code.',
        '',
        'Hard boundaries:',
        '- Return ScriptStrategy code only. Do not return indicator backtest code, live-indicator code, indicator output, plots, layers, signals, or calculatedVars.',
        '- Start the script with a triple-quoted metadata docstring. The first non-empty line is the strategy name, and the following non-empty lines are the strategy description. Do not put name or description in ctx.param.',
        '- The strategy run panel owns symbol, spot/swap, direction, investment amount, leverage, and timeframe unless the source indicator has an explicit timeframe header. Do not define these with ctx.param and do not hard-code them.',
        '- Declare every strategy parameter in on_init as ctx.name = ctx.param("name", default). Do not call ctx.param("name") without a default, and do not repeatedly read ctx.param inside on_bar.',
        '- Preserve the indicator signal logic first. Map visual buy/entry markers to long entries, sell/exit markers to long exits, and warning markers to wait/risk states.',
        '- Default to long-only unless the user explicitly asks for shorts and the indicator has clear bearish short-entry logic.',
        '- First classify every marker as long entry, long exit, short entry, short exit, warning/wait, or visual-only. Marker color and type="sell" alone do not prove short-entry intent.',
        '- Preserve composite event algebra exactly. For edge(A | B), compare the complete previous composite A_prev | B_prev; do not emit a duplicate event on the next bar.',
        '- If the user explicitly requests symmetric shorts from a long-only indicator, derive and label them as new behavior; otherwise do not invent short entries.',
        '- Confirm indicator conditions on the completed bar inside on_bar. Use # signal_timing: next_bar_open when code-owned timing is needed; the engine handles next-bar execution.',
        '- Preserve recursive indicator parity. For EMA/ewm/MACD/Wilder-style smoothing, compute from all available bars with ctx.bars(ctx.current_index + 1), declare # startup_candle_count: N, and let the data engine own warmup readiness. Do not add a manual len(ctx.bars(...)) warmup gate inside on_bar.',
        '- Prefer registered technical factors through ctx.factor(factor_id, **params) when the required calculation exists. CTA factors use only bars visible at the current index; fundamental factors are portfolio-only.',
        '- Remove display-only params such as colors, visibility toggles, marker offsets, line extension, and plot layout. Every retained ctx.param must affect entry, exit, sizing, state, or risk.',
        '- The chart timeframe below is UI context only. Do not emit a # timeframe header unless the indicator source code has an explicit timeframe header or the user explicitly requests one.',
        '- For all-in compounding, size from ctx.available_capital and fall back to ctx.investment_amount. For proportional compounding, use current ctx.equity or available capital times an explicit allocation parameter.',
        '- Use ScriptStrategy order APIs such as ctx.order_value, ctx.order_target, ctx.open_long, ctx.close_long, ctx.open_short, and ctx.close_short. Prevent duplicate orders on the same bar.',
        '- Do not generate grid, DCA, or martingale executor logic unless the user explicitly asks for a ScriptStrategy version.',
        '',
        `Indicator name: ${ctx.name || this.text.defaultIndicatorName}`,
        ctx.description ? `Indicator description: ${ctx.description}` : '',
        `Market: ${ctx.market || ''}`,
        `Symbol: ${ctx.symbol || ''}`,
        `Chart timeframe UI context only (not a source-code header): ${ctx.timeframe || ''}`,
        '',
        `Indicator params JSON:\n${params}`,
        '',
        `User conversion request:\n${instruction}`,
        '',
        `Indicator source code:\n\`\`\`python\n${ctx.code || ''}\n\`\`\``
      ].filter(Boolean).join('\n')
    },
    async confirmIndicatorToStrategy () {
      const ctx = this.indicatorConvertContext || {}
      if (!ctx.indicatorId) {
        this.indicatorConvertError = this.text.indicatorConvertSelectFirst
        return
      }
      if (ctx.codeHidden || !ctx.code) {
        this.indicatorConvertError = ctx.codeHidden ? this.text.indicatorConvertHiddenBlocked : this.text.indicatorConvertNoCode
        return
      }
      this.indicatorConvertLoading = true
      this.indicatorConvertError = ''
      try {
        const res = await aiGenerateStrategy({
          intent: 'indicator_to_strategy',
          source: 'indicator_to_strategy',
          prompt: this.buildIndicatorConversionPrompt(),
          source_indicator_id: ctx.indicatorId || '',
          save_script_source: true,
          script_source_name: `${ctx.name || this.text.defaultIndicatorName} Strategy`,
          script_source_description: `AI converted from indicator: ${ctx.name || this.text.defaultIndicatorName}`,
          script_source_metadata: this.buildGeneratedMetadata(ctx)
        })
        const sourceId = this.extractGeneratedSourceId(res)
        if (sourceId) {
          await this.loadSources()
          await this.openSource(sourceId, { updateRoute: false })
          this.finishIndicatorConversion(sourceId)
        } else {
          const code = this.extractAiGeneratedCode(res)
          if (!code) throw new Error((res && res.msg) || this.text.indicatorConvertFailed)
          const fallback = await createScriptSource({
            user_id: this.userId,
            name: this.extractScriptMetadataFromCode(code).name || `${ctx.name || this.text.defaultIndicatorName} Strategy`,
            description: this.extractScriptMetadataFromCode(code).description || `AI converted from indicator: ${ctx.name || this.text.defaultIndicatorName}`,
            code,
            metadata: this.buildGeneratedMetadata(ctx)
          })
          if (!(fallback && fallback.code === 1)) throw new Error((fallback && fallback.msg) || this.text.indicatorConvertFailed)
          await this.loadSources()
          const fallbackSourceId = this.getScriptSourceId(fallback.data)
          await this.openSource(fallbackSourceId, { updateRoute: false })
          this.finishIndicatorConversion(fallbackSourceId)
        }
        this.$message.success(this.text.indicatorConvertSuccess)
      } catch (e) {
        this.indicatorConvertError = e.backendMessage || e.message || this.text.indicatorConvertFailed
      } finally {
        this.indicatorConvertLoading = false
      }
    },
    extractGeneratedSourceId (res) {
      const data = (res && res.data) || {}
      return data.source_id || data.sourceId || this.getScriptSourceId(data.source) || res.source_id || res.sourceId || ''
    },
    extractAiGeneratedCode (res) {
      if (!res || typeof res !== 'object') return ''
      const data = res.data || {}
      const candidates = [res.code, res.script_code, res.strategy_code, data.code, data.script_code, data.strategy_code]
      const code = candidates.find(item => typeof item === 'string' && item.trim())
      return code ? String(code).trim() : ''
    },
    buildGeneratedMetadata (ctx = {}) {
      return {
        generated_by: 'ai_indicator_to_strategy',
        source_indicator_id: ctx.indicatorId || '',
        source_indicator_name: ctx.name || '',
        source_indicator_market: ctx.market || '',
        source_indicator_symbol: ctx.symbol || '',
        source_indicator_timeframe: ctx.timeframe || '',
        lifecycle_verified: false,
        script_verified: false,
        last_run_config: this.buildTradingConfig(),
        script_template_params: {}
      }
    },
    closeIndicatorConvertModal () {
      if (this.indicatorConvertLoading) return
      this.showIndicatorConvertModal = false
      this.indicatorConvertError = ''
      this.clearIndicatorConvertSession()
      this.clearIndicatorConvertRoute()
    },
    finishIndicatorConversion (sourceId) {
      this.showIndicatorConvertModal = false
      this.indicatorConvertError = ''
      this.clearIndicatorConvertSession()
      this.writeRouteSource(sourceId)
    },
    clearIndicatorConvertSession () {
      const key = String((this.$route.query || {}).convert_key || '').trim()
      if (!key || typeof sessionStorage === 'undefined') return
      try {
        sessionStorage.removeItem(key)
      } catch (_) {}
    },
    async applyIndicatorConvertRouteOnce () {
      const query = this.$route.query || {}
      const isConvert = String(query.convert || '').toLowerCase() === 'indicator' || !!query.convert_key || !!query.source_indicator_id
      if (!isConvert) return
      let context = null
      const key = String(query.convert_key || '').trim()
      if (key && typeof sessionStorage !== 'undefined') {
        try {
          context = JSON.parse(sessionStorage.getItem(key) || 'null')
        } catch (_) {
          context = null
        }
      }
      if (!(this.indicatorConvertIndicators || []).length) {
        await this.loadIndicatorOptions()
      }
      if (context) {
        const storedContext = this.normalizeIndicator(context)
        if (storedContext) {
          const sourceIndex = (this.indicatorConvertIndicators || []).findIndex(item => String(item.indicatorId) === storedContext.indicatorId)
          if (sourceIndex >= 0) {
            const mergedContext = {
              ...this.indicatorConvertIndicators[sourceIndex],
              ...storedContext
            }
            this.indicatorConvertIndicators.splice(sourceIndex, 1, mergedContext)
            context = mergedContext
          } else {
            this.indicatorConvertIndicators.unshift(storedContext)
            context = storedContext
          }
        }
      } else if (query.source_indicator_id || query.indicator_id) {
        context = (this.indicatorConvertIndicators || []).find(item => String(item.indicatorId) === String(query.source_indicator_id || query.indicator_id))
      }
      if (!context) return
      this.indicatorConvertContext = context
      this.selectedIndicatorConvertId = context.indicatorId ? String(context.indicatorId) : undefined
      this.showIndicatorConvertModal = true
    },
    clearIndicatorConvertRoute () {
      const query = { ...(this.$route.query || {}) }
      delete query.convert
      delete query.convert_key
      delete query.source_indicator_id
      delete query.indicator_id
      delete query.indicatorId
      delete query.market
      delete query.symbol
      delete query.timeframe
      this.replaceRouteQuery(query)
    },
    marketLabel (market) {
      const text = String(market || '').trim()
      if (!text) return '-'
      const key = `dashboard.indicator.market.${text}`
      const translated = this.$t(key)
      return translated && translated !== key ? translated : text
    },
    formatTime (value) {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value)
      return date.toLocaleString()
    }
  }
}
</script>

<style lang="less" scoped>
.strategy-ide-shell {
  box-sizing: border-box;
  height: calc(100vh - 64px);
  padding: 12px;
  background: #f5f7fb;
  overflow: hidden;
}

.strategy-ide-layout {
  height: 100%;
  min-height: 0;
}

.script-panel {
  height: 100%;
  min-height: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.script-panel ::v-deep .strategy-editor {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.script-panel ::v-deep .editor-top-toolbar {
  flex: 0 0 auto;
}

.script-panel ::v-deep .editor-layout {
  flex: 1 1 auto;
  height: calc(100% - 57px);
  min-height: 0;
}

.script-panel ::v-deep .code-col,
.script-panel ::v-deep .side-col {
  height: 100%;
  min-height: 0;
}

.script-panel ::v-deep .code-section,
.script-panel ::v-deep .side-tabs {
  height: 100%;
  min-height: 0;
}

.script-panel ::v-deep .code-editor-container {
  min-height: 0;
}

.script-panel ::v-deep .CodeMirror {
  height: 100% !important;
}

.ide-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.toolbar-left {
  flex: 1 1 auto;
}

.toolbar-right {
  flex: 0 0 auto;
}

.strategy-workspace-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 10px;
  border-right: 1px solid #e5e7eb;
}

.strategy-workspace-copy {
  display: flex;
  width: 150px;
  min-width: 0;
  flex-direction: column;
  line-height: 1.25;
}

.strategy-workspace-copy strong {
  color: #202735;
  font-size: 13px;
}

.strategy-workspace-copy span {
  margin-top: 3px;
  overflow: hidden;
  color: #7b8494;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.strategy-workspace-switcher .ant-radio-button-wrapper {
  height: 36px;
  padding: 0 13px;
  line-height: 34px;
  font-weight: 700;
}

.script-select-label {
  flex: 0 0 auto;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.script-select {
  width: 280px;
}

.ide-icon-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ide-icon-btn--danger {
  color: #ff4d4f;
  border-color: rgba(255, 77, 79, 0.45);
}

.script-save-button,
.script-live-button,
.script-backtest-button,
.indicator-convert-button,
.factor-library-button,
.universe-library-button {
  height: 36px;
  font-weight: 700;
}

.script-save-button,
.script-live-button {
  min-width: 76px;
}

.script-backtest-button,
.indicator-convert-button {
  min-width: 120px;
}

.universe-library-button--selected {
  border-color: var(--primary-color, #52c41a);
  color: var(--primary-color, #52c41a);
  background: rgba(82, 196, 26, 0.08);
}

.theme-dark {
  background: #0f0f0f;

  .script-panel {
    border-color: rgba(255, 255, 255, 0.1);
    background: #141414;
  }

  .ide-toolbar {
    border-bottom-color: rgba(255, 255, 255, 0.08);
    background: #141414;
  }

  .script-select-label {
    color: rgba(255, 255, 255, 0.62);
  }

  .strategy-workspace-copy strong {
    color: rgba(255, 255, 255, 0.9);
  }

  .strategy-workspace-copy span {
    color: rgba(255, 255, 255, 0.46);
  }

  .strategy-workspace-switcher {
    border-right-color: rgba(255, 255, 255, 0.1);
  }

  .strategy-workspace-switcher .ant-radio-button-wrapper {
    border-color: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.68);
    background: #202020;
  }

  .strategy-workspace-switcher .ant-radio-button-wrapper-checked {
    border-color: var(--primary-color, #52c41a);
    color: #fff;
    background: var(--primary-color, #52c41a);
  }

  ::v-deep .ant-select-selection,
  ::v-deep .ant-input,
  ::v-deep textarea.ant-input,
  ::v-deep .ant-input-number,
  ::v-deep .ant-input-number-input {
    background: #111 !important;
    border-color: rgba(255, 255, 255, 0.12) !important;
    color: rgba(255, 255, 255, 0.86) !important;
  }
}

@media (max-width: 1180px) {
  .ide-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar-left,
  .toolbar-right {
    width: 100%;
    flex-wrap: wrap;
  }

  .script-select {
    flex: 1 1 260px;
    width: auto;
  }
}
</style>

<style lang="less">
.robot-builder-drawer {
  .ant-drawer-body {
    height: calc(100vh - 55px);
    overflow: auto;
    padding: 14px 18px 18px;
    background: #f4f6f8;
  }

  .robot-builder-intro {
    margin-bottom: 12px;
    padding: 10px 12px;
    border: 1px solid #d9e2ec;
    border-radius: 8px;
    background: #fff;
    color: #52606d;
  }
}

.robot-builder-drawer--dark {
  .ant-drawer-header,
  .ant-drawer-content,
  .ant-drawer-body {
    border-color: #2b2b2b;
    background: #0b0b0b;
    color: rgba(255, 255, 255, 0.86);
  }

  .ant-drawer-title,
  .ant-drawer-close {
    color: rgba(255, 255, 255, 0.86);
  }

  .robot-builder-intro {
    border-color: #2b2b2b;
    background: #151515;
    color: rgba(255, 255, 255, 0.58);
  }
}

.script-publish-modal {
  .ant-modal-content {
    overflow: hidden;
    border-radius: 12px;
  }

  .ant-modal-header {
    padding: 18px 24px;
    border-bottom: 1px solid #edf0f5;
  }

  .ant-modal-body {
    padding: 18px 24px 20px;
    background: #f6f7f9;
  }

  .ant-modal-footer {
    padding: 14px 24px;
    border-top: 1px solid #edf0f5;
    background: #fff;
  }

  .publish-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .publish-summary-card {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 74px;
    padding: 14px;
    border: 1px solid rgba(255, 77, 79, 0.22);
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(255, 77, 79, 0.1) 0%, #fff 72%);
  }

  .publish-summary-icon {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #fff;
    background: var(--primary-color, #ff4d4f);
    box-shadow: 0 10px 24px rgba(255, 77, 79, 0.24);
    font-size: 18px;
  }

  .publish-summary-main {
    flex: 1;
    min-width: 0;
  }

  .publish-summary-label {
    margin-bottom: 3px;
    font-size: 12px;
    font-weight: 700;
    color: #6b7280;
  }

  .publish-summary-name {
    overflow: hidden;
    color: #111827;
    font-size: 16px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .publish-summary-tag {
    margin: 0;
    height: 24px;
    line-height: 22px;
    border-radius: 999px;
    font-weight: 700;
  }

  .publish-note {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    color: #4b5563;
    font-size: 13px;
    line-height: 1.55;
  }

  .publish-note .anticon {
    margin-top: 3px;
    color: var(--primary-color, #ff4d4f);
  }

  .publish-section,
  .publish-option-card {
    padding: 14px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: #fff;
  }

  .publish-section-title,
  .field-label,
  .publish-option-head {
    color: #1f2937;
    font-size: 13px;
    font-weight: 800;
  }

  .publish-section-title {
    margin-bottom: 10px;
  }

  .publish-pricing-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
  }

  .publish-pricing-group .ant-radio-button-wrapper {
    height: 40px;
    line-height: 38px;
    padding: 0 14px;
    border: 1px solid #dfe3ea;
    border-radius: 8px !important;
    color: #4b5563;
    text-align: center;
    font-weight: 700;
    background: #fafafa;
    box-shadow: none;
  }

  .publish-pricing-group .ant-radio-button-wrapper::before {
    display: none;
  }

  .publish-pricing-group .ant-radio-button-wrapper-checked {
    color: #fff;
    border-color: var(--primary-color, #ff4d4f);
    background: var(--primary-color, #ff4d4f);
    box-shadow: 0 8px 18px rgba(255, 77, 79, 0.24);
  }

  .publish-price-box {
    margin-top: 12px;
  }

  .publish-price-input {
    width: 100%;
  }

  .publish-option-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .publish-option-card.active {
    border-color: var(--primary-color, #ff4d4f);
    background: linear-gradient(135deg, rgba(255, 77, 79, 0.08) 0%, #fff 76%);
    box-shadow: inset 0 0 0 1px rgba(255, 77, 79, 0.14);
  }

  .publish-option-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }

  .publish-hint {
    color: #6b7280;
    font-size: 12px;
    line-height: 1.55;
  }
}

.indicator-convert-modal {
  .indicator-convert-box {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .indicator-convert-selector {
    padding: 12px;
    border: 1px solid rgba(239, 68, 68, 0.18);
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.06);
  }

  .field-label {
    display: block;
    color: #334155;
    font-size: 13px;
    font-weight: 700;
  }

  .field-label--spaced {
    margin-top: 4px;
  }

  .indicator-convert-current {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
    border: 1px solid rgba(239, 68, 68, 0.18);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(255, 255, 255, 0.96));
  }

  .indicator-convert-current span {
    display: block;
    margin-bottom: 4px;
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
  }

  .indicator-convert-current strong {
    color: #111827;
    font-size: 16px;
    font-weight: 800;
  }

  .indicator-convert-current small {
    color: #64748b;
    font-size: 12px;
    white-space: nowrap;
  }

  .indicator-convert-note {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 10px 12px;
    border: 1px solid rgba(59, 130, 246, 0.16);
    border-radius: 6px;
    background: rgba(59, 130, 246, 0.06);
    color: #475569;
    font-size: 13px;
    line-height: 1.55;
  }

  .indicator-convert-note .anticon {
    margin-top: 3px;
    color: #2563eb;
  }
}

.code-version-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.code-version-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.code-version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.code-version-item__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.code-version-item__main strong {
  color: #111827;
}

.code-version-item__main span,
.code-version-item__main small {
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-version-item__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.code-version-preview {
  margin-top: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.code-version-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.code-version-preview pre {
  max-height: 360px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.6;
}

.code-version-hidden {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 20px;
  text-align: center;
  color: #64748b;
  background: #0f172a;
}

.code-version-hidden .anticon {
  color: #52c41a;
  font-size: 24px;
}

.code-version-hidden strong {
  color: #e2e8f0;
}

.script-publish-modal--dark,
.indicator-convert-modal--dark,
.script-version-drawer--dark {
  .ant-modal-content,
  .ant-modal-header,
  .ant-modal-footer,
  .ant-drawer-content,
  .ant-drawer-header {
    background: #181818;
    border-color: rgba(255, 255, 255, 0.08);
  }

  .ant-modal-body {
    background: #141414;
  }

  .ant-modal-title,
  .ant-modal-close,
  .ant-drawer-title,
  .ant-drawer-close,
  .publish-section-title,
  .publish-option-head,
  .field-label,
  .code-version-item__main strong {
    color: rgba(255, 255, 255, 0.88);
  }

  .publish-summary-card,
  .indicator-convert-current {
    border-color: rgba(255, 77, 79, 0.32);
    background: linear-gradient(135deg, rgba(255, 77, 79, 0.18) 0%, #1c1c1c 72%);
  }

  .publish-summary-name,
  .indicator-convert-current strong {
    color: rgba(255, 255, 255, 0.9);
  }

  .publish-summary-label,
  .publish-hint,
  .indicator-convert-current span,
  .indicator-convert-current small,
  .code-version-toolbar,
  .code-version-item__main span,
  .code-version-item__main small {
    color: rgba(255, 255, 255, 0.52);
  }

  .publish-note,
  .publish-section,
  .publish-option-card,
  .indicator-convert-selector,
  .indicator-convert-note,
  .code-version-item,
  .code-version-preview {
    border-color: rgba(255, 255, 255, 0.1);
    background: #1f1f1f;
  }

  .publish-option-card.active {
    border-color: var(--primary-color, #ff4d4f);
    background: linear-gradient(135deg, rgba(255, 77, 79, 0.16) 0%, #1f1f1f 78%);
  }

  .code-version-preview__head {
    border-color: rgba(255, 255, 255, 0.08);
    background: #141414;
  }
}
</style>
