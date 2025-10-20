import { getStudentRoleIds, isAdminRole, isStudentRole } from "@/utils/lib/roles"
import { createClient } from "@/utils/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("roleid")
      .eq("userid", user.id)
      .single()

    if (!profile || !isAdminRole(profile.roleid)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { studentId, guruWaliId } = body

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    // Verify student exists and has the correct role
    const studentRoleIds = getStudentRoleIds()

    const { data: student, error: studentError } = await supabase
      .from("user_profiles")
      .select("userid, roleid")
      .eq("userid", studentId)
      .in("roleid", studentRoleIds.length ? studentRoleIds : [-1])
      .single()

    if (studentError || !student || !isStudentRole(student.roleid)) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // If guruWaliId is provided, verify it exists and has the correct role or guruwali attribute
    if (guruWaliId) {
      const { data: guruwali, error: guruWaliError } = await supabase
        .from("user_profiles")
        .select("userid, roleid, is_guruwali")
        .eq("userid", guruWaliId)
        .single()

      if (guruWaliError || !guruwali) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      // Check if user is guruwali (roleid 6) or has guruwali attribute or is teacher with guruwali access
      const isValidGuruwali = guruwali.roleid === 6 || 
                              guruwali.is_guruwali === true ||
                              guruwali.roleid === 2 // allow teachers to be assigned as guruwali

      if (!isValidGuruwali) {
        return NextResponse.json({ error: "User is not authorized to be guruwali" }, { status: 400 })
      }
    }

    // Update the student's guruwali assignment
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ 
        guruwali_userid: guruWaliId || null,
        updated_at: new Date().toISOString()
      })
      .eq("userid", studentId)

    if (updateError) {
      console.error("Error updating guruwali assignment:", updateError)
      return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 })
    }

    return NextResponse.json({ 
      ok: true, 
      message: guruWaliId 
        ? "Guruwali berhasil ditugaskan" 
        : "Penugasan guruwali berhasil dihapus"
    })
  } catch (error) {
    console.error("Error in assign guruwali API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
