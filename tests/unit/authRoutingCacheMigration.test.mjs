import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const read = relativePath => fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

test('auth route cache migration invalidates stale roles but preserves the token', () => {
  const mutations = read('../../src/store/mutation-types.js')
  const user = read('../../src/store/modules/user.js')

  assert.match(mutations, /AUTH_ROUTING_CACHE_VERSION/)
  assert.match(user, /AUTH_ROUTING_CACHE_SCHEMA_VERSION/)
  assert.match(user, /storage\.remove\(USER_ROLES\)/)
  assert.match(user, /needsAuthRoutingRefresh/)
  assert.doesNotMatch(user, /storage\.remove\(ACCESS_TOKEN\).*AUTH_ROUTING_CACHE_SCHEMA_VERSION/s)
})

test('refresh uses the unified backend permissions field when rebuilding dynamic routes', () => {
  const user = read('../../src/store/modules/user.js')
  const generator = read('../../src/router/generator-routers.js')

  assert.match(user, /role\.permissions/)
  assert.match(user, /permissions: permissions/)
  assert.match(generator, /role\.permissions/)
  assert.doesNotMatch(user, /permissionList/)
  assert.doesNotMatch(generator, /permissionList/)
})

test('stale auth route cache forces a backend user-info refresh before routes are generated', () => {
  const user = read('../../src/store/modules/user.js')

  assert.match(user, /!state\.needsAuthRoutingRefresh\s*&&\s*state\.info/)
  assert.match(user, /SET_AUTH_ROUTING_CACHE_FRESH/)
  assert.match(user, /storage\.set\(\s*AUTH_ROUTING_CACHE_VERSION,\s*AUTH_ROUTING_CACHE_SCHEMA_VERSION/s)
})
