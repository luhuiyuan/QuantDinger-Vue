import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('data source operations route is guarded by the backend permission code', () => {
  const routes = read('src/config/router.config.js')
  const generator = read('src/router/generator-routers.js')
  assert.match(routes, /path: '\/data-source-operations'[\s\S]*permission: \['data_sources:view'\]/)
  assert.match(generator, /grantedPermissions\.has\(permission\)/)
})

test('console keeps the required three tabs and bounded visibility-aware polling', () => {
  const view = read('src/views/data-source-operations/index.vue')
  assert.match(view, /key="overview"/)
  assert.match(view, /key="instances"/)
  assert.match(view, /key="policies"/)
  assert.match(view, /document\.hidden/)
  assert.match(view, /15000/)
  assert.match(view, /status === 404 \|\| status === 501/)
})

test('credentials are write-only and Data Source Settings filters legacy secrets', () => {
  const consoleView = read('src/views/data-source-operations/index.vue')
  const settings = read('src/views/settings/index.vue')
  assert.match(consoleView, /dataSources\.credentialsWriteOnly/)
  assert.match(consoleView, /X-Step-Up-Proof|issueDataSourceStepUp/)
  assert.match(settings, /isSharedDataSourceTransport/)
  assert.match(settings, /item\.type === 'password'/)
})

test('request logs expose routed request grouping and a console deep link', () => {
  const logs = read('src/views/external-data-request-logs/index.vue')
  assert.match(logs, /routed_request_id/)
  assert.match(logs, /path: '\/data-source-operations'/)
  assert.match(logs, /Routed ID/)
})

test('API client includes lifecycle, credentials, diagnostics, health, policy, legacy import and cutover operations', () => {
  const api = read('src/api/dataSourceOperations.js')
  for (const fragment of ['/credentials', '/diagnostics/', '/quarantine', '/extend-circuit', '/recovery-probes', '/policies/', '/legacy-imports', '/cutovers']) {
    assert.ok(api.includes(fragment), `missing ${fragment}`)
  }
})

test('legacy credential import never renders a secret value and requires step-up', () => {
  const view = read('src/views/data-source-operations/index.vue')
  assert.match(view, /source_names/)
  assert.match(view, /importLegacyCredential/)
  assert.match(view, /issueDataSourceStepUp/)
  assert.doesNotMatch(view, /legacy.*secret.*value/)
})

test('provider instances and routing policies are validated before their API calls', () => {
  const view = read('src/views/data-source-operations/index.vue')
  const validation = read('src/utils/dataSourceOperationsValidation.js')
  assert.match(view, /validateProviderInstanceDraft/)
  assert.match(view, /validateRoutingPolicyEntries/)
  assert.match(validation, /\^\[a-z\]\[a-z0-9_\]\{1,119\}/)
  assert.match(validation, /routeDuplicateInstance/)
  assert.match(validation, /routeInstanceIneligible/)
})
