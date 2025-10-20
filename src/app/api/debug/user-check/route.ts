import { getStudentRoleIds } from "@/utils/lib/roles"
import { createAdminClient } from "@/utils/supabase/admin"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const adminClient = await createAdminClient()
    
    const studentId = "05c3061e-e24c-4918-ae00-5fabfa8a2552"
    
    // Check if the student exists with any role
    const { data: user, error: userError } = await adminClient
      .from("user_profiles")
      .select("*")
      .eq("userid", studentId)
      .maybeSingle()

    console.log("Direct user lookup:", { user, userError })

    // Check all users with role 5
    const studentRoleIds = getStudentRoleIds()

    const { data: allStudents, error: studentsError } = await adminClient
      .from("user_profiles")
      .select("userid, username, roleid")
      .in("roleid", studentRoleIds.length ? studentRoleIds : [-1])
      .limit(10)

    console.log("All students:", { allStudents, studentsError })

    // Check the parent
    const parentId = "6f07ae03-187e-4e25-a519-9f72f96f22ff"
    const { data: parent, error: parentError } = await adminClient
      .from("user_profiles")
      .select("*")
      .eq("userid", parentId)
      .maybeSingle()

    console.log("Parent lookup:", { parent, parentError })

    return NextResponse.json({
      data: {
        student: user,
        allStudents,
        parent,
        studentId,
        parentId
      }
    })
  } catch (err: any) {
    console.error("Debug error:", err)
    return NextResponse.json({ 
      error: "Debug error",
      details: err.message
    }, { status: 500 })
  }
}
