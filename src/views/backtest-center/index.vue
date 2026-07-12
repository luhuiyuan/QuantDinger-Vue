<template>
  <div class="backtest-center-page" :class="{ 'theme-dark': isDarkTheme, 'portfolio-mode': isPortfolioAsset }" :style="{ '--primary-color': resolvedPrimaryColor }">
    <aside class="backtest-sidebar" :class="{ 'backtest-sidebar--portfolio': isPortfolioAsset }">
      <div class="sidebar-head">
        <div>
          <strong>{{ copy.title }}</strong>
        </div>
        <a-button size="small" icon="reload" :loading="loadingAssets" @click="loadAssets" />
      </div>

      <div class="sidebar-body">
        <section class="side-config side-config--strategy">
          <div class="section-title"><span class="section-step">1</span><a-icon type="appstore" /><span>{{ copy.selectStrategy }}</span></div>
          <a-select
            v-model="selectedAssetKey"
            class="strategy-select"
            show-search
            :placeholder="copy.strategyPlaceholder"
            :loading="loadingAssets"
            :filter-option="filterAssetOption"
            :dropdown-class-name="isDarkTheme ? 'backtest-strategy-dropdown backtest-strategy-dropdown--dark' : 'backtest-strategy-dropdown'"
            style="width: 100%"
            @change="handleAssetSelectChange">
            <a-select-option v-for="asset in assets" :key="asset.asset_key" :value="asset.asset_key"><span class="asset-opt-tag">{{ assetTypeText(asset.asset_type) }}</span><strong class="asset-opt-name">{{ asset.name }}</strong></a-select-option>
          </a-select>
          <button v-if="selectedAsset && codeParams.length" type="button" class="sidebar-param-link" :aria-expanded="String(paramsExpanded)" @click="paramsExpanded = !paramsExpanded">
            <span><a-icon type="code" />{{ copy.strategyParams }} ({{ codeParams.length }})</span>
            <a-icon :type="paramsExpanded ? 'up' : 'right'" />
          </button>
          <div v-if="selectedAsset && codeParams.length && paramsExpanded" class="strategy-param-dock strategy-param-dock--sidebar side-config--code-params">
            <div class="section-title section-title--between">
              <span><a-icon type="code" />{{ copy.strategyParams }} ({{ codeParams.length }})</span>
              <span>
                <a-tag v-if="hasUnsavedCodeParams" color="orange">{{ copy.unsaved }}</a-tag>
                <a-button type="link" size="small" icon="up" :aria-label="copy.strategyParams" @click="paramsExpanded = false" />
              </span>
            </div>
            <div class="side-param-hint">{{ copy.strategyParamsHint }}</div>
            <div class="side-code-param-list side-code-param-list--dock">
              <div v-for="param in codeParams" :key="param.name" class="side-code-param-row">
                <label><span>{{ param.displayLabel || param.name }}</span><em v-if="param.unit">{{ param.unit }}</em></label>
                <a-switch v-if="param.type === 'boolean'" :checked="!!paramValues[param.name]" @change="value => setParamValue(param.name, value)" />
                <a-input v-else-if="param.type === 'text' || param.type === 'string'" :value="paramValues[param.name]" size="small" @change="event => setParamValue(param.name, event.target.value)" />
                <a-input-number
                  v-else
                  :value="paramValues[param.name]"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step || (param.type === 'integer' ? 1 : 0.01)"
                  :precision="getCodeParamPrecision(param)"
                  size="small"
                  style="width: 100%"
                  @change="value => setParamValue(param.name, value)" />
              </div>
            </div>
            <div class="side-param-actions side-param-actions--dock">
              <a-button size="small" icon="reload" @click="resetCodeParams">{{ copy.resetParams }}</a-button>
              <a-button
                size="small"
                type="primary"
                icon="save"
                :loading="savingCodeVersion"
                :disabled="!canPersistParamsToCode || !hasUnsavedCodeParams"
                @click="saveParamsAsCodeVersion">{{ copy.saveVersion }}</a-button>
            </div>
            <div v-if="!canPersistParamsToCode" class="side-param-hint side-param-hint--warn">{{ paramPersistUnavailableText }}</div>
          </div>
          <a-empty v-if="!loadingAssets && !assets.length" class="empty-inline" :description="copy.noAssets"><a-button size="small" type="primary" @click="goEditor">{{ copy.createAsset }}</a-button></a-empty>
        </section>

        <section v-if="!isPortfolioAsset" class="side-config">
          <div class="section-title"><span class="section-step">2</span><a-icon type="search" /><span>{{ copy.symbol }}</span></div>
          <label class="compact-redundant-label">{{ copy.symbol }}</label>
          <a-select
            v-model="selectedWatchlistKey"
            class="backtest-watchlist-select"
            show-search
            allow-clear
            :placeholder="copy.symbolPlaceholder"
            :loading="loadingWatchlist"
            :filter-option="filterWatchlistOption"
            :dropdown-class-name="isDarkTheme ? 'ide-watchlist-dropdown ide-watchlist-dropdown--dark' : 'ide-watchlist-dropdown'"
            style="width: 100%"
            @change="handleWatchlistChange">
            <a-select-option v-for="w in watchlistOptions" :key="watchlistContextKey(w)" :value="watchlistContextKey(w)">
              <span class="wl-opt-tag" :class="'wl-mkt-' + String(w.market || '').toLowerCase()">{{ marketLabel(w.market) }}</span>
              <strong class="wl-opt-symbol">{{ w.symbol }}</strong>
              <span v-if="w.name" class="wl-opt-name">{{ w.name }}</span>
            </a-select-option>
            <a-select-option key="__add__" value="__add__" class="add-option"><div class="ide-watchlist-add-row"><a-icon type="plus" />{{ copy.addSymbol }}</div></a-select-option>
          </a-select>
          <div class="side-param-hint timeframe-summary"><span>{{ copy.timeframeFromCode }}</span><strong>{{ form.timeframe }}</strong></div>
        </section>

        <section v-if="!isPortfolioAsset" class="side-config">
          <div class="section-title"><span class="section-step">3</span><a-icon type="global" /><span>{{ copy.exchange }}</span></div>
          <label v-if="form.market === 'Crypto'" class="compact-redundant-label">{{ copy.exchange }}</label>
          <a-select v-if="form.market === 'Crypto'" v-model="form.exchangeId" style="width: 100%; margin-bottom: 10px;" @change="handleExchangeChange">
            <a-select-option v-for="exchangeId in cryptoExchangeIds" :key="exchangeId" :value="exchangeId">{{ exchangeId.toUpperCase() }}</a-select-option>
          </a-select>
          <div class="two-cols"><div><label>{{ copy.marketType }}</label><a-select v-model="form.marketType" style="width: 100%" @change="handleMarketTypeChange"><a-select-option value="spot">{{ copy.spot }}</a-select-option><a-select-option value="swap">{{ copy.swap }}</a-select-option></a-select></div><div><label>{{ copy.leverage }}</label><a-input-number
            v-model="form.leverage"
            :min="1"
            :max="isSpotMode ? 1 : 125"
            :step="1"
            :disabled="isSpotMode"
            style="width: 100%" /></div></div>
        </section>

        <section v-if="!isPortfolioAsset" class="side-config">
          <div class="section-title"><span class="section-step">4</span><a-icon type="swap" /><span>{{ copy.direction }}</span></div>
          <label class="compact-redundant-label">{{ copy.direction }}</label>
          <a-radio-group v-model="form.tradeDirection" button-style="solid" class="direction-group"><a-radio-button value="long">{{ copy.long }}</a-radio-button><a-radio-button value="short" :disabled="isSpotMode">{{ copy.short }}</a-radio-button><a-radio-button value="both" :disabled="isSpotMode">{{ copy.both }}</a-radio-button></a-radio-group>
        </section>

        <section v-else class="side-config portfolio-config">
          <div class="section-title"><span class="section-step">2</span><a-icon type="cluster" /><span>{{ copy.portfolioConfig }}</span></div>
          <label>{{ copy.universe }}</label>
          <a-select v-model="form.universeId" :loading="loadingUniverses" style="width: 100%; margin-bottom: 10px;" :placeholder="copy.universePlaceholder">
            <a-select-option v-for="universe in universes" :key="universe.id" :value="universe.id">
              {{ universeLabel(universe) }} · {{ universe.member_count || 0 }}
            </a-select-option>
          </a-select>
          <label>{{ copy.rebalanceFrequency }}</label>
          <a-radio-group v-model="form.rebalanceFrequency" button-style="solid" class="direction-group">
            <a-radio-button value="daily">{{ copy.daily }}</a-radio-button>
            <a-radio-button value="weekly">{{ copy.weekly }}</a-radio-button>
            <a-radio-button value="monthly">{{ copy.monthly }}</a-radio-button>
          </a-radio-group>
          <div class="two-cols portfolio-config__limits">
            <div><label>{{ copy.maxWeight }}</label><a-input-number
              v-model="form.maxWeightPct"
              :min="0.1"
              :max="100"
              :step="1"
              :precision="2"
              style="width: 100%" /></div>
            <div><label>{{ copy.minTradeValue }}</label><a-input-number
              v-model="form.minTradeValue"
              :min="0"
              :step="10"
              :precision="2"
              style="width: 100%" /></div>
          </div>
          <div class="portfolio-config__switch"><span>{{ copy.allowFractional }}</span><a-switch v-model="form.allowFractional" /></div>
          <div class="side-param-hint">{{ copy.portfolioLongOnlyHint }}</div>
        </section>

        <section class="side-config side-config--capital">
          <div class="section-title"><span class="section-step">{{ isPortfolioAsset ? 3 : 5 }}</span><a-icon type="wallet" /><span>{{ copy.capital }}</span></div>
          <label>{{ copy.initialCapital }}</label>
          <a-input-number
            v-model="form.initialCapital"
            :min="10"
            :max="1000000"
            :step="1000"
            :precision="2"
            style="width: 100%"
            :formatter="moneyFormatter"
            :parser="moneyParser" />
        </section>

        <section class="side-config side-config--costs">
          <div class="section-title"><span class="section-step">{{ isPortfolioAsset ? 4 : 6 }}</span><a-icon type="percentage" /><span>{{ copy.commission }} / {{ copy.slippage }}</span></div>
          <button type="button" class="advanced-toggle" :aria-expanded="String(costsExpanded)" @click="costsExpanded = !costsExpanded">
            <span>{{ fmtNum(form.commissionPct) }}% / {{ fmtNum(form.slippagePct) }}%</span>
            <a-icon :type="costsExpanded ? 'up' : 'down'" />
          </button>
          <div v-if="costsExpanded" class="advanced-costs">
            <div class="two-cols"><div><label>{{ copy.commission }}</label><a-input-number
              v-model="form.commissionPct"
              :min="0"
              :max="10"
              :step="0.01"
              :precision="4"
              style="width: 100%" /></div><div><label>{{ copy.slippage }}</label><a-input-number
                v-model="form.slippagePct"
                :min="0"
                :max="10"
                :step="0.01"
                :precision="4"
                style="width: 100%" /></div></div>
            <div v-if="!isSpotMode" class="two-cols funding-fields"><div><label>{{ copy.fundingRateAnnual }}</label><a-input-number
              v-model="form.fundingRateAnnual"
              :min="-100"
              :max="100"
              :step="0.01"
              :precision="4"
              style="width: 100%" /></div><div><label>{{ copy.fundingIntervalHours }}</label><a-input-number
                v-model="form.fundingIntervalHours"
                :min="1"
                :max="24"
                :step="1"
                :precision="0"
                style="width: 100%" /></div></div>
          </div>
        </section>

        <section class="side-config side-config--range">
          <div class="section-title"><span class="section-step">{{ isPortfolioAsset ? 5 : 7 }}</span><a-icon type="line-chart" /><span>{{ copy.backtestRange }}</span></div>
          <div class="date-presets"><a-button v-for="preset in datePresets" :key="preset.days" size="small" :type="activePresetDays === preset.days ? 'primary' : 'default'" @click="applyPreset(preset.days)">{{ preset.label }}</a-button></div>
          <div class="date-row"><div><label>{{ copy.startDate }}</label><a-date-picker v-model="startDate" format="YYYY-MM-DD" :allow-clear="false" style="width: 100%" @change="onDateRangeChange" /></div><div><label>{{ copy.endDate }}</label><a-date-picker v-model="endDate" format="YYYY-MM-DD" :allow-clear="false" style="width: 100%" @change="onDateRangeChange" /></div></div>
        </section>
      </div>
      <div class="run-actions sidebar-runbar"><a-button
        type="primary"
        icon="thunderbolt"
        block
        :loading="running"
        :disabled="!selectedAsset"
        @click="runBacktest">{{ copy.runBacktest }}</a-button></div>
    </aside>

    <main class="backtest-main">
      <section class="current-card current-card--compact">
        <div class="section-title"><a-icon type="appstore" /><span>{{ copy.currentStrategy }}</span></div>
        <div v-if="selectedAsset" class="selected-asset selected-asset--compact"><div class="selected-asset__main"><a-tag class="asset-type-tag">{{ assetTypeText(selectedAsset.asset_type) }}</a-tag><strong>{{ selectedAsset.name }}</strong><p v-if="selectedAssetDescription">{{ selectedAssetDescription }}</p></div><div class="selected-asset__actions"><span class="selected-asset__meta">{{ marketContextSummary }} / {{ form.timeframe }}</span><a-button size="small" icon="history" :loading="historyLoading" @click="openHistoryDrawer">{{ copy.history }}</a-button></div></div>
        <a-empty v-if="!selectedAsset" class="empty-inline" :description="copy.selectStrategyFirst" />
      </section>

      <div class="result-split-workbench">
        <section class="result-split-panel result-split-panel--backtest">
          <div class="workbench-panel-header"><div class="workbench-panel-title"><a-icon type="bar-chart" /><span>{{ copy.resultOverview }}</span></div><div v-if="selectedAsset" class="workbench-panel-meta">{{ form.symbol }} / {{ form.timeframe }}</div></div>
          <div class="workbench-panel-body">
            <div v-if="running" class="result-running"><a-spin size="large" /><div class="running-time">{{ copy.running }}</div></div>
            <div v-else-if="!hasResult" class="result-empty"><a-icon type="bar-chart" /><p>{{ copy.emptyResult }}</p></div>
            <div v-else class="result-data result-data--workbench">
              <div class="backtest-workbench">
                <div class="backtest-workbench-main">
                  <a-alert
                    v-if="dataRangeNotice"
                    class="data-range-notice"
                    type="warning"
                    show-icon
                    :message="dataRangeNotice.title"
                    :description="dataRangeNotice.description" />
                  <div class="backtest-overview-head">
                    <div class="backtest-verdict-copy">
                      <div class="backtest-overview-kicker">{{ form.symbol }} / {{ form.timeframe }}</div>
                      <div class="backtest-overview-title">{{ backtestInsight }}</div>
                      <span v-if="sampleDiagnostic" class="backtest-overview-note">{{ sampleDiagnostic.title }} · {{ sampleDiagnostic.value }}</span>
                    </div>
                  </div>
                  <div class="metrics-grid metrics-grid--workbench">
                    <div v-for="m in headlineMetricCards" :key="m.label" :class="['metric-card', m.cls]">
                      <div class="metric-label">{{ m.label }}</div>
                      <div class="metric-value">{{ m.value }}</div>
                      <div v-if="m.hint" class="metric-hint">{{ m.hint }}</div>
                    </div>
                  </div>
                  <div v-if="hasZeroTradeResult" class="zero-trade-warning">
                    <a-icon type="info-circle" />
                    <span>{{ copy.zeroTradeWarning }}</span>
                  </div>
                  <div v-if="backtestDiagnostics.length" class="backtest-quality-strip">
                    <span class="backtest-quality-strip__title">
                      <a-icon type="safety-certificate" />
                      {{ copy.diagnostics }}
                    </span>
                    <span v-for="item in backtestDiagnostics" :key="item.key" :class="['backtest-quality-chip', 'backtest-quality-chip--' + item.tone]">
                      <a-icon :type="item.icon" />
                      <span>{{ item.title }}</span>
                      <strong>{{ item.value }}</strong>
                    </span>
                  </div>
                  <div class="eq-section eq-section--hero">
                    <div class="eq-title">
                      <a-icon type="area-chart" />
                      {{ copy.equityCurve }}
                    </div>
                    <div class="equity-chart equity-chart--large">
                      <div v-show="equitySeries.length > 1" ref="equityChart" class="equity-echart"></div>
                      <div v-if="equitySeries.length <= 1" class="chart-empty">{{ copy.noCurve }}</div>
                    </div>
                  </div>
                  <nav class="result-view-tabs" :aria-label="copy.resultOverview">
                    <button type="button" :class="{ active: resultSection === 'trades' }" @click="setResultSection('trades')"><a-icon type="swap" />{{ copy.trades }}</button>
                    <button v-if="replayActionTotal > 0" type="button" :class="{ active: resultSection === 'replay' }" @click="setResultSection('replay')"><a-icon type="stock" />{{ copy.tradeReplay }}</button>
                    <button type="button" :class="{ active: resultSection === 'diagnostics' }" @click="setResultSection('diagnostics')"><a-icon type="safety-certificate" />{{ copy.diagnostics }}</button>
                    <button type="button" :class="{ active: resultSection === 'audit' }" @click="setResultSection('audit')"><a-icon type="file-done" />{{ bt('backtest-center.audit.title', '') }}</button>
                    <button type="button" @click="openHistoryDrawer"><a-icon type="history" />{{ copy.history }}</button>
                  </nav>
                  <div v-show="resultSection === 'replay' && replayActionTotal > 0" class="replay-section result-view-panel">
                    <div class="eq-title">
                      <a-icon type="stock" />
                      {{ copy.tradeReplay }}
                      <span class="trades-count">({{ replayActionTotal }})</span>
                    </div>
                    <div class="replay-chart">
                      <div v-if="replayKlinesLoading" class="chart-empty"><a-spin size="large" /><span>{{ copy.running }}</span></div>
                      <div v-show="replayCandles.length" ref="replayChart" class="replay-echart"></div>
                      <div v-if="!replayKlinesLoading && !replayCandles.length" class="chart-empty">{{ copy.noReplayData }}</div>
                    </div>
                  </div>
                  <div v-show="resultSection === 'trades' && isPortfolioStrategy" class="trades-section trades-section--workbench result-view-panel portfolio-results">
                    <div class="trades-title"><a-icon type="retweet" />{{ copy.rebalances }}<span class="trades-count">({{ portfolioRebalances.length }})</span></div>
                    <a-table
                      class="trades-table"
                      :columns="portfolioRebalanceColumns"
                      :data-source="portfolioRebalances"
                      :pagination="{ pageSize: 6, size: 'small' }"
                      size="small"
                      :scroll="{ x: 880 }"
                      row-key="rowKey">
                      <template slot="time" slot-scope="text"><span class="mono">{{ formatTradeTime(text) }}</span></template>
                      <template slot="percent" slot-scope="text"><span class="mono">{{ fmtPct(Number(text || 0) * 100) }}</span></template>
                      <template slot="weights" slot-scope="text"><span class="portfolio-weight-list">{{ portfolioWeightText(text) }}</span></template>
                    </a-table>
                    <div class="trades-title portfolio-orders-title"><a-icon type="swap" />{{ copy.orders }}<span class="trades-count">({{ portfolioOrders.length }})</span></div>
                    <a-table
                      class="trades-table"
                      :columns="portfolioOrderColumns"
                      :data-source="portfolioOrders"
                      :pagination="{ pageSize: 8, size: 'small' }"
                      size="small"
                      :scroll="{ x: 1080 }"
                      row-key="rowKey">
                      <template slot="side" slot-scope="text, record"><a-tag v-if="record.status === 'filled'" :color="text === 'buy' ? 'green' : 'red'">{{ text === 'buy' ? copy.buy : copy.sell }}</a-tag><span v-else>-</span></template>
                      <template slot="price" slot-scope="text"><span class="mono">{{ fmtPrice(text) }}</span></template>
                      <template slot="money" slot-scope="text"><span class="mono">{{ fmtMoney(text) }}</span></template>
                      <template slot="time" slot-scope="text"><span class="mono">{{ formatTradeTime(text) }}</span></template>
                    </a-table>
                  </div>
                  <div v-show="resultSection === 'trades' && !isPortfolioStrategy" class="trades-section trades-section--workbench result-view-panel">
                    <div class="trades-title">
                      <a-icon type="swap" />
                      {{ copy.trades }}
                      <span class="trades-count">({{ pairedTrades.length }})</span>
                    </div>
                    <a-table
                      class="trades-table"
                      :columns="tradeColumnsV2"
                      :data-source="pairedTrades"
                      :pagination="{ pageSize: 8, size: 'small' }"
                      size="small"
                      :scroll="{ x: 1180 }"
                      row-key="id">
                      <template slot="tradeNo" slot-scope="text"><span class="mono">#{{ text }}</span></template>
                      <template slot="side" slot-scope="text"><a-tag :color="text === 'short' ? 'red' : 'green'" style="margin: 0;">{{ text === 'short' ? copy.short : copy.long }}</a-tag></template>
                      <template slot="closeReason" slot-scope="text"><a-tag :color="closeReasonTone(text)" style="margin: 0;">{{ closeReasonText(text) }}</a-tag></template>
                      <template slot="price" slot-scope="text"><span class="mono">{{ fmtPrice(text) }}</span></template>
                      <template slot="time" slot-scope="text"><span class="mono">{{ formatTradeTime(text) }}</span></template>
                      <template slot="balance" slot-scope="text"><span class="mono">{{ fmtMoney(text) }}</span></template>
                      <template slot="profit" slot-scope="text"><span :class="['mono', Number(text) >= 0 ? 'positive-text' : 'negative-text']">{{ fmtMoney(text) }}</span></template>
                    </a-table>
                  </div>
                  <div v-show="resultSection === 'diagnostics'" class="diagnostic-detail result-view-panel">
                    <div v-for="item in backtestDiagnostics" :key="item.key" :class="['diagnostic-detail__row', 'diagnostic-detail__row--' + item.tone]">
                      <span><a-icon :type="item.icon" />{{ item.title }}</span>
                      <strong>{{ item.value }}</strong>
                    </div>
                    <div class="secondary-metrics">
                      <div v-for="m in secondaryMetricCards" :key="m.label"><span>{{ m.label }}</span><strong :class="m.cls">{{ m.value }}</strong></div>
                    </div>
                  </div>
                  <div v-show="resultSection === 'audit'" class="professional-audit result-view-panel">
                    <div class="professional-audit__head">
                      <div>
                        <strong>{{ bt('backtest-center.audit.title', '') }}</strong>
                        <span>{{ bt('backtest-center.audit.redesignedSubtitle', '') }}</span>
                      </div>
                    </div>
                    <div class="professional-audit__grid professional-audit__grid--summary">
                      <div v-for="card in auditSummaryCards" :key="card.key" :class="['audit-summary-card', 'audit-summary-card--' + card.status]">
                        <div class="audit-summary-card__head">
                          <span>
                            <a-icon :type="card.icon" />
                            <strong>{{ card.title }}</strong>
                          </span>
                          <em>{{ card.badge }}</em>
                        </div>
                        <div class="audit-summary-card__value">{{ card.value }}</div>
                        <div class="audit-summary-card__desc">{{ card.desc }}</div>
                        <div v-if="card.rows && card.rows.length" class="audit-summary-card__rows">
                          <div v-for="row in card.rows" :key="row.label" :class="['audit-summary-card__row', row.tone ? 'audit-summary-card__row--' + row.tone : '']">
                            <span>{{ row.label }}</span>
                            <strong>{{ row.value }}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="robustnessLabEnabled" class="result-split-panel result-split-panel--optimizer">
          <div class="workbench-panel-header">
            <div class="workbench-panel-title">
              <a-icon type="experiment" />
              <span>{{ copy.smartTune }}</span>
            </div>
          </div>
          <div class="workbench-panel-body">
            <div v-if="!canTuneBacktest" class="result-empty result-empty--compact">
              <a-icon type="experiment" />
              <p>{{ copy.tuneEmpty }}</p>
            </div>
            <div v-else class="ide-tuning-launch">
              <div class="ide-tune-pills">
                <button
                  v-for="opt in tuneMethodOptions"
                  :key="opt.value"
                  type="button"
                  class="ide-tune-pill"
                  :class="{ active: structuredTuneMethod === opt.value }"
                  :disabled="experimentRunning"
                  @click="structuredTuneMethod = opt.value"
                >
                  <a-icon :type="opt.icon" />
                  <span>{{ opt.label }}</span>
                </button>
              </div>

              <div class="ide-tune-dimensions">
                <div class="ide-tune-dimensions-summary">
                  <span>
                    <a-icon type="appstore" />
                    {{ copy.tunableDimensions }}
                  </span>
                  <strong>{{ enabledSweepDimensions.length }} / {{ experimentSweepDimensions.length }}</strong>
                </div>
                <div v-if="!experimentSweepDimensions.length" class="ide-tune-dimensions-empty">
                  {{ copy.tuneEmpty }}
                </div>
                <div v-else class="ide-tune-dimensions-list">
                  <label
                    v-for="d in experimentSweepDimensions"
                    :key="d.key"
                    class="ide-tune-dim-row"
                    :class="{ 'is-disabled': !d.enabled }"
                  >
                    <input
                      type="checkbox"
                      class="ide-tune-dim-check"
                      :checked="d.enabled"
                      :disabled="experimentRunning"
                      @change="toggleSweepDimension(d.key)"
                    >
                    <span class="ide-tune-dim-label">{{ d.displayLabel || d.label }}</span>
                    <span class="ide-tune-dim-count">x{{ d.values.length }}</span>
                    <span class="ide-tune-dim-values">{{ formatSweepValues(d.displayValues || d.values) }}</span>
                  </label>
                </div>
              </div>

              <a-button
                type="primary"
                block
                icon="thunderbolt"
                :loading="experimentRunning"
                :disabled="!selectedAsset || !enabledSweepDimensions.length"
                @click="runStructuredTune"
              >
                {{ copy.execute }}
              </a-button>

              <div v-if="hasExperimentResult" class="experiment-results">
                <div class="experiment-best-card">
                  <div class="experiment-best-score">
                    <span>R1</span>
                    <strong>{{ formatScore(experimentBestScore) }}</strong>
                    <em>{{ experimentBestGrade }}</em>
                  </div>
                  <div class="experiment-best-copy">
                    <strong>{{ copy.bestStrategyOutput }}</strong>
                    <p>{{ experimentBestSummary }}</p>
                    <p v-if="experimentOosMeta.enabled" class="experiment-oos-line">{{ experimentBestOosSummary }}</p>
                  </div>
                </div>
                <div v-if="experimentBest" class="experiment-best-actions">
                  <a-button size="small" type="primary" icon="check" @click="applyTuneResult(experimentBest)">{{ copy.applyBestParams }}</a-button>
                  <a-button size="small" icon="thunderbolt" @click="runBacktestWithTuneCandidate(experimentBest)">{{ copy.backtestCandidate }}</a-button>
                  <a-button size="small" icon="save" :loading="savingCodeVersion" :disabled="!canPersistParamsToCode" @click="applyTuneResultAndSave(experimentBest)">{{ copy.applySaveVersion }}</a-button>
                </div>
                <div v-if="experimentSplitCards.length" class="experiment-split-grid">
                  <div v-for="card in experimentSplitCards" :key="card.key" class="experiment-split-card">
                    <div class="experiment-split-card__head">
                      <strong>{{ card.title }}</strong>
                      <span>{{ card.range }}</span>
                    </div>
                    <div class="experiment-split-metrics">
                      <div v-for="metric in card.metrics" :key="metric.label">
                        <span>{{ metric.label }}</span>
                        <strong :class="metric.cls">{{ metric.value }}</strong>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="experiment-candidate-grid">
                  <button
                    v-for="candidate in experimentCandidateCards"
                    :key="candidate.name"
                    type="button"
                    class="experiment-candidate-card"
                    :class="{ active: experimentSelectedCandidate && experimentSelectedCandidate.name === candidate.name }"
                    @click="selectExperimentCandidate(candidate.raw)"
                  >
                    <span>{{ candidate.name }}</span>
                    <strong>{{ formatScore(candidate.score) }}</strong>
                    <em>{{ candidate.grade }}</em>
                    <small>{{ candidate.summary }}</small>
                  </button>
                </div>
                <div v-if="experimentSelectedCandidate" class="experiment-selected-detail">
                  <div class="experiment-selected-head">
                    <div>
                      <strong>{{ experimentSelectedCandidate.name || copy.candidateParams }}</strong>
                      <span>{{ copy.paramChangeScore }}</span>
                    </div>
                    <div class="experiment-selected-actions">
                      <a-button size="small" @click="applyTuneResult(experimentSelectedCandidate)">{{ copy.applyCandidate }}</a-button>
                      <a-button size="small" icon="thunderbolt" @click="runBacktestWithTuneCandidate(experimentSelectedCandidate)">{{ copy.backtest }}</a-button>
                    </div>
                  </div>
                  <div class="experiment-change-list">
                    <div v-for="entry in experimentSelectedChangeEntries" :key="entry.name" class="experiment-change-row">
                      <span>{{ entry.label }}</span>
                      <strong>{{ entry.before }}</strong>
                      <a-icon class="experiment-change-arrow" type="arrow-right" />
                      <strong>{{ entry.after }}</strong>
                    </div>
                    <div v-if="!experimentSelectedChangeEntries.length" class="experiment-change-empty">{{ copy.noCandidateParamChanges }}</div>
                  </div>
                  <div class="experiment-score-grid">
                    <div v-for="item in experimentSelectedScoreComponents" :key="item.key" class="experiment-score-item">
                      <span>{{ item.label }}</span>
                      <strong>{{ formatScore(item.value) }}</strong>
                    </div>
                  </div>
                </div>
                <div v-if="experimentRankingRows.length" class="experiment-ranking-section">
                  <div class="experiment-ranking-head">
                    <strong>{{ copy.candidateRanking }}</strong>
                    <span>{{ copy.candidateRankingHint }}</span>
                  </div>
                  <div class="experiment-ranking-table">
                    <button
                      v-for="row in experimentRankingRows"
                      :key="row.name"
                      type="button"
                      class="experiment-ranking-row"
                      :class="{ active: experimentSelectedCandidate && experimentSelectedCandidate.name === row.name }"
                      @click="selectExperimentCandidate(row.raw)"
                    >
                      <span class="mono">#{{ row.rank }}</span>
                      <strong>{{ row.name }}</strong>
                      <em>{{ row.grade }}</em>
                      <span>{{ formatScore(row.score) }}</span>
                      <span :class="row.returnCls">{{ row.returnText }}</span>
                      <span>{{ row.drawdownText }}</span>
                      <span>{{ row.tradesText }}</span>
                    </button>
                  </div>
                </div>
                <div class="experiment-analytics-grid">
                  <div class="experiment-analytics-card">
                    <strong>{{ copy.convergence }}</strong>
                    <div class="mini-bars">
                      <i v-for="point in experimentConvergenceData" :key="point.index" :style="{ height: point.height + '%' }"></i>
                    </div>
                  </div>
                  <div class="experiment-analytics-card">
                    <strong>{{ copy.isOos }}</strong>
                    <div class="oos-matrix">
                      <span v-for="point in experimentOosMatrixData" :key="point.name" :class="'tone-' + point.tone">{{ point.name }}</span>
                    </div>
                  </div>
                  <div class="experiment-analytics-card">
                    <strong>{{ copy.sensitivity }}</strong>
                    <div v-for="item in experimentParameterSensitivityData" :key="item.name" class="sensitivity-row">
                      <span>{{ item.label }}</span>
                      <em><i :style="{ width: item.width + '%' }"></i></em>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="false && tuneBest" class="tune-best-card">
                <span>{{ copy.bestParams }}</span>
                <strong>{{ fmtPct(tuneBest.totalReturn) }}</strong>
                <button type="button" :disabled="savingCodeVersion || !canPersistParamsToCode" @click="applyTuneResultAndSave(tuneBest)">
                  {{ copy.applySaveVersion }}
                </button>
                <button type="button" @click="applyTuneResult(tuneBest)">{{ copy.apply }}</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <a-drawer
      :title="copy.history"
      :visible="historyDrawerVisible"
      width="min(960px, calc(100vw - 32px))"
      :body-style="{ padding: '16px', overflow: 'auto' }"
      :destroy-on-close="false"
      :wrap-class-name="isDarkTheme ? 'backtest-history-drawer backtest-history-drawer--dark' : 'backtest-history-drawer'"
      @close="historyDrawerVisible = false"
    >
      <a-table
        class="history-table"
        size="small"
        row-key="id"
        :loading="historyLoading"
        :columns="historyColumns"
        :data-source="historyRows"
        :pagination="{ pageSize: 12, size: 'small' }"
        :scroll="{ x: 900 }"
      >
        <template slot="return" slot-scope="text">
          <span :class="['mono', Number(text) >= 0 ? 'positive-text' : 'negative-text']">{{ fmtPct(text) }}</span>
        </template>
        <template slot="status" slot-scope="text">
          <a-tag :color="String(text).toLowerCase() === 'success' ? 'green' : 'red'">{{ text || '-' }}</a-tag>
        </template>
        <template slot="historyTime" slot-scope="text">
          <span class="mono">{{ formatTradeTime(text) }}</span>
        </template>
        <template slot="action" slot-scope="text, record">
          <a-button size="small" type="link" @click="viewHistoryRun(record)">{{ copy.viewDetail }}</a-button>
        </template>
      </a-table>
    </a-drawer>

    <a-modal
      :title="copy.addSymbolTitle"
      :visible="showAddModal"
      :ok-text="copy.add"
      :cancel-text="copy.cancel"
      :confirm-loading="addingStock"
      width="560px"
      :wrap-class-name="isDarkTheme ? 'ide-modal-wrap ide-modal-wrap--dark' : 'ide-modal-wrap'"
      @ok="handleAddStock"
      @cancel="closeAddModal"
    >
      <a-tabs v-model="addMarketTab" size="small" class="ide-add-market-tabs" @change="onAddMarketTabChange">
        <a-tab-pane key="Crypto" :tab="copy.crypto" />
        <a-tab-pane key="USStock" :tab="copy.usStock" />
        <a-tab-pane key="CNStock" :tab="copy.cnStock" />
        <a-tab-pane key="HKStock" :tab="copy.hkStock" />
        <a-tab-pane key="Forex" :tab="copy.forex" />
      </a-tabs>

      <div v-if="addMarketTab === 'Crypto'" class="add-symbol-source-row">
        <a-select v-model="form.exchangeId" style="width: 50%;" @change="onAddSourceChange">
          <a-select-option v-for="exchangeId in cryptoExchangeIds" :key="exchangeId" :value="exchangeId">
            {{ exchangeId.toUpperCase() }}
          </a-select-option>
        </a-select>
        <a-select v-model="form.marketType" style="width: 50%;" @change="onAddSourceChange">
          <a-select-option value="spot">{{ marketTypeLabel('spot') }}</a-select-option>
          <a-select-option value="swap">{{ marketTypeLabel('swap') }}</a-select-option>
        </a-select>
      </div>

      <a-input-search
        v-model="addSearchKeyword"
        :placeholder="copy.addSymbolSearchPlaceholder"
        :loading="addSearching"
        size="large"
        allow-clear
        style="margin: 12px 0;"
        @search="doAddSearch"
        @change="onAddSearchInput"
      />

      <a-list
        v-if="addSearchResults.length > 0"
        size="small"
        :data-source="addSearchResults"
        class="add-symbol-results"
      >
        <a-list-item
          slot="renderItem"
          slot-scope="item"
          class="add-symbol-row"
          :class="{ active: addSelectedItem && addSelectedItem.symbol === item.symbol }"
          @click="addSelectedItem = item"
        >
          <div>
            <strong>{{ item.symbol }}</strong>
            <span v-if="item.name">{{ item.name }}</span>
          </div>
          <a-tag>{{ marketLabel(item.market || addMarketTab) }}</a-tag>
        </a-list-item>
      </a-list>

      <div v-if="addSearchResults.length === 0 && addSearchKeyword && addSearched" class="add-symbol-empty">
        {{ copy.noSearchResult }}
      </div>
    </a-modal>
  </div>
</template>

<script>
import * as echarts from 'echarts'
import moment from 'moment'
import { mapState } from 'vuex'
import {
  getStrategyAssetList,
  getUnifiedBacktestHistory,
  getUnifiedBacktestRun,
  runUnifiedBacktest,
  tuneUnifiedBacktest,
  updateScriptSource
} from '@/api/strategy'
import { getWatchlist, addWatchlist, searchSymbols } from '@/api/market'
import { getUniverses } from '@/api/universe'
import { CRYPTO_EXCHANGE_IDS, marketContextKey } from '@/utils/marketContext'
import request, { BACKTEST_TIMEOUT } from '@/utils/request'
import {
  extractScriptParamsFromCode,
  buildScriptCodeWithParamValues,
  buildTemplateParamValues,
  buildRuntimeParamValues
} from '@/views/strategy-ide/components/scriptTemplateCatalog'

export default {
  name: 'BacktestCenter',
  data () {
    return {
      loadingAssets: false,
      loadingWatchlist: false,
      loadingUniverses: false,
      assets: [],
      universes: [],
      watchlist: [],
      tunedCodeByAssetKey: {},
      selectedAssetKey: '',
      selectedWatchlistKey: 'Crypto:binance:swap::BTC/USDT',
      cryptoExchangeIds: CRYPTO_EXCHANGE_IDS,
      paramValues: {},
      paramsExpanded: false,
      costsExpanded: false,
      resultSection: 'trades',
      showAddModal: false,
      addMarketTab: 'Crypto',
      addSearchKeyword: '',
      addSearchResults: [],
      addSelectedItem: null,
      addSearching: false,
      addSearched: false,
      addingStock: false,
      addSearchTimer: null,
      startDate: moment().subtract(30, 'days'),
      endDate: moment(),
      activePresetDays: 30,
      running: false,
      result: null,
      historyDrawerVisible: false,
      historyLoading: false,
      historyRows: [],
      structuredTuneMethod: 'grid',
      experimentRunning: false,
      experimentRunKind: 'structured',
      experimentLiveHint: '',
      experimentResult: null,
      experimentError: '',
      experimentSelectedCandidateName: '',
      experimentCurrentRound: 0,
      experimentMaxRounds: 0,
      lastAppliedExperimentCandidateName: '',
      lastAppliedExperimentChanges: [],
      savingCodeVersion: false,
      disabledSweepKeys: [],
      tuneResults: [],
      equityChartInstance: null,
      equityResizeHandler: null,
      equityRenderTimer: null,
      replayKlines: [],
      replayKlinesLoading: false,
      replayKlineRequestKey: '',
      replayChartInstance: null,
      robustnessLabEnabled: false,
      replayResizeHandler: null,
      timeframes: ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'],
      form: {
        symbol: 'BTC/USDT',
        market: 'Crypto',
        exchangeId: 'binance',
        timeframe: '1D',
        marketType: 'swap',
        initialCapital: 10000,
        leverage: 1,
        tradeDirection: 'long',
        commissionPct: 0.05,
        slippagePct: 0.05,
        fundingRateAnnual: 0,
        fundingIntervalHours: 8,
        strictMode: true,
        intrabarMode: 'conservative',
        universeId: undefined,
        rebalanceFrequency: 'weekly',
        maxWeightPct: 10,
        minTradeValue: 0,
        allowFractional: true,
        risk: {
          entryPct: 1,
          stopLossPct: 0,
          takeProfitPct: 0,
          trailingEnabled: false,
          trailingStopPct: 0,
          trailingActivationPct: 0,
          maxHoldingBars: 0,
          exitOwner: 'engine'
        }
      }
    }
  },
  computed: {
    ...mapState({
      navTheme: state => state.app.theme,
      primaryColor: state => state.app.color
    }),
    resolvedPrimaryColor () {
      return /^#[0-9a-f]{6}$/i.test(String(this.primaryColor || '')) ? this.primaryColor : '#52c41a'
    },
    isZh () {
      return String((this.$i18n && this.$i18n.locale) || '').toLowerCase().startsWith('zh')
    },
    isDarkTheme () {
      const body = typeof document !== 'undefined' ? document.body : null
      return this.navTheme === 'dark' ||
        this.navTheme === 'realdark' ||
        !!(body && (body.classList.contains('dark') || body.classList.contains('realdark')))
    },
    userId () {
      const user = this.$store && this.$store.state && this.$store.state.user
      return (user && (user.id || user.userId || user.user_id || (user.info && (user.info.id || user.info.user_id)))) || 1
    },
    copy () {
      const keys = [
        'kicker', 'title', 'workspace', 'all', 'indicator', 'script', 'bot', 'portfolioStrategy',
        'searchAsset', 'noAssets', 'createAsset', 'selectStrategy',
        'strategyPlaceholder', 'currentStrategy', 'selectStrategyFirst',
        'noDescription', 'history', 'engine', 'paramsCount', 'marketConfig',
        'backtestParams', 'symbol', 'symbolPlaceholder', 'addSymbol', 'market',
        'crypto', 'usStock', 'cnStock', 'hkStock', 'forex', 'timeframe',
        'timeframeFromCode', 'exchange', 'marketType', 'spot', 'swap', 'capital',
        'initialCapital', 'leverage', 'direction', 'long', 'short', 'both',
        'commission', 'slippage', 'fundingRateAnnual', 'fundingIntervalHours',
        'intrabarMode', 'intrabarConservative', 'intrabarBalanced',
        'intrabarAggressive', 'strictMode', 'strictOnHint', 'strictOffHint',
        'codeParams', 'resetParams', 'noCodeParams', 'strategyParams',
        'unsaved', 'strategyParamsHint', 'saveVersion', 'backtestRange',
        'startDate', 'endDate', 'runBacktest', 'resultOverview', 'running',
        'emptyResult', 'zeroTradeWarning', 'dataRangeAdjustedTitle', 'dataRangeAdjustedDescription', 'diagnostics', 'equityCurve',
        'strategyEquity', 'strategyEquityShort', 'spotBenchmark', 'vsSpot',
        'noCurve', 'tradeReplay', 'noReplayData', 'zoomIn', 'zoomOut', 'resetZoom',
        'openShort', 'highShort', 'lowShort', 'closeShort',
        'openAction', 'closeAction',
        'addAction', 'reduceAction', 'trades', 'smartTune', 'tunableDimensions', 'execute',
        'bestParams', 'apply', 'viewDetail', 'addSymbolTitle', 'add', 'cancel',
        'addSymbolSearchPlaceholder', 'noSearchResult', 'symbolRequired',
        'addSuccess', 'refreshHistory', 'codeHidden', 'paramDetected',
        'paramEmpty', 'goEditor', 'selectAssetFirst', 'tuneEmpty',
        'tuneApplied', 'tuneNoTrade', 'paramsSaved', 'saveVersionFailed',
        'noCodeToSave', 'paramsAlreadySaved', 'bestStrategyOutput',
        'applyBestParams', 'backtestCandidate', 'applySaveVersion',
        'candidateParams', 'paramChangeScore', 'applyCandidate', 'backtest',
        'noCandidateParamChanges', 'candidateRanking', 'candidateRankingHint',
        'convergence', 'isOos', 'sensitivity', 'portfolioConfig', 'universe',
        'universePlaceholder', 'rebalanceFrequency', 'daily', 'weekly', 'monthly',
        'maxWeight', 'minTradeValue', 'allowFractional', 'portfolioLongOnlyHint',
        'rebalances', 'orders', 'buy', 'sell', 'signalDate', 'executionDate',
        'grossExposure', 'cashWeight', 'targetWeights', 'quantity', 'price',
        'notional', 'fees', 'status', 'annualReturn', 'volatility', 'turnover',
        'averagePositions'
      ]
      return keys.reduce((acc, key) => {
        acc[key] = this.bt(`backtest-center.${key}`, key)
        return acc
      }, {})
    },
    datePresets () {
      const presets = [
        { days: 30, key: '30d' },
        { days: 90, key: '90d' },
        { days: 180, key: '180d' },
        { days: 365, key: '1y' },
        { days: 730, key: '2y' },
        { days: 1095, key: '3y' }
      ].map(item => ({
        days: item.days,
        label: this.bt(`backtest-center.presets.${item.key}`, item.key)
      }))
      return presets.filter(item => Number(item.days || 0) <= this.maxBacktestDays)
    },
    isSpotMode () {
      return this.form.marketType === 'spot'
    },
    marketContextSummary () {
      if (this.isPortfolioAsset) {
        const universe = (this.universes || []).find(item => Number(item.id) === Number(this.form.universeId))
        return `${this.universeLabel(universe)} / ${this.copy[this.form.rebalanceFrequency] || this.form.rebalanceFrequency}`
      }
      if (this.form.market !== 'Crypto') return this.form.symbol
      return `${String(this.form.exchangeId || '').toUpperCase()} · ${this.marketTypeLabel(this.form.marketType)} · ${this.form.symbol}`
    },
    riskCopy () {
      const t = key => this.bt(`backtest-center.risk.${key}`, key)
      return {
        title: t('title'),
        codeDefault: t('codeDefault'),
        hint: t('hint'),
        entryPct: t('entryPct'),
        stopLossPct: t('stopLossPct'),
        takeProfitPct: t('takeProfitPct'),
        trailingEnabled: t('trailingEnabled'),
        trailingHint: t('trailingHint'),
        trailingStopPct: t('trailingStopPct'),
        trailingActivationPct: t('trailingActivationPct'),
        maxHoldingBars: t('maxHoldingBars')
      }
    },
    strategyRiskSource () {
      return this.hasCodeOwnedRiskControls ? 'code' : 'manual'
    },
    maxBacktestDays () {
      return this.getMaxBacktestDays(this.form.timeframe)
    },
    selectedAsset () {
      return (this.assets || []).find(asset => asset.asset_key === this.selectedAssetKey) || null
    },
    isPortfolioAsset () {
      return !!(this.selectedAsset && this.selectedAsset.asset_type === 'portfolio_strategy')
    },
    isPortfolioStrategy () {
      const runType = String((this.result && (this.result.runType || this.result.run_type)) || '').toLowerCase()
      return this.isPortfolioAsset || runType === 'portfolio_strategy'
    },
    selectedAssetDescription () {
      const asset = this.selectedAsset
      if (!asset) return ''
      return String(asset.description || asset.summary || asset.subtitle || '').trim()
    },
    watchlistOptions () {
      const rows = Array.isArray(this.watchlist) ? [...this.watchlist] : []
      const key = this.watchlistContextKey({
        market: this.form.market,
        symbol: this.form.symbol,
        exchange_id: this.form.exchangeId,
        market_type: this.form.marketType
      })
      if (this.form.symbol && !rows.some(item => this.watchlistContextKey(item) === key)) {
        rows.unshift({
          market: this.form.market,
          symbol: this.form.symbol,
          exchange_id: this.form.exchangeId,
          market_type: this.form.marketType,
          name: ''
        })
      }
      return rows
    },
    selectedAssetCodeHidden () {
      return !!(this.selectedAsset && this.selectedAsset.code_hidden)
    },
    selectedAssetOriginalCode () {
      return this.selectedAsset ? String(this.selectedAsset.code || '') : ''
    },
    selectedAssetCode () {
      if (!this.selectedAsset) return ''
      return this.tunedCodeByAssetKey[this.selectedAsset.asset_key] || this.selectedAsset.code || ''
    },
    persistedParamTemplate () {
      return extractScriptParamsFromCode(this.selectedAssetOriginalCode)
    },
    persistedParamValues () {
      const template = this.persistedParamTemplate
      return template ? buildTemplateParamValues(template) : {}
    },
    paramTemplate () {
      return extractScriptParamsFromCode(this.selectedAssetCode)
    },
    codeParams () {
      const params = (this.paramTemplate && Array.isArray(this.paramTemplate.params)) ? this.paramTemplate.params : []
      return params.map(param => ({
        ...param,
        displayLabel: this.getCodeParamLabel(param)
      }))
    },
    canTuneBacktest () {
      return !this.isPortfolioAsset && !!this.selectedAssetCodeWithParams &&
        this.codeParams.some(param => ['integer', 'number', 'percent'].includes(param.type))
    },
    codeParamSummary () {
      return this.codeParams.length
        ? this.copy.paramDetected.replace('{count}', String(this.codeParams.length))
        : this.copy.paramEmpty
    },
    selectedAssetCodeWithParams () {
      if (!this.selectedAssetCode || !this.codeParams.length) return this.selectedAssetCode
      return buildScriptCodeWithParamValues(this.selectedAssetCode, this.codeParams, this.paramValues)
    },
    codeWithCurrentParamsForPersist () {
      const baseCode = this.selectedAssetOriginalCode || this.selectedAssetCode
      if (!baseCode || !this.codeParams.length) return baseCode
      return buildScriptCodeWithParamValues(baseCode, this.codeParams, this.paramValues)
    },
    paramChangeList () {
      const original = this.persistedParamValues || {}
      return this.codeParams
        .map(param => ({
          name: param.name,
          before: original[param.name],
          after: this.paramValues[param.name]
        }))
        .filter(item => this.normalizeParamCompareValue(item.before) !== this.normalizeParamCompareValue(item.after))
    },
    hasUnsavedCodeParams () {
      return !!this.canPersistParamsToCode &&
        !!this.codeWithCurrentParamsForPersist &&
        String(this.codeWithCurrentParamsForPersist) !== String(this.selectedAssetOriginalCode || '')
    },
    canPersistParamsToCode () {
      return !!this.selectedAsset &&
        this.selectedAsset.can_edit_code !== false &&
        !this.selectedAssetCodeHidden &&
        !!(this.selectedAssetOriginalCode || this.selectedAssetCode) &&
        ['script', 'portfolio_strategy'].includes(String(this.selectedAsset.asset_type || '')) &&
        this.codeParams.length > 0
    },
    paramPersistUnavailableText () {
      if (this.selectedAssetCodeHidden) {
        return this.bt('backtest-center.paramPersist.sourceHidden', 'sourceHidden')
      }
      if (!this.selectedAssetOriginalCode && !this.selectedAssetCode) {
        return this.bt('backtest-center.paramPersist.noWritableCode', 'noWritableCode')
      }
      return this.bt('backtest-center.paramPersist.scriptOnly', 'scriptOnly')
    },
    historyParams () {
      if (!this.selectedAsset) return {}
      return {
        assetType: this.selectedAsset.asset_type,
        assetId: this.selectedAsset.source_id || this.selectedAsset.id
      }
    },
    hasResult () {
      return !!this.result
    },
    resultTrades () {
      const result = this.result || {}
      const rows = result.rawTrades || result.raw_trades || result.trades || []
      return Array.isArray(rows) ? rows : []
    },
    closedTradeRows () {
      const result = this.result || {}
      const rows = result.closedTrades || result.closed_trades || result.tradeRecords || result.trade_records || []
      if (Array.isArray(rows) && rows.length) return rows
      return this.buildClosedTradesFromExecutions(this.resultTrades)
    },
    pairedTrades () {
      return this.closedTradeRows
        .map((trade, index) => {
          const entryTime = this.firstDefined(trade, [
            'entry_time', 'entryTime', 'entry_at', 'entryAt',
            'open_time', 'openTime', 'open_at', 'openAt',
            'entry_date', 'entryDate', 'entry_timestamp', 'entryTimestamp',
            'open_timestamp', 'openTimestamp', 'bar_time', 'barTime',
            'time', 'timestamp', 'date'
          ])
          const exitTime = this.firstDefined(trade, [
            'exit_time', 'exitTime', 'exit_at', 'exitAt',
            'close_time', 'closeTime', 'close_at', 'closeAt',
            'exit_date', 'exitDate', 'exit_timestamp', 'exitTimestamp',
            'close_timestamp', 'closeTimestamp', 'bar_time', 'barTime',
            'time', 'timestamp', 'date'
          ])
          return {
            id: trade.id || trade.order_id || `${entryTime || index}-${exitTime || index}-${index}`,
            tradeNo: trade.tradeNo || trade.trade_no || trade.id || index + 1,
            entryTime: entryTime || '-',
            exitTime: exitTime || '-',
            side: this.normalizeTradeSide(trade.position_side || trade.positionSide || trade.side || trade.direction || trade.type, trade),
            closeReason: trade.close_reason || trade.closeReason || trade.exit_reason || trade.reason || trade.type || '',
            entryPrice: this.firstDefined(trade, ['entry_price', 'entryPrice', 'open_price', 'openPrice', 'avg_entry_price', 'avgEntryPrice', 'price']),
            exitPrice: this.firstDefined(trade, ['exit_price', 'exitPrice', 'close_price', 'closePrice', 'fill_price', 'fillPrice', 'price']),
            quantity: trade.quantity != null ? trade.quantity : (trade.amount != null ? trade.amount : (trade.qty != null ? trade.qty : trade.size)),
            profit: trade.profit != null ? trade.profit : (trade.pnl != null ? trade.pnl : (trade.realized_pnl != null ? trade.realized_pnl : trade.realizedPnl)),
            balance: trade.balance != null ? trade.balance : (trade.equity != null ? trade.equity : trade.cash)
          }
        })
        .slice()
        .reverse()
    },
    tradeColumnsV2 () {
      return [
        { title: '#', dataIndex: 'tradeNo', width: 70, scopedSlots: { customRender: 'tradeNo' } },
        { title: this.bt('backtest-center.tradeColumns.side', 'side'), dataIndex: 'side', width: 90, scopedSlots: { customRender: 'side' } },
        { title: this.bt('backtest-center.tradeColumns.closeReason', 'closeReason'), dataIndex: 'closeReason', width: 120, scopedSlots: { customRender: 'closeReason' } },
        { title: this.bt('backtest-center.tradeColumns.profit', 'profit'), dataIndex: 'profit', width: 120, scopedSlots: { customRender: 'profit' } },
        { title: this.bt('backtest-center.tradeColumns.entryPrice', 'entryPrice'), dataIndex: 'entryPrice', width: 130, scopedSlots: { customRender: 'price' } },
        { title: this.bt('backtest-center.tradeColumns.exitPrice', 'exitPrice'), dataIndex: 'exitPrice', width: 130, scopedSlots: { customRender: 'price' } },
        { title: this.bt('backtest-center.tradeColumns.entryTime', 'entryTime'), dataIndex: 'entryTime', width: 160, scopedSlots: { customRender: 'time' } },
        { title: this.bt('backtest-center.tradeColumns.exitTime', 'exitTime'), dataIndex: 'exitTime', width: 160, scopedSlots: { customRender: 'time' } },
        { title: this.bt('backtest-center.tradeColumns.balance', 'balance'), dataIndex: 'balance', width: 130, scopedSlots: { customRender: 'balance' } }
      ]
    },
    tradeColumns () {
      return [
        { title: this.bt('backtest-center.tradeColumns.time', 'time'), dataIndex: 'time', width: 180 },
        { title: this.bt('backtest-center.tradeColumns.side', 'side'), dataIndex: 'side', width: 90, scopedSlots: { customRender: 'side' } },
        { title: this.bt('backtest-center.tradeColumns.price', 'price'), dataIndex: 'price', width: 110, scopedSlots: { customRender: 'price' } },
        { title: this.bt('backtest-center.tradeColumns.quantity', 'quantity'), dataIndex: 'quantity', width: 100 },
        { title: this.bt('backtest-center.tradeColumns.profit', 'profit'), dataIndex: 'profit', width: 120, scopedSlots: { customRender: 'profit' } }
      ]
    },
    historyColumns () {
      return [
        { title: this.bt('backtest-center.historyColumns.time', 'time'), dataIndex: 'created_at_display', width: 140, ellipsis: true, scopedSlots: { customRender: 'historyTime' } },
        { title: this.bt('backtest-center.historyColumns.range', 'range'), dataIndex: 'range', width: 170, ellipsis: true },
        { title: this.bt('backtest-center.historyColumns.source', 'source'), dataIndex: 'source_context', width: 210, ellipsis: true },
        { title: this.bt('backtest-center.historyColumns.return', 'return'), dataIndex: 'total_return', width: 86, scopedSlots: { customRender: 'return' } },
        { title: this.bt('backtest-center.historyColumns.status', 'status'), dataIndex: 'status', width: 86, scopedSlots: { customRender: 'status' } },
        { title: this.bt('backtest-center.historyColumns.type', 'type'), dataIndex: 'asset_type', width: 72, ellipsis: true },
        { title: this.bt('backtest-center.historyColumns.action', 'action'), key: 'action', width: 78, align: 'right', scopedSlots: { customRender: 'action' } }
      ]
    },
    totalReturnValue () {
      return this.pickNumber(this.result, ['totalReturn', 'total_return', 'returnPct', 'return_pct', 'profitRate', 'profit_rate'], 0)
    },
    maxDrawdownValue () {
      return this.pickNumber(this.result, ['maxDrawdown', 'max_drawdown', 'drawdown', 'maxDd'], 0)
    },
    winRateValue () {
      return this.pickNumber(this.result, ['winRate', 'win_rate'], 0)
    },
    benchmarkReturnValue () {
      const explicit = this.pickNumber(this.result, [
        'benchmarkReturn',
        'benchmark_return',
        'benchmarkReturnPct',
        'benchmark_return_pct',
        'spotReturn',
        'spot_return',
        'buyHoldReturn',
        'buy_hold_return',
        'buyAndHoldReturn',
        'buy_and_hold_return'
      ], null)
      if (explicit !== null) return explicit
      return this.deriveSeriesReturn(this.benchmarkSeries)
    },
    spotExcessReturnValue () {
      const explicit = this.pickNumber(this.result, ['alphaReturn', 'alpha_return', 'benchmarkAlpha', 'benchmark_alpha', 'excessReturn', 'excess_return'], null)
      if (explicit !== null) return explicit
      if (this.benchmarkReturnValue === null) return null
      return this.totalReturnValue - this.benchmarkReturnValue
    },
    resultTradeCount () {
      return this.pickNumber(this.result, ['totalTrades', 'total_trades', 'tradeCount', 'trade_count'], this.closedTradeRows.length)
    },
    hasZeroTradeResult () {
      if (!this.result) return false
      const hasCurve = Array.isArray(this.result.equityCurve) && this.result.equityCurve.length > 1
      return hasCurve && Number(this.resultTradeCount || 0) === 0
    },
    dataRangeNotice () {
      if (!this.result) return null
      const assumptions = this.result.executionAssumptions || this.result.execution_assumptions || {}
      if (!assumptions.requestedRangeAdjusted) return null
      const range = assumptions.actualDataRange || assumptions.actual_data_range || {}
      const requestedStart = range.requestedStart || range.requested_start || (this.startDate && this.startDate.format('YYYY-MM-DD')) || '-'
      const requestedEnd = range.requestedEnd || range.requested_end || (this.endDate && this.endDate.format('YYYY-MM-DD')) || '-'
      const actualStart = range.actualStart || range.actual_start || this.result.startDate || this.result.start_date || '-'
      const actualEnd = range.actualEnd || range.actual_end || this.result.endDate || this.result.end_date || '-'
      const snapshot = this.result.dataSnapshot || this.result.data_snapshot || assumptions.dataSnapshot || assumptions.data_snapshot || {}
      const rows = Number(snapshot.rowCount || snapshot.row_count || 0)
      const formatRangeValue = value => {
        const parsed = moment(value)
        return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : String(value || '-')
      }
      return {
        title: this.copy.dataRangeAdjustedTitle,
        description: this.copy.dataRangeAdjustedDescription
          .replace('{requestedStart}', formatRangeValue(requestedStart))
          .replace('{requestedEnd}', formatRangeValue(requestedEnd))
          .replace('{actualStart}', formatRangeValue(actualStart))
          .replace('{actualEnd}', formatRangeValue(actualEnd))
          .replace('{rows}', String(rows))
      }
    },
    metricCards () {
      if (this.isPortfolioStrategy) {
        const metrics = (this.result && this.result.metrics) || {}
        return [
          { label: this.bt('backtest-center.metrics.totalReturn', 'totalReturn'), value: this.fmtPct(this.totalReturnValue), cls: this.totalReturnValue >= 0 ? 'positive' : 'negative' },
          { label: this.bt('backtest-center.metrics.maxDrawdown', 'maxDrawdown'), value: this.fmtPct(this.maxDrawdownValue), cls: this.maxDrawdownValue > 20 ? 'negative' : '' },
          { label: this.bt('backtest-center.metrics.sharpe', 'sharpe'), value: this.fmtNum(this.pickNumber(this.result, ['sharpeRatio'], 0)), cls: '' },
          { label: this.copy.annualReturn, value: this.fmtPct(Number(metrics.annual_return || 0) * 100), cls: Number(metrics.annual_return || 0) >= 0 ? 'positive' : 'negative' },
          { label: this.copy.volatility, value: this.fmtPct(Number(metrics.volatility || 0) * 100), cls: '' },
          { label: this.copy.turnover, value: this.fmtNum(metrics.turnover || 0), cls: '' },
          { label: this.copy.rebalances, value: this.fmtInt(metrics.rebalance_count || 0), cls: '' },
          { label: this.copy.averagePositions, value: this.fmtNum(metrics.average_position_count || 0), cls: '' },
          { label: this.copy.fees, value: this.fmtMoney(Number(metrics.total_commission || 0) + Number(metrics.total_slippage || 0)), cls: '' }
        ]
      }
      const profitFactor = this.pickNumber(this.result, ['profitFactor', 'profit_factor'], 0)
      const cards = [
        { label: this.bt('backtest-center.metrics.totalReturn', 'totalReturn'), value: this.fmtPct(this.totalReturnValue), cls: this.totalReturnValue >= 0 ? 'positive' : 'negative' },
        { label: this.bt('backtest-center.metrics.maxDrawdown', 'maxDrawdown'), value: this.fmtPct(this.maxDrawdownValue), cls: this.maxDrawdownValue > 20 ? 'negative' : '' },
        { label: this.bt('backtest-center.metrics.sharpe', 'sharpe'), value: this.fmtNum(this.pickNumber(this.result, ['sharpeRatio', 'sharpe_ratio', 'sharpe'], 0)), cls: '' },
        { label: this.bt('backtest-center.metrics.winRate', 'winRate'), value: this.fmtPct(this.winRateValue), cls: this.winRateValue >= 50 ? 'positive' : 'negative' },
        { label: this.bt('backtest-center.metrics.profitFactor', 'profitFactor'), value: this.fmtNum(profitFactor), cls: profitFactor >= 1 ? 'positive' : 'negative' },
        { label: this.bt('backtest-center.metrics.trades', 'trades'), value: this.fmtInt(this.resultTradeCount), cls: '' },
        { label: this.bt('backtest-center.metrics.bestTrade', 'bestTrade'), value: this.fmtMoney(this.pickNumber(this.result, ['bestTrade', 'best_trade'], this.bestTradeProfit)), cls: this.bestTradeProfit >= 0 ? 'positive' : 'negative' },
        { label: this.bt('backtest-center.metrics.worstTrade', 'worstTrade'), value: this.fmtMoney(this.pickNumber(this.result, ['worstTrade', 'worst_trade'], this.worstTradeProfit)), cls: 'negative' },
        { label: this.bt('backtest-center.metrics.avgPnl', 'avgPnl'), value: this.fmtMoney(this.avgTradeProfit), cls: this.avgTradeProfit >= 0 ? 'positive' : 'negative' }
      ]
      if (this.spotExcessReturnValue !== null) {
        cards.splice(5, 0, {
          label: this.bt('backtest-center.metrics.vsSpot', 'vsSpot'),
          value: this.fmtPct(this.spotExcessReturnValue),
          cls: this.spotExcessReturnValue >= 0 ? 'positive' : 'negative',
          hint: this.bt('backtest-center.metrics.vsSpotHint', 'vsSpotHint')
        })
      }
      return cards
    },
    tradeProfits () {
      return this.closedTradeRows
        .map(item => Number(item.profit != null ? item.profit : (item.pnl != null ? item.pnl : item.realized_pnl)))
        .filter(Number.isFinite)
    },
    bestTradeProfit () {
      return this.tradeProfits.length ? Math.max(...this.tradeProfits) : 0
    },
    worstTradeProfit () {
      return this.tradeProfits.length ? Math.min(...this.tradeProfits) : 0
    },
    avgTradeProfit () {
      if (!this.tradeProfits.length) return 0
      return this.tradeProfits.reduce((sum, value) => sum + value, 0) / this.tradeProfits.length
    },
    backtestInsight () {
      const ret = this.totalReturnValue
      const dd = Math.abs(this.maxDrawdownValue)
      if (ret > 0 && dd <= 12) return this.bt('backtest-center.insight.stable', 'stable')
      if (ret > 0 && dd > 25) return this.bt('backtest-center.insight.drawdownReview', 'drawdownReview')
      if (ret <= 0) return this.bt('backtest-center.insight.weak', 'weak')
      return this.bt('backtest-center.insight.candidate', 'candidate')
    },
    backtestDiagnostics () {
      if (!this.result) return []
      const rows = []
      rows.push({
        key: 'drawdown',
        icon: Math.abs(this.maxDrawdownValue) > 20 ? 'warning' : 'safety',
        tone: Math.abs(this.maxDrawdownValue) > 20 ? 'danger' : 'good',
        title: this.bt('backtest-center.diagnostic.drawdown', 'drawdown'),
        value: this.fmtPct(this.maxDrawdownValue)
      })
      rows.push({
        key: 'sample',
        icon: 'database',
        tone: this.closedTradeRows.length >= 20 ? 'good' : 'warn',
        title: this.bt('backtest-center.diagnostic.samples', 'samples'),
        value: this.fmtInt(this.closedTradeRows.length)
      })
      const alpha = this.pickNumber(this.result, ['alphaReturn', 'alpha_return', 'benchmarkAlpha'], null)
      if (alpha !== null) {
        rows.push({
          key: 'alpha',
          icon: alpha >= 0 ? 'rise' : 'fall',
          tone: alpha >= 0 ? 'good' : 'warn',
          title: this.bt('backtest-center.diagnostic.alpha', 'alpha'),
          value: this.fmtPct(alpha)
        })
      }
      return rows
    },
    equityReturns () {
      return this.seriesReturns(this.equitySeries)
    },
    benchmarkReturns () {
      return this.seriesReturns(this.benchmarkSeries)
    },
    periodsPerYear () {
      const tf = String(this.form.timeframe || '').toLowerCase()
      const map = {
        '1m': 365 * 24 * 60,
        '5m': 365 * 24 * 12,
        '15m': 365 * 24 * 4,
        '30m': 365 * 24 * 2,
        '1h': 365 * 24,
        '4h': 365 * 6,
        '1d': 365,
        '1w': 52
      }
      return map[tf] || 365
    },
    professionalRiskStats () {
      const returns = this.equityReturns
      const benchmark = this.benchmarkReturns
      const volatility = this.annualizedVolatility(returns)
      const sortino = this.sortinoRatio(returns)
      const calmar = this.calmarRatio()
      const beta = this.betaValue(returns, benchmark)
      const alpha = this.spotExcessReturnValue
      const drawdownDuration = this.maxDrawdownDuration()
      const exposure = this.exposureRatio()
      return {
        volatility,
        sortino,
        calmar,
        beta,
        alpha,
        drawdownDuration,
        exposure
      }
    },
    backtestRunId () {
      const result = this.result || {}
      return result.runId || result.run_id || result.id || result.backtestId || result.backtest_id || '-'
    },
    auditSummaryCards () {
      if (!this.result) return []
      const t = key => this.bt('backtest-center.audit.' + key, key)
      const commission = Number(this.form.commissionPct || 0)
      const slippage = Number(this.form.slippagePct || 0)
      const candleCount = this.replayCandles.length
      const tradeCount = Number(this.resultTradeCount || 0)
      const markerCount = this.replayTradeEvents.length
      const pairCount = this.pairedTrades.length
      const executedParams = (
        (this.result && (this.result.parameterSnapshot || this.result.parameter_snapshot)) ||
        ((this.result && (this.result.executionAssumptions || this.result.execution_assumptions)) || {}).parameterSnapshot ||
        {}
      )
      const paramCount = Object.keys(executedParams || {}).length
      const runId = String(this.backtestRunId || '')
      const assumptions = (this.result && (this.result.executionAssumptions || this.result.execution_assumptions)) || {}
      const dataSnapshot = this.result.dataSnapshot || this.result.data_snapshot || assumptions.dataSnapshot || assumptions.data_snapshot || {}
      const dataHash = String(dataSnapshot.sha256 || this.result.dataHash || this.result.data_hash || '')
      const dataRows = Number(dataSnapshot.rowCount || dataSnapshot.row_count || 0)
      const initialCapital = Number(this.form.initialCapital || 0)
      const leverage = Number(this.form.leverage || 1)
      const rangeText = `${this.startDate ? this.startDate.format('YYYY-MM-DD') : '-'} ~ ${this.endDate ? this.endDate.format('YYYY-MM-DD') : '-'}`
      const riskEnabled = this.hasCodeOwnedRiskControls ||
        Number((this.form.risk || {}).stopLossPct || 0) > 0 ||
        Number((this.form.risk || {}).takeProfitPct || 0) > 0 ||
        Number((this.form.risk || {}).maxHoldingBars || 0) > 0 ||
        !!((this.form.risk || {}).trailingEnabled)
      const riskRows = []
      const risk = this.form.risk || {}
      if (Number(risk.stopLossPct || 0) > 0) riskRows.push({ label: t('stopLoss'), value: String(risk.stopLossPct), tone: 'ok' })
      if (Number(risk.takeProfitPct || 0) > 0) riskRows.push({ label: t('takeProfit'), value: String(risk.takeProfitPct), tone: 'ok' })
      if (risk.trailingEnabled) riskRows.push({ label: t('trailing'), value: t('enabled'), tone: 'ok' })
      if (Number(risk.maxHoldingBars || 0) > 0) riskRows.push({ label: t('maxHolding'), value: String(risk.maxHoldingBars), tone: 'ok' })
      if (!riskRows.length) riskRows.push({ label: t('riskSource'), value: riskEnabled ? t('codeDefault') : t('notConfigured'), tone: riskEnabled ? 'neutral' : 'warn' })
      const cards = [
        {
          key: 'data',
          icon: 'database',
          title: t('dataCoverage'),
          badge: candleCount ? t('passed') : t('attention'),
          value: candleCount ? `${this.fmtInt(candleCount)} ${t('candles')}` : t('dataSparse'),
          desc: candleCount ? t('dataReadyDesc') : t('dataSparseDesc'),
          rows: [
            { label: this.copy.timeframe, value: this.form.timeframe || '-', tone: 'neutral' },
            { label: t('range'), value: rangeText, tone: 'neutral' },
            { label: t('pathReview'), value: candleCount ? t('available') : t('unavailable'), tone: candleCount ? 'ok' : 'warn' }
          ],
          status: candleCount ? 'ok' : 'warn'
        },
        {
          key: 'execution',
          icon: 'control',
          title: t('executionAssumptions'),
          badge: t('documented'),
          value: t('barBasedFill'),
          desc: t('executionAssumptionsDesc'),
          rows: [
            { label: t('fillPolicy'), value: t('fullFill'), tone: 'ok' },
            { label: t('commissionAndSlippage'), value: `${commission.toFixed(4)}% / ${slippage.toFixed(4)}%`, tone: commission > 0 || slippage > 0 ? 'ok' : 'warn' },
            { label: this.copy.marketType, value: this.form.marketType === 'spot' ? this.copy.spot : this.copy.swap, tone: 'neutral' }
          ],
          status: 'ok'
        },
        {
          key: 'capital',
          icon: 'wallet',
          title: t('capitalModel'),
          badge: t('accounting'),
          value: this.fmtMoney(initialCapital),
          desc: t('capitalModelDesc'),
          rows: [
            { label: this.copy.leverage, value: `${Number.isFinite(leverage) ? leverage : 1}x`, tone: leverage > 1 ? 'warn' : 'neutral' },
            { label: this.copy.direction, value: this.form.tradeDirection === 'short' ? this.copy.short : (this.form.tradeDirection === 'both' ? this.copy.both : this.copy.long), tone: 'neutral' },
            { label: t('marginBudget'), value: this.fmtMoney(initialCapital), tone: 'neutral' }
          ],
          status: leverage > 1 ? 'warn' : 'ok'
        },
        {
          key: 'trades',
          icon: 'stock',
          title: t('tradeEvidence'),
          badge: tradeCount >= 30 ? t('sufficient') : t('limited'),
          value: `${this.fmtInt(tradeCount)} ${t('tradeSamples')}`,
          desc: markerCount ? t('replayReadyDesc') : t('replayEmptyDesc'),
          rows: [
            { label: t('pairedTrades'), value: this.fmtInt(pairCount), tone: pairCount ? 'ok' : 'warn' },
            { label: t('replayMarkers'), value: markerCount ? `${this.fmtInt(markerCount)} ${t('markers')}` : t('noMarkers'), tone: markerCount ? 'ok' : 'warn' },
            { label: t('sampleQuality'), value: tradeCount >= 30 ? t('sampleOk') : t('lowSample'), tone: tradeCount >= 30 ? 'ok' : 'warn' }
          ],
          status: tradeCount >= 30 && markerCount ? 'ok' : 'warn'
        },
        {
          key: 'risk',
          icon: 'safety',
          title: t('riskReport'),
          badge: riskEnabled ? t('detected') : t('codeDefault'),
          value: riskEnabled ? t('enabled') : t('codeDefault'),
          desc: riskEnabled ? t('riskReadyDesc') : t('riskCodeDefaultDesc'),
          rows: riskRows,
          status: riskEnabled ? 'ok' : 'neutral'
        },
        {
          key: 'repro',
          icon: 'file-done',
          title: t('reproducibility'),
          badge: runId && runId !== '-' && dataHash ? t('captured') : t('partial'),
          value: runId && runId !== '-' ? runId : `${t('captured')} (${paramCount})`,
          desc: dataHash ? `SHA-256 ${dataHash.slice(0, 12)} · ${this.fmtInt(dataRows)}` : (paramCount ? `${t('paramSnapshot')}: ${paramCount}` : t('codeDataVersion')),
          rows: [
            { label: t('runId'), value: runId && runId !== '-' ? runId : t('notReturned'), tone: runId && runId !== '-' ? 'ok' : 'warn' },
            { label: t('paramSnapshot'), value: paramCount ? `${this.fmtInt(paramCount)} ${t('captured')}` : t('noStrategyParams'), tone: paramCount ? 'ok' : 'neutral' },
            { label: t('codeDataVersion'), value: dataHash ? dataHash.slice(0, 20) : t('codeYesDataNeeded'), tone: dataHash ? 'ok' : 'neutral' }
          ],
          status: runId && runId !== '-' && dataHash ? 'ok' : 'neutral'
        }
      ]
      if (this.benchmarkSeries.length) {
        cards.splice(3, 0, {
          key: 'benchmark',
          icon: 'line-chart',
          title: t('spotBenchmark'),
          badge: t('available'),
          value: this.fmtPct(this.benchmarkReturnValue),
          desc: t('benchmarkReadyDesc'),
          rows: [
            { label: t('strategyReturn'), value: this.fmtPct(this.totalReturnValue), tone: Number(this.totalReturnValue) >= 0 ? 'ok' : 'warn' },
            { label: t('benchmarkReturn'), value: this.fmtPct(this.benchmarkReturnValue), tone: Number(this.benchmarkReturnValue) >= 0 ? 'ok' : 'warn' },
            { label: t('excessReturn'), value: this.fmtPct(this.totalReturnValue - this.benchmarkReturnValue), tone: (this.totalReturnValue - this.benchmarkReturnValue) >= 0 ? 'ok' : 'warn' }
          ],
          status: 'ok'
        })
      }
      return cards
    },
    headlineMetricCards () {
      if (this.isPortfolioStrategy) return this.metricCards.slice(0, 5)
      const labels = [
        this.bt('backtest-center.metrics.totalReturn', 'totalReturn'),
        this.bt('backtest-center.metrics.vsSpot', 'vsSpot'),
        this.bt('backtest-center.metrics.maxDrawdown', 'maxDrawdown'),
        this.bt('backtest-center.metrics.sharpe', 'sharpe'),
        this.bt('backtest-center.metrics.trades', 'trades')
      ]
      return labels.map(label => this.metricCards.find(item => item.label === label)).filter(Boolean)
    },
    secondaryMetricCards () {
      const primaryLabels = new Set(this.headlineMetricCards.map(item => item.label))
      return this.metricCards.filter(item => !primaryLabels.has(item.label))
    },
    sampleDiagnostic () {
      return this.backtestDiagnostics.find(item => item.key === 'sample') || null
    },
    hasCodeOwnedRiskControls () {
      const code = String(this.selectedAssetCodeWithParams || this.selectedAssetOriginalCode || '')
      if (!code.trim()) return false
      return /@strategy\s+(stopLossPct|takeProfitPct|trailingEnabled|trailingStopPct|trailingActivationPct|maxHoldingBars)\b/i.test(code) ||
        /ctx\.param\(\s*['"](stop_loss|take_profit|trailing|trail|hard_stop|max_holding)/i.test(code)
    },
    equityToneColor () {
      return this.totalReturnValue < 0 ? '#d94b4b' : this.resolvedPrimaryColor
    },
    equitySeries () {
      if (!this.result) return []
      const raw = this.result.equityCurve || this.result.equity_curve || this.result.balanceCurve || this.result.balance_curve || []
      if (Array.isArray(raw) && raw.length) {
        return raw.map((item, index) => {
          if (typeof item === 'number') return { index, value: Number(item) }
          const value = this.pickNumberDeep(item, ['value', 'balance', 'equity', 'cash', 'totalEquity', 'total_equity', 'finalEquity', 'final_equity', 'nav'], NaN)
          return {
            index,
            time: item.time || item.date || item.datetime || item.timestamp || '',
            value
          }
        }).filter(item => Number.isFinite(item.value))
      }
      let balance = Number(this.form.initialCapital || 0)
      const points = [{ index: 0, value: balance }]
      this.resultTrades.forEach((trade, index) => {
        const profit = Number(trade.profit != null ? trade.profit : (trade.pnl != null ? trade.pnl : trade.realized_pnl))
        if (Number.isFinite(profit)) {
          balance += profit
          points.push({ index: index + 1, value: balance })
        }
      })
      return points
    },
    portfolioRebalances () {
      return ((this.result && this.result.rebalances) || []).map((item, index) => ({ ...item, rowKey: `${item.signal_date || index}-${index}` }))
    },
    portfolioOrders () {
      return ((this.result && this.result.orders) || []).map((item, index) => ({ ...item, rowKey: `${item.execution_date || index}-${item.symbol || ''}-${index}` }))
    },
    portfolioRebalanceColumns () {
      return [
        { title: this.copy.signalDate, dataIndex: 'signal_date', scopedSlots: { customRender: 'time' }, width: 170 },
        { title: this.copy.executionDate, dataIndex: 'execution_date', scopedSlots: { customRender: 'time' }, width: 170 },
        { title: this.copy.grossExposure, dataIndex: 'gross_exposure', scopedSlots: { customRender: 'percent' }, width: 120 },
        { title: this.copy.cashWeight, dataIndex: 'cash_weight', scopedSlots: { customRender: 'percent' }, width: 110 },
        { title: this.copy.targetWeights, dataIndex: 'target_weights', scopedSlots: { customRender: 'weights' }, width: 300 },
        { title: this.copy.status, dataIndex: 'status', width: 100 }
      ]
    },
    portfolioOrderColumns () {
      return [
        { title: this.copy.executionDate, dataIndex: 'execution_date', scopedSlots: { customRender: 'time' }, width: 170 },
        { title: this.copy.symbol, dataIndex: 'symbol', width: 100 },
        { title: this.copy.direction, dataIndex: 'side', scopedSlots: { customRender: 'side' }, width: 90 },
        { title: this.copy.quantity, dataIndex: 'quantity', width: 120 },
        { title: this.copy.price, dataIndex: 'price', scopedSlots: { customRender: 'price' }, width: 120 },
        { title: this.copy.notional, dataIndex: 'notional', scopedSlots: { customRender: 'money' }, width: 130 },
        { title: this.copy.fees, dataIndex: 'commission', scopedSlots: { customRender: 'money' }, width: 110 },
        { title: this.copy.status, dataIndex: 'status', width: 100 },
        { title: this.copy.exitReason, dataIndex: 'reason', width: 190 }
      ]
    },
    equitySvgRows () {
      const rows = this.equitySeries.map((item, index) => ({
        index,
        value: Number(item.value)
      })).filter(item => Number.isFinite(item.value))
      if (rows.length <= 1) return []
      const benchmark = this.benchmarkSeries.map((item, index) => ({
        index,
        value: Number(item.value)
      })).filter(item => Number.isFinite(item.value))
      const values = rows.concat(benchmark).map(item => item.value).filter(Number.isFinite)
      const min = Math.min(...values)
      const max = Math.max(...values)
      const span = Math.max(max - min, Math.abs(max) * 0.002, 1)
      return rows.map((item, index) => ({
        x: rows.length === 1 ? 0 : (index / (rows.length - 1)) * 1000,
        y: 218 - ((item.value - min) / span) * 190
      }))
    },
    equitySvgStrategyPoints () {
      return this.equitySvgRows.map(item => `${item.x.toFixed(2)},${item.y.toFixed(2)}`).join(' ')
    },
    equitySvgFillPoints () {
      if (!this.equitySvgRows.length) return ''
      return `0,230 ${this.equitySvgStrategyPoints} 1000,230`
    },
    equitySvgBenchmarkPoints () {
      const strategyRows = this.equitySeries
      const rows = this.benchmarkSeries.map((item, index) => ({
        index,
        value: Number(item.value)
      })).filter(item => Number.isFinite(item.value))
      if (rows.length <= 1 || strategyRows.length <= 1) return ''
      const values = strategyRows.map(item => Number(item.value)).concat(rows.map(item => item.value)).filter(Number.isFinite)
      const min = Math.min(...values)
      const max = Math.max(...values)
      const span = Math.max(max - min, Math.abs(max) * 0.002, 1)
      return rows.map((item, index) => {
        const x = rows.length === 1 ? 0 : (index / (rows.length - 1)) * 1000
        const y = 218 - ((item.value - min) / span) * 190
        return `${x.toFixed(2)},${y.toFixed(2)}`
      }).join(' ')
    },
    benchmarkSeries () {
      if (!this.result) return []
      const raw = this.result.benchmarkCurve || this.result.benchmark_curve || this.result.benchmarkEquityCurve || this.result.benchmark_equity_curve || []
      if (!Array.isArray(raw) || !raw.length) {
        if (!this.replayCandles.length) return []
        const firstClose = Number(this.replayCandles[0].close)
        if (!Number.isFinite(firstClose) || firstClose <= 0) return []
        const initial = Number(this.form.initialCapital || 0) || 10000
        return this.replayCandles.map((item, index) => ({
          index,
          time: item.time,
          value: initial * (Number(item.close) / firstClose)
        })).filter(item => Number.isFinite(item.value))
      }
      return raw.map((item, index) => {
        if (typeof item === 'number') return { index, value: Number(item) }
        const value = this.pickNumberDeep(item, ['value', 'balance', 'equity', 'cash', 'totalEquity', 'total_equity', 'finalEquity', 'final_equity', 'nav'], NaN)
        return {
          index,
          time: item.time || item.date || item.datetime || item.timestamp || '',
          value
        }
      }).filter(item => Number.isFinite(item.value))
    },
    replayCandles () {
      const raw = this.replayKlines || []
      if (!Array.isArray(raw)) return []
      return raw.map((item, index) => ({
        key: item.id || item.time || item.timestamp || index,
        time: item.time || item.date || item.timestamp || '',
        timeValue: this.toTimeMs(item.time || item.date || item.timestamp),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: Number(item.volume || 0)
      }))
        .filter(item => Number.isFinite(item.open) && Number.isFinite(item.high) && Number.isFinite(item.low) && Number.isFinite(item.close))
        .sort((a, b) => {
          if (a.timeValue === null && b.timeValue === null) return 0
          if (a.timeValue === null) return 1
          if (b.timeValue === null) return -1
          return a.timeValue - b.timeValue
        })
    },
    replayActionTotal () {
      return this.replayTradeEvents.length
    },
    replayTradeEvents () {
      const events = []
      this.pairedTrades.slice().reverse().forEach((trade, index) => {
        events.push({
          key: `open-${trade.id || index}`,
          time: trade.entryTime,
          price: Number(trade.entryPrice),
          label: this.copy.openAction,
          tone: trade.side === 'short' ? 'short' : 'long'
        })
        events.push({
          key: `close-${trade.id || index}`,
          time: trade.exitTime,
          price: Number(trade.exitPrice),
          label: this.copy.closeAction,
          tone: 'close'
        })
      })
      if (!events.length) {
        this.resultTrades.forEach((trade, index) => {
          const side = this.normalizeTradeSide(trade.position_side || trade.positionSide || trade.side || trade.direction || trade.type, trade)
          const reason = String(trade.reason || trade.close_reason || trade.closeReason || trade.type || '').toLowerCase()
          const isClose = reason.includes('close') || reason.includes('exit')
          events.push({
            key: `event-${index}`,
            time: trade.time || trade.timestamp || trade.date || trade.created_at,
            price: Number(trade.price || trade.fill_price || trade.close || trade.entry_price || trade.exit_price),
            label: isClose ? this.copy.closeAction : this.copy.openAction,
            tone: isClose ? 'close' : (side === 'short' ? 'short' : 'long')
          })
        })
      }
      return events.filter(item => Number.isFinite(item.price))
    },
    tuneMethodOptions () {
      return [
        { value: 'grid', icon: 'appstore', label: this.bt('backtest-center.tuneMethods.grid', 'grid') },
        { value: 'random', icon: 'sync', label: this.bt('backtest-center.tuneMethods.random', 'random') },
        { value: 'de', icon: 'branches', label: this.bt('backtest-center.tuneMethods.de', 'de') },
        { value: 'bayes', icon: 'bulb', label: this.bt('backtest-center.tuneMethods.bayes', 'bayes') }
      ]
    },
    experimentSweepDimensions () {
      return this.codeParams
        .filter(param => ['integer', 'number', 'percent'].includes(param.type))
        .map(param => {
        const values = this.buildSweepValues(param)
        return {
          key: param.name,
          path: `strategy_config.script_params.${param.name}`,
          paramName: param.name,
          label: param.displayLabel || param.label || param.name,
          displayLabel: param.displayLabel || param.label || param.name,
          values,
          displayValues: values,
          enabled: !this.disabledSweepKeys.includes(param.name)
        }
      })
        .filter(item => item.values.length > 1)
    },
    enabledSweepDimensions () {
      return this.experimentSweepDimensions.filter(item => item.enabled)
    },
    hasExperimentResult () {
      return !!(this.experimentResult && (this.experimentBest || this.experimentCandidateCards.length))
    },
    experimentProgressTitle () {
      if (this.experimentCurrentRound && this.experimentMaxRounds) return this.bt('backtest-center.experiment.round', 'round').replace('{current}', this.experimentCurrentRound).replace('{total}', this.experimentMaxRounds)
      return this.bt('backtest-center.experiment.tuning', 'tuning')
    },
    experimentRankedStrategies () {
      const data = this.experimentResult || {}
      const ranked = data.rankedStrategies || data.ranked_strategies || []
      if (Array.isArray(ranked) && ranked.length) return ranked
      const best = data.bestStrategyOutput || data.best_strategy_output
      return best ? [best] : []
    },
    experimentBest () {
      const data = this.experimentResult || {}
      return data.bestStrategyOutput || data.best_strategy_output || this.experimentRankedStrategies[0] || null
    },
    experimentSelectedCandidate () {
      if (!this.experimentRankedStrategies.length) return null
      const selected = this.experimentRankedStrategies.find(item => item && item.name === this.experimentSelectedCandidateName)
      return selected || this.experimentBest || this.experimentRankedStrategies[0]
    },
    experimentBestScore () {
      return this.scoreFromCandidate(this.experimentBest)
    },
    experimentBestGrade () {
      return this.experimentGradeFromScore(this.experimentBestScore)
    },
    experimentOosMeta () {
      const raw = (this.experimentResult && (this.experimentResult.oosValidation || this.experimentResult.oos_validation)) || {}
      return {
        enabled: !!raw.enabled,
        trainStart: raw.trainStart || raw.train_start || '',
        trainEnd: raw.trainEnd || raw.train_end || '',
        oosStart: raw.oosStart || raw.oos_start || '',
        oosEnd: raw.oosEnd || raw.oos_end || ''
      }
    },
    experimentBestSummary () {
      const r = this.resultFromCandidate(this.experimentBest)
      if (!r) return this.bt('backtest-center.experiment.waiting', 'waiting')
      return `${this.fmtPct(r.totalReturn)} / ${this.bt('backtest-center.experiment.dd', 'dd')} ${this.fmtPct(r.maxDrawdown)} / ${this.bt('backtest-center.experiment.trades', 'trades')} ${Number(r.totalTrades || 0)}`
    },
    experimentBestOosSummary () {
      const c = this.experimentBest || {}
      const r = this.resultFromCandidate({
        result: c.oosSummary || c.oos_summary || c.oosResult || c.oos_result || {}
      })
      const degrade = c.oosDegradation != null ? c.oosDegradation : c.oos_degradation
      if (!r || !Object.keys(r).length) return ''
      return `OOS ${this.fmtPct(r.totalReturn)}${Number.isFinite(Number(degrade)) ? ` / ${this.bt('backtest-center.experiment.degrade', 'degrade')} ${this.fmtPct(degrade)}` : ''}`
    },
    experimentSplitCards () {
      const cards = []
      const train = this.resultFromCandidate(this.experimentBest) || {}
      const best = this.experimentBest || {}
      const oos = this.resultFromCandidate({
        result: best.oosSummary || best.oos_summary || best.oosResult || best.oos_result || {}
      }) || {}
      const meta = this.experimentOosMeta || {}
      const rangeText = (start, end) => (start && end ? `${start} ~ ${end}` : '-')
      const metrics = result => [
        {
          label: this.bt('backtest-center.metrics.totalReturn', 'totalReturn'),
          value: this.fmtPct(result.totalReturn),
          cls: Number(result.totalReturn || 0) >= 0 ? 'positive-text' : 'negative-text'
        },
        {
          label: this.bt('backtest-center.metrics.maxDrawdown', 'maxDrawdown'),
          value: this.fmtPct(result.maxDrawdown),
          cls: Number(result.maxDrawdown || 0) < 0 ? 'negative-text' : ''
        },
        {
          label: this.bt('backtest-center.metrics.sharpe', 'sharpe'),
          value: this.fmtNum(result.sharpeRatio, 2),
          cls: ''
        },
        {
          label: this.bt('backtest-center.metrics.trades', 'trades'),
          value: this.fmtInt(result.totalTrades),
          cls: ''
        }
      ]
      if (Object.keys(train).length) {
        cards.push({
          key: 'train',
          title: this.bt('backtest-center.experiment.inSample', 'inSample'),
          range: rangeText(meta.trainStart, meta.trainEnd),
          metrics: metrics(train)
        })
      }
      if (Object.keys(oos).length) {
        cards.push({
          key: 'oos',
          title: this.bt('backtest-center.experiment.outOfSample', 'outOfSample'),
          range: rangeText(meta.oosStart, meta.oosEnd),
          metrics: metrics(oos)
        })
      }
      return cards
    },
    experimentCandidateCards () {
      return this.experimentRankedStrategies.slice(0, 12).map((candidate, index) => {
        const score = this.scoreFromCandidate(candidate)
        const result = this.resultFromCandidate(candidate) || {}
        return {
          raw: candidate,
          name: candidate.name || `variant_${index + 1}`,
          score,
          grade: this.experimentGradeFromScore(score),
          summary: `${this.fmtPct(result.totalReturn)} / ${this.bt('backtest-center.experiment.dd', 'dd')} ${this.fmtPct(result.maxDrawdown)}`
        }
      })
    },
    experimentRankingRows () {
      return this.experimentRankedStrategies.slice(0, 20).map((candidate, index) => {
        const result = this.resultFromCandidate(candidate) || {}
        const score = this.scoreFromCandidate(candidate)
        const totalReturn = Number(result.totalReturn || 0)
        return {
          raw: candidate,
          rank: index + 1,
          name: candidate.name || `variant_${index + 1}`,
          score,
          grade: this.experimentGradeFromScore(score),
          returnText: this.fmtPct(totalReturn),
          returnCls: totalReturn >= 0 ? 'positive-text' : 'negative-text',
          drawdownText: this.fmtPct(result.maxDrawdown),
          tradesText: this.fmtInt(result.totalTrades)
        }
      })
    },
    experimentSelectedChangeEntries () {
      const params = this.extractTuneParamsFromCandidate(this.experimentSelectedCandidate)
      return Object.keys(params).map(name => ({
        name,
        label: this.humanizeExperimentParamName(name),
        before: this.formatExperimentValue(this.paramValues[name]),
        after: this.formatExperimentValue(this.tuneParamForUi(name, params[name]))
      })).filter(item => item.before !== item.after)
    },
    experimentSelectedScoreComponents () {
      const score = (this.experimentSelectedCandidate && this.experimentSelectedCandidate.score) || {}
      const components = score.components || score.componentScores || score.component_scores || score
      const excluded = ['overallScore', 'overall_score', 'overall', 'total', 'grade', 'summary', 'components', 'componentScores', 'component_scores']
      return Object.keys(components).filter(key => !excluded.includes(key)).slice(0, 8).map(key => ({
        key,
        label: this.humanizeExperimentScoreKey(key),
        value: components[key]
      }))
    },
    experimentConvergenceData () {
      const rounds = (this.experimentResult && this.experimentResult.rounds) || []
      const points = rounds.length ? rounds : this.experimentRankedStrategies
      const values = points.map((item, index) => ({
        index,
        value: Number(item.globalBestScore || item.bestScore || this.scoreFromCandidate(item) || 0)
      }))
      const maxValue = Math.max(1, ...values.map(item => item.value))
      return values.slice(0, 50).map(item => ({ ...item, height: Math.max(8, Math.min(100, (item.value / maxValue) * 100)) }))
    },
    experimentOosMatrixData () {
      return this.experimentRankedStrategies.slice(0, 24).map((candidate, index) => {
        const train = (this.resultFromCandidate(candidate) || {}).totalReturn || 0
        const oosResult = this.resultFromCandidate({
          result: candidate.oosSummary || candidate.oos_summary || candidate.oosResult || candidate.oos_result || {}
        })
        const oos = Number.isFinite(Number(oosResult.totalReturn)) ? oosResult.totalReturn : train
        const tone = Number(oos) >= Number(train) * 0.5 ? 'good' : Number(oos) >= 0 ? 'warn' : 'bad'
        return { name: String(candidate.name || index + 1), tone }
      })
    },
    experimentParameterSensitivityData () {
      const analytics = (this.experimentResult && this.experimentResult.analytics) || {}
      const raw = analytics.parameterSensitivity || analytics.parameter_sensitivity || {}
      const entries = Array.isArray(raw) ? raw : Object.keys(raw).map(name => ({ name, value: raw[name] }))
      if (entries.length) {
        const max = Math.max(1, ...entries.map(item => Math.abs(Number(item.value || item.score || 0))))
        return entries.slice(0, 8).map(item => ({
          name: item.name,
          label: this.humanizeExperimentParamName(item.name),
          width: Math.max(6, Math.min(100, Math.abs(Number(item.value || item.score || 0)) / max * 100))
        }))
      }
      return this.enabledSweepDimensions.slice(0, 8).map((item, index) => ({
        name: item.paramName || item.key,
        label: item.label,
        width: Math.max(12, 100 - index * 12)
      }))
    },
    tuneBest () {
      if (this.experimentBest) {
        const params = this.extractTuneParamsFromCandidate(this.experimentBest)
        const result = this.resultFromCandidate(this.experimentBest) || {}
        return {
          ...this.experimentBest,
          params,
          totalReturn: result.totalReturn,
          maxDrawdown: result.maxDrawdown,
          totalTrades: result.totalTrades
        }
      }
      if (!this.tuneResults.length) return null
      const tradable = this.tuneResults.filter(item => Number((this.resultFromCandidate(item) || {}).totalTrades || item.totalTrades || 0) > 0)
      if (!tradable.length) return null
      return [...tradable].sort((a, b) => this.scoreTuneResult(b) - this.scoreTuneResult(a))[0]
    }
  },
  watch: {
    selectedAssetKey () {
      this.syncParamValuesFromCode()
      this.paramsExpanded = false
      this.$nextTick(() => {
        this.disabledSweepKeys = this.codeParams
          .filter(param => ['integer', 'number', 'percent'].includes(param.type))
          .map(param => param.name)
      })
      this.result = null
      this.replayKlines = []
      this.replayKlineRequestKey = ''
      this.tuneResults = []
      this.loadHistory()
      this.queueRenderReplayChart()
    },
    result () {
      this.disposeEquityChart()
      this.disposeReplayChart()
      this.loadReplayKlines()
      this.queueRenderEquityChart()
    },
    'form.marketType' () {
      this.enforceMarketTypeRules()
    },
    'form.timeframe' () {
      this.clampDateRangeForTimeframe()
    },
    '$route.fullPath' () {
      if (this.assets.length) {
        this.selectInitialAsset(true)
      } else {
        this.applyRouteParamsToForm()
      }
    },
    isDarkTheme () {
      this.disposeEquityChart()
      this.queueRenderEquityChart()
      this.disposeReplayChart()
      this.queueRenderReplayChart()
    },
    resolvedPrimaryColor () {
      this.queueRenderEquityChart()
      this.queueRenderReplayChart()
    },
    '$i18n.locale' () {
      this.queueRenderEquityChart()
      this.queueRenderReplayChart()
    }
  },
  created () {
    this.loadAssets()
    this.loadWatchlist()
    this.loadUniverses()
  },
  mounted () {
    this.equityResizeHandler = () => {
      if (this.equityChartInstance) this.equityChartInstance.resize()
    }
    this.replayResizeHandler = () => {
      if (this.replayChartInstance) this.replayChartInstance.resize()
    }
    window.addEventListener('resize', this.equityResizeHandler)
    window.addEventListener('resize', this.replayResizeHandler)
    this.queueRenderEquityChart()
    this.queueRenderReplayChart()
  },
  updated () {
    if (this.hasResult && this.equitySeries.length > 1 && !this.equityChartInstance) {
      this.queueRenderEquityChart()
    }
    if (this.replayActionTotal > 0 && this.replayCandles.length && !this.replayChartInstance) {
      this.queueRenderReplayChart()
    }
  },
  beforeDestroy () {
    window.removeEventListener('resize', this.equityResizeHandler)
    window.removeEventListener('resize', this.replayResizeHandler)
    this.disposeEquityChart()
    this.disposeReplayChart()
  },
  methods: {
    setResultSection (section) {
      this.resultSection = section
      if (section === 'replay') this.$nextTick(() => this.queueRenderReplayChart())
      if (section === 'trades') this.$nextTick(() => this.renderEquityChart())
    },
    bt (key, fallback) {
      if (this.$t) {
        const value = this.$t(key)
        if (value && value !== key) return value
      }
      return fallback
    },
    getCodeParamLabel (param = {}) {
      const name = String(param.name || '').trim()
      if (!name) return ''
      const aliasKeys = {
        entryPct: 'indicatorIde.strategyDirectives.fields.entryPct',
        stopLossPct: 'indicatorIde.strategyDirectives.fields.stopLossPct',
        takeProfitPct: 'indicatorIde.strategyDirectives.fields.takeProfitPct',
        trailingEnabled: 'indicatorIde.strategyDirectives.fields.trailingEnabled',
        trailingStopPct: 'indicatorIde.strategyDirectives.fields.trailingStopPct',
        trailingActivationPct: 'indicatorIde.strategyDirectives.fields.trailingActivationPct',
        maxHoldingBars: 'trading-assistant.strategyAnnotation.maxHoldingBars.label'
      }
      const candidates = [
        aliasKeys[name],
        `trading-assistant.templateParam.${name}.label`
      ].filter(Boolean)
      for (const key of candidates) {
        const value = this.bt(key, '')
        if (value) return value
      }
      const locale = String((this.$i18n && this.$i18n.locale) || '').toLowerCase()
      if (locale.startsWith('en') && param.label) return param.label
      return name
    },
    routeQueryValue (...keys) {
      const q = this.$route && this.$route.query ? this.$route.query : {}
      for (const key of keys) {
        const raw = q[key]
        const value = Array.isArray(raw) ? raw[0] : raw
        if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim()
      }
      return ''
    },
    routeQueryNumber (...keys) {
      const value = this.routeQueryValue(...keys)
      if (!value) return null
      const number = Number(value)
      return Number.isFinite(number) ? number : null
    },
    routeQueryBoolean (...keys) {
      const value = this.routeQueryValue(...keys).toLowerCase()
      if (!value) return null
      if (['1', 'true', 'yes', 'on'].includes(value)) return true
      if (['0', 'false', 'no', 'off'].includes(value)) return false
      return null
    },
    applyRouteParamsToForm () {
      const symbol = this.routeQueryValue('symbol', 'trading_pair', 'pair')
      const market = this.routeQueryValue('market', 'market_category', 'marketCategory')
      const marketType = this.routeQueryValue('market_type', 'marketType')
      const exchangeId = this.routeQueryValue('exchange_id', 'exchangeId')
      const direction = this.routeQueryValue('trade_direction', 'tradeDirection', 'direction').toLowerCase()
      const universeId = this.routeQueryNumber('universe_id', 'universeId')
      if (symbol) this.form.symbol = symbol
      if (market) this.form.market = this.normalizeMarket(market)
      if (marketType) this.form.marketType = this.normalizeMarketType(marketType)
      if (exchangeId) this.form.exchangeId = exchangeId.toLowerCase()
      if (['long', 'short', 'both'].includes(direction)) this.form.tradeDirection = direction
      if (universeId !== null) this.form.universeId = universeId

      const initialCapital = this.routeQueryNumber('initial_capital', 'initialCapital', 'investment_amount', 'investmentAmount', 'capital')
      const leverage = this.routeQueryNumber('leverage')
      const commissionPct = this.routeQueryNumber('commission_pct', 'commissionPct', 'commission')
      const slippagePct = this.routeQueryNumber('slippage_pct', 'slippagePct', 'slippage')
      const fundingRateAnnual = this.routeQueryNumber('funding_rate_annual', 'fundingRateAnnual')
      const fundingIntervalHours = this.routeQueryNumber('funding_interval_hours', 'fundingIntervalHours')
      const strictMode = this.routeQueryBoolean('strict_mode', 'strictMode')
      const intrabarMode = this.routeQueryValue('intrabar_mode', 'intrabarMode')

      if (initialCapital !== null) this.form.initialCapital = initialCapital
      if (leverage !== null) this.form.leverage = leverage
      if (commissionPct !== null) this.form.commissionPct = commissionPct
      if (slippagePct !== null) this.form.slippagePct = slippagePct
      if (fundingRateAnnual !== null) this.form.fundingRateAnnual = fundingRateAnnual
      if (fundingIntervalHours !== null) this.form.fundingIntervalHours = fundingIntervalHours
      if (strictMode !== null) this.form.strictMode = strictMode
      if (intrabarMode) this.form.intrabarMode = this.normalizeIntrabarMode(intrabarMode)

      this.enforceMarketTypeRules()
      this.syncSelectedWatchlistKey()
      this.clampDateRangeForTimeframe()
    },
    moneyFormatter (value) {
      return `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    },
    moneyParser (value) {
      return String(value || '').replace(/\$\s?|(,*)/g, '')
    },
    filterAssetOption (input, option) {
      const key = String(option.componentOptions.propsData.value || '')
      const asset = (this.assets || []).find(item => item.asset_key === key)
      const text = `${asset ? asset.name : ''} ${asset ? asset.engine : ''} ${asset ? asset.description : ''}`.toLowerCase()
      return text.includes(String(input || '').toLowerCase())
    },
    handleAssetSelectChange (key) {
      const asset = (this.assets || []).find(item => item.asset_key === key)
      if (asset) this.selectAsset(asset)
    },
    async loadWatchlist () {
      this.loadingWatchlist = true
      try {
        const res = await getWatchlist({ userid: this.userId })
        const rows = res && Array.isArray(res.data) ? res.data : []
        this.watchlist = rows.filter(item => item && item.symbol)
        this.ensureSelectedWatchlist()
      } catch (e) {
        this.watchlist = []
      } finally {
        this.loadingWatchlist = false
      }
    },
    ensureSelectedWatchlist () {
      const key = `${this.form.market}:${this.form.symbol}`
      const exists = (this.watchlist || []).some(item => `${item.market}:${item.symbol}` === key)
      this.selectedWatchlistKey = exists ? key : key
    },
    syncSelectedWatchlistKey () {
      this.selectedWatchlistKey = this.form.symbol
        ? this.watchlistContextKey({
            market: this.form.market,
            symbol: this.form.symbol,
            exchange_id: this.form.exchangeId,
            market_type: this.form.marketType
          })
        : undefined
    },
    filterWatchlistOption (input, option) {
      const val = String(option.componentOptions.propsData.value || '')
      if (val === '__add__') return true
      const row = (this.watchlistOptions || []).find(item => `${item.market}:${item.symbol}` === val)
      const text = `${val} ${row ? row.name : ''}`.toLowerCase()
      return text.includes(String(input || '').toLowerCase())
    },
    watchlistContextKey (item) {
      return marketContextKey(item)
    },
    marketTypeLabel (marketType) {
      return String(marketType || '').toLowerCase() === 'swap' ? this.copy.swap : this.copy.spot
    },
    handleWatchlistChange (val) {
      if (val === '__add__') {
        this.addMarketTab = this.form.market || 'Crypto'
        this.showAddModal = true
        this.$nextTick(() => {
          this.selectedWatchlistKey = `${this.form.market}:${this.form.symbol}`
        })
        return
      }
      if (!val) {
        this.form.symbol = ''
        return
      }
      const row = (this.watchlistOptions || []).find(item => this.watchlistContextKey(item) === val)
      if (row) {
        this.form.market = row.market || this.form.market
        this.form.symbol = row.symbol || this.form.symbol
      } else {
        const splitIndex = String(val).indexOf(':')
        if (splitIndex > 0) {
          this.form.market = String(val).slice(0, splitIndex)
          this.form.symbol = String(val).slice(splitIndex + 1)
        }
      }
      this.selectedWatchlistKey = this.watchlistContextKey({
        market: this.form.market,
        symbol: this.form.symbol
      })
    },
    handleExchangeChange () {
      this.syncSelectedWatchlistKey()
      this.result = null
    },
    handleMarketTypeChange () {
      this.enforceMarketTypeRules()
      this.syncSelectedWatchlistKey()
      this.result = null
    },
    enforceMarketTypeRules () {
      if (this.isSpotMode) {
        this.form.leverage = 1
        this.form.tradeDirection = 'long'
        this.form.fundingRateAnnual = 0
      } else if (!this.form.fundingIntervalHours) {
        this.form.fundingIntervalHours = 8
      }
    },
    marketLabel (market) {
      const labels = {
        Crypto: this.bt('backtest-center.marketLabel.crypto', 'crypto'),
        USStock: this.bt('backtest-center.marketLabel.usStock', 'usStock'),
        CNStock: this.bt('backtest-center.marketLabel.cnStock', 'cnStock'),
        HKStock: this.bt('backtest-center.marketLabel.hkStock', 'hkStock'),
        Forex: this.bt('backtest-center.marketLabel.forex', 'forex'),
        Futures: this.bt('backtest-center.marketLabel.futures', 'futures')
      }
      return labels[market] || market || ''
    },
    onAddMarketTabChange () {
      this.addSearchKeyword = ''
      this.addSearchResults = []
      this.addSelectedItem = null
      this.addSearched = false
    },
    onAddSourceChange () {
      this.addSearchResults = []
      this.addSelectedItem = null
      this.addSearched = false
      if (this.addSearchKeyword) this.doAddSearch()
    },
    onAddSearchInput () {
      clearTimeout(this.addSearchTimer)
      if (!this.addSearchKeyword) {
        this.addSearchResults = []
        this.addSelectedItem = null
        this.addSearched = false
        return
      }
      this.addSearchTimer = setTimeout(() => this.doAddSearch(), 350)
    },
    async doAddSearch () {
      if (!this.addSearchKeyword) return
      this.addSearching = true
      try {
        const res = await searchSymbols({
          market: this.addMarketTab,
          keyword: this.addSearchKeyword,
          limit: 20,
          exchange_id: this.addMarketTab === 'Crypto' ? this.form.exchangeId : undefined,
          market_type: this.addMarketTab === 'Crypto' ? this.form.marketType : undefined
        })
        this.addSearchResults = res && Array.isArray(res.data) ? res.data : []
        this.addSearched = true
        if (!this.addSearchResults.length) {
          this.addSelectedItem = {
            market: this.addMarketTab,
            symbol: this.addSearchKeyword.trim().toUpperCase(),
            name: ''
          }
        }
      } catch (e) {
        this.addSearchResults = []
        this.addSearched = true
        this.addSelectedItem = {
          market: this.addMarketTab,
          symbol: this.addSearchKeyword.trim().toUpperCase(),
          name: ''
        }
      } finally {
        this.addSearching = false
      }
    },
    async handleAddStock () {
      const item = this.addSelectedItem || (this.addSearchKeyword
        ? { market: this.addMarketTab, symbol: this.addSearchKeyword.trim().toUpperCase(), name: '' }
        : null)
      if (!item || !item.symbol) {
        this.$message.warning(this.copy.symbolRequired)
        return
      }
      this.addingStock = true
      try {
        const market = item.market || this.addMarketTab
        await addWatchlist({
          userid: this.userId,
          market,
          symbol: item.symbol,
          name: item.name || '',
          exchange_id: item.exchange_id || (market === 'Crypto' ? this.form.exchangeId : ''),
          market_type: item.market_type || (market === 'Crypto' ? this.form.marketType : 'spot'),
          instrument_id: item.instrument_id || '',
          settle_currency: item.settle_currency || ''
        })
        await this.loadWatchlist()
        this.form.market = market
        this.form.symbol = item.symbol
        this.selectedWatchlistKey = this.watchlistContextKey({
          market,
          symbol: item.symbol
        })
        this.$message.success(this.copy.addSuccess)
        this.closeAddModal()
      } catch (e) {
        this.$message.error(e.backendMessage || e.message || 'Failed')
      } finally {
        this.addingStock = false
      }
    },
    closeAddModal () {
      this.showAddModal = false
      this.addSearchKeyword = ''
      this.addSearchResults = []
      this.addSelectedItem = null
      this.addSearched = false
    },
    async loadUniverses () {
      this.loadingUniverses = true
      try {
        const res = await getUniverses()
        const payload = this.unwrapApiPayload(res)
        this.universes = Array.isArray(payload) ? payload : []
        if (!this.form.universeId && this.universes.length) {
          const preferred = this.universes.find(item => item.market !== 'Mixed' && Number(item.member_count || 0) > 0) || this.universes.find(item => item.code === 'watchlist' && Number(item.member_count || 0) > 0) || this.universes.find(item => Number(item.member_count || 0) > 0) || this.universes[0]
          this.form.universeId = preferred && preferred.id
        }
      } catch (e) {
        this.universes = []
        this.$message.error(e.backendMessage || e.message || this.bt('backtest-center.message.universeLoadFailed', 'universeLoadFailed'))
      } finally {
        this.loadingUniverses = false
      }
    },
    universeLabel (universe) {
      if (!universe) return '-'
      const key = universe.name_i18n_key || universe.nameI18nKey
      if (key) {
        const translated = this.$t(key)
        if (translated && translated !== key) return translated
      }
      return universe.name || universe.code || '-'
    },
    async loadAssets () {
      this.loadingAssets = true
      try {
        const res = await getStrategyAssetList()
        const items = res && res.data && Array.isArray(res.data.items) ? res.data.items : []
        this.assets = items
          .filter(item => item.can_backtest !== false && ['script', 'portfolio_strategy'].includes(String(item.asset_type || '')))
          .map(item => this.localizeStrategyAsset(item))
        this.selectInitialAsset()
      } catch (e) {
        this.$message.error(e.backendMessage || e.message || 'Failed to load strategy assets')
      } finally {
        this.loadingAssets = false
      }
    },
    localizeStrategyAsset (asset) {
      const item = { ...asset }
      const nameKey = item.name_i18n_key || item.nameI18nKey
      const descriptionKey = item.description_i18n_key || item.descriptionI18nKey
      if (nameKey) {
        const translated = this.$t(nameKey)
        if (translated && translated !== nameKey) item.name = translated
      }
      if (descriptionKey) {
        const translated = this.$t(descriptionKey)
        if (translated && translated !== descriptionKey) item.description = translated
      }
      return item
    },
    selectInitialAsset (force = false) {
      if (!force && this.selectedAssetKey && this.assets.some(item => item.asset_key === this.selectedAssetKey)) {
        this.applyRouteParamsToForm()
        return
      }
      const q = this.$route.query || {}
      const qType = String(q.asset_type || q.assetType || '').toLowerCase()
      const qId = String(q.asset_id || q.assetId || q.source_id || q.sourceId || '').trim()
      const matched = this.assets.find(item => {
        const itemId = String(item.source_id || item.id || '')
        return qType && qId && item.asset_type === qType && itemId === qId
      })
      const fallback = matched || this.assets[0]
      if (fallback) this.selectAsset(fallback)
    },
    selectAsset (asset) {
      this.selectedAssetKey = asset.asset_key
      const cfg = {
        ...(asset.trading_config || {}),
        ...(asset.indicator_config || {}),
        ...(asset.metadata || {})
      }
      this.form.symbol = cfg.symbol || cfg.trading_pair || cfg.pair || this.form.symbol
      this.form.market = cfg.market_category || cfg.market || this.form.market
      const exchangeConfig = asset.exchange_config || cfg.exchange_config || {}
      this.form.exchangeId = exchangeConfig.exchange_id || cfg.exchange_id || cfg.exchangeId || this.form.exchangeId
      this.selectedWatchlistKey = this.watchlistContextKey({
        market: this.form.market,
        symbol: this.form.symbol,
        exchange_id: this.form.exchangeId,
        market_type: cfg.market_type || cfg.marketType || this.form.marketType
      })
      this.form.timeframe = this.resolveCodeTimeframe(this.selectedAssetCode || this.selectedAssetOriginalCode || '') || cfg.timeframe || cfg.period || this.form.timeframe
      this.form.marketType = this.normalizeMarketType(cfg.market_type || cfg.marketType || this.form.marketType)
      if (cfg.initial_capital || cfg.investment_amount || asset.initial_capital) {
        this.form.initialCapital = Number(cfg.initial_capital || cfg.investment_amount || asset.initial_capital)
      }
      if (cfg.leverage) this.form.leverage = Number(cfg.leverage)
      if (cfg.trade_direction || cfg.direction) this.form.tradeDirection = String(cfg.trade_direction || cfg.direction)
      const feesCfg = cfg.fees || {}
      if (feesCfg.fundingRateAnnual !== undefined) this.form.fundingRateAnnual = Number(feesCfg.fundingRateAnnual || 0)
      if (feesCfg.fundingIntervalHours !== undefined) this.form.fundingIntervalHours = Number(feesCfg.fundingIntervalHours || 8)
      const execCfg = cfg.execution || {}
      const intrabarMode = execCfg.intrabarMode || execCfg.intrabar_mode || cfg.intrabarMode || cfg.intrabar_mode
      if (intrabarMode) this.form.intrabarMode = this.normalizeIntrabarMode(intrabarMode)
      if (asset.asset_type === 'portfolio_strategy') {
        this.form.timeframe = '1D'
        this.form.marketType = 'spot'
        this.form.leverage = 1
        this.form.tradeDirection = 'long'
        this.form.universeId = Number(cfg.universe_id || cfg.universeId || this.form.universeId) || this.form.universeId
        this.form.rebalanceFrequency = cfg.rebalance_frequency || cfg.rebalanceFrequency || this.form.rebalanceFrequency
        if (cfg.max_weight || cfg.maxWeight) this.form.maxWeightPct = Number(cfg.max_weight || cfg.maxWeight) * 100
      }
      this.syncRiskControlsFromCode()
      this.applyRouteParamsToForm()
    },
    resolveCodeTimeframe (code) {
      const parsed = this.parseStrategyAnnotations(code || '')
      const raw = String(parsed.timeframe || parsed.kline_timeframe || parsed.klineTimeframe || '').trim()
      if (!raw) return ''
      return this.timeframes.includes(raw) ? raw : ''
    },
    syncRiskControlsFromCode () {
      const parsed = this.parseStrategyAnnotations(this.selectedAssetCode || this.selectedAssetOriginalCode || '')
      const nested = this.buildRiskConfigFromFlat(parsed)
      const risk = nested.risk || {}
      const trailing = risk.trailing || {}
      const position = nested.position || {}
      this.form.risk = {
        entryPct: this.safeRiskNumber(position.entryPct, 1),
        stopLossPct: this.safeRiskNumber(risk.stopLossPct, 0),
        takeProfitPct: this.safeRiskNumber(risk.takeProfitPct, 0),
        trailingEnabled: !!trailing.enabled,
        trailingStopPct: this.safeRiskNumber(trailing.pct, 0),
        trailingActivationPct: this.safeRiskNumber(trailing.activationPct, 0),
        maxHoldingBars: this.safeRiskInteger(risk.maxHoldingBars, 0),
        exitOwner: nested.exitOwner || 'engine'
      }
      const timing = String(parsed.signalTiming || '').trim()
      if (timing) {
        this.form.strictMode = !['same_bar_close', 'same_bar', 'current_bar', 'current'].includes(timing.toLowerCase())
      }
    },
    parseStrategyAnnotations (code) {
      const parsed = {}
      const text = String(code || '')
      const lineRe = /^\s*#\s*@strategy\s+([A-Za-z_][\w-]*)\s*:?\s+([^\s#]+).*$/gm
      let match
      while ((match = lineRe.exec(text))) {
        parsed[match[1]] = this.coerceStrategyValue(match[2])
      }
      const headerRe = /(?:^|\n)\s*#\s*[-=\s]*.*?\b(exit_owner|exitOwner|signal_timing|signalTiming|timeframe|kline_timeframe|klineTimeframe)\s*:\s*([A-Za-z0-9_-]+)/gi
      while ((match = headerRe.exec(text))) {
        parsed[match[1]] = this.coerceStrategyValue(match[2])
      }
      if (parsed.exit_owner && !parsed.exitOwner) parsed.exitOwner = parsed.exit_owner
      if (parsed.signal_timing && !parsed.signalTiming) parsed.signalTiming = parsed.signal_timing
      if (parsed.kline_timeframe && !parsed.klineTimeframe) parsed.klineTimeframe = parsed.kline_timeframe
      return parsed
    },
    coerceStrategyValue (value) {
      const raw = String(value == null ? '' : value).trim()
      if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === 'true'
      const num = Number(raw)
      return Number.isFinite(num) && raw !== '' ? num : raw
    },
    buildRiskConfigFromFlat (flat = {}) {
      const trailingEnabled = !!flat.trailingEnabled
      return {
        exitOwner: String(flat.exitOwner || flat.exit_owner || 'engine').toLowerCase(),
        position: {
          entryPct: this.normalizeEntryPct(flat.entryPct)
        },
        risk: {
          stopLossPct: this.safeRiskNumber(flat.stopLossPct, 0),
          takeProfitPct: this.safeRiskNumber(flat.takeProfitPct, 0),
          maxHoldingBars: this.safeRiskInteger(flat.maxHoldingBars, 0),
          trailing: {
            enabled: trailingEnabled,
            pct: trailingEnabled ? this.safeRiskNumber(flat.trailingStopPct, 0) : 0,
            activationPct: trailingEnabled ? this.safeRiskNumber(flat.trailingActivationPct, 0) : 0
          }
        }
      }
    },
    normalizeEntryPct (value) {
      const num = this.safeRiskNumber(value, 1)
      if (num > 1) return Math.min(num / 100, 1)
      return Math.min(Math.max(num, 0.01), 1)
    },
    safeRiskNumber (value, fallback = 0) {
      const num = Number(value)
      return Number.isFinite(num) ? num : fallback
    },
    safeRiskInteger (value, fallback = 0) {
      const num = Number(value)
      return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : fallback
    },
    buildRiskStrategyConfig () {
      const risk = this.form.risk || {}
      const trailingEnabled = !!risk.trailingEnabled
      return {
        exitOwner: String(risk.exitOwner || 'engine').toLowerCase(),
        position: {
          entryPct: this.normalizeEntryPct(risk.entryPct)
        },
        risk: {
          stopLossPct: Math.max(0, this.safeRiskNumber(risk.stopLossPct, 0)),
          takeProfitPct: Math.max(0, this.safeRiskNumber(risk.takeProfitPct, 0)),
          maxHoldingBars: this.safeRiskInteger(risk.maxHoldingBars, 0),
          trailing: {
            enabled: trailingEnabled,
            pct: trailingEnabled ? Math.max(0, this.safeRiskNumber(risk.trailingStopPct, 0)) : 0,
            activationPct: trailingEnabled ? Math.max(0, this.safeRiskNumber(risk.trailingActivationPct, 0)) : 0
          }
        }
      }
    },
    assetTypeText (type) {
      if (type === 'script') return this.copy.script
      if (type === 'bot') return this.copy.bot
      if (type === 'portfolio_strategy') return this.copy.portfolioStrategy
      return type || '-'
    },
    syncParamValuesFromCode () {
      const template = this.paramTemplate
      const values = template ? buildTemplateParamValues(template) : {}
      this.paramValues = {}
      Object.keys(values).forEach(key => this.$set(this.paramValues, key, values[key]))
    },
    resetCodeParams () {
      this.syncParamValuesFromCode()
    },
    setParamValue (name, value) {
      this.$set(this.paramValues, name, value)
      this.result = null
      this.experimentResult = null
    },
    codeParamNameParts (name) {
      return String(name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    },
    isCodeParamPeriodLike (param = {}) {
      const name = String(param.name || '').toLowerCase()
      const parts = this.codeParamNameParts(name)
      const periodTokens = ['period', 'lookback', 'window', 'length', 'len', 'bars', 'ema', 'sma', 'rsi', 'adx', 'ma']
      const nonPeriodTokens = ['pct', 'percent', 'ratio', 'rate', 'mult', 'multiplier', 'threshold', 'distance', 'width', 'bandwidth', 'risk', 'target', 'stop', 'pullback', 'activation']
      if (parts.some(token => nonPeriodTokens.includes(token))) return false
      return periodTokens.includes(name) || periodTokens.some(token => name.endsWith(`_${token}`)) || name.endsWith('_atr_period')
    },
    codeParamDecimalPrecision (value) {
      const num = Number(value)
      if (!Number.isFinite(num) || Number.isInteger(num)) return 0
      const raw = String(value)
      if (/e-/i.test(raw)) {
        const [, exponent = '0'] = raw.toLowerCase().split('e-')
        return Math.min(10, Math.max(0, Number(exponent)))
      }
      const [, decimals = ''] = raw.split('.')
      return Math.min(10, decimals.replace(/0+$/, '').length)
    },
    getCodeParamPrecision (param) {
      if (!param) return undefined
      if (param.type === 'integer') return 0
      const candidates = [
        param.step,
        param.default,
        this.paramValues && this.paramValues[param.name],
        param.min,
        param.max
      ]
      const precision = candidates.reduce((max, value) => Math.max(max, this.codeParamDecimalPrecision(value)), 0)
      if (param.type === 'percent' && precision > 0) return Math.max(precision, 4)
      return precision || undefined
    },
    normalizeParamCompareValue (value) {
      if (value === undefined || value === null) return ''
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      const raw = String(value).trim()
      const num = Number(raw)
      if (Number.isFinite(num) && raw !== '') {
        return String(Number(num.toFixed(10)))
      }
      return raw
    },
    async saveParamsAsCodeVersion () {
      if (!this.selectedAsset) {
        this.$message.warning(this.copy.selectAssetFirst)
        return
      }
      if (!this.canPersistParamsToCode) {
        this.$message.warning(this.paramPersistUnavailableText)
        return
      }
      const nextCode = this.codeWithCurrentParamsForPersist
      if (!nextCode || !String(nextCode).trim()) {
        this.$message.warning(this.copy.noCodeToSave)
        return
      }
      if (String(nextCode) === String(this.selectedAssetOriginalCode || '')) {
        this.$message.info(this.copy.paramsAlreadySaved)
        return
      }

      this.savingCodeVersion = true
      try {
        const asset = this.selectedAsset
        const assetId = asset.source_id || asset.id
        let res
        if (['script', 'portfolio_strategy'].includes(asset.asset_type)) {
          res = await updateScriptSource(assetId, {
            id: assetId,
            name: asset.name || '',
            description: asset.description || '',
            code: nextCode,
            asset_type: asset.asset_type,
            template_key: asset.template_key || asset.templateKey || '',
            param_schema: asset.param_schema || asset.paramSchema || {},
            metadata: asset.metadata || {}
          })
        } else {
          throw new Error(this.paramPersistUnavailableText)
        }
        this.assertSaveResponse(res)

        this.$set(asset, 'code', nextCode)
        if (asset.asset_key) this.$delete(this.tunedCodeByAssetKey, asset.asset_key)
        this.syncParamValuesFromCode()
        this.$message.success(this.copy.paramsSaved)
      } catch (error) {
        const msg = (error && (error.message || error.msg)) || this.copy.saveVersionFailed
        this.$message.error(msg)
      } finally {
        this.savingCodeVersion = false
      }
    },
    assertSaveResponse (res) {
      if (!res) return
      if (res.success === false || res.ok === false || res.code === 0 || res.status === 'error') {
        throw new Error(res.msg || res.message || this.copy.saveVersionFailed)
      }
    },
    applyPreset (days) {
      const safeDays = Math.min(Number(days || 30), this.maxBacktestDays)
      this.activePresetDays = safeDays
      this.endDate = moment()
      this.startDate = moment().subtract(safeDays, 'days')
      this.syncPanelDateRange()
    },
    onDateRangeChange () {
      this.activePresetDays = null
      this.clampDateRangeForTimeframe()
    },
    getMaxBacktestDays (timeframe) {
      const tf = String(timeframe || '').trim().toLowerCase()
      if (tf === '1m') return 30
      if (tf === '5m') return 90
      if (tf === '15m' || tf === '30m') return 180
      if (tf === '1h') return 365
      if (tf === '4h') return 730
      return 1095
    },
    clampDateRangeForTimeframe () {
      if (!this.startDate || !this.endDate) return
      const maxDays = this.maxBacktestDays
      const start = moment(this.startDate)
      const end = moment(this.endDate)
      if (!start.isValid() || !end.isValid()) return
      if (end.diff(start, 'days', true) > maxDays) {
        this.startDate = moment(end).subtract(maxDays, 'days')
        this.activePresetDays = this.datePresets.some(item => item.days === maxDays) ? maxDays : null
      }
      this.syncPanelDateRange()
    },
    syncPanelDateRange () {
      // Kept as a local boundary for range changes; the standalone workbench no longer proxies to a child panel.
    },
    async runBacktest () {
      if (!this.selectedAsset) {
        this.$message.warning(this.copy.selectAssetFirst)
        return
      }
      this.running = true
      this.result = null
      try {
        const res = await this.runUnified({
          startDate: this.startDate && this.startDate.format ? this.startDate.format('YYYY-MM-DD') : undefined,
          endDate: this.endDate && this.endDate.format ? this.endDate.format('YYYY-MM-DD') : undefined
        })
        this.applyRunResult(res)
        await this.loadHistory()
        if (this.hasZeroTradeResult) {
          this.$message.warning(this.bt('backtest-center.message.noTrades', 'noTrades'))
        } else {
          this.$message.success(this.bt('backtest-center.message.completed', 'completed'))
        }
      } catch (error) {
        this.$message.error((error && (error.message || error.msg)) || this.bt('backtest-center.message.failed', 'failed'))
      } finally {
        this.running = false
      }
    },
    applyRunResult (res) {
      const payload = this.unwrapApiPayload(res)
      this.result = this.normalizeBacktestResult(payload || {})
    },
    unwrapApiPayload (res) {
      if (!res || typeof res !== 'object') return res
      if (Object.prototype.hasOwnProperty.call(res, 'code') && Object.prototype.hasOwnProperty.call(res, 'data')) {
        return res.data
      }
      if (res.data && typeof res.data === 'object') {
        if (Object.prototype.hasOwnProperty.call(res.data, 'code') && Object.prototype.hasOwnProperty.call(res.data, 'data')) {
          return res.data.data
        }
        return res.data
      }
      return res
    },
    normalizeBacktestResult (raw = {}) {
      if (raw && raw.result && typeof raw.result === 'object' && !Array.isArray(raw.result)) {
        const nested = raw.result
        raw = {
          ...nested,
          ...raw,
          result: nested,
          runId: raw.runId || raw.run_id || nested.runId || nested.run_id,
          id: raw.id || nested.id,
          totalReturn: nested.totalReturn != null ? nested.totalReturn : (raw.totalReturn != null ? raw.totalReturn : raw.total_return),
          maxDrawdown: nested.maxDrawdown != null ? nested.maxDrawdown : (raw.maxDrawdown != null ? raw.maxDrawdown : raw.max_drawdown),
          winRate: nested.winRate != null ? nested.winRate : (raw.winRate != null ? raw.winRate : raw.win_rate),
          sharpeRatio: nested.sharpeRatio != null ? nested.sharpeRatio : (raw.sharpeRatio != null ? raw.sharpeRatio : raw.sharpe_ratio),
          profitFactor: nested.profitFactor != null ? nested.profitFactor : (raw.profitFactor != null ? raw.profitFactor : raw.profit_factor),
          totalTrades: nested.totalTrades != null ? nested.totalTrades : (raw.totalTrades != null ? raw.totalTrades : raw.total_trades)
        }
      }
      const result = { ...raw }
      result.rawTrades = this.pickArray(result, ['rawTrades', 'raw_trades', 'trades'])
      result.closedTrades = this.pickArray(result, ['closedTrades', 'closed_trades', 'tradeRecords', 'trade_records'])
      result.tradeRecords = result.closedTrades
      result.trades = result.rawTrades.length ? result.rawTrades : result.closedTrades
      result.orders = this.pickArray(result, ['orders', 'orderRecords', 'order_records'])
      result.replayKlines = this.pickArray(result, ['replayKlines', 'replay_klines', 'replayData.bars', 'replay_data.bars', 'replay.bars', 'klines', 'candles', 'bars'])
      result.equityCurve = this.pickArray(result, ['equityCurve', 'equity_curve', 'equity', 'balanceCurve', 'balance_curve', 'portfolioValues', 'portfolio_values'])
      result.benchmarkCurve = this.pickArray(result, ['benchmarkCurve', 'benchmark_curve', 'benchmarkEquityCurve', 'benchmark_equity_curve', 'benchmark.curve'])
      result.totalReturn = this.pickNumberDeep(result, ['totalReturn', 'total_return', 'total_return_pct', 'returnPct', 'return_pct', 'profitRate', 'profit_rate', 'metrics.totalReturn', 'metrics.total_return'], 0)
      result.maxDrawdown = this.pickNumberDeep(result, ['maxDrawdown', 'max_drawdown', 'drawdown', 'maxDd', 'metrics.maxDrawdown', 'metrics.max_drawdown'], 0)
      result.winRate = this.pickNumberDeep(result, ['winRate', 'win_rate', 'metrics.winRate', 'metrics.win_rate'], 0)
      result.sharpeRatio = this.pickNumberDeep(result, ['sharpeRatio', 'sharpe_ratio', 'sharpe', 'metrics.sharpeRatio', 'metrics.sharpe_ratio'], 0)
      result.profitFactor = this.pickNumberDeep(result, ['profitFactor', 'profit_factor', 'metrics.profitFactor'], 0)
      const closedProfits = (result.closedTrades || [])
        .map(item => this.pickNumberDeep(item, ['profit', 'pnl', 'realized_pnl', 'realizedPnl'], NaN))
        .filter(Number.isFinite)
      const fallbackBest = closedProfits.length ? Math.max(...closedProfits) : 0
      const fallbackWorst = closedProfits.length ? Math.min(...closedProfits) : 0
      const fallbackAvg = closedProfits.length ? closedProfits.reduce((sum, value) => sum + value, 0) / closedProfits.length : 0
      result.bestTrade = this.pickNumberDeep(result, ['bestTrade', 'best_trade', 'largestWin', 'largest_win', 'metrics.bestTrade', 'metrics.largestWin', 'metrics.largest_win'], fallbackBest)
      result.worstTrade = this.pickNumberDeep(result, ['worstTrade', 'worst_trade', 'largestLoss', 'largest_loss', 'metrics.worstTrade', 'metrics.largestLoss', 'metrics.largest_loss'], fallbackWorst)
      result.avgTrade = this.pickNumberDeep(result, ['avgTrade', 'avg_trade', 'metrics.avgTrade'], fallbackAvg)
      if (closedProfits.some(value => value !== 0)) {
        if (Number(result.bestTrade) === 0) result.bestTrade = fallbackBest
        if (Number(result.worstTrade) === 0) result.worstTrade = fallbackWorst
        if (Number(result.avgTrade) === 0) result.avgTrade = fallbackAvg
      }
      const fallbackTradeCount = Array.isArray(result.closedTrades) && result.closedTrades.length
        ? result.closedTrades.length
        : (Array.isArray(result.trades) ? result.trades.length : 0)
      result.totalTrades = this.pickNumberDeep(result, ['totalTrades', 'total_trades', 'tradeCount', 'trade_count', 'metrics.totalTrades', 'metrics.total_trades'], fallbackTradeCount)
      if (!Number(result.totalTrades) && fallbackTradeCount) result.totalTrades = fallbackTradeCount
      return result
    },
    timeframeToSeconds (timeframe) {
      const tf = String(timeframe || '').trim()
      return {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '30m': 1800,
        '1H': 3600,
        '1h': 3600,
        '4H': 14400,
        '4h': 14400,
        '1D': 86400,
        '1d': 86400,
        '1W': 604800,
        '1w': 604800
      }[tf] || 86400
    },
    resolveReplayContext (result = this.result) {
      const assumptions = (result && (result.executionAssumptions || result.execution_assumptions)) || {}
      const nested = (result && result.result) || {}
      const startValue = result && (result.startDate || result.start_date || result.start || result.from || nested.startDate || nested.start_date)
      const endValue = result && (result.endDate || result.end_date || result.end || result.to || nested.endDate || nested.end_date)
      const start = startValue ? moment(startValue) : moment(this.startDate)
      const end = endValue ? moment(endValue) : moment(this.endDate)
      return {
        market: (result && (result.market || result.market_category || result.marketCategory)) || assumptions.market || this.form.market,
        symbol: (result && (result.symbol || result.ticker)) || assumptions.symbol || this.form.symbol,
        timeframe: (result && (result.timeframe || result.klineTimeframe || result.kline_timeframe)) || assumptions.timeframe || assumptions.strategyTimeframe || this.form.timeframe,
        marketType: (result && (result.marketType || result.market_type)) || assumptions.marketType || assumptions.market_type || this.form.marketType,
        exchangeId: (result && (result.exchangeId || result.exchange_id)) || assumptions.exchangeId || assumptions.exchange_id || this.form.exchangeId,
        start,
        end
      }
    },
    normalizeReplayKlineRows (rows, startMs, endMs) {
      if (!Array.isArray(rows)) return []
      return rows.map((item, index) => {
        const timeValue = this.toTimeMs(item.time || item.date || item.timestamp || item.t)
        return {
          key: item.id || item.time || item.timestamp || item.t || index,
          time: item.time || item.date || item.timestamp || item.t || '',
          timeValue,
          open: Number(item.open != null ? item.open : item.o),
          high: Number(item.high != null ? item.high : item.h),
          low: Number(item.low != null ? item.low : item.l),
          close: Number(item.close != null ? item.close : item.c),
          volume: Number(item.volume != null ? item.volume : (item.v || 0))
        }
        })
        .filter(item => item.timeValue !== null && item.timeValue >= startMs && item.timeValue <= endMs)
        .filter(item => Number.isFinite(item.open) && Number.isFinite(item.high) && Number.isFinite(item.low) && Number.isFinite(item.close))
    },
    replayRowsFromResult (result) {
      if (!result || typeof result !== 'object') return []
      const sources = [result, result.result, result.data].filter(item => item && typeof item === 'object')
      for (const source of sources) {
        const rows = this.pickArray(source, ['replayKlines', 'replay_klines', 'replayData.bars', 'replay_data.bars', 'replay.bars', 'klines', 'candles', 'bars'])
        if (rows.length) return rows
      }
      return []
    },
    async loadReplayKlines () {
      const result = this.result
      this.replayKlines = []
      this.disposeReplayChart()
      this.queueRenderReplayChart()
      if (!result) {
        this.replayKlinesLoading = false
        this.replayKlineRequestKey = ''
        return
      }
      const context = this.resolveReplayContext(result)
      if (!context.symbol || !context.market || !context.timeframe || !context.start.isValid() || !context.end.isValid()) {
        this.replayKlinesLoading = false
        this.replayKlineRequestKey = ''
        return
      }
      const startMs = context.start.clone().startOf('day').valueOf()
      const endMs = context.end.clone().endOf('day').valueOf()
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        this.replayKlinesLoading = false
        this.replayKlineRequestKey = ''
        return
      }
      const resultRows = this.normalizeReplayKlineRows(this.replayRowsFromResult(result), startMs, endMs)
      if (resultRows.length) {
        this.replayKlineRequestKey = [
          'result',
          context.market,
          context.symbol,
          context.timeframe,
          context.marketType,
          context.exchangeId,
          this.form.tradeDirection,
          startMs,
          endMs,
          this.result && (this.result.runId || this.result.run_id || this.result.id || '')
        ].join('|')
        this.replayKlines = resultRows
        this.replayKlinesLoading = false
        this.queueRenderReplayChart()
        return
      }
      const requestKey = [
        context.market,
        context.symbol,
        context.timeframe,
        context.marketType,
        context.exchangeId,
        this.form.tradeDirection,
        startMs,
        endMs,
        this.result && (this.result.runId || this.result.run_id || this.result.id || '')
      ].join('|')
      this.replayKlineRequestKey = requestKey
      this.replayKlinesLoading = true
      try {
        const pageLimit = 1000
        const tfSeconds = this.timeframeToSeconds(context.timeframe)
        const expectedBars = Math.ceil((endMs - startMs) / Math.max(1, tfSeconds * 1000)) + 2
        const maxPages = Math.min(80, Math.max(1, Math.ceil(expectedBars / pageLimit) + 4))
        const byTime = new Map()
        let beforeTime = Math.floor(endMs / 1000)
        for (let page = 0; page < maxPages; page += 1) {
          const response = await request({
            url: '/api/indicator/kline',
            method: 'get',
            params: {
              market: context.market,
              symbol: context.symbol,
              timeframe: context.timeframe,
              limit: pageLimit,
              before_time: beforeTime,
              market_type: context.marketType,
              exchange_id: context.exchangeId
            },
            timeout: BACKTEST_TIMEOUT
          })
          if (this.replayKlineRequestKey !== requestKey) return
          const rows = response && response.code === 1 && Array.isArray(response.data) ? response.data : []
          if (!rows.length) break
          const normalized = this.normalizeReplayKlineRows(rows, startMs, endMs)
          normalized.forEach(item => {
            byTime.set(item.timeValue, item)
          })
          const allTimes = rows
            .map(item => this.toTimeMs(item.time || item.date || item.timestamp || item.t))
            .filter(value => value !== null)
          if (!allTimes.length) break
          const earliestMs = Math.min(...allTimes)
          if (earliestMs <= startMs) break
          const nextBefore = Math.floor(earliestMs / 1000) - 1
          if (!Number.isFinite(nextBefore) || nextBefore >= beforeTime) break
          beforeTime = nextBefore
        }
        if (this.replayKlineRequestKey !== requestKey) return
        this.replayKlines = Array.from(byTime.values()).sort((a, b) => a.timeValue - b.timeValue)
      } catch (error) {
        if (this.replayKlineRequestKey === requestKey) {
          this.replayKlines = []
        }
      } finally {
        if (this.replayKlineRequestKey === requestKey) {
          this.replayKlinesLoading = false
          this.queueRenderReplayChart()
        }
      }
    },
    async openHistoryDrawer () {
      this.historyDrawerVisible = true
      await this.loadHistory()
    },
    async loadHistory () {
      if (!this.selectedAsset) {
        this.historyRows = []
        return
      }
      this.historyLoading = true
      try {
        const res = await this.loadUnifiedHistory({ limit: 50 })
        const data = this.unwrapApiPayload(res)
        const rows = Array.isArray(data) ? data : (data && (data.items || data.rows || data.records)) || []
        this.historyRows = rows.map(row => {
          const start = row.start_date || row.startDate || row.start || ''
          const end = row.end_date || row.endDate || row.end || ''
          const result = row.result || row.metrics || {}
          const normalized = this.normalizeBacktestResult({ ...result, ...row })
          const assumptions = normalized.executionAssumptions || result.executionAssumptions || result.execution_assumptions || {}
          const market = row.market || result.market || this.form.market
          const exchangeId = row.exchange_id || result.exchange_id || assumptions.exchangeId || assumptions.exchange_id || ''
          const marketType = row.market_type || result.market_type || assumptions.marketType || assumptions.market_type || 'spot'
          const symbol = row.symbol || result.symbol || this.form.symbol || ''
          const createdAt = this.firstDefined(row, ['created_at', 'createdAt', 'created', 'time', 'timestamp', 'updated_at', 'updatedAt'])
          return {
            ...row,
            created_at: createdAt || '',
            created_at_display: this.formatTradeTime(createdAt),
            range: start && end ? `${start} ~ ${end}` : '-',
            total_return: normalized.totalReturn,
            status: row.status || (row.success === false ? 'failed' : 'success'),
            asset_type: row.asset_type || row.assetType || (this.selectedAsset && this.selectedAsset.asset_type),
            source_context: market === 'Crypto'
              ? `${String(exchangeId || '-').toUpperCase()} · ${this.marketTypeLabel(marketType)} · ${symbol}`
              : `${market || '-'} · ${symbol}`
          }
        })
      } finally {
        this.historyLoading = false
      }
    },
    async viewHistoryRun (record) {
      if (!record || !record.id) return
      try {
        const res = await this.loadUnifiedDetail(record.id)
        this.applyRunResult(res)
        this.historyDrawerVisible = false
      } catch (error) {
        this.$message.error(this.bt('backtest-center.message.historyDetailFailed', 'historyDetailFailed'))
      }
    },
    buildOverrideConfig () {
      const codeParams = this.runtimeParamValues()
      const leverage = this.isSpotMode ? 1 : Number(this.form.leverage || 1)
      const tradeDirection = this.isSpotMode ? 'long' : this.form.tradeDirection
      const fees = {
        fundingRateAnnual: this.isSpotMode ? 0 : Number(this.form.fundingRateAnnual || 0),
        fundingIntervalHours: this.isSpotMode ? 8 : Number(this.form.fundingIntervalHours || 8)
      }
      return {
        symbol: this.form.symbol,
        market: this.form.market,
        market_category: this.form.market,
        exchange_id: this.form.market === 'Crypto' ? this.form.exchangeId : '',
        timeframe: this.form.timeframe,
        market_type: this.form.marketType,
        initialCapital: Number(this.form.initialCapital || 0),
        initial_capital: Number(this.form.initialCapital || 0),
        investment_amount: Number(this.form.initialCapital || 0),
        leverage,
        trade_direction: tradeDirection,
        fees,
        paramOverrides: codeParams,
        indicator_params: codeParams,
        script_params: codeParams,
        params: codeParams
      }
    },
    async runUnified (panelPayload = {}) {
      if (!this.selectedAsset) {
        this.$message.warning(this.copy.selectAssetFirst)
        return { code: 0, msg: this.copy.selectAssetFirst }
      }
      if (this.isPortfolioAsset) {
        if (!this.form.universeId) {
          this.$message.warning(this.copy.universePlaceholder)
          return { code: 0, msg: this.copy.universePlaceholder }
        }
        const paramOverrides = this.runtimeParamValues()
        return runUnifiedBacktest({
          ...panelPayload,
          assetType: 'portfolio_strategy',
          assetId: this.selectedAsset.source_id || this.selectedAsset.id,
          strategyName: this.selectedAsset.name || '',
          code: this.selectedAssetCodeWithParams,
          universeId: Number(this.form.universeId),
          rebalanceFrequency: this.form.rebalanceFrequency,
          initialCapital: Number(this.form.initialCapital || 0),
          commission: Number(this.form.commissionPct || 0) / 100,
          slippage: Number(this.form.slippagePct || 0) / 100,
          maxWeight: Number(this.form.maxWeightPct || 0) / 100,
          minTradeValue: Number(this.form.minTradeValue || 0),
          allowFractional: !!this.form.allowFractional,
          startupCandleCount: 120,
          params: paramOverrides,
          paramOverrides,
          persist: true,
          timeout: BACKTEST_TIMEOUT
        })
      }
      const baseOverride = this.buildOverrideConfig()
      const panelStrategyConfig = panelPayload.strategyConfig || {}
      const panelOverride = panelPayload.overrideConfig || {}
      const cleanPanelStrategyConfig = { ...panelStrategyConfig }
      delete cleanPanelStrategyConfig.position
      delete cleanPanelStrategyConfig.risk
      delete cleanPanelStrategyConfig.exitOwner
      delete cleanPanelStrategyConfig.exit_owner
      delete cleanPanelStrategyConfig.execution
      const cleanPanelOverride = { ...panelOverride }
      delete cleanPanelOverride.timeframe
      delete cleanPanelOverride.position
      delete cleanPanelOverride.risk
      delete cleanPanelOverride.exitOwner
      delete cleanPanelOverride.exit_owner
      delete cleanPanelOverride.execution
      const baseParams = this.runtimeParamValues()
      const panelParams = this.normalizeRuntimeParamOverrides({
        ...(panelPayload.paramOverrides || panelPayload.param_overrides || {}),
        ...(panelStrategyConfig.indicator_params || {}),
        ...(panelOverride.paramOverrides || panelOverride.param_overrides || {}),
        ...(panelOverride.indicator_params || {}),
        ...(panelOverride.script_params || {}),
        ...(panelOverride.params || {})
      })
      const paramOverrides = {
        ...baseParams,
        ...panelParams
      }
      const leverage = this.isSpotMode ? 1 : Number(this.form.leverage || 1)
      const tradeDirection = this.isSpotMode ? 'long' : this.form.tradeDirection
      const fees = {
        fundingRateAnnual: this.isSpotMode ? 0 : Number(this.form.fundingRateAnnual || 0),
        fundingIntervalHours: this.isSpotMode ? 8 : Number(this.form.fundingIntervalHours || 8)
      }
      return runUnifiedBacktest({
        ...panelPayload,
        assetType: this.selectedAsset.asset_type,
        assetId: this.selectedAsset.source_id || this.selectedAsset.id,
        symbol: this.form.symbol,
        market: this.form.market,
        exchangeId: this.form.market === 'Crypto' ? this.form.exchangeId : '',
        timeframe: this.form.timeframe,
        marketType: this.form.marketType,
        initialCapital: Number(this.form.initialCapital || 0),
        leverage,
        tradeDirection,
        commission: Number(this.form.commissionPct || 0) / 100,
        slippage: Number(this.form.slippagePct || 0) / 100,
        fundingRateAnnual: fees.fundingRateAnnual,
        fundingIntervalHours: fees.fundingIntervalHours,
        paramOverrides,
        strategyConfig: {
          ...cleanPanelStrategyConfig,
          paramOverrides,
          indicator_params: {
            ...paramOverrides
          },
          script_params: {
            ...paramOverrides
          },
          params: {
            ...paramOverrides
          },
          fees: {
            ...((cleanPanelStrategyConfig && cleanPanelStrategyConfig.fees) || {}),
            ...fees
          }
        },
        scriptSourceId: this.selectedAsset.source_id || this.selectedAsset.id,
        overrideConfig: {
          ...baseOverride,
          ...cleanPanelOverride,
          codeOverride: this.selectedAssetCodeWithParams || cleanPanelOverride.codeOverride,
          indicator_params: {
            ...(baseOverride.indicator_params || {}),
            ...(cleanPanelOverride.indicator_params || {}),
            ...paramOverrides
          },
          script_params: {
            ...(baseOverride.script_params || {}),
            ...(cleanPanelOverride.script_params || {}),
            ...paramOverrides
          },
          params: {
            ...(baseOverride.params || {}),
            ...(cleanPanelOverride.params || {}),
            ...paramOverrides
          },
          paramOverrides: {
            ...(baseOverride.paramOverrides || {}),
            ...(cleanPanelOverride.paramOverrides || {}),
            ...paramOverrides
          },
          fees: {
            ...((baseOverride && baseOverride.fees) || {}),
            ...((cleanPanelOverride && cleanPanelOverride.fees) || {}),
            ...fees
          }
        },
        timeout: BACKTEST_TIMEOUT
      })
    },
    runtimeParamValues (overrides = null) {
      return buildRuntimeParamValues(this.codeParams || [], overrides || this.paramValues || {})
    },
    normalizeRuntimeParamOverrides (overrides = {}) {
      return Object.keys(overrides || {}).reduce((acc, key) => {
        acc[key] = overrides[key]
        return acc
      }, {})
    },
    loadUnifiedHistory (params = {}) {
      return getUnifiedBacktestHistory({
        ...params,
        ...this.historyParams
      })
    },
    loadUnifiedDetail (runId) {
      return getUnifiedBacktestRun(runId)
    },
    handleApplyTuneParams (payload = {}) {
      if (!this.selectedAsset || !payload.code) return
      this.$set(this.tunedCodeByAssetKey, this.selectedAsset.asset_key, payload.code)
      this.$nextTick(() => this.syncParamValuesFromCode())
      this.$message.success(this.copy.tuneApplied)
    },
    normalizeTradeSide (value, row = {}) {
      const explicit = String(value || '').toLowerCase()
      const type = String(row.type || row.action || row.trade_type || row.tradeType || '').toLowerCase()
      const positionSide = String(row.position_side || row.positionSide || row.pos_side || '').toLowerCase()
      if (positionSide.includes('short')) return 'short'
      if (positionSide.includes('long')) return 'long'
      const merged = `${explicit} ${type}`
      if (merged.includes('short')) return 'short'
      if (merged.includes('long')) return 'long'
      if (type.startsWith('open_') || type.startsWith('add_')) {
        return explicit === 'sell' ? 'short' : 'long'
      }
      if (type.startsWith('close_') || type.startsWith('reduce_') || type === 'cover') {
        return explicit === 'buy' ? 'short' : 'long'
      }
      return explicit === 'sell' ? 'short' : 'long'
    },
    tradeNumber (value, fallback = 0) {
      const number = Number(value)
      return Number.isFinite(number) ? number : fallback
    },
    buildClosedTradesFromExecutions (rows = []) {
      const open = {}
      const closed = []
      ;(Array.isArray(rows) ? rows : []).forEach(row => {
        const type = String(row.type || row.action || row.trade_type || row.tradeType || '').toLowerCase()
        const side = this.normalizeTradeSide(row.position_side || row.positionSide || row.side || row.direction || row.type, row)
        const price = this.tradeNumber(row.price != null ? row.price : (row.entry_price != null ? row.entry_price : row.exit_price), 0)
        const qty = this.tradeNumber(row.amount != null ? row.amount : (row.quantity != null ? row.quantity : row.qty), 0)
        const time = row.time || row.date || row.timestamp || row.bar_time || '-'
        const isOpen = type.startsWith('open_') || type.startsWith('add_') || type === 'buy'
        const isClose = type.startsWith('close_') || type === 'sell' || type === 'cover' || type === 'liquidation' || this.tradeNumber(row.profit != null ? row.profit : row.pnl, 0) !== 0
        if (isOpen && price > 0) {
          const current = open[side]
          if (!current) {
            open[side] = { side, entry_time: time, entry_price: price, amount: qty, entry_reason: row.reason || row.type || '' }
          } else {
            const total = this.tradeNumber(current.amount) + qty
            if (total > 0 && qty > 0) current.entry_price = ((current.entry_price * current.amount) + (price * qty)) / total
            current.amount = total
          }
          return
        }
        if (!isClose || price <= 0) return
        const current = open[side] || {}
        const amount = qty || current.amount || 0
        closed.push({
          id: closed.length + 1,
          side,
          entry_time: current.entry_time || row.entry_time || time,
          exit_time: row.exit_time || time,
          entry_price: current.entry_price || row.entry_price || price,
          exit_price: row.exit_price || price,
          amount,
          profit: row.profit != null ? row.profit : (row.pnl != null ? row.pnl : row.realized_pnl),
          balance: row.balance != null ? row.balance : (row.equity != null ? row.equity : row.cash),
          close_reason: row.close_reason || row.reason || row.type || ''
        })
        if (current.amount) {
          current.amount = Math.max(0, current.amount - amount)
          if (current.amount <= 1e-12) delete open[side]
        }
      })
      return closed
    },
    closeReasonText (value) {
      const key = String(value || '').toLowerCase()
      if (key.includes('ema_pullback_exit') || key.includes('pullback_exit')) return this.bt('backtest-center.closeReason.emaPullbackExit', 'emaPullbackExit')
      if (key.includes('ema_trend_break') || key.includes('trend_break')) return this.bt('backtest-center.closeReason.emaTrendBreak', 'emaTrendBreak')
      if (key.includes('max_holding') || key.includes('maxholding') || key.includes('holding')) return this.bt('backtest-center.closeReason.maxHolding', 'maxHolding')
      if (key.includes('trailing')) return this.bt('backtest-center.closeReason.trailingStop', 'trailingStop')
      if (key.includes('take') || key.includes('profit')) return this.bt('backtest-center.closeReason.takeProfit', 'takeProfit')
      if (key.includes('stop') || key.includes('loss')) return this.bt('backtest-center.closeReason.stopLoss', 'stopLoss')
      if (key.includes('liquidation')) return this.bt('backtest-center.closeReason.liquidation', 'liquidation')
      if (key.includes('end')) return this.bt('backtest-center.closeReason.finalClose', 'finalClose')
      if (key.includes('signal') || key.includes('close')) return this.bt('backtest-center.closeReason.signalClose', 'signalClose')
      return value || this.bt('backtest-center.closeReason.close', 'close')
    },
    closeReasonTone (value) {
      const key = String(value || '').toLowerCase()
      if (key.includes('take') || key.includes('profit')) return 'green'
      if (key.includes('stop') || key.includes('loss') || key.includes('liquidation')) return 'red'
      return 'blue'
    },
    firstDefined (source, keys = []) {
      const obj = source || {}
      for (const key of keys) {
        const value = obj[key]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    },
    formatTradeTime (value) {
      if (!value || value === '-') return '-'
      if (typeof value === 'number') {
        const ts = value > 1e12 ? value : value * 1000
        return this.formatDateTime(new Date(ts))
      }
      const raw = String(value).trim()
      if (!raw) return '-'
      if (/^\d{10,13}$/.test(raw)) {
        const number = Number(raw)
        const ts = number > 1e12 ? number : number * 1000
        return this.formatDateTime(new Date(ts))
      }
      const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
      const parsed = new Date(normalized.endsWith('Z') ? normalized : normalized.replace(/(\.\d+)?$/, ''))
      if (!Number.isNaN(parsed.getTime()) && /T|\d{2}:\d{2}/.test(normalized)) {
        return this.formatDateTime(parsed)
      }
      const match = raw.replace('T', ' ').match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2})(?::(\d{1,2}))?)?/)
      if (match) {
        const hour = match[2] != null ? String(match[2]).padStart(2, '0') : '00'
        const minute = match[3] != null ? String(match[3]).padStart(2, '0') : '00'
        return `${match[1]} ${hour}:${minute}`
      }
      return raw.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '')
    },
    formatDateTime (date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-'
      const pad = value => String(value).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    },
    portfolioWeightText (weights) {
      if (!weights || typeof weights !== 'object') return '-'
      return Object.entries(weights)
        .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))
        .map(([symbol, weight]) => `${symbol} ${(Number(weight || 0) * 100).toFixed(2)}%`)
        .join(' · ')
    },
    pickNumber (source, keys = [], fallback = 0) {
      const obj = source || {}
      for (const key of keys) {
        const value = Number(obj[key])
        if (Number.isFinite(value)) {
          const isTradeMetric = ['bestTrade', 'best_trade', 'worstTrade', 'worst_trade'].includes(key)
          if (isTradeMetric && value === 0 && Number(fallback) !== 0) continue
          return value
        }
      }
      return fallback
    },
    getPathValue (source, path) {
      if (!source || !path) return undefined
      return String(path).split('.').reduce((acc, key) => {
        if (acc && Object.prototype.hasOwnProperty.call(acc, key)) return acc[key]
        return undefined
      }, source)
    },
    pickNumberDeep (source, keys = [], fallback = 0) {
      for (const key of keys) {
        const raw = String(key).includes('.') ? this.getPathValue(source, key) : (source || {})[key]
        if (raw === '' || raw === null || raw === undefined) continue
        const value = Number(raw)
        if (Number.isFinite(value)) return value
      }
      return fallback
    },
    pickArray (source, keys = []) {
      for (const key of keys) {
        const value = String(key).includes('.') ? this.getPathValue(source, key) : (source || {})[key]
        if (Array.isArray(value)) return value
      }
      return []
    },
    fmtNum (value, digits = 2) {
      if (value === null || value === undefined || value === '') return '-'
      const num = Number(value)
      if (!Number.isFinite(num)) return '-'
      return num.toFixed(digits)
    },
    fmtInt (value) {
      if (value === null || value === undefined || value === '') return '0'
      const num = Number(value)
      if (!Number.isFinite(num)) return '0'
      return Math.round(num).toLocaleString()
    },
    fmtPct (value) {
      if (value === null || value === undefined || value === '') return '-'
      const num = Number(value)
      if (!Number.isFinite(num)) return '-'
      return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`
    },
    fmtMoney (value) {
      const num = Number(value)
      if (!Number.isFinite(num)) return '-'
      return `${num < 0 ? '-' : ''}$${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    fmtPrice (value) {
      const num = Number(value)
      if (!Number.isFinite(num)) return '-'
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    },
    seriesReturns (series = []) {
      if (!Array.isArray(series) || series.length < 2) return []
      const rows = []
      for (let index = 1; index < series.length; index += 1) {
        const prev = Number(series[index - 1] && series[index - 1].value)
        const next = Number(series[index] && series[index].value)
        if (Number.isFinite(prev) && Number.isFinite(next) && prev !== 0) {
          rows.push((next - prev) / Math.abs(prev))
        }
      }
      return rows
    },
    average (values = []) {
      const rows = values.filter(Number.isFinite)
      if (!rows.length) return null
      return rows.reduce((sum, value) => sum + value, 0) / rows.length
    },
    standardDeviation (values = []) {
      const rows = values.filter(Number.isFinite)
      if (rows.length < 2) return null
      const mean = this.average(rows)
      const variance = rows.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (rows.length - 1)
      return Math.sqrt(variance)
    },
    annualizedVolatility (returns = []) {
      const std = this.standardDeviation(returns)
      if (std === null) return null
      return std * Math.sqrt(this.periodsPerYear) * 100
    },
    sortinoRatio (returns = []) {
      const rows = returns.filter(Number.isFinite)
      if (rows.length < 2) return null
      const mean = this.average(rows)
      const downside = rows.filter(value => value < 0)
      const downsideStd = this.standardDeviation(downside)
      if (!downsideStd) return null
      return (mean * this.periodsPerYear) / (downsideStd * Math.sqrt(this.periodsPerYear))
    },
    calmarRatio () {
      const drawdown = Math.abs(Number(this.maxDrawdownValue || 0)) / 100
      if (!drawdown) return null
      return (Number(this.totalReturnValue || 0) / 100) / drawdown
    },
    betaValue (returns = [], benchmark = []) {
      const length = Math.min(returns.length, benchmark.length)
      if (length < 3) return null
      const r = returns.slice(0, length)
      const b = benchmark.slice(0, length)
      const rAvg = this.average(r)
      const bAvg = this.average(b)
      const covariance = r.reduce((sum, value, index) => sum + ((value - rAvg) * (b[index] - bAvg)), 0) / (length - 1)
      const variance = b.reduce((sum, value) => sum + Math.pow(value - bAvg, 2), 0) / (length - 1)
      if (!variance) return null
      return covariance / variance
    },
    maxDrawdownDuration () {
      if (!this.equitySeries.length) return null
      let peak = -Infinity
      let current = 0
      let longest = 0
      this.equitySeries.forEach(item => {
        const value = Number(item.value)
        if (!Number.isFinite(value)) return
        if (value >= peak) {
          peak = value
          current = 0
        } else {
          current += 1
          longest = Math.max(longest, current)
        }
      })
      return longest
    },
    exposureRatio () {
      const explicit = this.pickNumberDeep(this.result, ['exposure', 'exposureRatio', 'exposure_ratio', 'metrics.exposure', 'metrics.exposure_ratio'], null)
      if (explicit !== null) return explicit > 1 ? explicit : explicit * 100
      if (!this.equitySeries.length) return null
      const tradeBars = this.closedTradeRows.length
      if (!tradeBars) return 0
      return Math.min(100, (tradeBars / Math.max(1, this.equitySeries.length)) * 100)
    },
    toTimeMs (value) {
      if (value === null || value === undefined || value === '' || value === '-') return null
      if (typeof value === 'number') {
        const timestamp = value > 1e12 ? value : value * 1000
        return Number.isFinite(timestamp) ? timestamp : null
      }
      const raw = String(value).trim()
      if (!raw) return null
      if (/^\d{10,13}$/.test(raw)) {
        const number = Number(raw)
        const timestamp = number > 1e12 ? number : number * 1000
        return Number.isFinite(timestamp) ? timestamp : null
      }
      const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
      const parsed = new Date(normalized.endsWith('Z') ? normalized : normalized.replace(/(\.\d+)?$/, ''))
      const time = parsed.getTime()
      return Number.isNaN(time) ? null : time
    },
    findReplayCandleIndex (time) {
      const candles = this.replayCandles
      if (!candles.length) return -1
      const target = this.toTimeMs(time)
      if (target === null) return -1
      let bestIndex = 0
      let bestDistance = Infinity
      candles.forEach((item, index) => {
        if (item.timeValue === null) return
        const distance = Math.abs(item.timeValue - target)
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = index
        }
      })
      return bestDistance === Infinity ? -1 : bestIndex
    },
    queueRenderEquityChart () {
      this.$nextTick(() => {
        window.requestAnimationFrame(() => this.renderEquityChart(0))
      })
    },
    disposeEquityChart () {
      if (this.equityRenderTimer) {
        window.clearTimeout(this.equityRenderTimer)
        this.equityRenderTimer = null
      }
      if (this.equityChartInstance) {
        this.equityChartInstance.dispose()
        this.equityChartInstance = null
      }
    },
    normalizeEquityChartSeries (series = []) {
      return series
        .map((item, index) => {
          const value = Number(item && item.value)
          if (!Number.isFinite(value)) return null
          const timestamp = this.toTimeMs(item && item.time)
          return {
            index,
            timestamp,
            label: this.formatTradeTime(item && item.time),
            value
          }
        })
        .filter(Boolean)
    },
    renderEquityChart (attempt = 0) {
      const el = this.$refs.equityChart
      if (!el) return
      if (this.equityChartInstance && this.equityChartInstance.getDom() !== el) {
        this.equityChartInstance.dispose()
        this.equityChartInstance = null
      }
      const width = el.clientWidth || el.getBoundingClientRect().width
      const height = el.clientHeight || el.getBoundingClientRect().height
      if ((width < 40 || height < 40) && attempt < 8) {
        if (this.equityRenderTimer) window.clearTimeout(this.equityRenderTimer)
        this.equityRenderTimer = window.setTimeout(() => this.renderEquityChart(attempt + 1), 80)
        return
      }
      const strategyRows = this.normalizeEquityChartSeries(this.equitySeries)
      if (strategyRows.length <= 1) {
        if (this.equityChartInstance) this.equityChartInstance.clear()
        return
      }
      const benchmarkRows = this.normalizeEquityChartSeries(this.benchmarkSeries)
      if (!this.equityChartInstance) {
        this.equityChartInstance = echarts.init(el, this.isDarkTheme ? 'dark' : null, { renderer: 'canvas' })
      }
      this.equityChartInstance.resize({ width, height })
      const colors = this.isDarkTheme
        ? {
            text: 'rgba(255,255,255,0.74)',
            muted: 'rgba(255,255,255,0.48)',
            grid: 'rgba(255,255,255,0.08)',
            bg: '#141414',
            tooltip: 'rgba(24,24,24,0.96)',
            border: 'rgba(255,255,255,0.12)',
            strategy: this.equityToneColor,
            benchmark: 'rgba(148,163,184,0.92)'
          }
        : {
            text: '#334155',
            muted: '#64748b',
            grid: 'rgba(15,23,42,0.08)',
            bg: '#ffffff',
            tooltip: 'rgba(255,255,255,0.98)',
            border: 'rgba(15,23,42,0.12)',
            strategy: this.equityToneColor,
            benchmark: '#94a3b8'
          }
      const hasRealTime = strategyRows.some(item => item.timestamp !== null) ||
        benchmarkRows.some(item => item.timestamp !== null)
      const axisValue = item => hasRealTime ? (item.timestamp != null ? item.timestamp : item.index) : item.index
      const strategyData = strategyRows.map(item => [axisValue(item), item.value, item.label])
      const benchmarkData = benchmarkRows.map(item => [axisValue(item), item.value, item.label])
      let runningPeak = -Infinity
      const drawdownData = strategyRows.map(item => {
        runningPeak = Math.max(runningPeak, item.value)
        const drawdown = runningPeak > 0 ? ((item.value - runningPeak) / runningPeak) * 100 : 0
        return [axisValue(item), drawdown, item.label]
      })
      const yValues = strategyRows.concat(benchmarkRows).map(item => item.value).filter(Number.isFinite)
      const minY = Math.min(...yValues)
      const maxY = Math.max(...yValues)
      const yPadding = Math.max((maxY - minY) * 0.12, Math.abs(maxY) * 0.01, 1)
      const formatAxisLabel = value => {
        if (!hasRealTime) {
          const row = strategyRows[Math.max(0, Math.min(strategyRows.length - 1, Number(value) || 0))]
          return row ? row.label : String(value)
        }
        return this.formatTradeTime(value)
      }
      this.equityChartInstance.setOption({
        animation: false,
        backgroundColor: colors.bg,
        color: [colors.strategy, colors.benchmark],
        grid: [
          { left: 58, right: 22, top: 34, height: '57%' },
          { left: 58, right: 22, top: '76%', height: '13%' }
        ],
        legend: {
          top: 10,
          right: 16,
          itemWidth: 18,
          itemHeight: 8,
          textStyle: {
            color: colors.muted,
            fontSize: 11,
            fontWeight: 700
          },
          data: benchmarkData.length
            ? [this.copy.strategyEquity, this.copy.spotBenchmark]
            : [this.copy.strategyEquity]
        },
        tooltip: {
          trigger: 'axis',
          triggerOn: 'mousemove',
          transitionDuration: 0,
          hideDelay: 40,
          enterable: false,
          confine: true,
          appendToBody: true,
          backgroundColor: colors.tooltip,
          borderColor: colors.border,
          borderWidth: 1,
          textStyle: { color: colors.text, fontSize: 12 },
          extraCssText: 'box-shadow:0 12px 30px rgba(0,0,0,0.26);border-radius:8px;z-index:9999;',
          axisPointer: {
            type: 'cross',
            snap: true,
            lineStyle: {
              color: colors.muted,
              type: 'dashed'
            },
            label: {
              color: '#fff',
              backgroundColor: 'rgba(74,91,164,0.88)'
            }
          },
          formatter: params => {
            const list = Array.isArray(params) ? params : [params]
            const first = list[0] || {}
            const title = first.value && first.value[2]
              ? first.value[2]
              : formatAxisLabel(first.axisValue)
            const rows = list
              .filter(item => item && item.value && Number.isFinite(Number(item.value[1])))
              .map(item => {
                const marker = item.marker || ''
                return `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:6px;">
                  <span>${marker}${this.escapeHtml(item.seriesName || '')}</span>
                  <strong>${this.escapeHtml(this.fmtMoney(item.value[1]))}</strong>
                </div>`
              })
              .join('')
            return `<div style="font-weight:800;margin-bottom:4px;">${this.escapeHtml(title)}</div>${rows}`
          }
        },
        xAxis: [
          {
            type: hasRealTime ? 'time' : 'value',
boundaryGap: false,
gridIndex: 0,
            axisLabel: { show: false },
axisLine: { lineStyle: { color: colors.grid } },
axisTick: { show: false },
splitLine: { show: false }
          },
          {
            type: hasRealTime ? 'time' : 'value',
boundaryGap: false,
gridIndex: 1,
            axisLabel: { color: colors.muted, fontSize: 11, formatter: formatAxisLabel, hideOverlap: true },
            axisLine: { lineStyle: { color: colors.grid } },
axisTick: { show: false },
splitLine: { show: false }
          }
        ],
        yAxis: [
          {
            type: 'value',
scale: true,
gridIndex: 0,
min: minY - yPadding,
max: maxY + yPadding,
            axisLabel: { color: colors.muted, fontSize: 11, formatter: value => this.fmtMoney(value).replace('$', '') },
            axisLine: { show: false },
axisTick: { show: false },
splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } }
          },
          {
            type: 'value',
gridIndex: 1,
max: 0,
            axisLabel: { color: colors.muted, fontSize: 10, formatter: value => `${Number(value).toFixed(1)}%` },
            axisLine: { show: false },
axisTick: { show: false },
splitLine: { lineStyle: { color: colors.grid } }
          }
        ],
        series: [
          {
            name: this.copy.strategyEquity,
            type: 'line',
            data: strategyData,
            smooth: false,
            showSymbol: false,
            symbol: 'circle',
            symbolSize: 7,
            lineStyle: {
              width: 3,
              color: colors.strategy,
              cap: 'round',
              join: 'round'
            },
            itemStyle: { color: colors.strategy },
            emphasis: {
              focus: 'series',
              itemStyle: {
                borderWidth: 2,
                borderColor: '#fff'
              }
            },
            areaStyle: {
              opacity: 0.22,
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: colors.strategy },
                  { offset: 1, color: this.isDarkTheme ? 'rgba(20,20,20,0.02)' : 'rgba(255,255,255,0.02)' }
                ]
              }
            }
          },
          ...(benchmarkData.length
            ? [{
                name: this.copy.spotBenchmark,
                type: 'line',
                data: benchmarkData,
                smooth: false,
                showSymbol: false,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: {
                  width: 2.5,
                  type: 'dashed',
                  color: colors.benchmark,
                  cap: 'round',
                  join: 'round'
                },
                itemStyle: { color: colors.benchmark },
                emphasis: { focus: 'series' }
              }]
            : []),
          {
            name: this.bt('backtest-center.metrics.maxDrawdown', 'maxDrawdown'),
            type: 'line',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: drawdownData,
            showSymbol: false,
            silent: true,
            lineStyle: { width: 1.5, color: this.resolvedPrimaryColor },
            areaStyle: { color: echarts.color.modifyAlpha(this.resolvedPrimaryColor, 0.12) }
          }
        ]
      }, true)
      window.requestAnimationFrame(() => {
        if (this.equityChartInstance) this.equityChartInstance.resize()
      })
    },
    queueRenderReplayChart () {
      this.$nextTick(() => {
        window.requestAnimationFrame(() => this.renderReplayChart())
      })
    },
    disposeReplayChart () {
      if (this.replayChartInstance) {
        this.replayChartInstance.dispose()
        this.replayChartInstance = null
      }
    },
    renderReplayChart () {
      const el = this.$refs.replayChart
      if (!el) return
      const candles = this.replayCandles
      if (!candles.length) {
        if (this.replayChartInstance) this.replayChartInstance.clear()
        return
      }
      const box = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 }
      if (box.width < 20 || box.height < 20) {
        window.setTimeout(() => this.queueRenderReplayChart(), 80)
        return
      }
      if (!this.replayChartInstance) {
        this.replayChartInstance = echarts.init(el, this.isDarkTheme ? 'dark' : null, { renderer: 'canvas' })
      }
      const colors = this.isDarkTheme
        ? {
            text: 'rgba(255,255,255,0.68)',
            muted: 'rgba(255,255,255,0.42)',
            grid: 'rgba(255,255,255,0.08)',
            bg: '#141414',
            tooltip: 'rgba(24,24,24,0.96)',
            border: 'rgba(255,255,255,0.12)',
            up: '#16c784',
            down: '#ff4d4f',
            close: '#3b82f6'
          }
        : {
            text: '#334155',
            muted: '#64748b',
            grid: 'rgba(15,23,42,0.08)',
            bg: '#ffffff',
            tooltip: 'rgba(255,255,255,0.98)',
            border: 'rgba(15,23,42,0.12)',
            up: '#16a34a',
            down: '#ef4444',
            close: '#2563eb'
          }
      const categories = candles.map(item => this.formatTradeTime(item.time))
      const candleData = candles.map(item => [item.open, item.close, item.low, item.high])
      const markerEvents = this.replayTradeEvents
        .map(event => {
          const index = this.findReplayCandleIndex(event.time)
          if (index < 0) return null
          const candle = candles[index]
          const isClose = event.tone === 'close'
          const color = event.tone === 'close' ? colors.close : (event.tone === 'short' ? colors.down : colors.up)
          return {
            name: event.label,
            value: [index, isClose ? candle.high : candle.low],
            event,
            tone: event.tone,
            symbol: isClose ? 'pin' : 'triangle',
            symbolRotate: 0,
            symbolOffset: isClose ? [0, -28] : [0, 28],
            label: { position: isClose ? 'top' : 'bottom' },
            emphasis: { label: { position: isClose ? 'top' : 'bottom' } },
            itemStyle: {
              color,
              opacity: 1,
              borderColor: this.isDarkTheme ? '#ffffff' : '#111827',
              borderWidth: 2,
              shadowBlur: 10,
              shadowColor: event.tone === 'close' ? 'rgba(59,130,246,0.55)' : (event.tone === 'short' ? 'rgba(239,68,68,0.5)' : 'rgba(22,199,132,0.5)')
            }
          }
        })
        .filter(Boolean)
      const showMarkerLabels = markerEvents.length <= 80
      const visibleCount = Math.min(160, Math.max(72, Math.floor(candles.length * 0.18)))
      const latestEventIndex = markerEvents.length
        ? Math.max(...markerEvents.map(item => Number(item.value && item.value[0])).filter(Number.isFinite))
        : candles.length - 1
      const endValue = Math.min(candles.length - 1, Math.max(0, latestEventIndex + 12))
      const startValue = Math.max(0, endValue - visibleCount + 1)
      const option = {
        animation: false,
        backgroundColor: colors.bg,
        grid: {
          left: 58,
          right: 24,
          top: 28,
          bottom: 68
        },
        tooltip: {
          trigger: 'axis',
          triggerOn: 'mousemove',
          transitionDuration: 0,
          hideDelay: 40,
          enterable: false,
          axisPointer: {
            type: 'cross',
            snap: true,
            crossStyle: { color: colors.muted },
            label: {
              color: '#fff',
              backgroundColor: 'rgba(15,23,42,0.78)'
            }
          },
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.tooltip,
          textStyle: { color: colors.text, fontSize: 12 },
          confine: true,
          formatter: params => this.formatReplayTooltip(params, candles)
        },
        xAxis: {
          type: 'category',
          data: categories,
          boundaryGap: true,
          axisLine: { lineStyle: { color: colors.grid } },
          axisTick: { show: false },
          axisLabel: { color: colors.muted, hideOverlap: true },
          splitLine: { show: false },
          min: 'dataMin',
          max: 'dataMax'
        },
        yAxis: {
          scale: true,
          boundaryGap: ['12%', '12%'],
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: colors.muted },
          splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } }
        },
        dataZoom: [
          {
            type: 'inside',
            xAxisIndex: 0,
            startValue,
            endValue,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: true,
            preventDefaultMouseMove: true,
            throttle: 20
          },
          {
            type: 'slider',
            xAxisIndex: 0,
            startValue,
            endValue,
            height: 24,
            bottom: 18,
            borderColor: colors.border,
            backgroundColor: this.isDarkTheme ? '#202020' : '#f8fafc',
            fillerColor: echarts.color.modifyAlpha(this.resolvedPrimaryColor, this.isDarkTheme ? 0.18 : 0.16),
            handleStyle: { color: colors.up },
            textStyle: { color: colors.muted },
            brushSelect: false
          }
        ],
        series: [
          {
            name: this.copy.tradeReplay,
            type: 'candlestick',
            data: candleData,
            barWidth: '62%',
            barMinWidth: 5,
            barMaxWidth: 18,
            itemStyle: {
              color: colors.up,
              color0: colors.down,
              borderColor: colors.up,
              borderColor0: colors.down
            }
          },
          {
            name: this.copy.tradeReplay,
            type: 'scatter',
            coordinateSystem: 'cartesian2d',
            data: markerEvents,
            encode: { x: 0, y: 1 },
            symbolSize: (value, params) => (params && params.data && params.data.tone === 'close') ? 24 : 20,
            z: 20,
            label: {
              show: showMarkerLabels,
              formatter: param => (param.data && param.data.name) || '',
              position: 'top',
              distance: 8,
              color: '#fff',
              fontSize: 10,
              fontWeight: 900,
              backgroundColor: 'rgba(15,23,42,0.82)',
              borderRadius: 4,
              padding: [3, 5],
              textBorderColor: 'rgba(15,23,42,0.9)',
              textBorderWidth: 2
            },
            tooltip: { trigger: 'item', triggerOn: 'mousemove', transitionDuration: 0 },
            emphasis: {
              scale: 1.55,
              itemStyle: {
                borderWidth: 3,
                shadowBlur: 14
              },
              label: {
                show: true,
                formatter: param => (param.data && param.data.name) || '',
                position: 'top',
                fontWeight: 900,
                color: '#fff',
                textBorderColor: 'rgba(15,23,42,0.86)',
                textBorderWidth: 3
              }
            }
          }
        ]
      }
      this.replayChartInstance.setOption(option, true)
      this.replayChartInstance.resize({ width: Math.floor(box.width), height: Math.floor(box.height) })
      window.setTimeout(() => {
        if (this.replayChartInstance) this.replayChartInstance.resize()
      }, 120)
    },
    formatReplayTooltip (params, candles) {
      const list = Array.isArray(params) ? params : [params]
      const candleParam = list.find(item => item && item.seriesType === 'candlestick')
      const eventParam = list.find(item => item && (item.seriesType === 'scatter' || item.seriesType === 'effectScatter') && item.data && Array.isArray(item.data.value))
      const index = candleParam
        ? candleParam.dataIndex
        : (eventParam ? Number(eventParam.data.value[0]) : (list[0] ? list[0].dataIndex : 0))
      const candle = candles[index]
      if (!candle) return ''
      const actionRows = list
        .filter(item => item && (item.seriesType === 'scatter' || item.seriesType === 'effectScatter') && item.data && item.data.event)
        .map(item => {
          const event = item.data.event
          return `<div class="replay-echart-tooltip__action">${this.escapeHtml(event.label)} | ${this.escapeHtml(this.fmtPrice(event.price))}</div>`
        })
        .join('')
      return [
        `<div class="replay-echart-tooltip">`,
        `<div class="replay-echart-tooltip__time">${this.escapeHtml(this.formatTradeTime(candle.time))}</div>`,
        `<div class="replay-echart-tooltip__grid">`,
        `<span>${this.escapeHtml(this.copy.openShort)}</span><strong>${this.escapeHtml(this.fmtPrice(candle.open))}</strong>`,
        `<span>${this.escapeHtml(this.copy.highShort)}</span><strong>${this.escapeHtml(this.fmtPrice(candle.high))}</strong>`,
        `<span>${this.escapeHtml(this.copy.lowShort)}</span><strong>${this.escapeHtml(this.fmtPrice(candle.low))}</strong>`,
        `<span>${this.escapeHtml(this.copy.closeShort)}</span><strong>${this.escapeHtml(this.fmtPrice(candle.close))}</strong>`,
        `</div>`,
        actionRows ? `<div class="replay-echart-tooltip__actions">${actionRows}</div>` : '',
        `</div>`
      ].join('')
    },
    escapeHtml (value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    },
    deriveSeriesReturn (series = []) {
      if (!Array.isArray(series) || series.length < 2) return null
      const first = Number(series[0] && series[0].value)
      const last = Number(series[series.length - 1] && series[series.length - 1].value)
      if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null
      return ((last - first) / Math.abs(first)) * 100
    },
    buildSweepValues (param = {}) {
      const name = String(param.name || '').toLowerCase()
      const isIntegerDeclared = param.type === 'integer'
      const isPercent = param.type === 'percent'
      const allowZero = /cooldown|delay|wait|pause/.test(name)
      const periodLike = this.isCodeParamPeriodLike(param)
      const forcePositiveInteger = (isIntegerDeclared || periodLike) && !allowZero
      const sanitizeValue = value => {
        const num = Number(value)
        if (!Number.isFinite(num)) return null
        if (forcePositiveInteger) return Math.max(1, Math.round(num))
        if (isIntegerDeclared) return Math.max(allowZero ? 0 : 1, Math.round(num))
        if (!allowZero && num <= 0) return null
        return Number(num.toFixed(isPercent ? 4 : 6))
      }
      if (Array.isArray(param.values) && param.values.length) {
        const explicitValues = param.values
          .map(sanitizeValue)
          .filter(value => value !== null && Number.isFinite(Number(value)))
        const unique = [...new Set(explicitValues)]
        if (unique.length) return unique.sort((a, b) => Number(a) - Number(b)).slice(0, 5)
      }

      const currentRaw = Number(this.paramValues[param.name] != null ? this.paramValues[param.name] : param.default)
      let current = Number.isFinite(currentRaw) ? currentRaw : Number(param.default)
      if (!Number.isFinite(current) || current <= 0) {
        current = Number(param.default)
      }
      if (!Number.isFinite(current) || current <= 0) {
        current = isPercent ? 1 : 10
      }
      if (forcePositiveInteger) {
        current = Math.max(1, Math.round(current))
      }

      const minRaw = Number(param.min)
      const maxRaw = Number(param.max)
      const fallbackMin = (isIntegerDeclared || periodLike) ? (allowZero ? 0 : 1) : 0
      const fallbackMax = (isIntegerDeclared || periodLike) ? Math.max(current * 2, current + 4) : Math.max(current * 2, current + (isPercent ? 2 : 1))
      let min = Number.isFinite(minRaw) ? minRaw : fallbackMin
      let max = Number.isFinite(maxRaw) ? maxRaw : fallbackMax
      if (forcePositiveInteger) min = Math.max(1, Math.round(min))
      if (isIntegerDeclared || periodLike) max = Math.max(min, Math.round(max))
      if (max < min) max = Math.max(min, current)

      const factors = (isIntegerDeclared || periodLike) ? [0.45, 0.65, 0.8, 1, 1.25, 1.5] : [0.5, 0.75, 1, 1.25, 1.5]
      const values = factors
        .map(factor => current * factor)
        .map(value => Math.min(max, Math.max(min, value)))
        .map(sanitizeValue)
        .filter(value => Number.isFinite(value))
        .filter(value => allowZero || value > 0)

      const sanitizedCurrent = sanitizeValue(current)
      if (sanitizedCurrent !== null) values.push(sanitizedCurrent)

      if (isIntegerDeclared || periodLike) {
        const anchors = allowZero ? [0, 2, 4, 6, 8, 12] : [3, 5, 8, 13, 21]
        if (!allowZero && (current >= 34 || max >= 34)) anchors.push(34, 55)
        if (!allowZero && (current >= 89 || max >= 89)) anchors.push(89)
        if (!allowZero && (current >= 144 || max >= 144)) anchors.push(144)
        anchors
          .map(value => Math.min(max, Math.max(min, value)))
          .map(sanitizeValue)
          .filter(value => Number.isFinite(value))
          .filter(value => allowZero || value > 0)
          .forEach(value => values.push(value))
      }

      return [...new Set(values)].sort((a, b) => Number(a) - Number(b)).slice(0, 8)
    },
    scoreTuneResult (item = {}) {
      const result = this.resultFromCandidate(item)
      const ret = Number(result.totalReturn || item.totalReturn || 0)
      const dd = Math.abs(Number(result.maxDrawdown || item.maxDrawdown || 0))
      const trades = Number(result.totalTrades || item.totalTrades || 0)
      const tradeScore = Math.min(Math.max(trades, 0), 80) * 0.03
      const emptyPenalty = trades <= 0 ? 15 : 0
      return ret - dd * 0.35 + tradeScore - emptyPenalty
    },
    formatSweepValues (values = []) {
      return values.map(value => {
        const num = Number(value)
        if (!Number.isFinite(num)) return String(value)
        return Math.abs(num) >= 100 ? String(Math.round(num)) : String(Number(num.toFixed(4)))
      }).join(', ')
    },
    toggleSweepDimension (key) {
      if (this.disabledSweepKeys.includes(key)) {
        this.disabledSweepKeys = this.disabledSweepKeys.filter(item => item !== key)
      } else {
        this.disabledSweepKeys = [...this.disabledSweepKeys, key]
      }
    },
    buildExperimentBase () {
      if (!this.selectedAsset || !this.selectedAssetCodeWithParams) return null
      const assetType = String(this.selectedAsset.asset_type || 'script')
      const assetId = this.selectedAsset.source_id || this.selectedAsset.id
      const params = { ...(this.paramValues || {}) }
      const runtimeParams = this.runtimeParamValues(params)
      const marketType = this.form.marketType
      if (assetType !== 'script') return null
      return {
        assetType,
        asset_type: assetType,
        assetId,
        asset_id: assetId,
        sourceId: assetId,
        source_id: assetId,
        strategyName: this.selectedAsset.name || '',
        strategy_name: this.selectedAsset.name || '',
        scriptSourceId: assetId,
        script_source_id: assetId,
        market: this.form.market,
        symbol: this.form.symbol,
        marketType,
        market_type: marketType,
        startDate: this.startDate && this.startDate.format ? this.startDate.format('YYYY-MM-DD') : undefined,
        endDate: this.endDate && this.endDate.format ? this.endDate.format('YYYY-MM-DD') : undefined,
        initialCapital: Number(this.form.initialCapital || 10000),
        commission: Number(this.form.commissionPct || 0) / 100,
        slippage: Number(this.form.slippagePct || 0) / 100,
        leverage: this.isSpotMode ? 1 : Number(this.form.leverage || 1),
        tradeDirection: this.isSpotMode ? 'long' : this.form.tradeDirection,
        strategyConfig: {
          indicator_params: { ...runtimeParams },
          indicatorParams: { ...runtimeParams },
          script_params: { ...runtimeParams },
          scriptParams: { ...runtimeParams },
          params: { ...runtimeParams },
          paramOverrides: { ...runtimeParams },
          fees: {
            fundingRateAnnual: this.isSpotMode ? 0 : Number(this.form.fundingRateAnnual || 0),
            fundingIntervalHours: this.isSpotMode ? 8 : Number(this.form.fundingIntervalHours || 8)
          },
          market_type: marketType,
          marketType
        },
        overrideConfig: {
          assetType,
          assetId,
          sourceId: assetId,
          scriptSourceId: assetId,
          script_source_id: assetId,
          strategyName: this.selectedAsset.name || '',
          codeOverride: this.selectedAssetCodeWithParams,
          script_params: { ...runtimeParams },
          scriptParams: { ...runtimeParams },
          params: { ...runtimeParams },
          paramOverrides: { ...runtimeParams },
          market_type: marketType,
          marketType
        },
        runType: 'strategy_script'
      }
    },
    extractTuneParamsFromCandidate (candidate) {
      const allowed = new Set((this.codeParams || []).map(item => item.name))
      const params = {}
      const merge = source => {
        if (!source || typeof source !== 'object') return
        Object.keys(source).forEach(key => {
          const cleanKey = String(key).split('.').pop()
          if (allowed.has(cleanKey)) params[cleanKey] = source[key]
        })
      }
      const overrides = (candidate && candidate.overrides) || {}
      const snapshot = (candidate && candidate.snapshot) || {}
      const strategyConfig = snapshot.strategy_config || snapshot.strategyConfig || {}
      merge(candidate && candidate.params)
      merge(candidate && candidate.paramOverrides)
      merge(candidate && candidate.indicatorParams)
      merge(candidate && candidate.indicator_params)
      merge(candidate && candidate.scriptParams)
      merge(candidate && candidate.script_params)
      merge(overrides.params)
      merge(overrides.paramOverrides)
      merge(overrides.indicatorParams)
      merge(overrides.indicator_params)
      merge(overrides.scriptParams)
      merge(overrides.script_params)
      merge(snapshot.indicator_params)
      merge(snapshot.script_params)
      merge(strategyConfig.indicator_params)
      merge(strategyConfig.script_params)
      merge(strategyConfig.params)
      Object.keys(overrides).forEach(key => {
        const cleanKey = String(key).split('.').pop()
        if (allowed.has(cleanKey)) params[cleanKey] = overrides[key]
      })
      return params
    },
    tuneParamForUi (name, value) {
      return value
    },
    scoreFromCandidate (candidate = {}) {
      const score = candidate.score || {}
      const raw = score.overallScore != null ? score.overallScore : (score.overall != null ? score.overall : (score.total != null ? score.total : candidate.score))
      const value = Number(raw)
      return Number.isFinite(value) ? value : 0
    },
    resultFromCandidate (candidate = {}) {
      const raw = candidate.result || candidate.summary || candidate.metrics || candidate.backtestResult || candidate.backtest_result || {}
      return this.normalizeBacktestResult(raw)
    },
    experimentGradeFromScore (score) {
      const value = Number(score || 0)
      if (value >= 85) return 'S'
      if (value >= 70) return 'A'
      if (value >= 55) return 'B'
      if (value >= 40) return 'C'
      return 'D'
    },
    formatScore (value) {
      const num = Number(value)
      return Number.isFinite(num) ? num.toFixed(1) : '-'
    },
    formatExperimentValue (value) {
      const num = Number(value)
      if (!Number.isFinite(num)) return value == null ? '-' : String(value)
      if (Math.abs(num) >= 100) return String(Number(num.toFixed(2)))
      if (Math.abs(num) >= 1) return String(Number(num.toFixed(4)))
      return String(Number(num.toFixed(6)))
    },
    humanizeExperimentParamName (name) {
      const map = {
        hard_stop_pct: this.bt('backtest-center.paramNames.hardStopPct', 'hardStopPct'),
        take_profit_pct: this.bt('backtest-center.paramNames.takeProfitPct', 'takeProfitPct'),
        trailing_stop_pct: this.bt('backtest-center.paramNames.trailingStopPct', 'trailingStopPct'),
        trailing_activation_pct: this.bt('backtest-center.paramNames.trailingActivationPct', 'trailingActivationPct'),
        risk_budget_pct: this.bt('backtest-center.paramNames.riskBudgetPct', 'riskBudgetPct'),
        entry_pct: this.bt('backtest-center.paramNames.entryPct', 'entryPct'),
        max_layers: this.bt('backtest-center.paramNames.maxLayers', 'maxLayers'),
        leverage: this.bt('backtest-center.paramNames.leverage', 'leverage')
      }
      return map[name] || String(name || '').replace(/_/g, ' ')
    },
    humanizeExperimentScoreKey (key) {
      const map = {
        returnScore: this.bt('backtest-center.score.return', 'return'),
        drawdownScore: this.bt('backtest-center.score.drawdown', 'drawdown'),
        sharpeScore: this.bt('backtest-center.score.sharpe', 'sharpe'),
        winRateScore: this.bt('backtest-center.score.winRate', 'winRate'),
        profitFactorScore: this.bt('backtest-center.score.profitFactor', 'profitFactor')
      }
      return map[key] || String(key || '').replace(/([A-Z])/g, ' $1').trim()
    },
    buildExperimentParameterSpace () {
      const space = {}
      this.enabledSweepDimensions.forEach(dim => {
        if (dim && dim.values && dim.values.length > 1) {
          const rawKey = dim.paramName || dim.param_name || dim.name || dim.key || dim.path
          const key = this.normalizeParamKey(rawKey)
          if (key) space[key] = dim.values
        }
      })
      return space
    },
    normalizeParamKey (key) {
      const text = String(key || '').trim()
      if (!text) return ''
      return text.replace(/\[/g, '.').replace(/\]/g, '').split('.').filter(Boolean).pop() || ''
    },
    unwrapExperimentResponse (res) {
      const payload = this.unwrapApiPayload(res)
      if (payload && payload.data && (payload.data.bestStrategyOutput || payload.data.rankedStrategies || payload.data.experiment)) return payload.data
      return payload
    },
    selectExperimentCandidate (candidate) {
      if (!candidate) return
      this.experimentSelectedCandidateName = candidate.name || ''
    },
    async runBacktestWithTuneCandidate (candidate) {
      if (!candidate) return
      this.applyTuneResult(candidate)
      await this.$nextTick()
      await this.runBacktest()
    },
    async runExperimentTune (method) {
      if (!this.selectedAsset) {
        this.$message.warning(this.copy.selectAssetFirst)
        return true
      }
      if (!this.selectedAssetCodeWithParams) {
        this.$message.warning(this.bt('backtest-center.message.noTunableCode', 'noTunableCode'))
        return true
      }
      const base = this.buildExperimentBase()
      if (!base) return true
      const finalMethod = method === 'bayes' ? 'tpe' : (method || 'grid')
      const parameterSpace = this.buildExperimentParameterSpace()
      if (!Object.keys(parameterSpace).length) {
        this.$message.warning(this.copy.tuneEmpty)
        return true
      }
      this.experimentRunning = true
      this.experimentRunKind = 'v2'
      this.experimentLiveHint = this.bt('backtest-center.message.tuningRunning', 'tuningRunning')
      this.experimentError = ''
      this.experimentResult = null
      this.tuneResults = []
      try {
        const data = this.unwrapExperimentResponse(await tuneUnifiedBacktest({
          base,
          method: finalMethod,
          parameterSpace,
          dimensions: this.enabledSweepDimensions,
          includeBaseline: true,
          oosValidation: true,
          maxVariants: finalMethod === 'grid' ? 120 : 60
        }))
        this.experimentResult = data || {}
        const best = this.experimentBest
        if (best) this.experimentSelectedCandidateName = best.name || ''
        const count = this.experimentRankedStrategies.length
        const bestResult = this.resultFromCandidate(best || {})
        const noTrade = !!(data && data.experiment && data.experiment.noTrade) || !best || Number(bestResult.totalTrades || 0) <= 0
        if (noTrade) {
          this.$message.warning(this.copy.tuneNoTrade)
        } else {
          const bestScore = this.formatScore(this.scoreFromCandidate(best))
          this.$message.success(this.bt('backtest-center.message.tuningComplete', 'tuningComplete')
            .replace('{count}', count)
            .replace('{score}', bestScore))
        }
      } catch (error) {
        const msg = (error && (error.message || error.msg)) || this.bt('backtest-center.message.tuningFailed', 'tuningFailed')
        this.experimentError = msg
        this.$message.error(msg)
      } finally {
        this.experimentRunning = false
        this.experimentLiveHint = ''
      }
      return true
    },
    async runStructuredTune () {
      return this.runExperimentTune(this.structuredTuneMethod)
    },
    applyTuneResult (item, options = {}) {
      const params = this.extractTuneParamsFromCandidate(item)
      if (!item || !params || !Object.keys(params).length) {
        this.$message.warning(this.bt('backtest-center.message.noApplicableParams', 'noApplicableParams'))
        return
      }
      const uiParams = {}
      Object.keys(params).forEach(key => {
        uiParams[key] = this.tuneParamForUi(key, params[key])
      })
      const before = { ...(this.paramValues || {}) }
      Object.keys(uiParams).forEach(key => this.$set(this.paramValues, key, uiParams[key]))
      if (this.selectedAsset) {
        const merged = { ...before, ...uiParams }
        const code = item.code || buildScriptCodeWithParamValues(this.selectedAssetCode, this.codeParams, merged)
        this.$set(this.tunedCodeByAssetKey, this.selectedAsset.asset_key, code)
      }
      if (item && item.name) this.experimentSelectedCandidateName = item.name
      this.lastAppliedExperimentCandidateName = item.name || ''
      this.lastAppliedExperimentChanges = Object.keys(uiParams).map(key => ({
        name: key,
        before: before[key],
        after: uiParams[key]
      }))
      if (!options.silent) {
        const name = item.name || this.bt('backtest-center.experiment.candidate', 'candidate')
        this.$message.success(this.bt('backtest-center.message.candidateApplied', 'candidateApplied').replace('{name}', name))
      }
    },
    async applyTuneResultAndSave (item) {
      this.applyTuneResult(item, { silent: true })
      await this.$nextTick()
      await this.saveParamsAsCodeVersion()
    },
    normalizeIntrabarMode (value) {
      const mode = String(value || 'conservative').trim().toLowerCase()
      if (['aggressive', 'optimistic', 'fast'].includes(mode)) return 'aggressive'
      if (['balanced', 'standard', 'normal', 'neutral'].includes(mode)) return 'balanced'
      return 'conservative'
    },
    normalizeMarketType (value) {
      const type = String(value || 'swap').trim().toLowerCase()
      if (['future', 'futures', 'perp', 'perpetual', 'contract'].includes(type)) return 'swap'
      return type === 'spot' ? 'spot' : 'swap'
    },
    normalizeMarket (value) {
      const key = String(value || '').trim().toLowerCase()
      const map = {
        crypto: 'Crypto',
        usstock: 'USStock',
        us: 'USStock',
        cnstock: 'CNStock',
        cn: 'CNStock',
        hkstock: 'HKStock',
        hk: 'HKStock',
        forex: 'Forex',
        fx: 'Forex',
        futures: 'Futures',
        future: 'Futures'
      }
      return map[key] || value || 'Crypto'
    },
    goEditor () {
      this.$router.push({ path: '/strategy-ide', query: { tab: 'script' } })
    }
  }
}
</script>

<style lang="less" scoped>
.backtest-center-page {
  height: calc(100vh - 72px);
  min-height: 0;
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
  overflow: hidden;
  background: #f5f7fb;
  color: #111827;
}

.backtest-center-page.portfolio-mode {
  grid-template-columns: 380px minmax(0, 1fr);
}

.backtest-sidebar,
.backtest-main,
.current-card,
.config-card {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 8px;
}

.backtest-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: calc(100vh - 104px);
  overflow: hidden;
  padding: 14px;
}

.sidebar-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.sidebar-head,
.main-head,
.config-card-head,
.code-param-head,
.selected-asset {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.sidebar-head span,
.main-head span {
  display: block;
  color: #16a34a;
  font-size: 12px;
  font-weight: 700;
}

.sidebar-head strong,
.main-head h1 {
  display: block;
  margin: 4px 0 0;
  color: inherit;
  font-size: 24px;
  line-height: 1.2;
}

.asset-tabs,
.asset-search {
  margin-top: 12px;
}

.asset-list {
  margin-top: 12px;
  min-height: 120px;
  max-height: 280px;
  overflow: auto;
}

.asset-row {
  width: 100%;
  display: block;
  text-align: left;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.asset-row.active {
  border-color: #52c41a;
  background: #f0fdf4;
}

.asset-row__type {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f0fdf4;
  color: #15803d;
  font-size: 12px;
  font-weight: 700;
}

.asset-row strong,
.asset-row small {
  display: block;
  margin-top: 6px;
}

.asset-row small {
  color: #64748b;
  line-height: 1.45;
}

.side-config {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.side-config--strategy {
  border-top: 0;
  padding-top: 0;
}

.strategy-select,
.backtest-watchlist-select {
  margin-top: 10px;
}

.strategy-select,
.backtest-watchlist-select {
  ::v-deep .ant-select-selection-selected-value {
    display: inline-flex !important;
    align-items: center;
    gap: 7px;
    max-width: calc(100% - 24px);
  }

  ::v-deep .asset-opt-tag,
  ::v-deep .wl-opt-tag {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    height: 18px;
    padding: 0 6px;
    border-radius: 3px;
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    line-height: 18px;
    white-space: nowrap;
    background: #52c41a;
  }

  ::v-deep .wl-mkt-crypto { background: #fa8c16; }
  ::v-deep .wl-mkt-usstock { background: #1890ff; }
  ::v-deep .wl-mkt-cnstock { background: #eb2f96; }
  ::v-deep .wl-mkt-hkstock { background: #f5222d; }
  ::v-deep .wl-mkt-forex { background: #52c41a; }
  ::v-deep .wl-mkt-futures { background: #722ed1; }

  ::v-deep .asset-opt-name,
  ::v-deep .wl-opt-symbol,
  ::v-deep .wl-opt-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.date-presets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}

.date-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.run-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 12px;
}

.sidebar-runbar {
  flex-shrink: 0;
  margin: 12px -14px -14px;
  padding: 12px 14px 14px;
  border-top: 1px solid #e5e7eb;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), #fff 32%);
}

.strict-inline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.strict-inline strong,
.strict-inline span {
  display: block;
}

.strict-inline span {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.strict-inline.active {
  border-color: rgba(82, 196, 26, 0.35);
  background: #f0fdf4;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
}

.section-title--between {
  justify-content: space-between;
}

.section-title--between > span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.side-config label,
.param-panel label,
.code-param-item label {
  display: block;
  margin: 10px 0 6px;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.two-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.direction-group {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.direction-group ::v-deep .ant-radio-button-wrapper {
  text-align: center;
}

.side-config--code-params {
  background: linear-gradient(180deg, rgba(82, 196, 26, 0.04), transparent);
}

.side-param-hint {
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.side-param-hint--warn {
  color: #b45309;
}

.side-code-param-list {
  display: grid;
  gap: 9px;
  margin-top: 12px;
}

.side-code-param-row {
  min-width: 0;
}

.side-code-param-row label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.side-code-param-row label span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-code-param-row em {
  color: #52c41a;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.side-param-actions {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 8px;
  margin-top: 12px;
}

.strategy-param-dock {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(24, 144, 255, 0.04), transparent);
}

.strategy-param-dock--sidebar {
  max-height: 420px;
  margin-top: 10px;
  padding: 10px;
  overflow-x: hidden;
  overflow-y: auto;
  border-radius: 4px;
}

.strategy-param-dock--sidebar .side-code-param-list--dock {
  grid-template-columns: minmax(0, 1fr);
}

.strategy-param-dock--sidebar .side-param-actions--dock {
  max-width: none;
  margin-left: 0;
}

.side-code-param-list--dock {
  grid-template-columns: repeat(auto-fit, minmax(168px, 1fr));
}

.side-param-actions--dock {
  max-width: 360px;
  margin-left: auto;
}

.backtest-main {
  min-width: 0;
  min-height: 0;
  max-height: calc(100vh - 104px);
  padding: 16px;
  overflow-x: hidden;
  overflow-y: auto;
}

.current-card,
.config-card {
  margin-top: 14px;
  padding: 16px;
}

.current-card--compact {
  margin-top: 0;
  padding: 14px 16px;
}

.selected-asset {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.selected-asset--compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.selected-asset__main strong {
  display: inline-block;
  margin-left: 8px;
  font-size: 18px;
  vertical-align: middle;
}

.selected-asset__main p {
  margin: 6px 0 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.selected-asset__meta {
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 800;
}

.selected-asset__actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.result-split-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  margin-top: 14px;
}

.result-split-panel {
  min-width: 0;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.05);
}

.workbench-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 46px;
  padding: 10px 16px;
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.1) 0%, rgba(82, 196, 26, 0.04) 100%);
  border-bottom: 1px solid rgba(82, 196, 26, 0.14);
}

.workbench-panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
  color: #1e293b;
}

.workbench-panel-title .anticon {
  color: #52c41a;
}

.workbench-panel-meta {
  max-width: 46%;
  overflow: hidden;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-panel-body {
  padding: 14px 16px 16px;
}

.result-running,
.result-empty {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  color: #94a3b8;
}

.result-empty .anticon {
  font-size: 46px;
  color: #cbd5e1;
}

.result-empty p {
  margin: 0;
  font-size: 12px;
}

.result-empty--compact {
  min-height: 160px;
}

.running-time {
  color: #52c41a;
  font-size: 14px;
  font-weight: 700;
}

.backtest-workbench-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.backtest-overview-head,
.backtest-quality-strip,
.eq-section--hero,
.replay-section,
.trades-section--workbench {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
}

.backtest-overview-head {
  padding: 12px 14px;
}

.backtest-overview-kicker {
  margin-bottom: 4px;
  color: #52c41a;
  font-size: 11px;
  font-weight: 800;
}

.backtest-overview-title {
  color: #0f172a;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.35;
}

.metrics-grid {
  display: grid;
  gap: 10px;
}

.metrics-grid--workbench {
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
}

.metric-card {
  min-height: 78px;
  padding: 12px 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: linear-gradient(165deg, #fff 0%, #f8fafc 100%);
}

.metric-label {
  margin-bottom: 6px;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
}

.metric-value {
  color: #0f172a;
  font-size: 18px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.metric-hint {
  margin-top: 4px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.35;
}

.metric-card.positive .metric-value,
.positive-text {
  color: #52c41a;
}

.metric-card.negative .metric-value,
.negative-text {
  color: #ff4d4f;
}

.backtest-quality-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
}

.zero-trade-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(250, 173, 20, 0.28);
  border-radius: 8px;
  background: rgba(250, 173, 20, 0.1);
  color: #b45309;
  font-size: 12px;
  line-height: 1.6;
}

.zero-trade-warning .anticon {
  margin-top: 3px;
  color: #faad14;
}

.backtest-quality-strip__title,
.backtest-quality-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.backtest-quality-strip__title {
  color: #475569;
  font-size: 12px;
  font-weight: 800;
}

.backtest-quality-chip {
  min-height: 28px;
  padding: 5px 9px;
  border: 1px solid rgba(100, 116, 139, 0.18);
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font-size: 11px;
}

.backtest-quality-chip strong {
  font-variant-numeric: tabular-nums;
}

.backtest-quality-chip--good {
  border-color: rgba(82, 196, 26, 0.3);
  background: rgba(82, 196, 26, 0.1);
  color: #15803d;
}

.backtest-quality-chip--warn {
  border-color: rgba(250, 173, 20, 0.3);
  background: rgba(250, 173, 20, 0.1);
  color: #b45309;
}

.backtest-quality-chip--danger {
  border-color: rgba(255, 77, 79, 0.3);
  background: rgba(255, 77, 79, 0.1);
  color: #dc2626;
}

.professional-audit {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: #fff;
}

.professional-audit__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.professional-audit__head strong,
.professional-audit__head span {
  display: block;
}

.professional-audit__head strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
}

.professional-audit__head span {
  margin-top: 3px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.professional-audit__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

.data-range-notice {
  margin-bottom: 14px;
  text-align: left;
}

.audit-summary-card {
  padding: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: #f8fafc;
}

.professional-audit__grid--summary {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.audit-summary-card {
  min-height: 178px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  position: relative;
  overflow: hidden;
}

.audit-summary-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: rgba(100, 116, 139, 0.34);
}

.audit-summary-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  color: #0f172a;
  font-size: 12px;
  font-weight: 900;
}

.audit-summary-card__head span {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.audit-summary-card__head strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-summary-card__head em {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(100, 116, 139, 0.12);
  color: #64748b;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
}

.audit-summary-card__head .anticon {
  color: var(--primary-color, #1890ff);
}

.audit-summary-card__value {
  color: #0f172a;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.audit-summary-card__desc {
  color: #64748b;
  font-size: 11px;
  line-height: 1.45;
}

.audit-summary-card__rows {
  display: grid;
  gap: 5px;
  padding-top: 8px;
  margin-top: auto;
  border-top: 1px solid rgba(100, 116, 139, 0.12);
}

.audit-summary-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.35;
}

.audit-summary-card__row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-summary-card__row strong {
  flex-shrink: 0;
  max-width: 58%;
  overflow: hidden;
  color: #0f172a;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.audit-summary-card__row--ok strong {
  color: #16a34a;
}

.audit-summary-card__row--warn strong {
  color: #b45309;
}

.audit-summary-card__row--bad strong {
  color: #dc2626;
}

.audit-summary-card--ok {
  border-color: rgba(82, 196, 26, 0.22);
  background: linear-gradient(180deg, rgba(82, 196, 26, 0.08), #f8fafc);
}

.audit-summary-card--ok::before {
  background: #52c41a;
}

.audit-summary-card--ok .audit-summary-card__head em {
  color: #15803d;
  background: rgba(82, 196, 26, 0.14);
}

.audit-summary-card--warn {
  border-color: rgba(250, 173, 20, 0.26);
  background: linear-gradient(180deg, rgba(250, 173, 20, 0.08), #f8fafc);
}

.audit-summary-card--warn::before {
  background: #faad14;
}

.audit-summary-card--warn .audit-summary-card__head em {
  color: #b45309;
  background: rgba(250, 173, 20, 0.16);
}

.audit-summary-card--neutral {
  border-color: rgba(100, 116, 139, 0.16);
}

.eq-section--hero,
.replay-section,
.trades-section--workbench {
  padding: 12px;
}

.eq-title,
.trades-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
}

.eq-title .anticon,
.trades-title .anticon {
  color: #52c41a;
}

.equity-chart--large {
  position: relative;
  height: 260px;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.03);
  cursor: crosshair;
}

.equity-echart {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.chart-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 12px;
}

.replay-chart {
  position: relative;
  height: 320px;
  min-height: 320px;
  overflow: hidden;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.02), rgba(15, 23, 42, 0.04)),
    #fff;
}

.replay-echart {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.replay-echart-tooltip__time {
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 900;
}

.replay-echart-tooltip__grid {
  display: grid;
  grid-template-columns: repeat(4, auto minmax(0, 1fr));
  gap: 4px 7px;
  align-items: center;
  font-size: 10px;
}

.replay-echart-tooltip__grid strong {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.replay-echart-tooltip__actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid currentColor;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.7;
}

.mono {
  font-variant-numeric: tabular-nums;
}

.ide-tune-pills {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ide-tune-pill {
  height: 42px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-weight: 800;
  cursor: pointer;
}

.ide-tune-pill.active {
  color: #fff;
  border-color: #52c41a;
  background: #52c41a;
}

.ide-tune-pill .anticon {
  margin-right: 6px;
}

.ide-tune-dimensions {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: #f8fafc;
}

.ide-tune-live-hint {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  color: #166534;
  font-size: 12px;
  background: rgba(82, 196, 26, 0.12);
}

.ide-tune-dimensions-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}

.ide-tune-dimensions-list {
  margin-top: 10px;
}

.ide-tune-dim-row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto minmax(80px, 1fr);
  gap: 8px;
  align-items: center;
  padding: 9px 0;
  border-top: 1px solid rgba(15, 23, 42, 0.07);
  color: #475569;
  font-size: 12px;
}

.ide-tune-dim-label {
  color: #0f172a;
  font-weight: 800;
}

.ide-tune-dim-count {
  color: #52c41a;
  font-weight: 800;
}

.ide-tune-dim-values {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
}

.ide-tune-dim-row.is-disabled {
  opacity: 0.45;
}

.tune-best-card {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(82, 196, 26, 0.28);
  border-radius: 8px;
  background: rgba(82, 196, 26, 0.08);
}

.tune-best-card span {
  color: #64748b;
  font-size: 12px;
}

.tune-best-card strong {
  color: #52c41a;
  font-size: 16px;
}

.tune-best-card button {
  border: 0;
  background: transparent;
  color: #52c41a;
  font-weight: 800;
  cursor: pointer;
}

.tune-best-card button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.param-panel,
.code-param-card {
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.param-title {
  font-weight: 800;
}

.code-param-card,
.unified-result-panel {
  margin-top: 12px;
}

.unified-result-panel--with-tuner {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(360px, 0.9fr);
  gap: 14px;
  align-items: start;
}

.unified-result-panel--with-tuner ::v-deep .bt-tuner-card {
  grid-column: 2;
  grid-row: 1 / span 3;
  margin: 0;
}

.unified-result-panel--with-tuner ::v-deep .bt-running-banner,
.unified-result-panel--with-tuner ::v-deep .bt-result-card,
.unified-result-panel--with-tuner ::v-deep .bt-empty-result {
  grid-column: 1;
  grid-row: 1;
  margin: 0;
}

.unified-result-panel--with-tuner ::v-deep .bt-history-section {
  grid-column: 1 / -1;
  margin-top: 0;
}

.unified-result-panel--with-tuner ::v-deep .bt-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.unified-result-panel--with-tuner ::v-deep .bt-analysis-grid {
  grid-template-columns: 1fr;
}

.code-param-head strong,
.code-param-head span {
  display: block;
}

.code-param-head span {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.code-param-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(170px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.code-param-item {
  min-width: 0;
}

.code-param-item label {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.code-param-item em {
  color: #16a34a;
  font-style: normal;
}

.asset-type-tag,
.asset-row__type {
  color: var(--primary-color, #1890ff) !important;
  border-color: color-mix(in srgb, var(--primary-color, #1890ff) 30%, transparent) !important;
  background: color-mix(in srgb, var(--primary-color, #1890ff) 10%, #fff) !important;
}

.sidebar-head span,
.main-head span,
.section-title .anticon,
.workbench-panel-title .anticon,
.backtest-overview-kicker,
.running-time,
.eq-title .anticon,
.trades-title .anticon,
.ide-tune-dim-count,
.code-param-item em,
.tune-best-card strong,
.tune-best-card button {
  color: var(--primary-color, #1890ff);
}

.asset-row.active,
.strict-inline.active {
  border-color: color-mix(in srgb, var(--primary-color, #1890ff) 42%, transparent);
  background: color-mix(in srgb, var(--primary-color, #1890ff) 8%, #fff);
}

.workbench-panel-header {
  border-bottom-color: color-mix(in srgb, var(--primary-color, #1890ff) 18%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary-color, #1890ff) 10%, #fff) 0%,
    color-mix(in srgb, var(--primary-color, #1890ff) 4%, #fff) 100%
  );
}

.side-config--code-params {
  background: linear-gradient(180deg, color-mix(in srgb, var(--primary-color, #1890ff) 5%, transparent), transparent);
}

.ide-tune-pill.active {
  color: #fff;
  border-color: var(--primary-color, #1890ff);
  background: var(--primary-color, #1890ff);
}

.tune-best-card {
  border-color: color-mix(in srgb, var(--primary-color, #1890ff) 26%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary-color, #1890ff) 10%, transparent),
    color-mix(in srgb, var(--primary-color, #1890ff) 3%, transparent)
  );
}

.ide-tune-live-hint {
  color: var(--primary-color, #1890ff);
}

.ide-tune-live-hint {
  background: color-mix(in srgb, var(--primary-color, #1890ff) 12%, transparent);
}

.backtest-center-page {
  ::v-deep .ant-btn-primary {
    background: var(--primary-color, #1890ff) !important;
    border-color: var(--primary-color, #1890ff) !important;
  }

  ::v-deep .ant-btn-primary:hover,
  ::v-deep .ant-btn-primary:focus {
    background: var(--primary-color-hover, var(--primary-color, #1890ff)) !important;
    border-color: var(--primary-color-hover, var(--primary-color, #1890ff)) !important;
  }

  ::v-deep .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) {
    color: #fff;
    background: var(--primary-color, #1890ff) !important;
    border-color: var(--primary-color, #1890ff) !important;
    box-shadow: none !important;
  }

  ::v-deep .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled)::before {
    background-color: var(--primary-color, #1890ff) !important;
  }

  ::v-deep .ant-switch-checked {
    background-color: var(--primary-color, #1890ff) !important;
  }

  ::v-deep .ant-checkbox-checked .ant-checkbox-inner,
  ::v-deep .ant-checkbox-indeterminate .ant-checkbox-inner {
    background-color: var(--primary-color, #1890ff) !important;
    border-color: var(--primary-color, #1890ff) !important;
  }

  ::v-deep .ant-checkbox-wrapper:hover .ant-checkbox-inner,
  ::v-deep .ant-checkbox:hover .ant-checkbox-inner,
  ::v-deep .ant-checkbox-input:focus + .ant-checkbox-inner {
    border-color: var(--primary-color, #1890ff) !important;
  }

  ::v-deep .asset-opt-tag {
    background: var(--primary-color, #1890ff) !important;
  }
}

.backtest-center-page {
  gap: 12px;
  padding: 12px;
  background: #f5f6f8;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.backtest-sidebar,
.backtest-main,
.current-card,
.result-split-panel,
.selected-asset,
.strategy-param-dock,
.backtest-overview-head,
.eq-section--hero,
.replay-section,
.trades-section--workbench,
.professional-audit {
  border-radius: 5px;
  box-shadow: none;
}

.backtest-sidebar { padding: 16px; }
.sidebar-head strong { font-size: 23px; font-weight: 750; }
.section-title { color: #202938; font-size: 14px; font-weight: 700; }
.section-title > .anticon { color: var(--primary-color, #52c41a); }
.section-step { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: var(--primary-color, #52c41a); color: #fff; font-size: 11px; font-weight: 800; }
.compact-redundant-label { display: none !important; }
.backtest-sidebar .side-config { margin-top: 8px; padding-top: 8px; }
.backtest-sidebar .side-config--strategy { margin-top: 0; padding-top: 0; }
.backtest-sidebar .strategy-select,
.backtest-sidebar .backtest-watchlist-select { margin-top: 7px; }
.backtest-sidebar .side-config label { margin-top: 6px; margin-bottom: 4px; }
.backtest-sidebar .timeframe-summary { margin-top: 6px; padding-top: 6px; padding-bottom: 6px; }
.backtest-sidebar .advanced-toggle { margin-top: 5px; padding-top: 5px; }
.backtest-sidebar .date-presets { margin-top: 7px; }
.backtest-sidebar .date-row { gap: 6px; }
.sidebar-param-link { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 10px; padding: 9px 2px 2px; border: 0; border-top: 1px solid #edf0f3; background: transparent; color: #657083; font-size: 12px; font-weight: 600; cursor: pointer; }
.sidebar-param-link > span { display: inline-flex; align-items: center; gap: 7px; }
.sidebar-param-link .anticon { color: var(--primary-color, #52c41a); }
.side-config label { color: #596579; font-size: 12px; font-weight: 600; }
.timeframe-summary { display: flex; align-items: center; justify-content: space-between; padding: 9px 10px; border: 1px solid #e5e7eb; border-radius: 4px; background: #fafbfc; }
.timeframe-summary strong { color: #1f2937; font-size: 13px; }
.advanced-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 12px; padding: 9px 0 2px; border: 0; border-top: 1px solid #edf0f3; background: transparent; color: #687386; font-size: 12px; font-weight: 600; text-align: left; cursor: pointer; }
.advanced-costs { padding-top: 2px; }
.sidebar-runbar { background: #fff; }
.sidebar-runbar ::v-deep .ant-btn { height: 46px; border-radius: 4px; font-size: 15px; font-weight: 700; }

.backtest-sidebar--portfolio {
  padding: 18px;
}

.backtest-sidebar--portfolio .sidebar-head {
  align-items: center;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid #e8ebef;
}

.backtest-sidebar--portfolio .sidebar-body {
  margin-right: -5px;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.32) transparent;
}

.backtest-sidebar--portfolio .side-config,
.backtest-sidebar--portfolio .side-config--strategy {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid #e6e9ee;
  border-radius: 8px;
  background: #fafbfc;
}

.backtest-sidebar--portfolio .side-config--strategy {
  margin-top: 0;
}

.backtest-sidebar--portfolio .section-title {
  margin-bottom: 12px;
  font-size: 14px;
}

.backtest-sidebar--portfolio .strategy-select {
  margin-top: 0;
}

.backtest-sidebar--portfolio .sidebar-param-link {
  margin-top: 12px;
  padding: 10px 0 0;
}

.backtest-sidebar--portfolio .portfolio-config > label:first-of-type {
  margin-top: 0;
}

.backtest-sidebar--portfolio .portfolio-config .direction-group {
  margin-top: 1px;
}

.backtest-sidebar--portfolio .portfolio-config__limits {
  gap: 10px;
  margin-top: 12px;
}

.backtest-sidebar--portfolio .portfolio-config__limits label {
  min-height: 32px;
  margin-top: 0;
  line-height: 16px;
}

.backtest-sidebar--portfolio .portfolio-config__switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  margin-top: 12px;
  padding: 0 11px;
  border: 1px solid #e5e8ed;
  border-radius: 6px;
  background: #fff;
  color: #4b5563;
  font-size: 12px;
  font-weight: 650;
}

.backtest-sidebar--portfolio .portfolio-config > .side-param-hint {
  margin-top: 10px;
  padding: 9px 10px;
  border: 1px solid color-mix(in srgb, var(--primary-color, #52c41a) 18%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--primary-color, #52c41a) 6%, #fff);
  line-height: 1.55;
}

.backtest-sidebar--portfolio .side-config--capital label {
  margin-top: 0;
}

.backtest-sidebar--portfolio .advanced-toggle {
  min-height: 36px;
  margin-top: 0;
  padding: 0 10px;
  border: 1px solid #e5e8ed;
  border-radius: 6px;
  background: #fff;
}

.backtest-sidebar--portfolio .date-presets {
  gap: 8px;
  margin-top: 0;
}

.backtest-sidebar--portfolio .date-presets ::v-deep .ant-btn {
  height: 32px;
  border-radius: 5px;
}

.backtest-sidebar--portfolio .date-row {
  gap: 10px;
  margin-top: 10px;
}

.backtest-sidebar--portfolio .date-row label {
  margin-top: 0;
}

.backtest-sidebar--portfolio ::v-deep .ant-select-selection,
.backtest-sidebar--portfolio ::v-deep .ant-input-number,
.backtest-sidebar--portfolio ::v-deep .ant-calendar-picker-input {
  min-height: 36px;
  border-radius: 6px;
}

.backtest-sidebar--portfolio ::v-deep .ant-select-selection__rendered,
.backtest-sidebar--portfolio ::v-deep .ant-input-number-input {
  min-height: 34px;
  line-height: 34px;
}

.backtest-sidebar--portfolio .sidebar-runbar {
  margin: 14px -18px -18px;
  padding: 14px 18px 18px;
}

.backtest-sidebar--portfolio .sidebar-runbar ::v-deep .ant-btn {
  height: 48px;
  border-radius: 7px;
}

.backtest-main { padding: 0; }
.current-card--compact { margin-top: 0; padding: 8px 20px; border: 0; border-bottom: 1px solid #e5e7eb; border-radius: 0; }
.current-card--compact > .section-title { display: none; }
.current-card--compact .selected-asset { margin-top: 0; padding: 3px 0; border: 0; background: transparent; }
.current-card--compact .selected-asset__main p { display: none; }
.selected-asset { background: #fafbfc; }
.selected-asset__main strong { font-weight: 700; }
.strategy-param-dock { background: #fffdf7; }
.result-split-workbench { margin-top: 0; }
.result-split-panel { border: 0; border-radius: 0; }
.workbench-panel-header { background: color-mix(in srgb, var(--primary-color, #52c41a) 5%, #fff); border-bottom-color: color-mix(in srgb, var(--primary-color, #52c41a) 22%, transparent); }
.result-split-panel--backtest > .workbench-panel-header { display: none; }
.workbench-panel-title .anticon { color: var(--primary-color, #52c41a); }
.workbench-panel-body { padding: 16px 20px 20px; }
.backtest-workbench-main { gap: 14px; }

.backtest-overview-head { display: flex; align-items: center; min-height: 58px; padding: 8px 14px; border-left: 4px solid var(--primary-color, #52c41a); background: #fff; }
.backtest-overview-kicker { color: var(--primary-color, #52c41a); }
.backtest-overview-title { font-size: 18px; }
.backtest-overview-note { display: block; margin-top: 4px; color: #7b8493; font-size: 12px; }

.metrics-grid--workbench { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; border: 1px solid #e5e7eb; border-radius: 4px; background: #fff; }
.metric-card { min-height: 76px; padding: 10px 16px; border: 0; border-right: 1px solid #e9ecf0; border-radius: 0; background: #fff; }
.metric-card:last-child { border-right: 0; }
.metric-label { font-size: 12px; font-weight: 600; }
.metric-value { font-size: 21px; letter-spacing: -.02em; }
.metric-card.positive .metric-value,
.positive-text { color: var(--primary-color, #52c41a); }
.backtest-quality-strip { display: none; border-radius: 4px; }
.backtest-quality-chip--good { border-color: rgba(35, 154, 89, .26); background: rgba(35, 154, 89, .08); color: #197745; }

.eq-section--hero,
.replay-section,
.trades-section--workbench { padding: 14px 16px; }
.eq-title .anticon,
.trades-title .anticon { color: var(--primary-color, #52c41a); }
.portfolio-orders-title { margin-top: 18px; }
.portfolio-weight-list { color: #667085; white-space: normal; }
.theme-dark .portfolio-weight-list { color: #a7a7a7; }
.equity-chart--large { height: 315px; border-radius: 2px; background: #fff; }

.result-view-tabs { display: flex; align-items: center; gap: 4px; min-height: 46px; padding: 0 4px; border-bottom: 1px solid #e5e7eb; }
.result-view-tabs button { position: relative; display: inline-flex; align-items: center; gap: 7px; min-height: 45px; padding: 0 14px; border: 0; background: transparent; color: #657083; font-size: 13px; font-weight: 600; cursor: pointer; }
.result-view-tabs button:last-child { margin-left: auto; }
.result-view-tabs button::after { content: ''; position: absolute; right: 12px; bottom: -1px; left: 12px; height: 2px; background: transparent; }
.result-view-tabs button.active { color: var(--primary-color, #52c41a); }
.result-view-tabs button.active::after { background: var(--primary-color, #52c41a); }
.result-view-panel { margin-top: 0; border-top: 0; border-radius: 0 0 4px 4px; }
.diagnostic-detail { padding: 8px 16px 16px; border: 1px solid #e5e7eb; border-top: 0; }
.diagnostic-detail__row { display: flex; align-items: center; justify-content: space-between; min-height: 48px; border-bottom: 1px solid #edf0f3; color: #566173; }
.diagnostic-detail__row span { display: inline-flex; align-items: center; gap: 8px; }
.diagnostic-detail__row strong { color: #222c39; font-variant-numeric: tabular-nums; }
.diagnostic-detail__row--warn strong { color: var(--primary-color, #52c41a); }
.diagnostic-detail__row--danger strong { color: #d94b4b; }
.secondary-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0; margin-top: 12px; border: 1px solid #e5e7eb; }
.secondary-metrics > div { padding: 12px; border-right: 1px solid #e5e7eb; }
.secondary-metrics span { display: block; color: #7b8493; font-size: 11px; }
.secondary-metrics strong { display: block; margin-top: 5px; color: #222c39; font-size: 15px; }

.empty-inline {
  padding: 18px 0;
}

.theme-dark {
  background: #101010;
  color: rgba(255, 255, 255, 0.9);

  .backtest-sidebar,
  .backtest-main,
  .current-card,
  .config-card,
  .asset-row,
  .result-split-panel {
    background: #171717;
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: none;
  }

  .selected-asset,
  .param-panel,
  .code-param-card,
  .strategy-param-dock,
  .strict-inline,
  .backtest-overview-head,
  .backtest-quality-strip,
  .zero-trade-warning,
  .professional-audit,
  .audit-summary-card,
  .eq-section--hero,
  .replay-section,
  .trades-section--workbench,
  .metric-card,
    .ide-tune-dimensions {
    background: #1d1d1d;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .workbench-panel-header {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--primary-color, #1890ff) 16%, transparent) 0%,
      color-mix(in srgb, var(--primary-color, #1890ff) 5%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--primary-color, #1890ff) 24%, transparent);
  }

  .workbench-panel-title,
  .backtest-overview-title,
  .professional-audit__head strong,
  .audit-summary-card__head,
  .audit-summary-card__value,
  .eq-title,
  .trades-title,
  .metric-value,
  .ide-tune-dim-label,
    .ide-tune-dimensions-summary {
    color: rgba(255, 255, 255, 0.92);
  }

  .metric-card,
  .backtest-overview-head,
  .eq-section--hero,
  .replay-section,
  .trades-section--workbench {
    background: linear-gradient(180deg, #202020 0%, #1a1a1a 100%);
  }

  .equity-chart--large,
  .replay-chart {
    background: #141414;
  }

  .ide-tune-pill,
  .backtest-quality-chip {
    color: rgba(255, 255, 255, 0.72);
    background: #202020;
    border-color: rgba(255, 255, 255, 0.12);
  }

  .ide-tune-pill.active {
    color: #fff;
    background: var(--primary-color, #1890ff);
    border-color: var(--primary-color, #1890ff);
  }

  .asset-row.active,
  .strict-inline.active {
    background: color-mix(in srgb, var(--primary-color, #1890ff) 12%, transparent);
    border-color: color-mix(in srgb, var(--primary-color, #1890ff) 45%, transparent);
  }

  .side-config {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .backtest-sidebar--portfolio .sidebar-head {
    border-bottom-color: rgba(255, 255, 255, 0.09);
  }

  .backtest-sidebar--portfolio .side-config,
  .backtest-sidebar--portfolio .side-config--strategy {
    border-color: rgba(255, 255, 255, 0.09);
    background: #1b1b1b;
  }

  .backtest-sidebar--portfolio .portfolio-config__switch,
  .backtest-sidebar--portfolio .advanced-toggle {
    color: rgba(255, 255, 255, 0.68);
    border-color: rgba(255, 255, 255, 0.1);
    background: #202020;
  }

  .backtest-sidebar--portfolio .portfolio-config > .side-param-hint {
    color: rgba(255, 255, 255, 0.58);
    border-color: color-mix(in srgb, var(--primary-color, #52c41a) 22%, transparent);
    background: color-mix(in srgb, var(--primary-color, #52c41a) 8%, #1b1b1b);
  }

  .sidebar-runbar {
    border-color: rgba(255, 255, 255, 0.1);
    background: linear-gradient(180deg, rgba(23, 23, 23, 0.92), #171717 32%);
  }

  .asset-row small,
  .side-config label,
  .side-param-hint,
  .param-panel label,
  .code-param-item label,
  .selected-asset__main p,
  .selected-asset__meta,
  .strict-inline span,
  .code-param-head span,
  .workbench-panel-meta,
  .professional-audit__head span,
  .audit-summary-card__desc,
  .audit-summary-card__row,
  .metric-label,
  .metric-hint,
  .ide-tune-dim-values,
  .tune-best-card span {
    color: rgba(255, 255, 255, 0.58);
  }

  .ide-tune-live-hint {
    color: var(--primary-color-hover, var(--primary-color, #1890ff));
    background: color-mix(in srgb, var(--primary-color, #1890ff) 12%, transparent);
  }

  .zero-trade-warning {
    color: #ffd666;
    background: rgba(250, 173, 20, 0.1);
    border-color: rgba(250, 173, 20, 0.28);
  }

  .ide-tune-dim-row {
    border-color: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.68);
  }

  .tune-best-card {
    background: color-mix(in srgb, var(--primary-color, #1890ff) 12%, transparent);
    border-color: color-mix(in srgb, var(--primary-color, #1890ff) 32%, transparent);
  }

  .audit-summary-card__row strong {
    color: rgba(255, 255, 255, 0.9);
  }

  .data-range-notice {
    background: rgba(250, 173, 20, 0.1);
    border-color: rgba(250, 173, 20, 0.28);
  }

  .data-range-notice ::v-deep .ant-alert-message {
    color: #ffd666;
  }

  .data-range-notice ::v-deep .ant-alert-description {
    color: #b8c0cc;
  }

  .audit-summary-card__row--ok strong {
    color: #52c41a;
  }

  .audit-summary-card__row--warn strong {
    color: #ffd666;
  }

  .audit-summary-card__row--bad strong {
    color: #ff7875;
  }

  .audit-summary-card__head em {
    color: rgba(255, 255, 255, 0.68);
    background: rgba(255, 255, 255, 0.08);
  }

  .audit-summary-card__rows {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .side-config--code-params {
    background: linear-gradient(180deg, color-mix(in srgb, var(--primary-color, #1890ff) 10%, transparent), transparent);
  }

  ::v-deep .trades-table .ant-table,
  ::v-deep .trades-table .ant-table-placeholder {
    border-color: #2a2d31 !important;
  }

  .side-param-hint--warn {
    color: #ffd666;
  }

  .asset-row__type {
    color: var(--primary-color-hover, var(--primary-color, #1890ff));
    background: color-mix(in srgb, var(--primary-color, #1890ff) 14%, transparent);
  }

  ::v-deep .ant-input,
  ::v-deep .ant-input-number,
  ::v-deep .ant-input-number-input,
  ::v-deep .ant-select-selection {
    color: rgba(255, 255, 255, 0.84);
    background: #222;
    border-color: rgba(255, 255, 255, 0.12);
  }

  ::v-deep .ant-input::placeholder {
    color: rgba(255, 255, 255, 0.34);
  }

  ::v-deep .ant-select-arrow,
  ::v-deep .ant-input-search-icon,
  ::v-deep .ant-calendar-picker-icon,
  ::v-deep .ant-input-number-handler-wrap {
    color: rgba(255, 255, 255, 0.45);
    background: transparent;
  }

  ::v-deep .ant-radio-button-wrapper {
    color: rgba(255, 255, 255, 0.72);
    background: #171717;
    border-color: rgba(255, 255, 255, 0.14);
  }

  ::v-deep .ant-radio-button-wrapper-checked {
    color: #fff;
    background: var(--primary-color, #1890ff);
    border-color: var(--primary-color, #1890ff);
    box-shadow: none;
  }

  ::v-deep .ant-btn:not(.ant-btn-primary) {
    color: rgba(255, 255, 255, 0.76);
    background: #202020;
    border-color: rgba(255, 255, 255, 0.12);
  }

  ::v-deep .ant-empty-description {
    color: rgba(255, 255, 255, 0.52);
  }
}

.theme-dark {
  .section-title { color: rgba(255, 255, 255, .9); }
  .timeframe-summary,
  .metric-card,
  .metrics-grid--workbench,
  .backtest-overview-head,
  .diagnostic-detail,
  .secondary-metrics { background: #1d1d1d; border-color: rgba(255, 255, 255, .1); }
  .timeframe-summary strong,
  .diagnostic-detail__row strong,
  .secondary-metrics strong { color: rgba(255, 255, 255, .9); }
  .advanced-toggle,
  .result-view-tabs { border-color: rgba(255, 255, 255, .1); color: rgba(255, 255, 255, .6); }
  .metric-card,
  .secondary-metrics > div { border-color: rgba(255, 255, 255, .08); }
  .result-view-tabs button { color: rgba(255, 255, 255, .6); }
  .result-view-tabs button.active { color: var(--primary-color, #52c41a) !important; }
  .result-view-tabs button.active .anticon { color: inherit !important; }
  .diagnostic-detail__row { border-color: rgba(255, 255, 255, .08); color: rgba(255, 255, 255, .62); }
}

@media (max-width: 1200px) {
  .metrics-grid--workbench { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .metric-card { border-bottom: 1px solid #e9ecf0; }
  .equity-chart--large { height: 310px; }
}

.add-symbol-results {
  max-height: 260px;
  overflow-y: auto;
}

.add-symbol-row {
  cursor: pointer;
  border-radius: 6px;
  padding: 10px 12px !important;
}

.add-symbol-row > div {
  min-width: 0;
}

.add-symbol-row strong,
.add-symbol-row span {
  display: block;
}

.add-symbol-row span {
  margin-top: 2px;
  color: #64748b;
  font-size: 12px;
}

.add-symbol-row.active {
  background: color-mix(in srgb, var(--primary-color, #1890ff) 12%, transparent);
}

.add-symbol-empty {
  padding: 16px 0;
  color: #64748b;
  text-align: center;
}

@media (max-width: 1280px) {
  .code-param-grid {
    grid-template-columns: repeat(2, minmax(160px, 1fr));
  }

  .unified-result-panel--with-tuner {
    grid-template-columns: 1fr;
  }

  .unified-result-panel--with-tuner ::v-deep .bt-tuner-card,
  .unified-result-panel--with-tuner ::v-deep .bt-running-banner,
  .unified-result-panel--with-tuner ::v-deep .bt-result-card,
  .unified-result-panel--with-tuner ::v-deep .bt-empty-result,
  .unified-result-panel--with-tuner ::v-deep .bt-history-section {
    grid-column: 1;
    grid-row: auto;
  }
}

@media (max-width: 1100px) {
  .backtest-center-page {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .backtest-center-page.portfolio-mode {
    grid-template-columns: 320px minmax(0, 1fr);
  }

  .backtest-sidebar,
  .backtest-main {
    max-height: calc(100vh - 104px);
  }

  .asset-list {
    max-height: 240px;
  }

  .selected-asset {
    grid-template-columns: 1fr;
  }

  .selected-asset--compact {
    align-items: flex-start;
    flex-direction: column;
  }
}

.add-symbol-source-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

@media (max-width: 760px) {
  .backtest-center-page {
    height: auto;
    min-height: calc(100vh - 72px);
    grid-template-columns: 1fr;
    overflow: visible;
  }
  .backtest-center-page.portfolio-mode {
    grid-template-columns: 1fr;
  }

  .backtest-sidebar,
  .backtest-main {
    max-height: none;
  }

  .metrics-grid--workbench { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .metric-value { font-size: 19px; }
  .result-view-tabs { overflow-x: auto; }
  .result-view-tabs button { flex: 0 0 auto; }
  .result-view-tabs button:last-child { margin-left: 0; }
  .equity-chart--large { height: 250px; }
}
</style>

<style lang="less">
.backtest-strategy-dropdown,
.ide-watchlist-dropdown {
  .ant-select-dropdown-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 7px 12px;
  }

  .asset-opt-tag,
  .wl-opt-tag {
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 6px;
    border-radius: 3px;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 18px;
    white-space: nowrap;
    background: var(--primary-color, #1890ff);
  }

  .asset-opt-name,
  .wl-opt-symbol {
    color: #262626;
    font-size: 13px;
    font-weight: 700;
  }

  .wl-opt-name {
    min-width: 0;
    color: #8c8c8c;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wl-mkt-crypto { background: #fa8c16; }
  .wl-mkt-usstock { background: var(--primary-color, #1890ff); }
  .wl-mkt-cnstock { background: #eb2f96; }
  .wl-mkt-hkstock { background: #f5222d; }
  .wl-mkt-forex { background: #52c41a; }
  .wl-mkt-futures { background: #722ed1; }

  .ide-watchlist-add-row {
    width: 100%;
    color: var(--primary-color, #1890ff);
    font-weight: 700;
  }

  .ant-select-dropdown-menu-item-selected {
    background: color-mix(in srgb, var(--primary-color, #1890ff) 10%, #fff);
  }
}

.backtest-strategy-dropdown--dark,
.ide-watchlist-dropdown--dark {
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.08);

  .ant-select-dropdown-menu-item {
    color: rgba(255, 255, 255, 0.85);
  }

  .asset-opt-name,
  .wl-opt-symbol {
    color: rgba(255, 255, 255, 0.9);
  }

  .wl-opt-name {
    color: rgba(255, 255, 255, 0.48);
  }

  .ant-select-dropdown-menu-item-active:not(.ant-select-dropdown-menu-item-selected) {
    background: rgba(255, 255, 255, 0.06);
  }

  .ant-select-dropdown-menu-item-selected {
    background: color-mix(in srgb, var(--primary-color, #1890ff) 16%, transparent);
  }
}

.ide-modal-wrap--dark {
  .ant-modal-content,
  .ant-modal-header,
  .ant-modal-footer,
  .ant-modal-body {
    background: #1f1f1f;
    color: rgba(255, 255, 255, 0.86);
  }

  .ant-modal-header,
  .ant-modal-footer {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .ant-modal-title,
  .ant-modal-close {
    color: rgba(255, 255, 255, 0.86);
  }

  .ant-tabs-bar,
  .ant-list-item {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .ant-tabs-tab,
  .ant-list-item {
    color: rgba(255, 255, 255, 0.75);
  }

  .ant-tabs-tab-active {
    color: var(--primary-color, #1890ff) !important;
  }

  .ant-input {
    color: rgba(255, 255, 255, 0.86);
    background: #171717;
    border-color: rgba(255, 255, 255, 0.12);
  }

  .add-symbol-row span,
  .add-symbol-empty {
    color: rgba(255, 255, 255, 0.52);
  }
}

.backtest-history-drawer--dark {
  &.ant-drawer,
  .ant-drawer {
    color: rgba(255, 255, 255, 0.86);
  }

  .ant-drawer-content-wrapper {
    background: #111;
  }

  .ant-drawer-content,
  .ant-drawer-wrapper-body,
  .ant-drawer-body {
    background: #111;
    color: rgba(255, 255, 255, 0.86);
  }

  .ant-drawer-header {
    background: #141414;
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  .ant-drawer-title,
  .ant-drawer-close {
    color: rgba(255, 255, 255, 0.86);
  }

  .history-table,
  .ant-table-wrapper,
  .ant-table,
  .ant-table-content,
  .ant-table-scroll,
  .ant-table-body,
  .ant-table-fixed,
  .ant-table-fixed-left,
  .ant-table-fixed-right,
  .ant-table-placeholder {
    background: #161616;
    color: rgba(255, 255, 255, 0.78);
  }

  .ant-table {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  .ant-table-body::-webkit-scrollbar,
  .ant-drawer-body::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .ant-table-body::-webkit-scrollbar-thumb,
  .ant-drawer-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.22);
    border-radius: 999px;
  }

  .ant-table-body::-webkit-scrollbar-track,
  .ant-drawer-body::-webkit-scrollbar-track {
    background: #111;
  }

  .ant-table-thead > tr > th {
    background: #101010;
    color: rgba(255, 255, 255, 0.78);
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  .ant-table-tbody > tr > td {
    background: #161616;
    color: rgba(255, 255, 255, 0.76);
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .ant-table-bordered,
  .ant-table-bordered .ant-table-content,
  .ant-table-bordered .ant-table-header > table,
  .ant-table-bordered .ant-table-body > table,
  .ant-table-bordered .ant-table-thead > tr > th,
  .ant-table-bordered .ant-table-tbody > tr > td {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  .ant-table-tbody > tr:hover > td {
    background: #1e2a17;
  }

  .ant-empty-description {
    color: rgba(255, 255, 255, 0.52);
  }

  .ant-pagination-item,
  .ant-pagination-prev .ant-pagination-item-link,
  .ant-pagination-next .ant-pagination-item-link {
    background: #171717;
    border-color: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.75);
  }

  .ant-pagination-item a {
    color: rgba(255, 255, 255, 0.75);
  }

  .ant-pagination-item-active {
    background: color-mix(in srgb, var(--primary-color, #1890ff) 14%, transparent);
    border-color: var(--primary-color, #1890ff);
  }

  .ant-pagination-item-active a {
    color: var(--primary-color, #1890ff);
  }
}

.backtest-history-drawer {
  .history-table {
    width: 100%;
    max-width: 100%;
    overflow: auto;
  }

  .history-table .ant-table {
    width: 100%;
    min-width: 900px;
    table-layout: auto;
  }

  .history-table .ant-table-content,
  .history-table .ant-table-body {
    overflow-x: auto !important;
    overscroll-behavior-x: contain;
  }

  .history-table .ant-table-thead > tr > th,
  .history-table .ant-table-tbody > tr > td {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .history-table .ant-table-tbody > tr > td:last-child,
  .history-table .ant-table-thead > tr > th:last-child {
    text-align: right;
  }

  .history-table .ant-btn-link {
    max-width: 72px;
    padding: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.ant-drawer.backtest-history-drawer--dark,
.backtest-history-drawer--dark.ant-drawer {
  .ant-drawer-content,
  .ant-drawer-wrapper-body,
  .ant-drawer-body {
    background: #111 !important;
    color: rgba(255, 255, 255, 0.86);
  }

  .ant-drawer-header {
    background: #141414 !important;
    border-bottom-color: rgba(255, 255, 255, 0.1) !important;
  }

  .ant-drawer-title,
  .ant-drawer-close {
    color: rgba(255, 255, 255, 0.86) !important;
  }
}

.experiment-results {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 12px;
}

.experiment-best-card,
.experiment-selected-detail,
.experiment-analytics-card {
  border: 1px solid rgba(82, 196, 26, 0.24);
  background: linear-gradient(180deg, rgba(82, 196, 26, 0.08), rgba(255, 255, 255, 0.02));
  border-radius: 8px;
  padding: 14px;
}

.experiment-best-card {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
}

.experiment-best-score strong {
  display: block;
  color: var(--primary-color, #52c41a);
  font-size: 34px;
  line-height: 1;
}

.experiment-best-score span,
.experiment-best-copy p,
.experiment-change-before,
.experiment-score-item span,
.experiment-analytics-card small {
  color: rgba(255, 255, 255, 0.52);
}

.experiment-best-score em {
  display: inline-flex;
  margin-top: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(82, 196, 26, 0.16);
  color: var(--primary-color, #52c41a);
  font-style: normal;
  font-weight: 700;
}

.experiment-best-copy h4 {
  margin: 0 0 6px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 18px;
}

.experiment-best-copy p {
  margin: 2px 0;
}

.experiment-best-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.experiment-split-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.experiment-split-card {
  border: 1px solid rgba(82, 196, 26, 0.18);
  background: rgba(255, 255, 255, 0.035);
  border-radius: 8px;
  padding: 12px;
}

.experiment-split-card__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
  color: rgba(255, 255, 255, 0.88);
  font-weight: 800;
}

.experiment-split-card__head span {
  color: rgba(255, 255, 255, 0.48);
  font-size: 12px;
  font-weight: 600;
}

.experiment-split-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.experiment-split-metrics div {
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.18);
  padding: 8px;
}

.experiment-split-metrics small {
  display: block;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.46);
}

.experiment-split-metrics strong {
  color: rgba(255, 255, 255, 0.9);
}

.experiment-candidate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.experiment-candidate-card {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 12px;
  color: rgba(255, 255, 255, 0.75);
  text-align: left;
  cursor: pointer;
}

.experiment-candidate-card.active {
  border-color: var(--primary-color, #52c41a);
  background: rgba(82, 196, 26, 0.14);
}

.experiment-candidate-card strong {
  display: block;
  color: rgba(255, 255, 255, 0.92);
}

.experiment-candidate-card em {
  color: var(--primary-color, #52c41a);
  font-style: normal;
  font-size: 22px;
  font-weight: 800;
}

.experiment-candidate-card span {
  float: right;
  border-radius: 4px;
  padding: 1px 6px;
  background: rgba(82, 196, 26, 0.15);
  color: var(--primary-color, #52c41a);
}

.experiment-detail-head,
.experiment-selected-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.experiment-detail-head h4,
.experiment-selected-head strong {
  display: block;
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 15px;
}

.experiment-selected-head span {
  display: block;
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.52);
  font-size: 12px;
}

.experiment-selected-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.experiment-change-list,
.experiment-score-grid {
  display: grid;
  gap: 8px;
}

.experiment-change-row,
.experiment-score-item {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) auto auto auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
}

.experiment-change-row strong,
.experiment-change-after,
.experiment-score-item strong {
  color: rgba(255, 255, 255, 0.88);
}

.experiment-change-arrow {
  color: var(--primary-color, #52c41a);
}

.experiment-ranking-section {
  border: 1px solid rgba(82, 196, 26, 0.18);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.025);
}

.experiment-ranking-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.88);
  font-weight: 800;
}

.experiment-ranking-head span {
  color: rgba(255, 255, 255, 0.48);
  font-size: 12px;
  font-weight: 600;
}

.experiment-ranking-table {
  display: flex;
  flex-direction: column;
  max-height: 460px;
  overflow: auto;
  padding-bottom: 6px;
  scrollbar-width: thin;
}

.experiment-ranking-row {
  display: grid;
  grid-template-columns: 44px minmax(120px, 1fr) 80px 70px 90px 90px 70px;
  gap: 10px;
  align-items: center;
  min-height: 44px;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  text-align: left;
  cursor: pointer;
}

.experiment-ranking-row:hover,
.experiment-ranking-row.active {
  background: rgba(82, 196, 26, 0.12);
}

.experiment-ranking-row strong {
  color: rgba(255, 255, 255, 0.92);
}

.experiment-analytics-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  align-items: stretch;
}

.experiment-analytics-card {
  min-width: 0;
  min-height: 150px;
}

.experiment-analytics-card strong {
  display: block;
  margin-bottom: 12px;
}

.mini-bars {
  height: 96px;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  padding-top: 16px;
}

.mini-bar {
  flex: 1;
  min-width: 3px;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, var(--primary-color, #52c41a), rgba(82, 196, 26, 0.18));
}

.mini-bars i {
  flex: 1;
  min-width: 3px;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, var(--primary-color, #52c41a), rgba(82, 196, 26, 0.18));
}

.oos-matrix {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 6px;
  max-height: 106px;
  overflow: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.oos-cell {
  height: 24px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
}

.oos-cell.good { background: rgba(82, 196, 26, 0.65); }
.oos-cell.warn { background: rgba(250, 173, 20, 0.72); }
.oos-cell.bad { background: rgba(255, 77, 79, 0.72); }

.oos-matrix .tone-good,
.oos-matrix .tone-warn,
.oos-matrix .tone-bad {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  max-width: 92px;
  min-height: 24px;
  padding: 3px 7px;
  border-radius: 5px;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oos-matrix .tone-good { background: rgba(82, 196, 26, 0.72); }
.oos-matrix .tone-warn { background: rgba(250, 173, 20, 0.78); }
.oos-matrix .tone-bad { background: rgba(255, 77, 79, 0.78); }

.sensitivity-row {
  display: grid;
  grid-template-columns: minmax(74px, 0.8fr) minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  margin: 9px 0;
  min-width: 0;
}

.sensitivity-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sensitivity-bar {
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, #15c8c8, var(--primary-color, #52c41a));
}

.sensitivity-row em {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.sensitivity-row em i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #15c8c8, var(--primary-color, #52c41a));
}

.theme-dark .experiment-results {
  color: rgba(255, 255, 255, 0.82);
}

.backtest-center-page:not(.theme-dark) {
  .experiment-best-card,
  .experiment-selected-detail,
  .experiment-analytics-card,
  .experiment-split-card,
  .experiment-ranking-section {
    background: #fff;
    border-color: #e5e7eb;
  }

  .experiment-best-copy h4,
  .experiment-candidate-card strong,
  .experiment-detail-head h4,
  .experiment-selected-head strong,
  .experiment-change-row strong,
  .experiment-change-after,
  .experiment-score-item strong,
  .experiment-split-card__head,
  .experiment-split-metrics strong,
  .experiment-ranking-head,
  .experiment-ranking-row strong {
    color: #111827;
  }

  .experiment-best-score span,
  .experiment-best-copy p,
  .experiment-change-before,
  .experiment-score-item span,
  .experiment-selected-head span,
  .experiment-analytics-card small,
  .experiment-split-card__head span,
  .experiment-split-metrics small,
  .experiment-ranking-head span {
    color: #6b7280;
  }

  .experiment-candidate-card {
    background: #f9fafb;
    border-color: #e5e7eb;
    color: #374151;
  }

  .experiment-change-row,
  .experiment-score-item,
  .experiment-split-metrics div {
    background: #f3f4f6;
  }

  .experiment-ranking-row {
    color: #374151;
    border-bottom-color: #e5e7eb;
  }

  .experiment-ranking-row:hover,
  .experiment-ranking-row.active {
    background: rgba(82, 196, 26, 0.1);
  }
}

.replay-echart-tooltip__time {
  margin-bottom: 8px;
  color: inherit;
  font-size: 11px;
  font-weight: 900;
}

.replay-echart-tooltip__grid {
  display: grid;
  grid-template-columns: repeat(4, auto minmax(0, 1fr));
  gap: 4px 7px;
  align-items: center;
  font-size: 10px;
}

.replay-echart-tooltip__grid strong {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.replay-echart-tooltip__actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid currentColor;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.7;
}
</style>
