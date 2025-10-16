import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Security middleware to add security headers to all responses
 * Helps protect against common web vulnerabilities
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security Headers
  
  // 1. Prevent clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY')
  
  // 2. Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // 3. Enable XSS protection (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // 4. Referrer Policy - limit information sent to other sites
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // 5. Permissions Policy - restrict access to browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )
  
  // 6. Content Security Policy (CSP)
  // Note: Adjust based on your actual requirements
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com", // reCAPTCHA requires unsafe-inline
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Tailwind and Google Fonts
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:", // Allow images from CDNs
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co", // Supabase API
    "frame-src 'self' https://www.google.com", // reCAPTCHA
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ]
  
  // Only set CSP in production to avoid development issues
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      cspDirectives.join('; ')
    )
  }
  
  // 7. Strict Transport Security (HTTPS only)
  // Only in production when using HTTPS
  if (process.env.NODE_ENV === 'production' && request.url.startsWith('https')) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
}

// Apply middleware to all routes except static files
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
