const INSTANCE_KEY = /^[a-z][a-z0-9_]{1,119}$/

export function validateProviderInstanceDraft ({ instanceKey, adapterKey, displayName, config }) {
  if (!INSTANCE_KEY.test(String(instanceKey || '').trim())) return 'instanceKeyInvalid'
  if (!String(adapterKey || '').trim()) return 'adapterKeyRequired'
  if (!String(displayName || '').trim()) return 'displayNameRequired'
  if (!config || Array.isArray(config) || typeof config !== 'object') return 'configObjectRequired'
  return null
}

export function validateRoutingPolicyEntries (entries, instances, capabilityKey) {
  if (!Array.isArray(entries) || entries.length === 0) return 'routeRequired'
  const ids = entries.map(entry => Number(entry.instance_id || 0))
  if (ids.some(id => id <= 0)) return 'routeInstanceRequired'
  if (new Set(ids).size !== ids.length) return 'routeDuplicateInstance'
  const byId = new Map((instances || []).map(instance => [Number(instance.id), instance]))
  if (ids.some(id => {
    const instance = byId.get(id)
    return !instance || instance.lifecycle_status !== 'active' || (instance.capabilities || {})[capabilityKey] !== 'eligible'
  })) return 'routeInstanceIneligible'
  return null
}
