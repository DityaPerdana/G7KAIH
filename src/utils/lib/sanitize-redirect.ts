const DISALLOWED_PREFIXES = ['/api', '/auth', '/login', '/signup']

function isBlocked(pathname: string) {
  return DISALLOWED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function sanitizeRedirectPath(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null
  }

  let candidate = input.trim()
  if (!candidate) {
    return null
  }

  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    try {
      const url = new URL(candidate)
      candidate = `${url.pathname}${url.search}${url.hash}`
    } catch {
      return null
    }
  }

  if (!candidate.startsWith('/')) {
    return null
  }

  if (candidate.startsWith('//')) {
    return null
  }

  const pathOnly = candidate.split(/[?#]/)[0]
  if (isBlocked(pathOnly)) {
    return null
  }

  return candidate
}
