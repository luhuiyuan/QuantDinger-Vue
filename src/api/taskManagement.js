import request from '@/utils/request'

export function getTaskOverview () {
  return request({ url: '/api/task-management/overview', method: 'get' })
}

export function listTaskDefinitions () {
  return request({ url: '/api/task-management/definitions', method: 'get' })
}

export function listTaskSchedules (params = {}) {
  return request({ url: '/api/task-management/schedules', method: 'get', params })
}

export function createTaskSchedule (data) {
  return request({ url: '/api/task-management/schedules', method: 'post', data })
}

export function updateTaskSchedule (scheduleId, data) {
  return request({ url: `/api/task-management/schedules/${scheduleId}`, method: 'put', data })
}

export function listTaskRuns (params = {}) {
  return request({ url: '/api/task-management/runs', method: 'get', params })
}

export function startTaskRun (data) {
  return request({ url: '/api/task-management/runs', method: 'post', data })
}

export function getTaskRun (runId) {
  return request({ url: `/api/task-management/runs/${runId}`, method: 'get' })
}

export function cancelTaskRun (runId, data = {}) {
  return request({ url: `/api/task-management/runs/${runId}/cancel`, method: 'post', data })
}

export function retryTaskRun (runId, data = {}) {
  return request({ url: `/api/task-management/runs/${runId}/retry`, method: 'post', data })
}

export function listTaskLogs (params = {}) {
  return request({ url: '/api/task-management/logs', method: 'get', params })
}
