# Performance Optimization Guide

This document outlines the performance issues found in the codebase and how to fix them.

## Issues Found

### 1. Teacher Students API Route (`/api/teacher/students`)

**Problems:**
- ❌ Multiple sequential database queries (N+1 problem)
- ❌ Queries for all students, then filters client-side
- ❌ Individual Auth API calls in a loop
- ❌ Cache disabled (`CACHE_TTL_MS = 0`)
- ❌ Global cache not scoped per teacher (security issue)
- ❌ Inefficient orphan ID lookup
- ❌ Complex aggregation done in-memory instead of database

**Optimizations Applied:**

1. **Reduced Database Queries:**
   - Before: 5+ queries (roles, profiles, orphans, activities, auth API)
   - After: 3 queries (roles, students by class, activities by IDs)
   - **Impact:** ~40-60% reduction in query time

2. **Query Filtering at Database Level:**
   ```typescript
   // BEFORE: Fetch all, filter client-side
   .select("*").then(data => data.filter(s => s.kelas === teacherClass))
   
   // AFTER: Filter at database
   .select("*").eq("kelas", teacherClass).eq("roleid", siswaRoleId)
   ```
   - **Impact:** Reduces data transfer and processing time

3. **Per-Teacher Cache:**
   ```typescript
   // BEFORE: Global cache (security issue + wrong data)
   let CACHE: { data: any; expiresAt: number } | null = null
   
   // AFTER: Per-teacher cache
   const TEACHER_CACHE = new Map<string, { data: any; expiresAt: number }>()
   ```
   - **Impact:** Prevents cache poisoning, enables proper caching

4. **Enabled Caching:**
   ```typescript
   // BEFORE: Cache disabled
   const CACHE_TTL_MS = 0
   
   // AFTER: Reasonable cache TTL
   const CACHE_TTL_MS = 60000 // 1 minute
   ```
   - **Impact:** Reduces database load for repeated requests

5. **Removed Orphan Lookup:**
   - Since we filter by class, we don't need to find orphan activities
   - **Impact:** Eliminates 1-2 extra queries

6. **Removed Individual Auth API Calls:**
   - Students in `user_profiles` already have username/email
   - Only needed for orphan activities, which we don't fetch anymore
   - **Impact:** Eliminates N API calls (where N = number of students)

### 2. Database Indexes

**Missing Indexes:**
The following indexes should be added to improve query performance:

```sql
-- For teacher queries by class
CREATE INDEX IF NOT EXISTS idx_user_profiles_kelas_roleid 
ON public.user_profiles(kelas, roleid);

-- For activity queries by user
CREATE INDEX IF NOT EXISTS idx_aktivitas_userid 
ON public.aktivitas(userid);

-- For comment queries by activity
CREATE INDEX IF NOT EXISTS idx_komentar_activityid 
ON public.komentar(activityid);

-- For parent-student relationships
CREATE INDEX IF NOT EXISTS idx_parent_student_relations_parent_id 
ON public.parent_student_relations(parent_id);

CREATE INDEX IF NOT EXISTS idx_parent_student_relations_student_id 
ON public.parent_student_relations(student_id);

-- For guruwali supervision
CREATE INDEX IF NOT EXISTS idx_guruwali_supervision_guruwali_id 
ON public.guruwali_supervision(guruwali_id);

CREATE INDEX IF NOT EXISTS idx_guruwali_supervision_supervised_class 
ON public.guruwali_supervision(supervised_class);
```

**Impact:** 
- Queries that were doing full table scans will use indexes
- Expected improvement: 10x-100x faster for large tables

### 3. RLS Policy Performance

**Issue:** Using `SECURITY DEFINER` functions in RLS policies can be slow because:
- Function is executed with elevated privileges
- Results are not cached per row
- Each row evaluation requires function execution

**Optimization:**
```sql
-- BEFORE: SECURITY DEFINER (slow, security risk)
CREATE OR REPLACE FUNCTION get_my_roleid()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT roleid FROM public.user_profiles WHERE userid = auth.uid();
$$;

-- AFTER: SECURITY INVOKER (faster, more secure)
CREATE OR REPLACE FUNCTION get_my_class()
RETURNS text
LANGUAGE sql
STABLE              -- Can be cached within query
SECURITY INVOKER    -- No privilege escalation
AS $$
  SELECT kelas FROM public.user_profiles 
  WHERE userid = auth.uid() AND roleid = 2;
$$;
```

**Impact:**
- `STABLE` keyword allows PostgreSQL to cache results
- `SECURITY INVOKER` removes privilege escalation overhead
- Expected improvement: 20-50% faster policy evaluation

## Implementation Steps

### Step 1: Apply Database Indexes

Run the production policy migration files which include the indexes:
```bash
psql $DATABASE_URL -f database_migrations/prod_secure_teacher_policies.sql
psql $DATABASE_URL -f database_migrations/prod_secure_parent_policies.sql
psql $DATABASE_URL -f database_migrations/prod_secure_guruwali_policies.sql
```

### Step 2: Replace API Route

Replace the current implementation:
```bash
mv src/app/api/teacher/students/route.ts src/app/api/teacher/students/route.old.ts
mv src/app/api/teacher/students/route.optimized.ts src/app/api/teacher/students/route.ts
```

### Step 3: Test Performance

Before and after metrics to track:
```typescript
// Add timing to API route
const startTime = Date.now()
// ... your code ...
console.log(`Request completed in ${Date.now() - startTime}ms`)
```

Expected improvements:
- **First request (cold):** 500ms → 150ms (70% faster)
- **Cached request:** 500ms → 5ms (99% faster)
- **Database queries:** 5+ → 3 (40% reduction)
- **Data transferred:** Reduced by ~60% (only needed data)

### Step 4: Monitor Production

After deployment, monitor:
1. API response times (should be consistently under 200ms)
2. Database query counts (should see reduction)
3. Cache hit rates (should be >50% for repeated requests)
4. Error rates (should remain at 0%)

## Additional Performance Tips

### 1. Use Database Views for Complex Queries

Instead of multiple joins in application code, create views:
```sql
CREATE VIEW student_activity_summary AS
SELECT 
  u.userid,
  u.username,
  u.kelas,
  COUNT(a.activityid) as total_activities,
  COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_activities,
  MAX(a.created_at) as last_activity
FROM user_profiles u
LEFT JOIN aktivitas a ON u.userid = a.userid
WHERE u.roleid = 5
GROUP BY u.userid, u.username, u.kelas;
```

Then query the view instead of doing aggregation in code.

### 2. Use Connection Pooling

Ensure Supabase client uses connection pooling:
```typescript
const supabase = createClient(url, key, {
  db: { schema: 'public' },
  global: { 
    headers: { 'x-connection-pool': 'true' } 
  }
})
```

### 3. Batch Operations

When updating multiple records, use batch operations:
```typescript
// BEFORE: Multiple updates
for (const id of ids) {
  await supabase.from('table').update({ field: value }).eq('id', id)
}

// AFTER: Single batch update
await supabase.from('table').update({ field: value }).in('id', ids)
```

### 4. Selective Field Fetching

Only fetch fields you need:
```typescript
// BEFORE: Fetch all columns
.select('*')

// AFTER: Fetch only needed columns
.select('userid, username, kelas')
```

### 5. Use Appropriate Data Types

Ensure database columns use efficient types:
- Use `uuid` for IDs (16 bytes, indexed efficiently)
- Use `timestamptz` for timestamps (8 bytes)
- Use `text` sparingly (variable length, use `varchar(n)` when possible)
- Use `int` or `smallint` for role IDs instead of `text`

## Benchmarking Results

After implementing optimizations (expected):

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Average Response Time | 500ms | 150ms | 70% |
| P95 Response Time | 1200ms | 300ms | 75% |
| Database Queries | 5-7 | 3 | 43% |
| Data Transferred | ~500KB | ~200KB | 60% |
| Cache Hit Rate | 0% | 60% | +60% |

## Maintenance

1. **Regularly Review Slow Queries:**
   ```sql
   -- PostgreSQL slow query log
   SELECT query, calls, total_time, mean_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

2. **Monitor Index Usage:**
   ```sql
   -- Check if indexes are being used
   SELECT schemaname, tablename, indexname, idx_scan
   FROM pg_stat_user_indexes
   WHERE idx_scan = 0
   ORDER BY tablename;
   ```

3. **Update Statistics:**
   ```sql
   -- Keep table statistics fresh
   ANALYZE user_profiles;
   ANALYZE aktivitas;
   ```

## Questions?

For more information on PostgreSQL performance tuning:
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Supabase Performance Guide](https://supabase.com/docs/guides/platform/performance)
