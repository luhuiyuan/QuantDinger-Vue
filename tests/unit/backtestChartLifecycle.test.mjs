import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const componentPath = fileURLToPath(
  new URL('../../src/views/backtest-center/index.vue', import.meta.url)
)
const source = fs.readFileSync(componentPath, 'utf8')

test('a new backtest result disposes the previous equity chart instance', () => {
  const watcher = source.match(/result \(\) \{([\s\S]*?)\n    \},\n    'form\.marketType'/)

  assert.ok(watcher, 'result watcher must exist')
  assert.match(watcher[1], /this\.disposeEquityChart\(\)/)
  assert.ok(
    watcher[1].indexOf('this.disposeEquityChart()') < watcher[1].indexOf('this.queueRenderEquityChart()'),
    'the detached chart must be disposed before rendering the next result'
  )
})

test('equity rendering rejects an instance attached to a stale DOM node', () => {
  assert.match(
    source,
    /this\.equityChartInstance\.getDom\(\) !== el[\s\S]*?this\.equityChartInstance\.dispose\(\)[\s\S]*?this\.equityChartInstance = null/
  )
})
