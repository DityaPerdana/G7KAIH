# Database Schema

This directory contains the database schema and migration files for the G7 KAIH system.

## Files

- **`schema.sql`** - Complete database schema for Supabase (uses `auth.users`)
- **`schema-postgresql.sql`** - Complete database schema for standalone PostgreSQL (uses `public.users`)
- **`MIGRATION.md`** - Guide for migrating from Supabase to PostgreSQL

## Which Schema Should I Use?

### Use `schema.sql` if:
- You're using **Supabase** for hosting
- You want Supabase Auth to handle authentication
- You want Row Level Security (RLS) managed by Supabase

### Use `schema-postgresql.sql` if:
- You're using **standalone PostgreSQL** (self-hosted, AWS RDS, etc.)
- You want to manage authentication in your application
- You're migrating away from Supabase

See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions.

## Quick Start

### For Supabase

Using the Supabase-compatible schema (`schema.sql`):

### Option 1: Run in Supabase SQL Editor (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of `schema.sql`
5. Click **Run** to execute

### Option 2: Run via Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run the schema
supabase db push
```

### Option 3: Run via psql

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" < database/schema.sql
```

### For Standalone PostgreSQL

Using the PostgreSQL-compatible schema (`schema-postgresql.sql`):

#### Option 1: Run via psql

```bash
psql -U your_user -d your_database -f database/schema-postgresql.sql
```

#### Option 2: Import via GUI

1. Open your PostgreSQL client (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Run the contents of `schema-postgresql.sql`

**Important:** The PostgreSQL schema requires you to implement authentication in your application. See [MIGRATION.md](./MIGRATION.md) for details.

## Schema Overview

The schema includes **11 core tables**:

### User Management
- `role` - User role definitions (admin, teacher, student, parent, guruwali)
- `user_profiles` - User profile information and metadata

### Activity Definitions
- `kegiatan` - Task definitions that students complete
- `category` - Field categories for structured data collection
- `category_fields` - Individual field definitions within categories
- `kegiatan_categories` - Many-to-many relationship between tasks and categories

### Activity Submissions
- `aktivitas` - Student activity submissions (with daily limit enforcement)
- `aktivitas_field_values` - Field values for each activity
- `aktivitas_field_images` - Image/file references from Cloudinary

### Feedback & Configuration
- `komentar` - Comments and feedback on student activities
- `submission_window` - Global submission window control

## Key Features

### 🔒 Security
- **Row Level Security (RLS)** enabled on user-facing tables
- Basic policies included for students (view/insert own data)
- Additional policies needed for teachers, parents, and admins

### ⚡ Performance
- Strategic indexes on frequently queried columns
- Optimized for common query patterns

### 🔗 Data Integrity
- Foreign key constraints ensure referential integrity
- Cascading deletes where appropriate
- Unique constraints for business rules (e.g., one submission per day)

### 🕐 Automatic Timestamps
- `updated_at` triggers on tables that track changes
- Automatic timestamp management

## Schema Sections

The `schema.sql` file is organized into sections:

1. **Roles and User Management** - User tables and role definitions
2. **Activity Definitions** - Task and category structures
3. **Activity Submissions** - Submission tables and field storage
4. **Comments and Feedback** - Comment system
5. **System Configuration** - Global settings
6. **Triggers and Functions** - Automated timestamp updates
7. **Row Level Security** - Security policies
8. **Initial Data Setup** - Optional default data
9. **Grants and Permissions** - Database permissions

## Important Notes

### Daily Submission Limit
The `aktivitas` table enforces **one submission per task per day** using:
```sql
UNIQUE(kegiatanid, userid, submitted_date)
```

The `submitted_date` should be set based on **Asia/Jakarta timezone** in application code.

### Soft Deletes
The `komentar` table uses soft delete:
- `deleteat = NULL` means the comment is active
- `deleteat = timestamp` means the comment is deleted
- Always filter with `WHERE deleteat IS NULL` in queries

### Parent-Student Linking
Parent-student relationships use the `parent_of_userid` field in `user_profiles`:
```sql
-- Parent record
userid: 'parent-uuid'
parent_of_userid: 'student-uuid'  -- Links to child
```

## Customization

### Add Custom RLS Policies

The schema includes basic student policies. Add policies for other roles:

```sql
-- Example: Teachers can view students in their class
CREATE POLICY teacher_view_class_students ON public.user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles teacher
            WHERE teacher.userid = auth.uid()
            AND teacher.roleid = 2  -- teacher role
            AND teacher.kelas = user_profiles.kelas
        )
    );
```

### Add Initial Data

Uncomment and customize the initial data section in `schema.sql`:

```sql
-- Add default categories
INSERT INTO public.category (categoryname) VALUES
  ('Prayer Details'),
  ('Reading Details')
ON CONFLICT (categoryname) DO NOTHING;

-- Add fields for categories
-- ... (see schema.sql for examples)
```

## Verification

After running the schema, verify the setup:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check roles are created
SELECT * FROM public.role ORDER BY roleid;

-- Verify indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

## Migrations

For future schema changes:

1. **Never modify `schema.sql` directly** for changes to existing databases
2. Create new migration files: `migrations/001_add_feature.sql`
3. Document migrations in a `MIGRATIONS.md` file
4. Use Supabase migrations or a tool like Flyway/Liquibase

## Troubleshooting

### Error: relation already exists
If you see this error, the schema may already exist. Either:
- Drop existing tables (⚠️ **data loss!**)
- Use `IF NOT EXISTS` clauses (already included in schema.sql)

### Error: permission denied
Ensure you're using a user with sufficient permissions (postgres user or service_role).

### RLS blocking queries
If queries are blocked after enabling RLS:
- Verify policies are created correctly
- Check user authentication status
- Use service_role for admin operations (bypasses RLS)

## Documentation

For more details, see:
- **[DATABASE.md](../DATABASE.md)** - Comprehensive database guide with ERD and examples
- **[BACKEND.md](../BACKEND.md)** - Backend architecture and implementation
- **[API.md](../API.md)** - API endpoints and usage

## Support

For issues or questions:
1. Check the documentation above
2. Review the inline comments in `schema.sql`
3. Open an issue on GitHub
