# Security Implementation Guide

This guide provides step-by-step instructions for implementing security improvements identified in the security audit.

## Overview

The following security enhancements are available:
1. ✅ Secure RLS policies (database layer)
2. ✅ Admin route authentication
3. ✅ Security headers middleware
4. ✅ Input validation utilities
5. ⏳ Environment variable management
6. ⏳ Security monitoring and logging

## Implementation Steps

### 1. Apply Secure Database Policies

**⚠️ CRITICAL: Do this before deploying to production**

Replace the insecure development policies with production-ready policies:

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Apply production policies
\i database_migrations/prod_secure_teacher_policies.sql
\i database_migrations/prod_secure_parent_policies.sql
\i database_migrations/prod_secure_guruwali_policies.sql
```

Or use the Supabase dashboard:
1. Go to SQL Editor in Supabase dashboard
2. Copy and paste the content of each `.sql` file
3. Execute them in order

**Verify the policies:**
```sql
-- Check that policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test as a teacher user
SET ROLE teacher_role;
SELECT * FROM user_profiles WHERE roleid = 5; -- Should only see students in your class
```

### 2. Enable Security Headers

**Option A: Use the provided middleware (Recommended)**

Rename or merge with existing middleware:
```bash
# If no middleware exists
mv src/middleware.security.ts src/middleware.ts

# If middleware exists
# Merge the security headers from src/middleware.security.ts into your existing src/middleware.ts
```

**Option B: Add to Next.js config**

Edit `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
}
```

**Verify security headers:**
```bash
# After deploying
curl -I https://your-app.vercel.app
# Check for X-Frame-Options, X-Content-Type-Options, etc.
```

### 3. Add Input Validation to API Routes

**Example: Secure an API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isValidUUID, rateLimiter } from '@/utils/validation'

export async function POST(request: NextRequest) {
  // 1. Rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimiter.check(ip, 10, 60000)) { // 10 requests per minute
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  // 2. Authentication
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 3. Input validation
  const body = await request.json()
  const { studentId, comment } = body

  if (!isValidUUID(studentId)) {
    return NextResponse.json(
      { error: 'Invalid student ID format' },
      { status: 400 }
    )
  }

  if (!comment || typeof comment !== 'string' || comment.length > 1000) {
    return NextResponse.json(
      { error: 'Invalid comment: must be a string with max 1000 characters' },
      { status: 400 }
    )
  }

  // 4. Authorization (check if user has access to this student)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('roleid, kelas')
    .eq('userid', user.id)
    .single()

  if (!profile || profile.roleid !== 2) { // Teacher role
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 5. Process request (RLS will further restrict access)
  const { data, error } = await supabase
    .from('komentar')
    .insert({
      userid: user.id,
      studentid: studentId,
      comment: comment,
    })

  if (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data })
}
```

### 4. Secure Environment Variables

**Create `.env.local` (never commit this file):**
```bash
# Public (safe to expose in client)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_DATA_SITEKEY=your-recaptcha-site-key

# Private (NEVER expose in client code)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# reCAPTCHA (private)
RECAPTCHA_SECRET_KEY=your-recaptcha-secret
```

**Update `.gitignore`:**
```
# Environment variables
.env
.env.local
.env.*.local
.env.production
.env.development
```

**Verify environment variables are secure:**
```bash
# Check that .env files are not tracked
git ls-files | grep .env

# Should return nothing. If it returns files, remove them:
git rm --cached .env.local
git commit -m "Remove environment variables from git"
```

### 5. Apply Performance Optimizations

**Replace the teacher students API route:**
```bash
# Backup current route
cp src/app/api/teacher/students/route.ts src/app/api/teacher/students/route.backup.ts

# Apply optimized version
mv src/app/api/teacher/students/route.optimized.ts src/app/api/teacher/students/route.ts
```

**Test the optimized route:**
```bash
# Start development server
npm run dev

# In another terminal, make a test request
curl -X GET http://localhost:3000/api/teacher/students \
  -H "Cookie: your-session-cookie"

# Check response time (should be <200ms)
```

### 6. Enable Security Monitoring

**Add logging to critical operations:**

```typescript
// src/utils/security-logger.ts
export function logSecurityEvent(event: {
  type: 'auth_failure' | 'forbidden' | 'rate_limit' | 'suspicious'
  userId?: string
  ip: string
  details: string
}) {
  // Log to your monitoring service
  console.warn('[SECURITY]', {
    timestamp: new Date().toISOString(),
    ...event
  })
  
  // Send to monitoring service (e.g., Sentry, DataDog)
  if (process.env.NODE_ENV === 'production') {
    // await sendToMonitoring(event)
  }
}
```

**Use in API routes:**
```typescript
if (!user) {
  logSecurityEvent({
    type: 'auth_failure',
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    details: 'No authentication token provided'
  })
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

## Testing Security

### 1. Test RLS Policies

Create a test script `scripts/test-rls-policies.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

async function testRLS() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Test as teacher
  await supabase.auth.signInWithPassword({
    email: 'teacher@school.com',
    password: 'test-password'
  })

  // This should only return students in teacher's class
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('roleid', 5) // Students

  console.log('Students accessible to teacher:', data?.length)
  console.log('Should match class size, not total students')
}

testRLS()
```

### 2. Test Security Headers

```bash
# Use curl or browser dev tools
curl -I https://your-app.vercel.app

# Expected headers:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Referrer-Policy: strict-origin-when-cross-origin
```

### 3. Test Input Validation

```bash
# Test with invalid UUID
curl -X POST http://localhost:3000/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"userId": "invalid-uuid"}'

# Expected: 400 Bad Request with error message
```

### 4. Test Rate Limiting

```bash
# Send 20 requests rapidly
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/endpoint
done

# Expected: Some requests should get 429 Too Many Requests
```

## Production Checklist

Before deploying to production, verify:

- [ ] Secure RLS policies applied (not dev policies)
- [ ] Security headers enabled
- [ ] Input validation added to all API routes
- [ ] Environment variables properly configured
- [ ] `.env.local` not committed to git
- [ ] Service role keys only used in server-side code
- [ ] Admin routes require admin authentication
- [ ] Rate limiting implemented
- [ ] Error messages don't leak sensitive information
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] Security monitoring configured
- [ ] All API routes have authentication checks
- [ ] Database indexes created
- [ ] Performance testing completed

## Security Best Practices

### 1. Never Trust User Input
```typescript
// BAD
const sql = `SELECT * FROM users WHERE id = '${userId}'`

// GOOD
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId) // Parameterized query
```

### 2. Use Least Privilege Principle
```typescript
// BAD: Using service role key
const supabase = createClient(url, serviceRoleKey)

// GOOD: Using user's session
const supabase = await createClient() // Uses user's auth
```

### 3. Validate Everything
```typescript
// BAD
const { role } = await request.json()
await updateUserRole(role)

// GOOD
const { role } = await request.json()
if (!isValidEnum(role, ['teacher', 'student', 'parent'])) {
  return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
}
await updateUserRole(role)
```

### 4. Log Security Events
```typescript
// Always log authentication failures
if (authError) {
  logSecurityEvent({
    type: 'auth_failure',
    ip: getClientIp(request),
    details: 'Invalid credentials'
  })
}
```

## Troubleshooting

### Issue: RLS policies blocking legitimate requests
**Solution:** Check if the policy conditions match your use case. Use `SELECT` with `USING` clause to debug.

### Issue: Security headers causing issues with external services
**Solution:** Adjust CSP directives in middleware to allow required domains.

### Issue: Rate limiting blocking legitimate users
**Solution:** Adjust rate limits or use more sophisticated rate limiting (e.g., Redis-based).

### Issue: Performance degradation after applying RLS
**Solution:** Ensure database indexes are created. Check query execution plans.

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## Support

For questions or issues:
1. Review the security documentation in this repository
2. Check Supabase documentation
3. Create an issue in the repository
4. Contact the security team
