import request from '@/utils/request'
import { adaptMarketHistoryResponse } from '@/utils/marketHistory'

function call (config) {
  return request(config).then(adaptMarketHistoryResponse)
}

export function getMarketHistoryCapabilities () {
  return call({ url: '/api/market-history/capabilities', method: 'get' })
}

export function getMarketHistoryProviderHealth () {
  return call({ url: '/api/market-history/provider-health', method: 'get' })
}

export function getMarketHistoryDiskStatus () {
  return call({ url: '/api/market-history/disk-status', method: 'get' })
}

export function listMarketHistorySyncRuns (limit = 30) {
  return call({ url: '/api/market-history/sync-runs', method: 'get', params: { limit } })
}

export function createMarketHistorySyncRun (data) {
  return call({ url: '/api/market-history/sync-runs', method: 'post', data })
}

export function retryMarketHistorySyncRun (runId) {
  return call({ url: `/api/market-history/sync-runs/${encodeURIComponent(runId)}/retry`, method: 'post' })
}

export function cancelMarketHistorySyncRun (runId) {
  return call({ url: `/api/market-history/sync-runs/${encodeURIComponent(runId)}/cancel`, method: 'post' })
}

export function getMarketHistoryCoverage (instrument, params) {
  return call({
    url: `/api/market-history/instruments/${encodeURIComponent(instrument)}/coverage`,
    method: 'get',
    params
  })
}

export function getFundamentalCapabilities () { return call({ url: '/api/market-history/fundamentals/capabilities', method: 'get' }) }
export function listFundamentalSyncRuns (limit = 30) { return call({ url: '/api/market-history/fundamentals/sync-runs', method: 'get', params: { limit } }) }
export function createFundamentalSyncRun (instruments) { return call({ url: '/api/market-history/fundamentals/sync-runs', method: 'post', data: { instruments } }) }
export function pauseFundamentalSyncRun (runId) { return call({ url: `/api/market-history/fundamentals/sync-runs/${encodeURIComponent(runId)}/pause`, method: 'post' }) }
export function resumeFundamentalSyncRun (runId) { return call({ url: `/api/market-history/fundamentals/sync-runs/${encodeURIComponent(runId)}/resume`, method: 'post' }) }
export function cancelFundamentalSyncRun (runId) { return call({ url: `/api/market-history/fundamentals/sync-runs/${encodeURIComponent(runId)}/cancel`, method: 'post' }) }
export function retryFundamentalSyncRun (runId) { return call({ url: `/api/market-history/fundamentals/sync-runs/${encodeURIComponent(runId)}/retry`, method: 'post' }) }
export function listFundamentalCoverage (limit = 200) { return call({ url: '/api/market-history/fundamentals/coverage', method: 'get', params: { limit } }) }
export function listFundamentalQualityIssues (status = 'open') { return call({ url: '/api/market-history/fundamentals/quality-issues', method: 'get', params: { status } }) }
export function listFundamentalVerificationTargets (status = 'pending') { return call({ url: '/api/market-history/fundamentals/verification-targets', method: 'get', params: { status } }) }
