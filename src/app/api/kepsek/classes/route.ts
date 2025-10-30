import { NextResponse } from "next/server"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export async function GET() {
  try {
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

    const { data: roles, error: roleErr } = await adminSupabase
      .from("role")
      .select("roleid, rolename")

    if (roleErr) {
      throw roleErr
    }

    const siswaRoleId = roles?.find((r) => {
      const label = String(r.rolename).toLowerCase()
      return label === "student" || label === "siswa"
    })?.roleid

    if (!siswaRoleId) {
      return NextResponse.json({ data: [] })
    }

    const { data: studentProfiles, error: studentErr } = await adminSupabase
      .from("user_profiles")
      .select("userid, kelas")
      .eq("roleid", siswaRoleId)

    if (studentErr) {
      throw studentErr
    }

    const filteredProfiles = (studentProfiles || []).filter(
      (profileRow) => profileRow?.userid && profileRow?.kelas && profileRow.kelas.trim() !== ""
    )

    const classMap = new Map<string, string[]>()
    for (const profileRow of filteredProfiles) {
      const kelas = profileRow.kelas as string
      const list = classMap.get(kelas) ?? []
      list.push(profileRow.userid as string)
      classMap.set(kelas, list)
    }

    const studentIds = filteredProfiles.map((row) => row.userid as string)
    let activities: { userid: string; status: string | null; created_at: string | null }[] = []

    if (studentIds.length > 0) {
      const ACTIVITY_CHUNK_SIZE = 200
      for (let i = 0; i < studentIds.length; i += ACTIVITY_CHUNK_SIZE) {
        const chunk = studentIds.slice(i, i + ACTIVITY_CHUNK_SIZE)
        const { data: chunkData, error: chunkError } = await adminSupabase
          .from("aktivitas")
          .select("userid, status, created_at")
          .in("userid", chunk)

        if (chunkError) {
          throw chunkError
        }

        activities.push(...(chunkData || []))
      }
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
    const result = Array.from(classMap.entries()).map(([kelas, ids]) => {
      let totalActivities = 0
      let latestActivity: string | null = null
      let activeStudents = 0

      for (const id of ids) {
        const stats = statsByUser.get(id)
        if (stats?.total) {
          totalActivities += stats.total
        }
        if (stats?.last) {
          if (!latestActivity || stats.last > latestActivity) {
            latestActivity = stats.last
          }
          const diffMs = now - new Date(stats.last).getTime()
          const diffDays = diffMs / (1000 * 60 * 60 * 24)
          if (diffDays <= 3) {
            activeStudents += 1
          }
        }
      }

      const averageActivity = ids.length > 0 ? Math.round(totalActivities / ids.length) : 0

      return {
        kelas,
        totalStudents: ids.length,
        activeStudents,
        averageActivity,
        lastActivity: latestActivity,
      }
    })

    result.sort((a, b) => a.kelas.localeCompare(b.kelas))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error("Error in kepsek classes endpoint", error)
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
