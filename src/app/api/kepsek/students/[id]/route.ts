import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const adminSupabase = await createAdminClient()

    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("roleid")
      .eq("userid", user.id)
      .single()

    if (!profile?.roleid) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 })
    }

    if (profile.roleid !== 7) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: roles, error: rolesError } = await adminSupabase
      .from("role")
      .select("roleid, rolename")

    if (rolesError) {
      throw rolesError
    }

    const siswaRoleId = roles?.find((r) => {
      const name = String(r.rolename).toLowerCase()
      return name === "student" || name === "siswa"
    })?.roleid

    if (!siswaRoleId) {
      return NextResponse.json({ error: "Student role not found" }, { status: 404 })
    }

    const { data: profileRows, error: profilesError } = await adminSupabase
      .from("user_profiles")
      .select("userid, username, email, roleid, kelas")
      .eq("userid", resolvedParams.id)

    if (profilesError) {
      throw profilesError
    }

    if (!profileRows || profileRows.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const studentProfile = profileRows[0]

    if (studentProfile.roleid !== siswaRoleId) {
      return NextResponse.json({ error: "User is not a student" }, { status: 404 })
    }

    const { count: activitiesCount } = await adminSupabase
      .from("aktivitas")
      .select("*", { count: "exact", head: true })
      .eq("userid", resolvedParams.id)

    const { data: lastActivityData } = await adminSupabase
      .from("aktivitas")
      .select("created_at")
      .eq("userid", resolvedParams.id)
      .order("created_at", { ascending: false })
      .limit(1)

    let status: "active" | "inactive" | "completed" = "inactive"
    const lastActivity = lastActivityData?.[0]?.created_at || null

    if (lastActivity) {
      const diffDays = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
      status = diffDays <= 1 ? "active" : diffDays <= 7 ? "completed" : "inactive"
    }

    const studentData = {
      id: studentProfile.userid,
      name: studentProfile.username || "Unknown",
      class: studentProfile.kelas || "",
      email: studentProfile.email,
      activitiesCount: activitiesCount || 0,
      lastActivity,
      status,
      roleid: studentProfile.roleid,
    }

    return NextResponse.json({ success: true, data: studentData })
  } catch (error) {
    console.error("Error fetching kepsek student", error)
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
