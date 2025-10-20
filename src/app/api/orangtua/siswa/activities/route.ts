import { getStudentRoleIds, isAdminRole, isParentRole, isStudentRole } from "@/utils/lib/roles"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET: /api/orangtua/siswa/activities - Get student's activity field values for parent
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use admin client for reliable data access
    const adminClient = await createAdminClient()

    // Get current user profile and role info
    const { data: parentProfile, error: parentError } = await adminClient
      .from("user_profiles")
      .select("userid, username, roleid, parent_of_userid")
      .eq("userid", user.id)
      .single()

    if (parentError || !parentProfile) {
      return NextResponse.json({ 
        error: "Access denied: Only parents can access this endpoint"
      }, { status: 403 })
    }

    const actingAsParent = isParentRole(parentProfile.roleid)
    const actingAsAdmin = isAdminRole(parentProfile.roleid)

    if (!actingAsParent && !actingAsAdmin) {
      return NextResponse.json({ 
        error: "Access denied: Only parents can access this endpoint"
      }, { status: 403 })
    }

    // Get query parameters for filtering
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get("page") || 1))
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 20)))
    const validationStatus = url.searchParams.get("validationStatus") // 'pending', 'teacher', 'parent', 'both'
    const requestedStudentId = url.searchParams.get("studentId")?.trim() || null
    const offset = (page - 1) * limit

    if (actingAsParent) {
      if (!parentProfile.parent_of_userid) {
        return NextResponse.json({ 
          error: "No student linked to this parent account"
        }, { status: 400 })
      }

      if (requestedStudentId && requestedStudentId !== parentProfile.parent_of_userid) {
        return NextResponse.json({
          error: "Access denied: Cannot view other students"
        }, { status: 403 })
      }
    }

    const effectiveStudentId = actingAsParent
      ? parentProfile.parent_of_userid
      : requestedStudentId || parentProfile.parent_of_userid || null

    if (!effectiveStudentId) {
      return NextResponse.json({ 
        error: "No student specified for activity lookup"
      }, { status: 400 })
    }

    // Verify student exists
    const studentRoleIds = getStudentRoleIds()

    const { data: studentProfile, error: studentError } = await adminClient
      .from("user_profiles")
      .select("userid, username, email, kelas, roleid")
      .eq("userid", effectiveStudentId)
      .in("roleid", studentRoleIds.length ? studentRoleIds : [-1])
      .single()

    if (studentError || !studentProfile || !isStudentRole(studentProfile.roleid)) {
      return NextResponse.json({ 
        error: "Student not found or invalid"
      }, { status: 404 })
    }

    // Step 1: Get field values with basic aktivitas info
    let fieldValuesQuery = adminClient
      .from("aktivitas_field_values")
      .select(`
        id,
        activityid,
        fieldid,
        value,
        isvalidatebyteacher,
        isvalidatebyparent,
        created_at,
        updated_at
      `)

    // Apply validation status filter
    if (validationStatus) {
      switch (validationStatus) {
        case 'pending':
          fieldValuesQuery = fieldValuesQuery.eq("isvalidatebyteacher", false).eq("isvalidatebyparent", false)
          break
        case 'teacher':
          fieldValuesQuery = fieldValuesQuery.eq("isvalidatebyteacher", true).eq("isvalidatebyparent", false)
          break
        case 'parent':
          fieldValuesQuery = fieldValuesQuery.eq("isvalidatebyteacher", false).eq("isvalidatebyparent", true)
          break
        case 'both':
          fieldValuesQuery = fieldValuesQuery.eq("isvalidatebyteacher", true).eq("isvalidatebyparent", true)
          break
      }
    }

    // First get all field values to filter by student's activities
    const { data: allFieldValues, error: fieldValuesError } = await fieldValuesQuery
      .order("created_at", { ascending: false })

    if (fieldValuesError) {
      console.error("Error fetching field values:", fieldValuesError)
      return NextResponse.json({ 
        error: "Failed to fetch field values"
      }, { status: 500 })
    }

    console.log('Raw field values fetched:', allFieldValues?.length || 0);
    console.log('Sample field values:', allFieldValues?.slice(0, 2));

    if (!allFieldValues || allFieldValues.length === 0) {
      return NextResponse.json({
        data: {
          student: {
            userid: studentProfile.userid,
            username: studentProfile.username,
            email: studentProfile.email,
            kelas: studentProfile.kelas
          },
          activities: [],
          pagination: {
            page: 1,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          filters: { validationStatus }
        }
      })
    }

    // Step 2: Get aktivitas data for field values and filter by student
    const activityIds = [...new Set(allFieldValues.map(fv => fv.activityid))]
    
    const { data: activities, error: activitiesError } = await adminClient
      .from("aktivitas")
      .select("activityid, activityname, activitycontent, userid, status, created_at, updated_at, kegiatanid, categoryid")
      .in("activityid", activityIds)
      .eq("userid", studentProfile.userid)

    if (activitiesError) {
      console.error("Error fetching activities:", activitiesError)
      return NextResponse.json({ 
        error: "Failed to fetch activities"
      }, { status: 500 })
    }

    // Filter field values to only include student's activities
    const studentActivityIds = new Set(activities?.map(a => a.activityid) || [])
    const studentFieldValues = allFieldValues.filter(fv => studentActivityIds.has(fv.activityid))

    // Apply pagination to filtered results
    const totalCount = studentFieldValues.length
    const paginatedFieldValues = studentFieldValues.slice(offset, offset + limit)

    if (paginatedFieldValues.length === 0) {
      return NextResponse.json({
        data: {
          student: {
            userid: studentProfile.userid,
            username: studentProfile.username,
            email: studentProfile.email,
            kelas: studentProfile.kelas
          },
          activities: [],
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
          },
          filters: { validationStatus }
        }
      })
    }

    // Step 3: Get additional data for rendering
    const fieldIds = [...new Set(paginatedFieldValues.map(fv => fv.fieldid))]
    const relevantActivityIds = [...new Set(paginatedFieldValues.map(fv => fv.activityid))]
    
    // Get field definitions
    const { data: fields, error: fieldsError } = await adminClient
      .from("category_fields")
      .select("fieldid, field_key, label, type, required, config, order_index, categoryid")
      .in("fieldid", fieldIds)

    if (fieldsError) {
      console.error("Error fetching fields:", fieldsError)
    }

    // Get kegiatan and category data
    const relevantActivities = activities?.filter(a => relevantActivityIds.includes(a.activityid)) || []
    const kegiatanIds = [...new Set(relevantActivities.map(a => a.kegiatanid).filter(Boolean))]
    const categoryIds = [...new Set(relevantActivities.map(a => a.categoryid).filter(Boolean))]

    const [kegiatanData, categoryData] = await Promise.all([
      kegiatanIds.length > 0 ? adminClient
        .from("kegiatan")
        .select("kegiatanid, kegiatanname")
        .in("kegiatanid", kegiatanIds) : Promise.resolve({ data: [] }),
      categoryIds.length > 0 ? adminClient
        .from("category")
        .select("categoryid, categoryname")
        .in("categoryid", categoryIds) : Promise.resolve({ data: [] })
    ])

    // Create lookup maps
    const activitiesMap = new Map(activities?.map(a => [a.activityid, a]) || [])
    const fieldsMap = new Map(fields?.map(f => [f.fieldid, f]) || [])
    const kegiatanMap = new Map(kegiatanData.data?.map(k => [k.kegiatanid, k]) || [])
    const categoryMap = new Map(categoryData.data?.map(c => [c.categoryid, c]) || [])

    console.log('Lookup maps created:');
    console.log('- Activities:', activitiesMap.size);
    console.log('- Fields:', fieldsMap.size);
    console.log('- Kegiatan:', kegiatanMap.size);
    console.log('- Categories:', categoryMap.size);

    // Get file information for fields that have files
    const { data: fileData, error: fileError } = await adminClient
      .from("aktivitas_field_images")
      .select("activityid, fieldid, filename, cloudinary_url, content_type, created_at")
      .in("activityid", relevantActivityIds)
      .in("fieldid", fieldIds)

    if (fileError) {
      console.log("Note: Could not fetch file data (table might not exist):", fileError.message)
    }

    const filesMap = new Map()
    fileData?.forEach(file => {
      const key = `${file.activityid}|${file.fieldid}`
      if (!filesMap.has(key)) {
        filesMap.set(key, [])
      }
      filesMap.get(key).push({
        filename: file.filename,
        url: file.cloudinary_url,
        contentType: file.content_type,
        createdAt: file.created_at
      })
    })

    // Transform the data for better frontend consumption
    const transformedActivities = paginatedFieldValues.map((fieldValue: any) => {
      const teacherValidated = Boolean(fieldValue.isvalidatebyteacher)
      const parentValidated = Boolean(fieldValue.isvalidatebyparent)
      const activity = activitiesMap.get(fieldValue.activityid)
      const field = fieldsMap.get(fieldValue.fieldid)
      const kegiatan = kegiatanMap.get(activity?.kegiatanid)
      const category = categoryMap.get(activity?.categoryid)
      
      // Get files for this field value
      const fileKey = `${fieldValue.activityid}|${fieldValue.fieldid}`
      const files = filesMap.get(fileKey) || []

      return {
        id: fieldValue.id,
        value: fieldValue.value,
        validation: {
          byTeacher: teacherValidated,
          byParent: parentValidated,
          status: teacherValidated && parentValidated 
            ? 'fully_validated' 
            : teacherValidated 
            ? 'teacher_validated' 
            : parentValidated 
            ? 'parent_validated' 
            : 'pending'
        },
        timestamps: {
          created: fieldValue.created_at,
          updated: fieldValue.updated_at
        },
        field: {
          id: field?.fieldid || fieldValue.fieldid,
          key: field?.field_key || 'unknown',
          label: field?.label || 'Unknown Field',
          type: field?.type || 'text',
          required: field?.required || false,
          config: field?.config || {},
          order: field?.order_index || 0,
          category: {
            id: field?.categoryid || activity?.categoryid || '',
            name: categoryMap.get(field?.categoryid)?.categoryname || 'Unknown Category'
          }
        },
        files: files,
        activity: {
          id: activity?.activityid || fieldValue.activityid,
          name: activity?.activityname || 'Unknown Activity',
          content: activity?.activitycontent || '',
          status: activity?.status || 'unknown',
          timestamps: {
            created: activity?.created_at || '',
            updated: activity?.updated_at || ''
          },
          kegiatan: {
            id: activity?.kegiatanid || '',
            name: kegiatan?.kegiatanname || 'Unknown Kegiatan'
          },
          category: {
            id: activity?.categoryid || '',
            name: category?.categoryname || 'Unknown Category'
          }
        }
      }
    })

    console.log('Transformed activities count:', transformedActivities.length);
    console.log('Sample transformed activity:', transformedActivities[0]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      data: {
        student: {
          userid: studentProfile.userid,
          username: studentProfile.username,
          email: studentProfile.email,
          kelas: studentProfile.kelas
        },
        activities: transformedActivities,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          validationStatus
        }
      }
    })
  } catch (err: any) {
    console.error("GET /api/orangtua/siswa/activities error:", err)
    return NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 })
  }
}

// PATCH: /api/orangtua/siswa/activities - Update parent validation status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { fieldValueId, isValidatedByParent } = body

    if (!fieldValueId || typeof isValidatedByParent !== "boolean") {
      return NextResponse.json({ 
        error: "Field value ID and validation status are required" 
      }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = await createAdminClient()
    
    // Verify user is a parent and get linked student
    const { data: parentProfile, error: parentError } = await adminClient
      .from("user_profiles")
      .select("userid, roleid, parent_of_userid")
      .eq("userid", user.id)
      .single()

    if (parentError || !parentProfile) {
      return NextResponse.json({ 
        error: "Access denied: Only parents or admins can validate activities"
      }, { status: 403 })
    }

    const actingAsParent = isParentRole(parentProfile.roleid)
    const actingAsAdmin = isAdminRole(parentProfile.roleid)

    if (!actingAsParent && !actingAsAdmin) {
      return NextResponse.json({ 
        error: "Access denied: Only parents or admins can validate activities"
      }, { status: 403 })
    }

    if (actingAsParent && !parentProfile.parent_of_userid) {
      return NextResponse.json({ 
        error: "Access denied: Parent account has no linked student"
      }, { status: 403 })
    }

    // Verify the field value belongs to the parent's student
    const { data: fieldValue, error: fieldValueError } = await adminClient
      .from("aktivitas_field_values")
      .select(`
        id,
        activityid,
        aktivitas!inner (
          userid
        )
      `)
      .eq("id", fieldValueId)
      .single()

    if (fieldValueError || !fieldValue) {
      return NextResponse.json({ 
        error: "Field value not found"
      }, { status: 404 })
    }

    // Type assertion for the nested data
    const activity = fieldValue.aktivitas as any
    if (actingAsParent && activity?.userid !== parentProfile.parent_of_userid) {
      return NextResponse.json({ 
        error: "Access denied: This activity does not belong to your linked student"
      }, { status: 403 })
    }

    // Update the validation status
    const { error: updateError } = await adminClient
      .from("aktivitas_field_values")
      .update({ 
        isvalidatebyparent: isValidatedByParent,
        updated_at: new Date().toISOString()
      })
      .eq("id", fieldValueId)

    if (updateError) {
      console.error("Error updating validation status:", updateError)
      return NextResponse.json({ 
        error: "Failed to update validation status"
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Activity ${isValidatedByParent ? 'validated' : 'unvalidated'} by parent`,
      data: {
        fieldValueId,
        isValidatedByParent
      }
    })
  } catch (err: any) {
    console.error("PATCH /api/orangtua/siswa/activities error:", err)
    return NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 })
  }
}
