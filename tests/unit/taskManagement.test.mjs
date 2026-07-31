import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const component = fs.readFileSync(path.join(root, 'src/views/task-management/index.vue'), 'utf8')
const api = fs.readFileSync(path.join(root, 'src/api/taskManagement.js'), 'utf8')
const router = fs.readFileSync(path.join(root, 'src/config/router.config.js'), 'utf8')

test('Task Management exposes one four-tab page to authenticated users', () => {
  assert.match(router, /path: '\/task-management'/)
  assert.match(router, /permission: \['dashboard'\]/)
  for (const tab of ['overview', 'schedules', 'runs', 'logs']) {
    assert.match(component, new RegExp(`key="${tab}"`))
  }
  assert.match(component, /isAdmin/)
  assert.match(component, /taskManagement\.adminOnly/)
})

test('Task Management API covers schedules, runs, cancellation, retry and cursor logs', () => {
  assert.match(api, /createTaskSchedule/)
  assert.match(api, /updateTaskSchedule/)
  assert.match(api, /startTaskRun/)
  assert.match(api, /cancelTaskRun/)
  assert.match(api, /retryTaskRun/)
  assert.match(api, /listTaskLogs/)
  assert.match(component, /nextCursor/)
  assert.match(component, /checkpointRef/)
})

test('Task Management polling is bounded and stops with the page lifecycle', () => {
  assert.match(component, /setInterval\(\(\) => this\.refreshActive\(true\), 5000\)/)
  assert.match(component, /beforeDestroy \(\) \{ this\.stopPolling\(\) \}/)
  assert.match(component, /deactivated \(\) \{ this\.stopPolling\(\) \}/)
  assert.match(component, /clearInterval/)
})

test('Task Management polling is single-flight and stale responses cannot replace current filters', () => {
  assert.match(component, /if \(this\.refreshInFlight\) return/)
  assert.match(component, /this\.refreshInFlight = true/)
  assert.match(component, /this\.refreshInFlight = false/)
  for (const sequence of ['overviewRequestSeq', 'definitionRequestSeq', 'scheduleRequestSeq', 'runRequestSeq', 'logRequestSeq', 'runDetailRequestSeq']) {
    assert.match(component, new RegExp(`\\+\\+this\\.${sequence}`))
    assert.match(component, new RegExp(`requestSeq (?:!==|===) this\\.${sequence}`))
  }
  assert.match(component, /if \(requestSeq !== this\.runRequestSeq\) return/)
  assert.match(component, /if \(requestSeq !== this\.logRequestSeq\) return/)
})

test('Task Management invalidates in-flight responses when polling stops', () => {
  const stopPolling = component.match(/stopPolling \(\) \{([\s\S]*?)\n    \},\n    async refreshActive/)
  assert.ok(stopPolling)
  assert.match(stopPolling[1], /this\.refreshInFlight = false/)
  assert.match(stopPolling[1], /this\.refreshGeneration \+= 1/)
  for (const sequence of ['overviewRequestSeq', 'definitionRequestSeq', 'scheduleRequestSeq', 'runRequestSeq', 'logRequestSeq', 'runDetailRequestSeq']) {
    assert.match(stopPolling[1], new RegExp(`this\\.${sequence} \\+= 1`))
  }
})

test('Task Management uses authoritative pagination and protects admin-only links', () => {
  assert.match(component, /this\.runPagination\.total = Number\(data\.total \|\| 0\)/)
  assert.doesNotMatch(component, /this\.runs\.length === this\.runPagination\.pageSize/)
  assert.match(component, /v-if="isAdmin && value" @click="openExternalRequest/)
})

test('Polling generations prevent an older refresh from clearing a newer guard', () => {
  assert.match(component, /const generation = this\.refreshGeneration/)
  assert.match(component, /if \(generation === this\.refreshGeneration\)/)
})

test('Task forms validate JSON and duplicate starts reuse the existing Run', () => {
  assert.match(component, /JSON\.parse/)
  assert.match(component, /taskManagement\.invalidJson/)
  assert.match(component, /data\.created === false/)
  assert.match(component, /taskManagement\.duplicate/)
})
