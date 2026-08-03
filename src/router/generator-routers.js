import { asyncRouterMap } from '@/config/router.config'
import storage from 'store'
import { USER_INFO, USER_ROLES } from '@/store/mutation-types'

/**
 * Filter routes based on user permissions.
 * Routes with meta.permission containing 'admin' are only visible to admin users.
 *
 * @param {Array} routes - Route configuration array
 * @param {boolean} isAdmin - Whether current user is admin
 * @returns {Array} Filtered routes
 */
function filterRoutesByPermission (routes, isAdmin, grantedPermissions = new Set()) {
  const filtered = []

  for (const route of routes) {
    // Clone route to avoid mutating original
    const clonedRoute = { ...route }

    // Check if route requires admin permission
    const permissions = clonedRoute.meta?.permission || []
    const requiresAdmin = permissions.includes('admin')
    const requiresPermission = permissions.filter(permission => permission !== 'admin')

    // If requires admin but user is not admin, skip this route
    if (requiresAdmin && !isAdmin) {
      continue
    }
    if (!requiresAdmin && requiresPermission.length > 0 && !requiresPermission.some(permission => grantedPermissions.has(permission))) {
      continue
    }

    // Recursively filter children
    if (clonedRoute.children && clonedRoute.children.length > 0) {
      clonedRoute.children = filterRoutesByPermission(clonedRoute.children, isAdmin, grantedPermissions)
    }

    filtered.push(clonedRoute)
  }

  return filtered
}

function getGrantedPermissions () {
  const roles = storage.get(USER_ROLES) || []
  const granted = new Set()
  for (const role of (Array.isArray(roles) ? roles : [roles])) {
    for (const permission of ((role && role.permissionList) || [])) granted.add(permission)
  }
  return granted
}

/**
 * Check if current user is admin.
 * Checks both userInfo.role and stored roles array.
 *
 * @returns {boolean} True if user is admin
 */
function checkIsAdmin () {
  // Check userInfo.role first
  const userInfo = storage.get(USER_INFO) || {}
  if (userInfo.role) {
    const roleId = typeof userInfo.role === 'string' ? userInfo.role : userInfo.role.id
    if (roleId === 'admin') {
      return true
    }
  }

  // Check stored roles array
  const roles = storage.get(USER_ROLES) || []
  if (Array.isArray(roles)) {
    for (const role of roles) {
      if (role && (role.id === 'admin' || role === 'admin')) {
        return true
      }
    }
  }

  return false
}

/**
 * Generate dynamic routes based on user permissions.
 * Filters admin-only routes for non-admin users.
 *
 * @param {string} token - User token (unused, kept for compatibility)
 * @returns {Promise<Array>} Promise resolving to filtered routes
 */
export const generatorDynamicRouter = token => {
  return new Promise((resolve) => {
    const isAdmin = checkIsAdmin()
    const grantedPermissions = getGrantedPermissions()

    // Filter routes based on permissions
    const filteredRoutes = filterRoutesByPermission(asyncRouterMap, isAdmin, grantedPermissions)

    resolve(filteredRoutes)
  })
}
