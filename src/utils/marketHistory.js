function camelKey (key) {
  return String(key).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

export function camelizeMarketHistory (value) {
  if (Array.isArray(value)) return value.map(camelizeMarketHistory)
  if (!value || typeof value !== 'object' || value instanceof Date) return value
  return Object.keys(value).reduce((result, key) => {
    result[camelKey(key)] = camelizeMarketHistory(value[key])
    return result
  }, {})
}

export function adaptMarketHistoryResponse (response) {
  if (!response || response.code !== 1) {
    const error = new Error((response && response.msg) || 'cn_history.invalid_response')
    error.code = response && response.msg
    error.details = response && response.data
    throw error
  }
  return camelizeMarketHistory(response.data)
}

export function marketHistoryUnavailableReason (error) {
  const status = error && error.response && error.response.status
  const envelope = error && error.response && error.response.data
  if (status === 404) return 'unsupported'
  if (status === 503 || (envelope && envelope.msg === 'cn_history.sync_disabled')) return 'disabled'
  if (status === 403) return 'forbidden'
  return ''
}

export function extractCoverageFailure (error) {
  const response = error && error.response
  const envelope = response && response.data
  const details = envelope && envelope.data
  if (response && response.status === 409 && details && details.code === 'strategyV2.cnHistoryCoverageIncomplete') {
    return camelizeMarketHistory(details)
  }
  return null
}
