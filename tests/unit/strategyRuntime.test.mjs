import test from 'node:test'
import assert from 'node:assert/strict'

import {
  filterAndSortStrategies,
  strategyExecutionMode,
  strategyLastActivityTimestamp,
  strategyModeBucket,
  strategyRuntimeSummary,
  strategySymbol
} from '../../src/utils/strategyRuntime.js'

const rows = [
  {
    id: 1,
    strategy_name: 'Signal BTC',
    strategy_mode: 'script',
    status: 'stopped',
    execution_mode: 'signal',
    initial_capital: 1000,
    total_pnl: -10,
    updated_at: '2026-07-10T10:00:00Z',
    trading_config: { symbol: 'BTC/USDT', timeframe: '5m' }
  },
  {
    id: 2,
    strategy_name: 'Live ETH Grid',
    strategy_mode: 'bot',
    status: 'running',
    initial_capital: 2000,
    total_pnl: 25,
    trading_config: {
      symbol: 'ETH/USDT',
      execution_mode: 'live',
      last_execution_time: 1783677600
    }
  },
  {
    id: 3,
    strategy_name: 'Live SOL Script',
    strategy_type: 'ScriptStrategy',
    status: 'running',
    execution_mode: 'live',
    initial_capital: 500,
    total_pnl: 5,
    trading_config: JSON.stringify({ symbols: ['SOL/USDT'], last_signal_time: '2026-07-10T09:00:00Z' })
  }
]

test('normalizes strategy runtime fields', () => {
  assert.equal(strategyModeBucket(rows[1]), 'bot')
  assert.equal(strategyModeBucket(rows[2]), 'script')
  assert.equal(strategyModeBucket({ strategy_mode: 'signal', strategy_type: 'ScriptStrategy' }), 'signal')
  assert.equal(strategyExecutionMode(rows[1]), 'live')
  assert.equal(strategySymbol(rows[2]), 'SOL/USDT')
  assert.equal(strategyLastActivityTimestamp(rows[1]), 1783677600000)
})

test('summarizes live operations without excluding strategies that have no trades', () => {
  assert.deepEqual(strategyRuntimeSummary(rows), {
    total: 3,
    running: 2,
    runningLive: 2,
    runningSignal: 0,
    totalPnl: 20,
    totalCapital: 3500
  })
})

test('filters and sorts running strategies before stopped strategies', () => {
  const filtered = filterAndSortStrategies(rows, { keyword: 'live', status: 'running', executionMode: 'live' })
  assert.deepEqual(filtered.map(item => item.id), [2, 3])
  assert.deepEqual(filterAndSortStrategies(rows).map(item => item.id), [2, 3, 1])
})
