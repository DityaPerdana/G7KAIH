-- PRODUCTION-READY RLS POLICIES FOR GURUWALI (HOMEROOM TEACHER) ROLE
-- These policies implement proper access control based on class supervision
-- Guruwali can only access data for students in their supervised classes

-- Helper function to get classes supervised by current guruwali
CREATE OR REPLACE FUNCTION get_my_supervised_classes()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT DISTINCT supervised_class 
  FROM public.guruwali_supervision
  WHERE guruwali_id = auth.uid();
$$;

-- Helper function to check if a student is in supervised class
CREATE OR REPLACE FUNCTION is_student_in_supervised_class(student_userid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles student
    WHERE student.userid = student_userid
    AND student.kelas IN (SELECT get_my_supervised_classes())
    AND student.roleid = 5  -- Student role
  );
$$;

-- Table: user_profiles
-- Guruwali can only read student profiles in their supervised classes
DROP POLICY IF EXISTS "Guruwali can read supervised students" ON public.user_profiles;
CREATE POLICY "Guruwali can read supervised students"
ON public.user_profiles FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
  AND kelas IN (SELECT get_my_supervised_classes())
  AND roleid = 5  -- Only student profiles
);

-- Guruwali can read their own profile
DROP POLICY IF EXISTS "Guruwali can read own profile" ON public.user_profiles;
CREATE POLICY "Guruwali can read own profile"
ON public.user_profiles FOR SELECT
USING (userid = auth.uid() AND roleid = 6);

-- Guruwali can read teachers in their supervised classes (for coordination)
DROP POLICY IF EXISTS "Guruwali can read class teachers" ON public.user_profiles;
CREATE POLICY "Guruwali can read class teachers"
ON public.user_profiles FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
  AND roleid = 2  -- Teacher role
  AND kelas IN (SELECT get_my_supervised_classes())
);

-- Table: aktivitas
-- Guruwali can only read activities from students in supervised classes
DROP POLICY IF EXISTS "Guruwali can read supervised activities" ON public.aktivitas;
CREATE POLICY "Guruwali can read supervised activities"
ON public.aktivitas FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
  AND is_student_in_supervised_class(userid)
);

-- Guruwali can update activities for validation (supervisor level)
DROP POLICY IF EXISTS "Guruwali can validate supervised activities" ON public.aktivitas;
CREATE POLICY "Guruwali can validate supervised activities"
ON public.aktivitas FOR UPDATE
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
  AND is_student_in_supervised_class(userid)
)
WITH CHECK (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
  AND is_student_in_supervised_class(userid)
);

-- Table: komentar
-- Guruwali can read comments on activities in supervised classes
DROP POLICY IF EXISTS "Guruwali can read supervised comments" ON public.komentar;
CREATE POLICY "Guruwali can read supervised comments"
ON public.komentar FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = komentar.activityid
    AND is_student_in_supervised_class(a.userid)
  )
);

-- Guruwali can create comments on activities in supervised classes
DROP POLICY IF EXISTS "Guruwali can comment on supervised activities" ON public.komentar;
CREATE POLICY "Guruwali can comment on supervised activities"
ON public.komentar FOR INSERT
WITH CHECK (
  auth.uid() = userid 
  AND (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = komentar.activityid
    AND is_student_in_supervised_class(a.userid)
  )
);

-- Guruwali can update/delete their own comments only
DROP POLICY IF EXISTS "Guruwali can manage own comments" ON public.komentar;
CREATE POLICY "Guruwali can manage own comments"
ON public.komentar FOR ALL
USING (
  auth.uid() = userid 
  AND (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
)
WITH CHECK (
  auth.uid() = userid 
  AND (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
);

-- Table: kegiatan
-- Guruwali can read all kegiatan (activities templates are not user-specific)
DROP POLICY IF EXISTS "Guruwali can read kegiatan" ON public.kegiatan;
CREATE POLICY "Guruwali can read kegiatan"
ON public.kegiatan FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6);

-- Table: category, kegiatan_categories, category_fields
-- Guruwali can read all categories and fields (shared resources)
DROP POLICY IF EXISTS "Guruwali can read category" ON public.category;
CREATE POLICY "Guruwali can read category"
ON public.category FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6);

DROP POLICY IF EXISTS "Guruwali can read kegiatan_categories" ON public.kegiatan_categories;
CREATE POLICY "Guruwali can read kegiatan_categories"
ON public.kegiatan_categories FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6);

DROP POLICY IF EXISTS "Guruwali can read category_fields" ON public.category_fields;
CREATE POLICY "Guruwali can read category_fields"
ON public.category_fields FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6);

-- Table: aktivitas_field_values
-- Guruwali can read field values for activities in supervised classes
DROP POLICY IF EXISTS "Guruwali can read supervised field values" ON public.aktivitas_field_values;
CREATE POLICY "Guruwali can read supervised field values"
ON public.aktivitas_field_values FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = aktivitas_field_values.activityid
    AND is_student_in_supervised_class(a.userid)
  )
);

-- Guruwali can update field values for validation in supervised classes
DROP POLICY IF EXISTS "Guruwali can validate supervised field values" ON public.aktivitas_field_values;
CREATE POLICY "Guruwali can validate supervised field values"
ON public.aktivitas_field_values FOR UPDATE
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = aktivitas_field_values.activityid
    AND is_student_in_supervised_class(a.userid)
  )
)
WITH CHECK (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = aktivitas_field_values.activityid
    AND is_student_in_supervised_class(a.userid)
  )
);

-- Table: aktivitas_field_files
-- Guruwali can read files for activities in supervised classes
DROP POLICY IF EXISTS "Guruwali can read supervised activity files" ON public.aktivitas_field_files;
CREATE POLICY "Guruwali can read supervised activity files"
ON public.aktivitas_field_files FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = aktivitas_field_files.activityid
    AND is_student_in_supervised_class(a.userid)
  )
);

-- Table: role
-- Guruwali can read role definitions (reference data)
DROP POLICY IF EXISTS "Guruwali can read role" ON public.role;
CREATE POLICY "Guruwali can read role"
ON public.role FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 6);

-- Create an index to improve performance of supervision queries
CREATE INDEX IF NOT EXISTS idx_guruwali_supervision_guruwali_id 
ON public.guruwali_supervision(guruwali_id);

CREATE INDEX IF NOT EXISTS idx_guruwali_supervision_supervised_class 
ON public.guruwali_supervision(supervised_class);

-- Add comments for documentation
COMMENT ON POLICY "Guruwali can read supervised students" ON public.user_profiles IS 
  'Guruwali can only see student profiles from classes they supervise';
COMMENT ON FUNCTION get_my_supervised_classes() IS 
  'Returns the classes supervised by the current guruwali for access control';
COMMENT ON FUNCTION is_student_in_supervised_class(uuid) IS 
  'Checks if a student belongs to a class supervised by current guruwali';
