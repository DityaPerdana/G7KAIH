/**
 * Input validation utilities for API routes
 * Helps prevent injection attacks and data integrity issues
 */

/**
 * Validates UUID format
 * @param value The value to validate
 * @returns true if valid UUID, false otherwise
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

/**
 * Validates email format
 * @param email The email to validate
 * @returns true if valid email, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

/**
 * Sanitizes string input by removing potential SQL injection characters
 * @param input The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  // Remove potentially dangerous characters
  return input.replace(/[;\-\-\/\*]/g, '').trim()
}

/**
 * Validates that a string contains only alphanumeric characters and specific allowed chars
 * @param value The value to validate
 * @param allowedChars Additional allowed characters (e.g., '-_.')
 * @returns true if valid, false otherwise
 */
export function isAlphanumeric(value: string, allowedChars: string = ''): boolean {
  const pattern = new RegExp(`^[a-zA-Z0-9${allowedChars}]+$`)
  return pattern.test(value)
}

/**
 * Validates integer within a range
 * @param value The value to validate
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @returns true if valid, false otherwise
 */
export function isValidInteger(value: any, min?: number, max?: number): boolean {
  const num = parseInt(value, 10)
  if (isNaN(num) || !Number.isInteger(num)) {
    return false
  }
  if (min !== undefined && num < min) {
    return false
  }
  if (max !== undefined && num > max) {
    return false
  }
  return true
}

/**
 * Validates that a value is one of the allowed enum values
 * @param value The value to validate
 * @param allowedValues Array of allowed values
 * @returns true if valid, false otherwise
 */
export function isValidEnum<T>(value: T, allowedValues: T[]): boolean {
  return allowedValues.includes(value)
}

/**
 * Validates and sanitizes a class name (kelas)
 * Allows alphanumeric characters, spaces, and hyphens
 * @param className The class name to validate
 * @returns Sanitized class name or null if invalid
 */
export function validateClassName(className: string): string | null {
  if (!className || className.length > 50) {
    return null
  }
  const sanitized = className.replace(/[^a-zA-Z0-9\s\-]/g, '').trim()
  if (sanitized.length === 0) {
    return null
  }
  return sanitized
}

/**
 * Validates file upload
 * @param file The file to validate
 * @param options Validation options
 * @returns Validation result
 */
export function validateFile(
  file: File,
  options: {
    maxSizeBytes?: number
    allowedTypes?: string[]
  } = {}
): { valid: boolean; error?: string } {
  const { maxSizeBytes = 10 * 1024 * 1024, allowedTypes = [] } = options

  // Check file size
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeBytes / 1024 / 1024}MB limit`
    }
  }

  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed. Allowed types: ${allowedTypes.join(', ')}`
    }
  }

  return { valid: true }
}

/**
 * Rate limiting helper (simple in-memory implementation)
 * For production, use a proper rate limiting service like Redis
 */
class RateLimiter {
  private requests = new Map<string, number[]>()

  /**
   * Check if a request should be allowed
   * @param key Unique identifier (e.g., user ID, IP address)
   * @param maxRequests Maximum number of requests
   * @param windowMs Time window in milliseconds
   * @returns true if allowed, false if rate limit exceeded
   */
  check(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now()
    const timestamps = this.requests.get(key) || []

    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs)

    if (validTimestamps.length >= maxRequests) {
      return false
    }

    // Add current timestamp
    validTimestamps.push(now)
    this.requests.set(key, validTimestamps)

    // Clean up old entries periodically
    if (this.requests.size > 1000) {
      this.cleanup(windowMs)
    }

    return true
  }

  private cleanup(windowMs: number) {
    const now = Date.now()
    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < windowMs)
      if (validTimestamps.length === 0) {
        this.requests.delete(key)
      } else {
        this.requests.set(key, validTimestamps)
      }
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter()

/**
 * Example usage in API route:
 * 
 * import { isValidUUID, isValidEmail, rateLimiter } from '@/utils/validation'
 * 
 * export async function POST(request: NextRequest) {
 *   // Rate limiting
 *   const ip = request.headers.get('x-forwarded-for') || 'unknown'
 *   if (!rateLimiter.check(ip, 10, 60000)) {
 *     return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 *   }
 * 
 *   // Validate input
 *   const { userId, email } = await request.json()
 *   
 *   if (!isValidUUID(userId)) {
 *     return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
 *   }
 *   
 *   if (!isValidEmail(email)) {
 *     return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
 *   }
 *   
 *   // Process request...
 * }
 */
