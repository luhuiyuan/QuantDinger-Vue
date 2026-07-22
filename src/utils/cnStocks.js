export const CN_STOCK_REFRESH_INTERVAL = 30000

export function cnChangeTone (value) {
  const number = Number(value)
  if (!Number.isFinite(number) || Math.abs(number) < 0.000001) return 'flat'
  return number > 0 ? 'rise' : 'fall'
}

export function formatCNSigned (value, digits = 2, suffix = '') {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const sign = number > 0 ? '+' : ''
  return `${sign}${number.toFixed(digits)}${suffix}`
}

export function normalizeCNStockQuery (query = {}) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const exchange = ['SH', 'SZ'].includes(query.exchange) ? query.exchange : ''
  const changeState = ['up', 'down', 'flat'].includes(query.changeState) ? query.changeState : ''
  return {
    keyword: String(query.keyword || '').trim(),
    exchange,
    changeState,
    page,
    pageSize
  }
}

export function cnStockBacktestLocation (stock) {
  return {
    path: '/backtest-center',
    query: {
      market: 'CNStock',
      symbol: stock.symbol,
      instrument: stock.instrument
    }
  }
}

export function freshnessKey (freshness) {
  if (freshness === 'fresh') return 'cnStocks.freshness.fresh'
  if (freshness === 'stale') return 'cnStocks.freshness.stale'
  if (freshness === 'closed_daily') return 'cnStocks.freshness.closedDaily'
  if (freshness === 'partial') return 'cnStocks.freshness.partial'
  return 'cnStocks.freshness.unavailable'
}
