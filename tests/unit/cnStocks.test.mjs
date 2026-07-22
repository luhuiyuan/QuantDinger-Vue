import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  cnChangeTone,
  cnStockBacktestLocation,
  formatCNSigned,
  freshnessKey,
  normalizeCNStockQuery
} from '../../src/utils/cnStocks.js'

const read = relativePath => fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

test('A-share formatting uses red-rise green-fall semantic classes and signed text', () => {
  assert.equal(cnChangeTone(1), 'rise')
  assert.equal(cnChangeTone(-1), 'fall')
  assert.equal(cnChangeTone(0), 'flat')
  assert.equal(formatCNSigned(1.234, 2, '%'), '+1.23%')
  assert.equal(formatCNSigned(-1.234, 2, '%'), '-1.23%')
})

test('catalog query is bounded and canonicalized', () => {
  assert.deepEqual(normalizeCNStockQuery({
    keyword: '  茅台 ', exchange: 'SH', changeState: 'up', page: -4, pageSize: 1000
  }), {
    keyword: '茅台', exchange: 'SH', changeState: 'up', page: 1, pageSize: 100,
    sortBy: 'symbol', sortOrder: 'asc'
  })
})

test('catalog sort query only accepts supported fields and directions', () => {
  assert.deepEqual(normalizeCNStockQuery({ sortBy: 'amount', sortOrder: 'desc' }), {
    keyword: '', exchange: '', changeState: '', page: 1, pageSize: 20,
    sortBy: 'amount', sortOrder: 'desc'
  })
  assert.equal(normalizeCNStockQuery({ sortBy: 'latest;DROP', sortOrder: 'sideways' }).sortBy, 'symbol')
})

test('detail navigation carries a context but never requests auto-run', () => {
  assert.deepEqual(cnStockBacktestLocation({
    symbol: '600519.SH', instrument: 'CNStock:600519.SH'
  }), {
    path: '/backtest-center',
    query: { market: 'CNStock', symbol: '600519.SH', instrument: 'CNStock:600519.SH' }
  })
})

test('freshness mapping stays explicit and market pages do not poll', () => {
  assert.equal(freshnessKey('stale'), 'cnStocks.freshness.stale')
  const list = read('../../src/views/cn-stocks/index.vue')
  const detail = read('../../src/views/cn-stocks/detail.vue')
  assert.doesNotMatch(list, /setInterval|visibilitychange/)
  assert.doesNotMatch(detail, /setInterval|refreshQuoteWhenVisible/)
  assert.match(detail, /backtestEligible/)
  assert.match(detail, /display_fallback|displayHistory/)
})

test('routes, API clients, locales and backtest handoff are wired', () => {
  const routes = read('../../src/config/router.config.js')
  const api = read('../../src/api/cnStocks.js')
  const backtest = read('../../src/views/backtest-center/index.vue')
  const zh = read('../../src/locales/lang/zh-CN.js')
  const en = read('../../src/locales/lang/en-US.js')
  assert.match(routes, /path: '\/cn-stocks'/)
  assert.match(routes, /path: '\/cn-stocks\/:symbol'/)
  assert.match(api, /\/api\/market\/cn\/overview/)
  assert.match(api, /\/history/)
  assert.match(backtest, /entryContext/)
  assert.match(zh, /"menu\.dashboard\.cnStocks": "A股行情"/)
  assert.match(en, /"menu\.dashboard\.cnStocks": "A-Share Market"/)
})
