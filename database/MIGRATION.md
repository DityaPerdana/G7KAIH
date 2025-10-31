# Migration Guide: Supabase to PostgreSQL

This guide explains how to migrate from the Supabase-specific schema to a standalone PostgreSQL schema.

## Overview

The main difference between the two schemas is the authentication layer:
- **Supabase**: Uses `auth.users` managed by Supabase Auth
- **PostgreSQL**: Uses `public.users` with password hashing managed by your application

## Schema Files

- **`schema.sql`** - Original Supabase-compatible schema
- **`schema-postgresql.sql`** - Standalone PostgreSQL schema

## Key Differences

### 1. User Authentication Table

**Supabase (auth.users - managed by Supabase):**
```sql
-- Supabase manages this table
-- Not directly accessible
```

**PostgreSQL (public.users - managed by your app):**
```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_confirmed BOOLEAN DEFAULT FALSE,
  confirmation_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Foreign Key References

**Supabase:**
```sql
userid UUID REFERENCES auth.users(id)
```

**PostgreSQL:**
```sql
userid UUID REFERENCES public.users(id)
```

### 3. Email Synchronization

PostgreSQL version includes automatic email sync between `users` and `user_profiles`:

```sql
CREATE TRIGGER sync_user_email_to_profile
    AFTER INSERT OR UPDATE OF email ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_email();
```

### 4. Convenient View

PostgreSQL version includes a view for easier data access:

```sql
CREATE VIEW public.users_with_profiles AS
SELECT u.*, p.*, r.rolename
FROM public.users u
LEFT JOIN public.user_profiles p ON u.id = p.userid
LEFT JOIN public.role r ON p.roleid = r.roleid;
```

## Migration Steps

### Option 1: Fresh Installation

If starting fresh with PostgreSQL:

1. **Run the PostgreSQL schema:**
   ```bash
   psql -U your_user -d your_database -f database/schema-postgresql.sql
   ```

2. **Create an admin user:**
   ```sql
   -- Hash your password first (use bcrypt in your app)
   INSERT INTO public.users (email, password_hash, email_confirmed) 
   VALUES ('admin@example.com', '$2b$10$...', TRUE);
   
   INSERT INTO public.user_profiles (userid, username, roleid)
   SELECT id, 'Administrator', 1
   FROM public.users WHERE email = 'admin@example.com';
   ```

### Option 2: Migrate from Supabase

If migrating existing data from Supabase:

1. **Export Supabase data:**
   ```bash
   # Export user profiles
   psql "postgresql://..." -c "\COPY (SELECT * FROM user_profiles) TO 'user_profiles.csv' CSV HEADER"
   
   # Export other tables
   psql "postgresql://..." -c "\COPY (SELECT * FROM aktivitas) TO 'aktivitas.csv' CSV HEADER"
   # ... repeat for other tables
   ```

2. **Create new PostgreSQL database and run schema:**
   ```bash
   psql -U your_user -d new_database -f database/schema-postgresql.sql
   ```

3. **Migrate user data:**
   ```sql
   -- First, create users with temporary passwords
   INSERT INTO public.users (id, email, password_hash, email_confirmed)
   SELECT 
     userid,
     email,
     '$2b$10$temporaryHashRequiresReset', -- Users must reset password
     TRUE
   FROM old_user_profiles;
   
   -- User profiles will be created automatically by trigger
   -- Update profiles with additional data
   UPDATE public.user_profiles p
   SET username = o.username,
       roleid = o.roleid,
       kelas = o.kelas,
       parent_of_userid = o.parent_of_userid
   FROM old_user_profiles o
   WHERE p.userid = o.userid;
   ```

4. **Migrate activity data:**
   ```bash
   psql -U your_user -d new_database -c "\COPY public.aktivitas FROM 'aktivitas.csv' CSV HEADER"
   # ... repeat for other tables
   ```

5. **Force password reset:**
   ```sql
   -- Set reset tokens for all users
   UPDATE public.users 
   SET reset_token = gen_random_uuid()::text,
       reset_token_expires = NOW() + INTERVAL '7 days';
   
   -- Send reset emails to all users
   ```

## Authentication Implementation

With PostgreSQL, you need to implement authentication in your application:

### 1. Password Hashing

Use bcrypt or argon2 for password hashing:

**Node.js with bcrypt:**
```javascript
const bcrypt = require('bcrypt');

// Hash password
const saltRounds = 10;
const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

// Verify password
const match = await bcrypt.compare(plainPassword, hashedPassword);
```

**Python with bcrypt:**
```python
import bcrypt

# Hash password
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

# Verify password
if bcrypt.checkpw(password.encode('utf-8'), hashed):
    # Password matches
```

### 2. User Registration

```sql
-- Create user with hashed password
INSERT INTO public.users (email, password_hash, confirmation_token)
VALUES ($1, $2, $3)
RETURNING id;

-- Profile is created automatically by trigger
-- Update profile with additional info
UPDATE public.user_profiles
SET username = $1, roleid = $2, kelas = $3
WHERE userid = $4;
```

### 3. Login

```sql
-- Get user by email
SELECT id, password_hash, email_confirmed
FROM public.users
WHERE email = $1;

-- In application:
-- 1. Verify password hash
-- 2. Check email_confirmed
-- 3. Update last_sign_in_at
-- 4. Create session/JWT
```

### 4. Email Confirmation

```sql
-- Check and confirm email
UPDATE public.users
SET email_confirmed = TRUE,
    confirmation_token = NULL
WHERE confirmation_token = $1
AND email_confirmed = FALSE
RETURNING id, email;
```

### 5. Password Reset

```sql
-- Generate reset token
UPDATE public.users
SET reset_token = gen_random_uuid()::text,
    reset_token_expires = NOW() + INTERVAL '1 hour'
WHERE email = $1
RETURNING reset_token;

-- Verify and reset password
UPDATE public.users
SET password_hash = $1,
    reset_token = NULL,
    reset_token_expires = NULL
WHERE reset_token = $2
AND reset_token_expires > NOW()
RETURNING id, email;
```

## Session Management

Implement session management for authenticated users:

### Option 1: JWT Tokens

```javascript
const jwt = require('jsonwebtoken');

// Create token
const token = jwt.sign(
  { userId: user.id, email: user.email, role: user.roleid },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

// Verify token
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### Option 2: Sessions Table

```sql
CREATE TABLE public.sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_token ON public.sessions(token);
CREATE INDEX idx_sessions_expires_at ON public.sessions(expires_at);
```

## API Changes Required

Update your API to work with the new authentication:

### Before (Supabase):
```javascript
// Supabase handles this
const { data: { user } } = await supabase.auth.getUser();
```

### After (PostgreSQL):
```javascript
// Your app handles this
const user = await getUserFromSession(req.headers.authorization);

async function getUserFromSession(authHeader) {
  const token = authHeader?.replace('Bearer ', '');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  const { rows } = await pool.query(
    'SELECT * FROM users_with_profiles WHERE id = $1',
    [decoded.userId]
  );
  
  return rows[0];
}
```

## Security Considerations

### 1. Password Storage
- **Never** store plain-text passwords
- Use bcrypt (cost factor 10-12) or argon2
- Enforce strong password policies

### 2. Rate Limiting
Implement rate limiting for authentication endpoints:
- Login attempts: 5 per 15 minutes
- Password reset: 3 per hour
- Registration: 10 per hour per IP

### 3. Token Security
- Use secure random tokens for confirmation/reset
- Set appropriate expiration times
- Invalidate tokens after use

### 4. HTTPS Only
- Always use HTTPS in production
- Set secure cookie flags
- Implement CORS properly

### 5. SQL Injection Prevention
- Always use parameterized queries
- Never concatenate user input into SQL
- Use an ORM or query builder when possible

## Testing the Migration

### 1. Verify Schema
```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Verify foreign keys
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint WHERE contype = 'f';
```

### 2. Test User Creation
```sql
-- Create test user
INSERT INTO public.users (email, password_hash, email_confirmed)
VALUES ('test@example.com', '$2b$10$test', TRUE)
RETURNING id;

-- Verify profile was created
SELECT * FROM users_with_profiles WHERE email = 'test@example.com';
```

### 3. Test Authentication Flow
```javascript
// Register
const hashedPassword = await bcrypt.hash('password123', 10);
const userId = await createUser('user@example.com', hashedPassword);

// Login
const user = await getUserByEmail('user@example.com');
const match = await bcrypt.compare('password123', user.password_hash);

// Create session
const token = jwt.sign({ userId: user.id }, JWT_SECRET);
```

## Rollback Plan

If you need to rollback to Supabase:

1. **Keep Supabase project active during migration**
2. **Test thoroughly in staging first**
3. **Have database backups**
4. **Plan for downtime window**

## Support

For issues during migration:
1. Check the PostgreSQL logs
2. Verify all foreign key constraints
3. Ensure password hashing is working
4. Test authentication endpoints thoroughly

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [bcrypt Documentation](https://github.com/kelektiv/node.bcrypt.js)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
