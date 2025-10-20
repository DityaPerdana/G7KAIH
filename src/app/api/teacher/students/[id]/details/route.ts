import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a teacher
    const { data: userProfile } = await adminSupabase
      .from('user_profiles')
      .select('roleid')
      .eq('userid', user.id)
      .single()

    const { data: role } = await adminSupabase
      .from('role')
      .select('rolename')
      .eq('roleid', userProfile?.roleid)
      .single()

    if (role?.rolename !== 'teacher' && role?.rolename !== 'guruwali') {
      return NextResponse.json({ error: 'Forbidden - Only teachers can access this data' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const kegiatanId = searchParams.get('kegiatanId')
    const categoryId = searchParams.get('categoryId')

    // Get student info
    const { data: studentProfile } = await adminSupabase
      .from('user_profiles')
      .select('userid, username')
      .eq('userid', studentId)
      .single()

    if (!studentProfile) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    console.log('Debug: Starting query for student:', studentId)

    // Build query for activities using admin client to bypass RLS
    let activitiesQuery = adminSupabase
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

    console.log('Debug: Query built for student:', studentId)

    // Apply filters
    if (startDate) {
      activitiesQuery = activitiesQuery.gte('created_at', startDate)
    }
    if (endDate) {
      activitiesQuery = activitiesQuery.lte('created_at', endDate)
    }
    if (kegiatanId) {
      activitiesQuery = activitiesQuery.eq('kegiatanid', kegiatanId)
    }
    if (categoryId) {
      activitiesQuery = activitiesQuery.eq('categoryid', categoryId)
    }

    const { data: activities, error: activitiesError } = await activitiesQuery

    console.log('Debug: Activities query result:', {
      error: activitiesError,
      activitiesCount: activities?.length || 0,
      firstActivity: activities?.[0]
    })

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
      return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
    }

    // Fetch images separately for all activities
    const activityIds = (activities || []).map(activity => activity.activityid)
    let images: any[] = []
    
    if (activityIds.length > 0) {
      const { data: imagesData, error: imagesError } = await adminSupabase
        .from('aktivitas_field_images')
        .select('id, activityid, fieldid, filename, cloudinary_url')
        .in('activityid', activityIds)
      
      if (!imagesError) {
        images = imagesData || []
      }
    }

    const activitiesWithFieldValues = (activities || []).map(activity => {
      const field_values = (activity.aktivitas_field_values || []).map((fv: any) => {
        const teacherValidated = Boolean(fv.isvalidatebyteacher)
        const parentValidated = Boolean(fv.isvalidatebyparent)
        // Find images for this specific field value
        const fieldImages = images.filter(img => 
          img.activityid === activity.activityid && img.fieldid === fv.fieldid
        )
        
        return {
          ...fv,
          files: fieldImages.map((file: any) => ({
            id: file.id,
            filename: file.filename,
            url: file.cloudinary_url
          })),
          validation: {
            status: teacherValidated && parentValidated
              ? 'fully_validated'
              : teacherValidated
              ? 'teacher_validated'
              : parentValidated
              ? 'parent_validated'
              : 'pending',
            byTeacher: teacherValidated,
            byParent: parentValidated
          }
        }
      })

      return {
        ...activity,
        id: activity.activityid, // Map activityid to id for frontend consistency
        student_name: studentProfile.username || `Siswa ${studentId.slice(0, 8)}`,
        kegiatan_name: (activity.kegiatan as any)?.kegiatanname || 'Kegiatan Tidak Diketahui',
        submission_date: activity.created_at,
        field_values,
      }
    })

    return NextResponse.json({
      success: true,
      data: activitiesWithFieldValues,
      student: {
        id: studentId,
        name: studentProfile.username || `Siswa ${studentId.slice(0, 8)}`
      },
      debug: {
        activitiesCount: activities?.length || 0,
        activitiesWithFieldValuesCount: activitiesWithFieldValues.length,
        firstActivity: activitiesWithFieldValues[0],
        studentId,
        studentProfile
      }
    })

  } catch (error) {
    console.error('Error in teacher activities details API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
