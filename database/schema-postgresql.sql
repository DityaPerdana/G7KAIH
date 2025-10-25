-- ============================================================================
-- G7 KAIH Database Schema (PostgreSQL Standalone)
-- ============================================================================
-- This schema defines the complete database structure for the G7 KAIH
-- educational activity management system for standalone PostgreSQL.
--
-- Database: PostgreSQL (Standalone)
-- Version: 2.0
-- 
-- For detailed documentation, see DATABASE.md
-- ============================================================================

-- ============================================================================
-- SECTION 1: AUTHENTICATION AND USER MANAGEMENT
-- ============================================================================

-- Table: users
-- Purpose: Core authentication and user table (replaces Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,  -- Store bcrypt/argon2 hashed password
  email_confirmed BOOLEAN DEFAULT FALSE,
  confirmation_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_confirmation_token ON public.users(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON public.users(reset_token);

COMMENT ON TABLE public.users IS 'Core user authentication table';
COMMENT ON COLUMN public.users.id IS 'Unique user identifier';
COMMENT ON COLUMN public.users.email IS 'User email address (unique)';
COMMENT ON COLUMN public.users.password_hash IS 'Hashed password (bcrypt/argon2)';
COMMENT ON COLUMN public.users.email_confirmed IS 'Whether email has been confirmed';
COMMENT ON COLUMN public.users.confirmation_token IS 'Email confirmation token';
COMMENT ON COLUMN public.users.reset_token IS 'Password reset token';
COMMENT ON COLUMN public.users.reset_token_expires IS 'Password reset token expiration';

-- Table: role
-- Purpose: Define user roles and permissions
CREATE TABLE IF NOT EXISTS public.role (
  roleid INTEGER PRIMARY KEY,
  rolename VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default roles
INSERT INTO public.role (roleid, rolename) VALUES
  (1, 'admin'),
  (2, 'teacher'),
  (3, 'parent'),
  (4, 'student'),
  (5, 'siswa'),
  (6, 'guruwali')
ON CONFLICT (roleid) DO NOTHING;

COMMENT ON TABLE public.role IS 'User role definitions for access control';
COMMENT ON COLUMN public.role.roleid IS 'Unique role identifier';
COMMENT ON COLUMN public.role.rolename IS 'Role name (admin, teacher, parent, student, siswa, guruwali)';

-- Table: user_profiles
-- Purpose: Store user metadata and profile information
CREATE TABLE IF NOT EXISTS public.user_profiles (
  userid UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  username VARCHAR(255),
  email VARCHAR(255),  -- Denormalized for convenience
  roleid INTEGER REFERENCES public.role(roleid),
  kelas VARCHAR(50),                    -- Class name (e.g., "7A", "8B")
  parent_of_userid UUID,                -- For parent-student linking (references userid)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_roleid ON public.user_profiles(roleid);
CREATE INDEX IF NOT EXISTS idx_user_profiles_kelas ON public.user_profiles(kelas);
CREATE INDEX IF NOT EXISTS idx_user_profiles_parent_of_userid ON public.user_profiles(parent_of_userid);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

COMMENT ON TABLE public.user_profiles IS 'User profile information and metadata';
COMMENT ON COLUMN public.user_profiles.userid IS 'Primary key, references public.users';
COMMENT ON COLUMN public.user_profiles.username IS 'Display name of the user';
COMMENT ON COLUMN public.user_profiles.email IS 'User email address (denormalized from users table)';
COMMENT ON COLUMN public.user_profiles.roleid IS 'User role (foreign key to role table)';
COMMENT ON COLUMN public.user_profiles.kelas IS 'Class/grade the user belongs to (for students and teachers)';
COMMENT ON COLUMN public.user_profiles.parent_of_userid IS 'For parents, references their child userid';

-- ============================================================================
-- SECTION 2: ACTIVITY DEFINITIONS (KEGIATAN & CATEGORIES)
-- ============================================================================

-- Table: kegiatan
-- Purpose: Define tasks/activities that students complete
CREATE TABLE IF NOT EXISTS public.kegiatan (
  kegiatanid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatanname VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kegiatan_created_at ON public.kegiatan(created_at DESC);

COMMENT ON TABLE public.kegiatan IS 'Task definitions that students need to complete';
COMMENT ON COLUMN public.kegiatan.kegiatanid IS 'Unique task identifier';
COMMENT ON COLUMN public.kegiatan.kegiatanname IS 'Name of the task (e.g., "Morning Prayer", "Reading Log")';

-- Table: category
-- Purpose: Group related fields together for structured data collection
CREATE TABLE IF NOT EXISTS public.category (
  categoryid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoryname VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_name ON public.category(categoryname);

COMMENT ON TABLE public.category IS 'Field categories for structured data collection';
COMMENT ON COLUMN public.category.categoryid IS 'Unique category identifier';
COMMENT ON COLUMN public.category.categoryname IS 'Category name (e.g., "Prayer Details", "Reading Details")';

-- Table: category_fields
-- Purpose: Define individual fields within a category
CREATE TABLE IF NOT EXISTS public.category_fields (
  fieldid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoryid UUID REFERENCES public.category(categoryid) ON DELETE CASCADE,
  field_key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,            -- text, time, multiselect, image, text_image
  required BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}'::JSONB,     -- Additional field configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(categoryid, field_key)
);

CREATE INDEX IF NOT EXISTS idx_category_fields_categoryid ON public.category_fields(categoryid);
CREATE INDEX IF NOT EXISTS idx_category_fields_type ON public.category_fields(type);

COMMENT ON TABLE public.category_fields IS 'Field definitions within categories';
COMMENT ON COLUMN public.category_fields.fieldid IS 'Unique field identifier';
COMMENT ON COLUMN public.category_fields.categoryid IS 'Parent category reference';
COMMENT ON COLUMN public.category_fields.field_key IS 'Unique field key within category';
COMMENT ON COLUMN public.category_fields.label IS 'Display label for the field';
COMMENT ON COLUMN public.category_fields.type IS 'Field type: text, time, multiselect, image, text_image';
COMMENT ON COLUMN public.category_fields.required IS 'Whether the field is mandatory';
COMMENT ON COLUMN public.category_fields.order_index IS 'Display order of the field';
COMMENT ON COLUMN public.category_fields.config IS 'Additional JSON configuration for the field';

-- Table: kegiatan_categories
-- Purpose: Many-to-many relationship between kegiatan and categories
CREATE TABLE IF NOT EXISTS public.kegiatan_categories (
  kegiatanid UUID REFERENCES public.kegiatan(kegiatanid) ON DELETE CASCADE,
  categoryid UUID REFERENCES public.category(categoryid) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (kegiatanid, categoryid)
);

CREATE INDEX IF NOT EXISTS idx_kegiatan_categories_kegiatanid ON public.kegiatan_categories(kegiatanid);
CREATE INDEX IF NOT EXISTS idx_kegiatan_categories_categoryid ON public.kegiatan_categories(categoryid);

COMMENT ON TABLE public.kegiatan_categories IS 'Many-to-many relationship linking tasks to categories';

-- ============================================================================
-- SECTION 3: ACTIVITY SUBMISSIONS
-- ============================================================================

-- Table: aktivitas
-- Purpose: Store student activity submissions
CREATE TABLE IF NOT EXISTS public.aktivitas (
  activityid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatanid UUID REFERENCES public.kegiatan(kegiatanid) ON DELETE CASCADE,
  userid UUID REFERENCES public.users(id) ON DELETE CASCADE,
  activityname VARCHAR(255),
  activitycontent TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  submitted_date DATE DEFAULT CURRENT_DATE, -- For daily limit enforcement (Asia/Jakarta timezone)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(kegiatanid, userid, submitted_date)  -- Enforce one submission per day per task
);

-- Indexes for aktivitas
CREATE INDEX IF NOT EXISTS idx_aktivitas_userid ON public.aktivitas(userid);
CREATE INDEX IF NOT EXISTS idx_aktivitas_kegiatanid ON public.aktivitas(kegiatanid);
CREATE INDEX IF NOT EXISTS idx_aktivitas_submitted_date ON public.aktivitas(submitted_date DESC);
CREATE INDEX IF NOT EXISTS idx_aktivitas_created_at ON public.aktivitas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aktivitas_status ON public.aktivitas(status);

COMMENT ON TABLE public.aktivitas IS 'Student activity submissions';
COMMENT ON COLUMN public.aktivitas.activityid IS 'Unique activity identifier';
COMMENT ON COLUMN public.aktivitas.kegiatanid IS 'Reference to the task being completed';
COMMENT ON COLUMN public.aktivitas.userid IS 'Student who submitted the activity';
COMMENT ON COLUMN public.aktivitas.activityname IS 'Auto-generated or custom activity name';
COMMENT ON COLUMN public.aktivitas.activitycontent IS 'Optional description or notes';
COMMENT ON COLUMN public.aktivitas.status IS 'Activity status (completed, pending, etc.)';
COMMENT ON COLUMN public.aktivitas.submitted_date IS 'Date of submission (Asia/Jakarta timezone) - enforces daily limit';

-- Table: aktivitas_field_values
-- Purpose: Store field values for each activity
CREATE TABLE IF NOT EXISTS public.aktivitas_field_values (
  activityid UUID REFERENCES public.aktivitas(activityid) ON DELETE CASCADE,
  fieldid UUID REFERENCES public.category_fields(fieldid) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (activityid, fieldid)
);

CREATE INDEX IF NOT EXISTS idx_aktivitas_field_values_activityid ON public.aktivitas_field_values(activityid);
CREATE INDEX IF NOT EXISTS idx_aktivitas_field_values_fieldid ON public.aktivitas_field_values(fieldid);

COMMENT ON TABLE public.aktivitas_field_values IS 'Stores the actual field values for each activity submission';
COMMENT ON COLUMN public.aktivitas_field_values.activityid IS 'Reference to the activity';
COMMENT ON COLUMN public.aktivitas_field_values.fieldid IS 'Reference to the field definition';
COMMENT ON COLUMN public.aktivitas_field_values.value IS 'The submitted value (stored as text)';

-- Table: aktivitas_field_images
-- Purpose: Store image/file references from Cloudinary
CREATE TABLE IF NOT EXISTS public.aktivitas_field_images (
  imageid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activityid UUID REFERENCES public.aktivitas(activityid) ON DELETE CASCADE,
  fieldid UUID REFERENCES public.category_fields(fieldid) ON DELETE CASCADE,
  filename VARCHAR(255),
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  content_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aktivitas_field_images_activityid ON public.aktivitas_field_images(activityid);
CREATE INDEX IF NOT EXISTS idx_aktivitas_field_images_fieldid ON public.aktivitas_field_images(fieldid);
CREATE INDEX IF NOT EXISTS idx_aktivitas_field_images_public_id ON public.aktivitas_field_images(cloudinary_public_id);

COMMENT ON TABLE public.aktivitas_field_images IS 'Stores image/file references uploaded to Cloudinary';
COMMENT ON COLUMN public.aktivitas_field_images.imageid IS 'Unique image record identifier';
COMMENT ON COLUMN public.aktivitas_field_images.activityid IS 'Reference to the activity';
COMMENT ON COLUMN public.aktivitas_field_images.fieldid IS 'Reference to the image field';
COMMENT ON COLUMN public.aktivitas_field_images.filename IS 'Original filename';
COMMENT ON COLUMN public.aktivitas_field_images.cloudinary_url IS 'Public URL to access the file';
COMMENT ON COLUMN public.aktivitas_field_images.cloudinary_public_id IS 'Cloudinary identifier for programmatic access/deletion';
COMMENT ON COLUMN public.aktivitas_field_images.content_type IS 'MIME type of the file';

-- ============================================================================
-- SECTION 4: COMMENTS AND FEEDBACK
-- ============================================================================

-- Table: komentar
-- Purpose: Store teacher/parent feedback on student activities
CREATE TABLE IF NOT EXISTS public.komentar (
  komentarid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siswaid UUID REFERENCES public.users(id),  -- Student being commented on
  userid UUID REFERENCES public.users(id),   -- Comment author
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleteat TIMESTAMP WITH TIME ZONE         -- Soft delete timestamp
);

CREATE INDEX IF NOT EXISTS idx_komentar_siswaid ON public.komentar(siswaid);
CREATE INDEX IF NOT EXISTS idx_komentar_userid ON public.komentar(userid);
CREATE INDEX IF NOT EXISTS idx_komentar_deleteat ON public.komentar(deleteat) WHERE deleteat IS NULL;
CREATE INDEX IF NOT EXISTS idx_komentar_created_at ON public.komentar(created_at DESC);

COMMENT ON TABLE public.komentar IS 'Comments and feedback on student activities';
COMMENT ON COLUMN public.komentar.komentarid IS 'Unique comment identifier';
COMMENT ON COLUMN public.komentar.siswaid IS 'Student being commented on';
COMMENT ON COLUMN public.komentar.userid IS 'User who wrote the comment (teacher/parent)';
COMMENT ON COLUMN public.komentar.content IS 'Comment text';
COMMENT ON COLUMN public.komentar.deleteat IS 'Soft delete timestamp (NULL = active, timestamp = deleted)';

-- ============================================================================
-- SECTION 5: SYSTEM CONFIGURATION
-- ============================================================================

-- Table: submission_window
-- Purpose: Control when students can submit activities (global toggle)
CREATE TABLE IF NOT EXISTS public.submission_window (
  id INTEGER PRIMARY KEY DEFAULT 1,
  is_open BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id),
  CHECK (id = 1)  -- Ensure only one row exists
);

-- Insert default row
INSERT INTO public.submission_window (id, is_open) VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.submission_window IS 'Global submission window control (single row table)';
COMMENT ON COLUMN public.submission_window.id IS 'Always 1 (enforced by CHECK constraint)';
COMMENT ON COLUMN public.submission_window.is_open IS 'Whether students can submit activities';
COMMENT ON COLUMN public.submission_window.updated_at IS 'Last time the window was toggled';
COMMENT ON COLUMN public.submission_window.updated_by IS 'Admin who last changed the setting';

-- ============================================================================
-- SECTION 6: TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kegiatan_updated_at
    BEFORE UPDATE ON public.kegiatan
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_aktivitas_updated_at
    BEFORE UPDATE ON public.aktivitas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_komentar_updated_at
    BEFORE UPDATE ON public.komentar
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_submission_window_updated_at
    BEFORE UPDATE ON public.submission_window
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function: Sync email from users to user_profiles
-- This keeps the denormalized email field in sync
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- When a new user is created, create their profile
        INSERT INTO public.user_profiles (userid, email)
        VALUES (NEW.id, NEW.email)
        ON CONFLICT (userid) DO UPDATE SET email = NEW.email;
    ELSIF TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN
        -- When email changes, update profile
        UPDATE public.user_profiles
        SET email = NEW.email
        WHERE userid = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_user_email_to_profile
    AFTER INSERT OR UPDATE OF email ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_email();

-- ============================================================================
-- SECTION 7: VIEWS FOR CONVENIENCE
-- ============================================================================

-- View: users_with_profiles
-- Purpose: Convenient view joining users with their profiles
CREATE OR REPLACE VIEW public.users_with_profiles AS
SELECT 
    u.id,
    u.email,
    u.email_confirmed,
    u.last_sign_in_at,
    u.created_at as user_created_at,
    u.updated_at as user_updated_at,
    p.username,
    p.roleid,
    r.rolename,
    p.kelas,
    p.parent_of_userid,
    p.created_at as profile_created_at,
    p.updated_at as profile_updated_at
FROM public.users u
LEFT JOIN public.user_profiles p ON u.id = p.userid
LEFT JOIN public.role r ON p.roleid = r.roleid;

COMMENT ON VIEW public.users_with_profiles IS 'Convenient view joining users with profiles and roles';

-- ============================================================================
-- SECTION 8: INITIAL DATA SETUP (Optional)
-- ============================================================================

-- Example: Create default admin user (uncomment and modify as needed)
/*
-- Hash your password first using bcrypt or argon2
-- Example with bcrypt (cost factor 10): $2b$10$...

INSERT INTO public.users (id, email, password_hash, email_confirmed) VALUES
  (gen_random_uuid(), 'admin@example.com', '$2b$10$YourHashedPasswordHere', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Then create the profile
INSERT INTO public.user_profiles (userid, username, roleid)
SELECT id, 'Administrator', 1
FROM public.users
WHERE email = 'admin@example.com'
ON CONFLICT (userid) DO NOTHING;
*/

-- Example: Create default categories (uncomment if needed)
/*
INSERT INTO public.category (categoryname) VALUES
  ('Prayer Details'),
  ('Reading Details'),
  ('Exercise Details'),
  ('Reflection'),
  ('Location')
ON CONFLICT (categoryname) DO NOTHING;
*/

-- ============================================================================
-- SECTION 9: GRANTS AND PERMISSIONS
-- ============================================================================

-- Note: Adjust these permissions based on your application's authentication strategy
-- For application-level authentication, the application user typically needs full access

-- Grant basic permissions (adjust based on your needs)
-- GRANT USAGE ON SCHEMA public TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
-- 
-- This PostgreSQL standalone schema includes:
-- - 12 core tables (including users table for authentication)
-- - Proper indexes for performance
-- - Foreign key constraints for data integrity
-- - Triggers for automatic timestamp updates and email sync
-- - Convenient view for user data access
-- - Comments for documentation
--
-- Key Differences from Supabase Version:
-- - Uses public.users instead of auth.users
-- - Includes password_hash and authentication fields
-- - Email confirmation and password reset support
-- - Auto-sync email between users and user_profiles
-- - No Row Level Security (implement in application layer)
--
-- Security Notes:
-- - Passwords should be hashed using bcrypt or argon2
-- - Implement authentication in your application layer
-- - Consider using session management (e.g., JWT, sessions table)
-- - Add additional security measures as needed
--
-- Next Steps:
-- 1. Run this schema in your PostgreSQL database
-- 2. Implement password hashing in your application (bcrypt/argon2)
-- 3. Create authentication endpoints (login, register, reset password)
-- 4. Set up session management
-- 5. Test the schema with sample data
--
-- For more information, see:
-- - DATABASE.md - Comprehensive database guide
-- - BACKEND.md - Backend architecture and implementation
-- - API.md - API endpoints and usage
-- ============================================================================
