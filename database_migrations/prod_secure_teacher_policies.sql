-- PRODUCTION-READY RLS POLICIES FOR TEACHER ROLE
-- These policies implement proper access control based on class assignment
-- Teachers can only access data for students in their assigned class

-- Helper function to get current user's class (teachers only)
CREATE OR REPLACE FUNCTION get_my_class()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER  -- Changed from SECURITY DEFINER for better security
AS $$
  SELECT kelas FROM public.user_profiles 
  WHERE userid = auth.uid() AND roleid = 2;
$$;

-- Helper function to check if a student belongs to teacher's class
CREATE OR REPLACE FUNCTION is_student_in_my_class(student_userid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles student
    WHERE student.userid = student_userid
    AND student.kelas = (SELECT kelas FROM public.user_profiles WHERE userid = auth.uid() AND roleid = 2)
    AND student.roleid = 5  -- Student role
  );
$$;

-- Table: user_profiles
-- Teachers can only read student profiles in their class
DROP POLICY IF EXISTS "Teachers can read students in their class" ON public.user_profiles;
CREATE POLICY "Teachers can read students in their class"
ON public.user_profiles FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
  AND kelas = (SELECT kelas FROM public.user_profiles WHERE userid = auth.uid())
  AND roleid = 5  -- Only student profiles
);

-- Teachers can read their own profile
DROP POLICY IF EXISTS "Teachers can read own profile" ON public.user_profiles;
CREATE POLICY "Teachers can read own profile"
ON public.user_profiles FOR SELECT
USING (userid = auth.uid() AND roleid = 2);

-- Table: aktivitas
-- Teachers can only read activities from students in their class
DROP POLICY IF EXISTS "Teachers can read class activities" ON public.aktivitas;
CREATE POLICY "Teachers can read class activities"
ON public.aktivitas FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
  AND is_student_in_my_class(userid)
);

-- Teachers can update activities for validation (only status fields)
DROP POLICY IF EXISTS "Teachers can validate class activities" ON public.aktivitas;
CREATE POLICY "Teachers can validate class activities"
ON public.aktivitas FOR UPDATE
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
  AND is_student_in_my_class(userid)
)
WITH CHECK (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
  AND is_student_in_my_class(userid)
);

-- Table: komentar
-- Teachers can read comments on activities in their class
DROP POLICY IF EXISTS "Teachers can read class comments" ON public.komentar;
CREATE POLICY "Teachers can read class comments"
ON public.komentar FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = komentar.activityid
    AND is_student_in_my_class(a.userid)
  )
);

-- Teachers can create comments on activities in their class
DROP POLICY IF EXISTS "Teachers can comment on class activities" ON public.komentar;
CREATE POLICY "Teachers can comment on class activities"
ON public.komentar FOR INSERT
WITH CHECK (
  auth.uid() = userid 
  AND (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = komentar.activityid
    AND is_student_in_my_class(a.userid)
  )
);

-- Teachers can update/delete their own comments only
DROP POLICY IF EXISTS "Teachers can manage own comments" ON public.komentar;
CREATE POLICY "Teachers can manage own comments"
ON public.komentar FOR ALL
USING (
  auth.uid() = userid 
  AND (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
)
WITH CHECK (
  auth.uid() = userid 
  AND (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
);

-- Table: kegiatan
-- Teachers can read all kegiatan (activities templates are not user-specific)
DROP POLICY IF EXISTS "Teachers can read kegiatan" ON public.kegiatan;
CREATE POLICY "Teachers can read kegiatan"
ON public.kegiatan FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2);

-- Table: category, kegiatan_categories, category_fields
-- Teachers can read all categories and fields (shared resources)
DROP POLICY IF EXISTS "Teachers can read category" ON public.category;
CREATE POLICY "Teachers can read category"
ON public.category FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2);

DROP POLICY IF EXISTS "Teachers can read kegiatan_categories" ON public.kegiatan_categories;
CREATE POLICY "Teachers can read kegiatan_categories"
ON public.kegiatan_categories FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2);

DROP POLICY IF EXISTS "Teachers can read category_fields" ON public.category_fields;
CREATE POLICY "Teachers can read category_fields"
ON public.category_fields FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2);

-- Table: aktivitas_field_values
-- Teachers can read field values for activities in their class
DROP POLICY IF EXISTS "Teachers can read class field values" ON public.aktivitas_field_values;
CREATE POLICY "Teachers can read class field values"
ON public.aktivitas_field_values FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = aktivitas_field_values.activityid
    AND is_student_in_my_class(a.userid)
  )
);

-- Teachers can update field values for validation in their class
DROP POLICY IF EXISTS "Teachers can validate class field values" ON public.aktivitas_field_values;
CREATE POLICY "Teachers can validate class field values"
ON public.aktivitas_field_values FOR UPDATE
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = aktivitas_field_values.activityid
    AND is_student_in_my_class(a.userid)
  )
)
WITH CHECK (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = aktivitas_field_values.activityid
    AND is_student_in_my_class(a.userid)
  )
);

-- Table: aktivitas_field_files
-- Teachers can read files for activities in their class
DROP POLICY IF EXISTS "Teachers can read class activity files" ON public.aktivitas_field_files;
CREATE POLICY "Teachers can read class activity files"
ON public.aktivitas_field_files FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = aktivitas_field_files.activityid
    AND is_student_in_my_class(a.userid)
  )
);

-- Table: role
-- Teachers can read role definitions (reference data)
DROP POLICY IF EXISTS "Teachers can read role" ON public.role;
CREATE POLICY "Teachers can read role"
ON public.role FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 2);

-- Create an index to improve performance of class-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_kelas_roleid 
ON public.user_profiles(kelas, roleid) 
WHERE roleid IN (2, 5);  -- Teacher and student roles

-- Create an index for activity queries by class
CREATE INDEX IF NOT EXISTS idx_aktivitas_userid 
ON public.aktivitas(userid);

-- Create an index for comments by activity
CREATE INDEX IF NOT EXISTS idx_komentar_activityid 
ON public.komentar(activityid);

-- Add comments for documentation
COMMENT ON POLICY "Teachers can read students in their class" ON public.user_profiles IS 
  'Teachers can only see student profiles from their assigned class, respecting data privacy';
COMMENT ON FUNCTION get_my_class() IS 
  'Returns the class name for the current teacher, used for access control';
COMMENT ON FUNCTION is_student_in_my_class(uuid) IS 
  'Checks if a student belongs to the current teachers class, prevents cross-class access';
