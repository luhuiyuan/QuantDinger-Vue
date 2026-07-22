import request from '@/utils/request'

export function getCNMarketOverview () {
  return request({ url: '/api/market/cn/overview', method: 'get' })
}

export function getCNStocks (params) {
  return request({ url: '/api/market/cn/stocks', method: 'get', params })
}

export function getCNStock (symbol) {
  return request({ url: `/api/market/cn/stocks/${encodeURIComponent(symbol)}`, method: 'get' })
}

export function getCNStockHistory (symbol, params) {
  return request({ url: `/api/market/cn/stocks/${encodeURIComponent(symbol)}/history`, method: 'get', params })
}
