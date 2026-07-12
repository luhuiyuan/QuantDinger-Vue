import request from '@/utils/request'

export function listPortfolioDeployments () {
  return request({ url: '/api/portfolio-deployments', method: 'get' })
}

export function createPortfolioDeployment (data) {
  return request({ url: '/api/portfolio-deployments', method: 'post', data })
}

export function getPortfolioDeployment (id) {
  return request({ url: `/api/portfolio-deployments/${id}`, method: 'get' })
}

export function updatePortfolioDeployment (id, data) {
  return request({ url: `/api/portfolio-deployments/${id}`, method: 'put', data })
}

export function deletePortfolioDeployment (id) {
  return request({ url: `/api/portfolio-deployments/${id}`, method: 'delete' })
}

export function startPortfolioDeployment (id) {
  return request({ url: `/api/portfolio-deployments/${id}/start`, method: 'post' })
}

export function stopPortfolioDeployment (id) {
  return request({ url: `/api/portfolio-deployments/${id}/stop`, method: 'post' })
}

export function runPortfolioDeployment (id) {
  return request({ url: `/api/portfolio-deployments/${id}/run`, method: 'post' })
}

export function listPortfolioDeploymentPlans (id, params) {
  return request({ url: `/api/portfolio-deployments/${id}/plans`, method: 'get', params })
}

export function acknowledgePortfolioOrder (deploymentId, orderId, data) {
  return request({ url: `/api/portfolio-deployments/${deploymentId}/orders/${orderId}/acknowledge`, method: 'post', data })
}
