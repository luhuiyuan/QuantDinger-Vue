import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  adaptMarketHistoryResponse,
  camelizeMarketHistory,
  extractCoverageFailure,
  marketHistoryUnavailableReason
} from '../../src/utils/marketHistory.js'

const read = relativePath => fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

test('market history responses adapt database snake_case without changing arrays', () => {
  assert.deepEqual(camelizeMarketHistory({ total_symbols: 2, nodes: [{ last_success_at: '2026-07-20' }] }), {
    totalSymbols: 2,
    nodes: [{ lastSuccessAt: '2026-07-20' }]
  })
  assert.deepEqual(adaptMarketHistoryResponse({ code: 1, data: { coverage_summary: { complete_raw: 3 } } }), {
    coverageSummary: { completeRaw: 3 }
  })
})

test('old, disabled, and forbidden backends produce explicit unavailable reasons', () => {
  assert.equal(marketHistoryUnavailableReason({ response: { status: 404 } }), 'unsupported')
  assert.equal(marketHistoryUnavailableReason({ response: { status: 503, data: { msg: 'cn_history.sync_disabled' } } }), 'disabled')
  assert.equal(marketHistoryUnavailableReason({ response: { status: 403 } }), 'forbidden')
})

test('coverage failures retain instruments, ranges, issues, and suggested sync action', () => {
  const failure = extractCoverageFailure({
    response: {
      status: 409,
      data: {
        data: {
          code: 'strategyV2.cnHistoryCoverageIncomplete',
          instruments: [{
            instrument: 'CNStock:600519.SH',
            requestedRange: { startDate: '2025-01-01', endDate: '2025-12-31' },
            issues: [{ scope: 'requested', type: 'missing_sessions' }],
            suggestedAction: { type: 'admin_targeted_sync', startDate: '2024-12-01', endDate: '2025-12-31' }
          }]
        }
      }
    }
  })
  assert.equal(failure.instruments[0].instrument, 'CNStock:600519.SH')
  assert.equal(failure.instruments[0].suggestedAction.type, 'admin_targeted_sync')
})

test('settings and backtest views expose operational controls and traceable result metadata', () => {
  const operations = read('../../src/views/settings/MarketHistoryOperations.vue')
  const center = read('../../src/views/backtest-center/index.vue')
  const result = read('../../src/views/backtest-center/PortfolioResult.vue')

  assert.match(operations, /getMarketHistoryProviderHealth/)
  assert.match(operations, /getMarketHistoryDiskStatus/)
  assert.match(operations, /createMarketHistorySyncRun/)
  assert.match(operations, /retryMarketHistorySyncRun/)
  assert.match(operations, /getMarketHistoryCoverage/)
  assert.match(operations, /availability = marketHistoryUnavailableReason\(error\) \|\| 'error'/)
  assert.match(center, /extractCoverageFailure\(error\)/)
  assert.match(result, /item\.dataVersion \|\| item\.contentHash/)
  assert.match(result, /result\.executionAssumptions\.marketRuleVersion/)
})
