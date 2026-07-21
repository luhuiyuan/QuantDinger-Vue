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
