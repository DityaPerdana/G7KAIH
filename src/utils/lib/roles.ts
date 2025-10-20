const FALLBACK_ADMIN_ROLE_IDS = new Set<number>([4])
const FALLBACK_PARENT_ROLE_IDS = new Set<number>([3])
const FALLBACK_STUDENT_ROLE_IDS = new Set<number>([5])

/**
 * Determine whether the given role id should be treated as an administrator.
 *
 * We prefer an explicit ADMIN_ROLE_ID environment variable, but fall back to
 * commonly-used admin role ids in legacy databases to avoid accidental lockout.
 */
export function isAdminRole(roleId: number | null | undefined): boolean {
  if (typeof roleId !== "number" || Number.isNaN(roleId)) {
    return false
  }

  const envAdminRoleId = Number(process.env.ADMIN_ROLE_ID ?? "")
  if (!Number.isNaN(envAdminRoleId)) {
    if (roleId === envAdminRoleId) {
      return true
    }
  }

  return FALLBACK_ADMIN_ROLE_IDS.has(roleId)
}

export function isParentRole(roleId: number | null | undefined): boolean {
  if (typeof roleId !== "number" || Number.isNaN(roleId)) {
    return false
  }

  const envParentRoleId = Number(process.env.PARENT_ROLE_ID ?? "")
  if (!Number.isNaN(envParentRoleId)) {
    if (roleId === envParentRoleId) {
      return true
    }
  }

  return FALLBACK_PARENT_ROLE_IDS.has(roleId)
}

export function isStudentRole(roleId: number | null | undefined): boolean {
  if (typeof roleId !== "number" || Number.isNaN(roleId)) {
    return false
  }

  const envStudentRoleId = Number(process.env.STUDENT_ROLE_ID ?? "")
  if (!Number.isNaN(envStudentRoleId) && roleId === envStudentRoleId) {
    return true
  }

  return FALLBACK_STUDENT_ROLE_IDS.has(roleId)
}

export function getAdminRoleIds(): number[] {
  const ids = new Set<number>(FALLBACK_ADMIN_ROLE_IDS)
  const envAdminRoleId = Number(process.env.ADMIN_ROLE_ID ?? "")
  if (!Number.isNaN(envAdminRoleId)) {
    ids.add(envAdminRoleId)
  }
  return Array.from(ids)
}

export function getParentRoleIds(): number[] {
  const ids = new Set<number>(FALLBACK_PARENT_ROLE_IDS)
  const envParentRoleId = Number(process.env.PARENT_ROLE_ID ?? "")
  if (!Number.isNaN(envParentRoleId)) {
    ids.add(envParentRoleId)
  }
  return Array.from(ids)
}

export function getStudentRoleIds(): number[] {
  const ids = new Set<number>(FALLBACK_STUDENT_ROLE_IDS)
  const envStudentRoleId = Number(process.env.STUDENT_ROLE_ID ?? "")
  if (!Number.isNaN(envStudentRoleId)) {
    ids.add(envStudentRoleId)
  }
  return Array.from(ids)
}
