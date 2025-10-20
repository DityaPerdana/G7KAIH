import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const studentId = resolvedParams.id
    
    // Get current user to verify they are a guru wali
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify current user is a guru wali and this student is assigned to them
    const { data: studentProfile, error: studentError } = await supabase
      .from('user_profiles')
      .select('userid, guruwali_userid, roleid')
      .eq('userid', studentId)
      .eq('roleid', 5) // Must be a student
      .eq('guruwali_userid', user.id) // Must be assigned to current guru wali
      .single()

    if (studentError || !studentProfile) {
      return NextResponse.json({ 
        error: "Student not found or not assigned to you" 
      }, { status: 404 })
    }

    // Use the same logic as teacher details but with guruwali access control
    const adminClient = await createAdminClient()

    // Get activities with all related data
    const { data: activities, error: activitiesError } = await adminClient
      .from('aktivitas')
      .select(`
        activityid,
        userid,
        created_at,
        kegiatan:kegiatanid (
          kegiatanid,
          kegiatanname
        ),
        category:categoryid (
          categoryid,
          categoryname
        ),
        aktivitas_field_values (
          id,
          fieldid,
          value,
          created_at,
          updated_at,
          isvalidatebyteacher,
          isvalidatebyparent,
          field:fieldid (
            fieldid,
            label,
            type,
            required
          )
        )
      `)
      .eq('userid', studentId)
      .order('created_at', { ascending: false })

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
      return NextResponse.json({ 
        error: "Failed to fetch activities",
        debug: activitiesError
      }, { status: 500 })
    }

    // Fetch images separately for all activities
    const activityIds = (activities || []).map(activity => activity.activityid)
    let images: any[] = []
    
    if (activityIds.length > 0) {
      const { data: imagesData, error: imagesError } = await adminClient
        .from('aktivitas_field_images')
        .select('id, activityid, fieldid, filename, cloudinary_url')
        .in('activityid', activityIds)
      
      if (!imagesError) {
        images = imagesData || []
      }
    }

    // Transform the data to match the expected format
    const transformedActivities = (activities || []).map(activity => {
      const kegiatan = Array.isArray(activity.kegiatan) ? activity.kegiatan[0] : activity.kegiatan
      const category = Array.isArray(activity.category) ? activity.category[0] : activity.category
      
      const field_values = (activity.aktivitas_field_values || []).map((fv: any) => {
        // Find images for this specific field value
        const fieldImages = images.filter(img => 
          img.activityid === activity.activityid && img.fieldid === fv.fieldid
        )
        
        const field = Array.isArray(fv.field) ? fv.field[0] : fv.field
        
        const teacherValidated = Boolean(fv.isvalidatebyteacher)
        const parentValidated = Boolean(fv.isvalidatebyparent)

        return {
          id: fv.id,
          field: {
            id: field?.fieldid,
            label: field?.label || 'Unknown Field',
            type: field?.type || 'text',
            required: field?.required || false
          },
          value: fv.value,
          files: fieldImages.map((file: any) => ({
            id: file.id,
            filename: file.filename,
            url: file.cloudinary_url
          })),
          validation: {
            status: teacherValidated && parentValidated ? 'fully_validated' :
                    teacherValidated ? 'teacher_validated' :
                    parentValidated ? 'parent_validated' : 'pending',
            byTeacher: teacherValidated,
            byParent: parentValidated
          },
          created_at: fv.created_at,
          updated_at: fv.updated_at
        }
      })
      
      return {
        id: activity.activityid,
        activityid: activity.activityid,
        student_id: activity.userid,
        kegiatan_id: kegiatan?.kegiatanid,
        category_id: category?.categoryid,
        submission_date: activity.created_at,
        created_at: activity.created_at,
        student_name: studentProfile.userid, // Will be filled by parent component
        kegiatan_name: kegiatan?.kegiatanname || 'Unknown Activity',
        field_values
      }
    })

    return NextResponse.json({
      success: true,
      data: transformedActivities
    })

  } catch (error) {
    console.error('GuruWali student details API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
