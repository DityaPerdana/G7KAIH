-- PRODUCTION-READY RLS POLICIES FOR PARENT ROLE
-- These policies ensure parents can only access their own children's data
-- Assumes a parent_student_relations table exists linking parents to students

-- Helper function to check if a student is the parent's child
CREATE OR REPLACE FUNCTION is_my_child(student_userid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_student_relations
    WHERE parent_id = auth.uid() 
    AND student_id = student_userid
  );
$$;

-- Helper function to get parent's children IDs
CREATE OR REPLACE FUNCTION get_my_children_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT student_id FROM public.parent_student_relations
  WHERE parent_id = auth.uid();
$$;

-- Table: user_profiles
-- Parents can only read their own children's profiles
DROP POLICY IF EXISTS "Parents can read own children profiles" ON public.user_profiles;
CREATE POLICY "Parents can read own children profiles"
ON public.user_profiles FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4
  AND userid IN (SELECT get_my_children_ids())
);

-- Parents can read their own profile
DROP POLICY IF EXISTS "Parents can read own profile" ON public.user_profiles;
CREATE POLICY "Parents can read own profile"
ON public.user_profiles FOR SELECT
USING (userid = auth.uid() AND roleid = 4);

-- Table: aktivitas
-- Parents can only read activities from their children
DROP POLICY IF EXISTS "Parents can read children activities" ON public.aktivitas;
CREATE POLICY "Parents can read children activities"
ON public.aktivitas FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4
  AND userid IN (SELECT get_my_children_ids())
);

-- Table: komentar
-- Parents can read comments on their children's activities
DROP POLICY IF EXISTS "Parents can read children comments" ON public.komentar;
CREATE POLICY "Parents can read children comments"
ON public.komentar FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = komentar.activityid
    AND a.userid IN (SELECT get_my_children_ids())
  )
);

-- Parents can create comments on their children's activities
DROP POLICY IF EXISTS "Parents can comment on children activities" ON public.komentar;
CREATE POLICY "Parents can comment on children activities"
ON public.komentar FOR INSERT
WITH CHECK (
  auth.uid() = userid 
  AND (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = komentar.activityid
    AND a.userid IN (SELECT get_my_children_ids())
  )
);

-- Parents can update/delete their own comments only
DROP POLICY IF EXISTS "Parents can manage own comments" ON public.komentar;
CREATE POLICY "Parents can manage own comments"
ON public.komentar FOR ALL
USING (
  auth.uid() = userid 
  AND (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4
)
WITH CHECK (
  auth.uid() = userid 
  AND (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4
);

-- Table: kegiatan
-- Parents can read all kegiatan (activity templates are not user-specific)
DROP POLICY IF EXISTS "Parents can read kegiatan" ON public.kegiatan;
CREATE POLICY "Parents can read kegiatan"
ON public.kegiatan FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4);

-- Table: category, kegiatan_categories, category_fields
-- Parents can read all categories and fields (shared resources)
DROP POLICY IF EXISTS "Parents can read category" ON public.category;
CREATE POLICY "Parents can read category"
ON public.category FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4);

DROP POLICY IF EXISTS "Parents can read kegiatan_categories" ON public.kegiatan_categories;
CREATE POLICY "Parents can read kegiatan_categories"
ON public.kegiatan_categories FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4);

DROP POLICY IF EXISTS "Parents can read category_fields" ON public.category_fields;
CREATE POLICY "Parents can read category_fields"
ON public.category_fields FOR SELECT
USING ((SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4);

-- Table: aktivitas_field_values
-- Parents can read field values for their children's activities
DROP POLICY IF EXISTS "Parents can read children field values" ON public.aktivitas_field_values;
CREATE POLICY "Parents can read children field values"
ON public.aktivitas_field_values FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = aktivitas_field_values.activityid
    AND a.userid IN (SELECT get_my_children_ids())
  )
);

-- Table: aktivitas_field_files
-- Parents can read files for their children's activities
DROP POLICY IF EXISTS "Parents can read children activity files" ON public.aktivitas_field_files;
CREATE POLICY "Parents can read children activity files"
ON public.aktivitas_field_files FOR SELECT
USING (
  (SELECT roleid FROM public.user_profiles WHERE userid = auth.uid()) = 4
  AND EXISTS (
    SELECT 1 FROM public.aktivitas a
    WHERE a.activityid = aktivitas_field_files.activityid
    AND a.userid IN (SELECT get_my_children_ids())
  )
);

-- Create an index to improve performance of parent-child relationship queries
CREATE INDEX IF NOT EXISTS idx_parent_student_relations_parent_id 
ON public.parent_student_relations(parent_id);

CREATE INDEX IF NOT EXISTS idx_parent_student_relations_student_id 
ON public.parent_student_relations(student_id);

-- Add comments for documentation
COMMENT ON POLICY "Parents can read own children profiles" ON public.user_profiles IS 
  'Parents can only see their own children profiles via parent_student_relations table';
COMMENT ON FUNCTION is_my_child(uuid) IS 
  'Checks if a student is linked to the current parent, prevents unauthorized access';
COMMENT ON FUNCTION get_my_children_ids() IS 
  'Returns the set of student IDs linked to the current parent for access control';
