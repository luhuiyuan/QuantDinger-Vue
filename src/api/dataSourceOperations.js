import request from '@/utils/request'

const base = '/api/data-sources'

export const getDataSourceOverview = () => request({ url: `${base}/overview`, method: 'get' })
export const getDataSourceReadiness = () => request({ url: `${base}/readiness`, method: 'get' })
export const listProviderInstances = (params = {}) => request({ url: `${base}/instances`, method: 'get', params })
export const getProviderInstance = id => request({ url: `${base}/instances/${id}`, method: 'get' })
export const createProviderInstance = data => request({ url: `${base}/instances`, method: 'post', data })
export const runProviderInstanceAction = (id, action, data) => request({ url: `${base}/instances/${id}/${action}`, method: 'post', data })
export const submitProviderCredentials = (id, data, proof) => request({
  url: `${base}/instances/${id}/credentials`,
  method: 'post',
  data,
  headers: { 'X-Step-Up-Proof': proof }
})
export const issueDataSourceStepUp = data => request({ url: `${base}/step-up`, method: 'post', data })
export const runProviderDiagnostic = (id, capability, data = {}) => request({ url: `${base}/instances/${id}/diagnostics/${capability}`, method: 'post', data })
export const listLatestProviderDiagnostics = id => request({ url: `${base}/instances/${id}/diagnostics`, method: 'get' })
export const quarantineProviderHealth = (stateId, data) => request({ url: `${base}/health/${stateId}/quarantine`, method: 'post', data })
export const extendProviderCircuit = (stateId, data) => request({ url: `${base}/health/${stateId}/extend-circuit`, method: 'post', data })
export const requestRecoveryProbe = (stateId, data) => request({ url: `${base}/health/${stateId}/recovery-probes`, method: 'post', data })
export const listRoutingPolicies = () => request({ url: `${base}/policies`, method: 'get' })
export const getRoutingPolicy = capability => request({ url: `${base}/policies/${capability}`, method: 'get' })
export const saveRoutingPolicyDraft = (capability, data) => request({ url: `${base}/policies/${capability}/draft`, method: 'put', data })
export const previewRoutingPolicyDraft = capability => request({ url: `${base}/policies/${capability}/preview`, method: 'get' })
export const runRoutingPolicyAction = (capability, action, data) => request({ url: `${base}/policies/${capability}/${action}`, method: 'post', data })
export const getRoutedDataRequest = id => request({ url: `${base}/routed-requests/${id}`, method: 'get' })
export const listLegacyCredentialImports = () => request({ url: `${base}/legacy-imports`, method: 'get' })
export const importLegacyCredential = (adapter, data, proof) => request({
  url: `${base}/legacy-imports/${adapter}`,
  method: 'post',
  data,
  headers: { 'X-Step-Up-Proof': proof }
})
export const createDataRoutingCutover = (data, proof) => request({ url: `${base}/cutovers`, method: 'post', data, headers: { 'X-Step-Up-Proof': proof } })
export const runDataRoutingCutoverAction = (id, action, data, proof) => request({ url: `${base}/cutovers/${id}/${action}`, method: 'post', data, headers: { 'X-Step-Up-Proof': proof } })
