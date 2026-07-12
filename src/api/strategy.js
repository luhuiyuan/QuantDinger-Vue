import request from '@/utils/request'

const api = {
  // Local Python backend
  strategies: '/api/strategies',
  strategyDetail: '/api/strategies/detail',
  createStrategy: '/api/strategies/create',
  batchCreateStrategies: '/api/strategies/batch-create',
  updateStrategy: '/api/strategies/update',
  stopStrategy: '/api/strategies/stop',
  startStrategy: '/api/strategies/start',
  deleteStrategy: '/api/strategies/delete',
  batchStartStrategies: '/api/strategies/batch-start',
  batchStopStrategies: '/api/strategies/batch-stop',
  batchDeleteStrategies: '/api/strategies/batch-delete',
  testConnection: '/api/strategies/test-connection',
  trades: '/api/strategies/trades',
  positions: '/api/strategies/positions',
  accountPositions: '/api/account/positions',
  accountSnapshot: '/api/account/snapshot',
  equityCurve: '/api/strategies/equityCurve',
  notifications: '/api/strategies/notifications',
  unreadNotificationCount: '/api/strategies/notifications/unread-count',
  verifyCode: '/api/strategies/verify-code',
  aiGenerate: '/api/strategies/ai-generate',
  scriptTemplates: '/api/strategies/script-templates',
  reviewReport: '/api/strategies/review-report',
  reviewReportHistory: '/api/strategies/review-report/history',
  logs: '/api/strategies/logs',
  gridRestingOrders: '/api/strategies/grid-resting-orders',
  executorTemplates: '/api/strategies/executors/templates',
  executorPreview: '/api/strategies/executors/preview',
  executorGenerate: '/api/strategies/executors/generate',
  executorCreate: '/api/strategies/executors/create',
  strategyAssets: '/api/strategy-assets',
  unifiedBacktestRun: '/api/backtest/run',
  unifiedBacktestTune: '/api/backtest/tune',
  unifiedBacktestHistory: '/api/backtest/history',
  unifiedBacktestGet: '/api/backtest/get',
  scriptSources: '/api/strategies/script-sources',
  scriptSourceDetail: '/api/strategies/script-sources/detail',
  createScriptSource: '/api/strategies/script-sources/create',
  updateScriptSource: '/api/strategies/script-sources/update',
  deleteScriptSource: '/api/strategies/script-sources/delete',
  publishScriptSource: '/api/strategies/script-sources/publish',
  scriptSourceVersions: '/api/strategies/script-sources/versions',
  restoreScriptSourceVersion: '/api/strategies/script-sources/versions/restore',
  publishTemplate: '/api/strategies/publish-template',
  indicators: '/api/indicator/getIndicators'
}

export function getStrategyList (params = {}) {
  return request({
    url: api.strategies,
    method: 'get',
    params
  })
}

export function getStrategyDetail (id) {
  return request({
    url: api.strategyDetail,
    method: 'get',
    params: { id }
  })
}

export function createStrategy (data) {
  return request({
    url: api.createStrategy,
    method: 'post',
    data
  })
}

export function batchCreateStrategies (data) {
  return request({
    url: api.batchCreateStrategies,
    method: 'post',
    data
  })
}

export function updateStrategy (id, data) {
  return request({
    url: api.updateStrategy,
    method: 'put',
    params: { id },
    data
  })
}

export function stopStrategy (id) {
  return request({
    url: api.stopStrategy,
    method: 'post',
    params: { id }
  })
}

export function startStrategy (id) {
  return request({
    url: api.startStrategy,
    method: 'post',
    params: { id }
  })
}

export function deleteStrategy (id) {
  return request({
    url: api.deleteStrategy,
    method: 'delete',
    params: { id }
  })
}

export function batchStartStrategies (data) {
  return request({
    url: api.batchStartStrategies,
    method: 'post',
    data
  })
}

export function batchStopStrategies (data) {
  return request({
    url: api.batchStopStrategies,
    method: 'post',
    data
  })
}

export function batchDeleteStrategies (data) {
  return request({
    url: api.batchDeleteStrategies,
    method: 'delete',
    data
  })
}

export function testExchangeConnection (exchangeConfig) {
  return request({
    url: api.testConnection,
    method: 'post',
    data: { exchange_config: exchangeConfig }
  })
}

export function getStrategyTrades (id, lang) {
  const params = { id }
  if (lang) params.lang = lang
  return request({
    url: api.trades,
    method: 'get',
    params
  })
}

export function getStrategyPositions (id) {
  return request({
    url: api.positions,
    method: 'get',
    params: { id }
  })
}

export function getAccountPositions (params = {}) {
  return request({
    url: api.accountPositions,
    method: 'get',
    params
  })
}

export function getAccountSnapshot (params = {}) {
  return request({
    url: api.accountSnapshot,
    method: 'get',
    params
  })
}

export function getGridRestingOrders (id, opts = {}) {
  const params = { id }
  if (opts.status) params.status = opts.status
  if (opts.limit) params.limit = opts.limit
  if (opts.sync) params.sync = '1'
  return request({
    url: api.gridRestingOrders,
    method: 'get',
    params
  })
}

export function getExecutorTemplates () {
  return request({
    url: api.executorTemplates,
    method: 'get'
  })
}

export function previewExecutorStrategy (data) {
  return request({
    url: api.executorPreview,
    method: 'post',
    data
  })
}

export function generateExecutorStrategy (data) {
  return request({
    url: api.executorGenerate,
    method: 'post',
    data
  })
}

export function createExecutorStrategy (data) {
  return request({
    url: api.executorCreate,
    method: 'post',
    data
  })
}

export function getStrategyEquityCurve (id) {
  return request({
    url: api.equityCurve,
    method: 'get',
    params: { id }
  })
}

export function getStrategyNotifications (params = {}) {
  return request({
    url: api.notifications,
    method: 'get',
    params
  })
}

export function getUnreadNotificationCount () {
  return request({
    url: api.unreadNotificationCount,
    method: 'get'
  })
}

export function verifyStrategyCode (data) {
  return request({
    url: api.verifyCode,
    method: 'post',
    data
  })
}

export function aiGenerateStrategy (data) {
  return request({
    url: api.aiGenerate,
    method: 'post',
    data
  })
}

export function getScriptTemplateList (params = {}) {
  return request({
    url: api.scriptTemplates,
    method: 'get',
    params
  })
}

export function getIndicatorListForStrategy (params = {}) {
  return request({
    url: api.indicators,
    method: 'get',
    params
  })
}

export function getStrategyReviewReport (id, data = {}) {
  return request({
    url: api.reviewReport,
    method: 'post',
    params: { id },
    data
  })
}

export function getStrategyReviewReportHistory (id, params = {}) {
  return request({
    url: api.reviewReportHistory,
    method: 'get',
    params: { id, ...params }
  })
}

export function getStrategyLogs (id, params = {}) {
  return request({
    url: api.logs,
    method: 'get',
    params: { id, ...params }
  })
}

export function getStrategyAssetList (params = {}) {
  return request({
    url: api.strategyAssets,
    method: 'get',
    params
  })
}

export function runUnifiedBacktest (data) {
  const payload = { ...(data || {}) }
  const timeout = payload.timeout
  delete payload.timeout
  return request({
    url: api.unifiedBacktestRun,
    method: 'post',
    data: payload,
    timeout
  })
}

export function tuneUnifiedBacktest (data) {
  const payload = { ...(data || {}) }
  const timeout = payload.timeout
  delete payload.timeout
  const config = {
    url: api.unifiedBacktestTune,
    method: 'post',
    data: payload,
    timeout
  }
  return request(config).catch(error => {
    if (error && error.response && error.response.status === 404) {
      return request({
        ...config,
        url: '/api/experiment/structured-tune'
      })
    }
    throw error
  })
}

export function getUnifiedBacktestHistory (params = {}) {
  return request({
    url: api.unifiedBacktestHistory,
    method: 'get',
    params
  })
}

export function getUnifiedBacktestRun (runId) {
  return request({
    url: api.unifiedBacktestGet,
    method: 'get',
    params: { runId }
  })
}

export function getScriptSourceList (params = {}) {
  return request({
    url: api.scriptSources,
    method: 'get',
    params
  })
}

export function getScriptSourceDetail (id) {
  return request({
    url: api.scriptSourceDetail,
    method: 'get',
    params: { id }
  })
}

export function createScriptSource (data) {
  return request({
    url: api.createScriptSource,
    method: 'post',
    data
  })
}

export function updateScriptSource (id, data) {
  return request({
    url: api.updateScriptSource,
    method: 'put',
    params: { id },
    data
  })
}

export function deleteScriptSource (id) {
  return request({
    url: api.deleteScriptSource,
    method: 'delete',
    params: { id }
  })
}

export function publishScriptSource (data) {
  return request({
    url: api.publishScriptSource,
    method: 'post',
    data
  })
}

export function getScriptSourceVersions (sourceId) {
  return request({
    url: api.scriptSourceVersions,
    method: 'get',
    params: { sourceId }
  })
}

export function getScriptSourceVersion (versionId) {
  return request({
    url: `${api.scriptSourceVersions}/${versionId}`,
    method: 'get'
  })
}

export function restoreScriptSourceVersion (versionId) {
  return request({
    url: api.restoreScriptSourceVersion,
    method: 'post',
    data: { versionId }
  })
}

export function publishStrategyTemplate (data) {
  return request({
    url: api.publishTemplate,
    method: 'post',
    data
  })
}
