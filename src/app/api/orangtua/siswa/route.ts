import { isAdminRole, isParentRole, getParentRoleIds, getStudentRoleIds, isStudentRole } from "@/utils/lib/roles"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

// GET: /api/orangtua/siswa - Get student data linked to parent
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use admin client for reliable data access
    const adminClient = await createAdminClient()
    
    // Get current user profile
    const { data: parentProfile, error: parentError } = await adminClient
      .from("user_profiles")
      .select("userid, username, email, roleid, parent_of_userid")
      .eq("userid", user.id)
      .single()

    if (parentError || !parentProfile) {
      return NextResponse.json({ 
        error: "Parent profile not found", 
        debug: { userId: user.id, parentError }
      }, { status: 404 })
    }

    const actingAsParent = isParentRole(parentProfile.roleid)
    const actingAsAdmin = isAdminRole(parentProfile.roleid)

    if (!actingAsParent && !actingAsAdmin) {
      return NextResponse.json({ 
        error: "Access denied: Only parents can access this endpoint", 
        debug: { 
          currentRole: parentProfile.roleid,
          expectedRole: getParentRoleIds(),
          username: parentProfile.username
        }
      }, { status: 403 })
    }

    let linkedStudent = null
    const result = {
      parent: {
        userid: parentProfile.userid,
        username: parentProfile.username,
        email: parentProfile.email,
        roleid: parentProfile.roleid
      },
      student: null as any,
      relationship_status: "no_relationship"
    }

    const studentRoleIds = getStudentRoleIds()

    // If parent has a linked student
    if (actingAsParent && parentProfile.parent_of_userid) {
      const { data: studentProfile, error: studentError } = await adminClient
        .from("user_profiles")
        .select("userid, username, email, kelas, roleid")
        .eq("userid", parentProfile.parent_of_userid)
        .in("roleid", studentRoleIds.length ? studentRoleIds : [-1])
        .maybeSingle()

      if (studentProfile && isStudentRole(studentProfile.roleid)) {
        result.student = {
          userid: studentProfile.userid,
          username: studentProfile.username,
          email: studentProfile.email,
          kelas: studentProfile.kelas
        }
        result.relationship_status = "linked"
      } else {
        result.relationship_status = "broken_link"
      }
    }

    // If no linked student found or link is broken, get available students for selection
    if (result.relationship_status !== "linked") {
      const { data: availableStudents, error: studentsError } = await adminClient
        .from("user_profiles")
        .select("userid, username, email, kelas, roleid")
        .in("roleid", studentRoleIds.length ? studentRoleIds : [-1])
        .is("parent_of_userid", null) // Not already linked
        .order("username", { ascending: true })

      if (!studentsError && availableStudents) {
        return NextResponse.json({ 
          data: {
            ...result,
            available_students: availableStudents
              .filter((student) => isStudentRole(student.roleid))
              .map((student) => ({
                userid: student.userid,
                username: student.username,
                email: student.email,
                kelas: student.kelas
              })),
            message: result.relationship_status === "broken_link"
              ? "Student link is broken. Please select a new student."
              : actingAsParent
                ? "No student linked. Please select a student to monitor."
                : "Anda melihat data sebagai admin. Pilih siswa untuk memeriksa keterhubungan."
          }
        })
      }
    }

    return NextResponse.json({ data: result })
  } catch (err: any) {
    console.error("GET /api/orangtua/siswa error:", err)
    return NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 })
  }
}

// POST: /api/orangtua/siswa - Link parent to a student
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { student_userid } = body

    if (!student_userid || typeof student_userid !== "string") {
      return NextResponse.json({ error: "Student user ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = await createAdminClient()

    // Verify current user is a parent
    const { data: parentProfile, error: parentError } = await adminClient
      .from("user_profiles")
      .select("userid, username, roleid")
      .eq("userid", user.id)
      .in("roleid", getParentRoleIds())
      .single()

    if (parentError || !parentProfile || !isParentRole(parentProfile.roleid)) {
      return NextResponse.json({ 
        error: "Only parents can link to students",
        debug: { userId: user.id, parentError }
      }, { status: 403 })
    }

    const studentRoleIds = getStudentRoleIds()

    // Verify student exists and has correct role
    const { data: studentProfile, error: studentError } = await adminClient
      .from("user_profiles")
      .select("userid, username, roleid")
      .eq("userid", student_userid)
      .in("roleid", studentRoleIds.length ? studentRoleIds : [-1])
      .single()

    if (studentError || !studentProfile || !isStudentRole(studentProfile.roleid)) {
      return NextResponse.json({ 
        error: "Student not found or invalid",
        debug: { student_userid, studentError }
      }, { status: 404 })
    }

    // Check if student is already linked to another parent
    const { data: existingParent, error: existingError } = await adminClient
      .from("user_profiles")
      .select("userid, username")
  .eq("parent_of_userid", student_userid)
  .in("roleid", getParentRoleIds())
      .maybeSingle()

    if (!existingError && existingParent && existingParent.userid !== user.id) {
      return NextResponse.json({ 
        error: `Student is already linked to another parent: ${existingParent.username}`,
        debug: { existing_parent: existingParent }
      }, { status: 409 })
    }

    // Update parent profile to link with student
    const { error: updateError } = await adminClient
      .from("user_profiles")
      .update({ 
        parent_of_userid: student_userid,
        updated_at: new Date().toISOString()
      })
      .eq("userid", user.id)

    if (updateError) {
      console.error("Error updating parent-student relationship:", updateError)
      return NextResponse.json({ 
        error: "Failed to link parent to student",
        debug: updateError.message
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully linked to student: ${studentProfile.username}`,
      data: {
        parent: {
          userid: parentProfile.userid,
          username: parentProfile.username
        },
        student: {
          userid: studentProfile.userid,
          username: studentProfile.username
        }
      }
    })
  } catch (err: any) {
    console.error("POST /api/orangtua/siswa error:", err)
    return NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 })
  }
}

// DELETE: /api/orangtua/siswa - Unlink parent from student
export async function DELETE() {
  try {
    const supabase = await createClient()
    
    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = await createAdminClient()

    // Verify current user is a parent
    const { data: parentProfile, error: parentError } = await adminClient
      .from("user_profiles")
      .select("userid, username, roleid, parent_of_userid")
      .eq("userid", user.id)
      .in("roleid", getParentRoleIds())
      .single()

    if (parentError || !parentProfile || !isParentRole(parentProfile.roleid)) {
      return NextResponse.json({ 
        error: "Only parents can unlink from students",
        debug: { userId: user.id, parentError }
      }, { status: 403 })
    }

    if (!parentProfile.parent_of_userid) {
      return NextResponse.json({ 
        error: "No student linked to unlink from"
      }, { status: 400 })
    }

    // Update parent profile to remove link
    const { error: updateError } = await adminClient
      .from("user_profiles")
      .update({ 
        parent_of_userid: null,
        updated_at: new Date().toISOString()
      })
      .eq("userid", user.id)

    if (updateError) {
      console.error("Error unlinking parent from student:", updateError)
      return NextResponse.json({ 
        error: "Failed to unlink from student",
        debug: updateError.message
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: "Successfully unlinked from student",
      data: {
        parent: {
          userid: parentProfile.userid,
          username: parentProfile.username
        }
      }
    })
  } catch (err: any) {
    console.error("DELETE /api/orangtua/siswa error:", err)
    return NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 })
  }
}
