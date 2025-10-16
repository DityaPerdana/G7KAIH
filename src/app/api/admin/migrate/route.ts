import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/utils/supabase/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify the user is authenticated and has admin role
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: "Unauthorized: Authentication required" 
      }, { status: 401 })
    }

    // Check if user has admin role (roleid = 1)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('roleid')
      .eq('userid', user.id)
      .single()

    if (profileError || !profile || profile.roleid !== 1) {
      return NextResponse.json({ 
        success: false, 
        error: "Forbidden: Admin access required" 
      }, { status: 403 })
    }

    // Create admin client only after authorization check
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create aktivitas_field_files table
    const { data, error } = await adminClient.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.aktivitas_field_files (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          activityid uuid NOT NULL,
          fieldid uuid NOT NULL,
          filename text NOT NULL,
          content_type text NOT NULL,
          file_bytes bytea NOT NULL,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );

        -- Add indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_aktivitas_field_files_activityid ON public.aktivitas_field_files(activityid);
        CREATE INDEX IF NOT EXISTS idx_aktivitas_field_files_fieldid ON public.aktivitas_field_files(fieldid);

        -- Add RLS policies if needed
        ALTER TABLE public.aktivitas_field_files ENABLE ROW LEVEL SECURITY;

        -- Allow read access for authenticated users
        CREATE POLICY IF NOT EXISTS "Allow read access for authenticated users" ON public.aktivitas_field_files
          FOR SELECT USING (auth.role() = 'authenticated');

        -- Allow insert for authenticated users
        CREATE POLICY IF NOT EXISTS "Allow insert for authenticated users" ON public.aktivitas_field_files
          FOR INSERT WITH CHECK (auth.role() = 'authenticated');
      `
    })

    if (error) {
      console.error('Migration error:', error)
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'aktivitas_field_files table created successfully',
      data 
    })

  } catch (err: any) {
    console.error('Migration error:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 })
  }
}
