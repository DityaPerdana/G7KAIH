import { createClient } from "@/utils/supabase/server"
import { NextRequest, NextResponse } from "next/server"

type StudentRow = {
  userid: string
  username: string | null
  kelas: string | null
  email: string | null
  guruwali_userid: string | null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("roleid, kelas, is_guruwali, is_wali_kelas")
      .eq("userid", user.id)
      .single()

    if (profileError || !userProfile || userProfile.roleid !== 2) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const className = userProfile.kelas?.trim() || null
    const isGuruWali = Boolean(userProfile.is_guruwali)

    if (!className && !isGuruWali) {
      return NextResponse.json({
        error: "Teacher must have a class assignment or guru wali designation"
      }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0]

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 })
    }

    const studentMap = new Map<string, StudentRow>()

    if (className) {
      const { data: classStudents, error: classError } = await supabase
        .from("user_profiles")
        .select("userid, username, kelas, email, guruwali_userid")
        .eq("roleid", 5)
        .eq("kelas", className)
        .order("username")

      if (classError) throw classError
      for (const student of classStudents || []) {
        if (student?.userid) studentMap.set(student.userid, student)
      }
    }

    if (isGuruWali) {
      const { data: guruWaliStudents, error: guruWaliError } = await supabase
        .from("user_profiles")
        .select("userid, username, kelas, email, guruwali_userid")
        .eq("roleid", 5)
        .eq("guruwali_userid", user.id)
        .order("username")

      if (guruWaliError) throw guruWaliError
      for (const student of guruWaliStudents || []) {
        if (student?.userid) studentMap.set(student.userid, student)
      }
    }

    const scopedStudents = Array.from(studentMap.values())
      .sort((a, b) => (a.username || "").localeCompare(b.username || ""))

    if (scopedStudents.length === 0) {
      return NextResponse.json({
        data: {
          date,
          totalStudents: 0,
          activeStudents: 0,
          inactiveStudents: [],
          activeRate: 0
        }
      })
    }

    const studentIds = scopedStudents.map(student => student.userid)

    const startDate = new Date(`${date}T00:00:00.000Z`)
    const endDate = new Date(`${date}T23:59:59.999Z`)

    const { data: activities, error: activitiesError } = await supabase
      .from("aktivitas")
      .select("userid, activityid, activityname, created_at")
      .in("userid", studentIds)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())

    if (activitiesError) throw activitiesError

    const activeStudentIds = new Set((activities || []).map(activity => activity.userid))

    const inactiveStudents = scopedStudents.filter(student => !activeStudentIds.has(student.userid))
    const activeStudents = scopedStudents.filter(student => activeStudentIds.has(student.userid))

    const result = {
      date,
      totalStudents: scopedStudents.length,
      activeStudents: activeStudents.length,
      inactiveStudents: inactiveStudents.map(student => ({
        userid: student.userid,
        username: student.username,
        kelas: student.kelas,
        email: student.email
      })),
      activeStudentsList: activeStudents.map(student => ({
        userid: student.userid,
        username: student.username,
        kelas: student.kelas,
        email: student.email,
        activities: (activities || []).filter(activity => activity.userid === student.userid)
      })),
      activeRate: scopedStudents.length > 0 ? Math.round((activeStudents.length / scopedStudents.length) * 100) : 0
    }

    return NextResponse.json({ data: result })

  } catch (error: any) {
    console.error("Daily inactive report error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

