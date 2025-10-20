import { getStudentRoleIds, isAdminRole, isStudentRole } from "@/utils/lib/roles"
import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
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

    const studentRoleIds = getStudentRoleIds()

    // Get all students with their assigned guruwali
    const { data: students, error: studentsError } = await supabase
      .from("user_profiles")
      .select(`
        userid,
        username,
        email,
        roleid,
        kelas,
        guruwali_userid
      `)
      .in("roleid", studentRoleIds.length ? studentRoleIds : [-1])
      .order("username")

    if (studentsError) {
      console.error("Error fetching students:", studentsError)
      return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
    }

    // Get all guruwali for mapping (roleid 6 OR teachers with is_guruwali = true)
    const { data: guruWaliList, error: guruWaliError } = await supabase
      .from("user_profiles")
      .select("userid, username, email, roleid, is_guruwali")
      .or("roleid.eq.6,and(roleid.eq.2,is_guruwali.eq.true)")

    if (guruWaliError) {
      console.error("Error fetching guruwali:", guruWaliError)
      return NextResponse.json({ error: "Failed to fetch guruwali" }, { status: 500 })
    }

    // Create a map for quick guruwali lookup
    const guruWaliMap = new Map(
      (guruWaliList || []).map(gw => [gw.userid, gw])
    )

    // Transform the data into the format expected by the frontend
    const assignments = (students || [])
      .filter(student => isStudentRole(student.roleid))
      .map(student => ({
      student: {
        userid: student.userid,
        username: student.username,
        email: student.email,
        roleid: student.roleid,
        kelas: student.kelas,
        guruwali_userid: student.guruwali_userid
      },
      guruwali: student.guruwali_userid ? guruWaliMap.get(student.guruwali_userid) || null : null
    }))

    return NextResponse.json({ ok: true, data: assignments })
  } catch (error) {
    console.error("Error in guruwali assignments API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
