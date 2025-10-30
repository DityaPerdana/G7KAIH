import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

const ACTIVE_THRESHOLD_DAYS = 3

export async function GET(request: NextRequest) {
  try {
    const kelasParam = request.nextUrl.searchParams.get("kelas")

    if (!kelasParam) {
      return NextResponse.json({ error: "Parameter 'kelas' wajib diisi" }, { status: 400 })
    }

    const decodedKelas = decodeURIComponent(kelasParam)

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
      return NextResponse.json({ data: [] })
    }

    const { data: students, error: studentsError } = await adminSupabase
      .from("user_profiles")
      .select("userid, username, email, kelas, roleid")
      .eq("roleid", siswaRoleId)
      .eq("kelas", decodedKelas)

    if (studentsError) {
      throw studentsError
    }

    const studentIds = (students || [])
      .map((student) => student?.userid)
      .filter((id): id is string => Boolean(id))

    let activities: { userid: string; status: string | null; created_at: string | null }[] = []

    if (studentIds.length > 0) {
      const { data: activityRows, error: activityError } = await adminSupabase
        .from("aktivitas")
        .select("userid, status, created_at")
        .in("userid", studentIds)

      if (activityError) {
        throw activityError
      }

      activities = activityRows || []
    }

    const statsByUser = new Map<string, { total: number; last?: string | null }>()
    for (const activity of activities) {
      const uid = activity.userid
      if (!uid) continue
      const entry = statsByUser.get(uid) ?? { total: 0, last: null }
      entry.total += 1
      if (activity.created_at && (!entry.last || activity.created_at > entry.last)) {
        entry.last = activity.created_at
      }
      statsByUser.set(uid, entry)
    }

    const now = Date.now()

    const data = (students || []).map((student) => {
      const uid = student?.userid as string
      const stats = statsByUser.get(uid)
      const lastActivity = stats?.last || null
      let status: "active" | "inactive" | "completed" = "inactive"

      if (lastActivity) {
        const diffDays = (now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
        status = diffDays <= ACTIVE_THRESHOLD_DAYS ? "active" : "inactive"
      }

      return {
        id: uid,
        name: student?.username || `Siswa ${uid.slice(0, 8)}`,
        class: student?.kelas || decodedKelas,
        email: student?.email || null,
        activitiesCount: stats?.total ?? 0,
        lastActivity,
        status,
        roleid: student?.roleid ?? siswaRoleId,
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Error in kepsek students endpoint", error)
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
