import request from '@/utils/request'

export function getExternalDataRequestOverview (params = {}) {
  return request({ url: '/api/external-data-request-logs/overview', method: 'get', params })
}

export function listExternalDataRequestLogs (params = {}) {
  return request({ url: '/api/external-data-request-logs/logs', method: 'get', params })
}

export function getExternalDataRequestLog (id) {
  return request({ url: `/api/external-data-request-logs/logs/${id}`, method: 'get' })
}

export function getExternalDataRequestLogSettings () {
  return request({ url: '/api/external-data-request-logs/settings', method: 'get' })
}
