import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// Enable cache with reasonable TTL for production
const CACHE_TTL_MS = 60000 // 1 minute cache

// Per-teacher cache to avoid cross-contamination
const TEACHER_CACHE = new Map<string, { data: any; expiresAt: number }>();

// Verified duplicate mappings (manually curated to prevent cross-contamination)
const VERIFIED_ALIASES = new Map<string, string[]>([
  ['6f07ae03-187e-4e25-a519-9f72f96f22ff', ['6f07ae03-187e-4e25-a519-9f72f96f22ff', 'eca885ad-1119-48ca-8efe-91efcbfb54b4']],
  ['eca885ad-1119-48ca-8efe-91efcbfb54b4', ['6f07ae03-187e-4e25-a519-9f72f96f22ff', 'eca885ad-1119-48ca-8efe-91efcbfb54b4']]
])

const VERIFIED_DISPLAY_NAMES = new Map<string, string>([
  ['6f07ae03-187e-4e25-a519-9f72f96f22ff', 'Raditya Alfarisi'],
  ['eca885ad-1119-48ca-8efe-91efcbfb54b4', 'Raditya Alfarisi'],
])

function nameFromEmail(email?: string | null): string | null {
  if (!email) return null
  const local = String(email).split('@')[0]
  if (!local) return null
  const words = local.replace(/[._-]+/g, ' ').split(' ').filter(Boolean)
  if (words.length === 0) return null
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function expandWithVerifiedAliases(ids: string[]): string[] {
  const set = new Set(ids)
  for (const [primary, list] of VERIFIED_ALIASES.entries()) {
    const hit = list.some((id) => set.has(id)) || set.has(primary)
    if (hit) {
      set.add(primary)
      for (const id of list) set.add(id)
    }
  }
  return Array.from(set)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check per-teacher cache first
    const cached = TEACHER_CACHE.get(user.id);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json({ data: cached.data })
    }

    // Get teacher profile with single query
    const { data: teacherProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('userid, username, kelas, roleid')
      .eq('userid', user.id)
      .single()

    if (profileError || !teacherProfile) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 403 })
    }

    // Verify user is a teacher (roleid 2) or guru wali (roleid 6)
    if (teacherProfile.roleid !== 2 && teacherProfile.roleid !== 6) {
      return NextResponse.json({ error: "Only teachers can access this endpoint" }, { status: 403 })
    }

    const teacherClass = teacherProfile.kelas;
    if (!teacherClass) {
      return NextResponse.json({ error: "Teacher must have a class assigned" }, { status: 400 })
    }

    // PERFORMANCE: Single query to get student role ID
    const { data: siswaRole } = await supabase
      .from("role")
      .select("roleid")
      .ilike("rolename", "siswa")
      .limit(1)
      .single()
    
    const siswaRoleId = siswaRole?.roleid || 5

    // PERFORMANCE: Single batched query to get students in this class with their activity stats
    // Using a join or subquery would be better, but we'll optimize with fewer queries
    const { data: students, error: studentsError } = await supabase
      .from("user_profiles")
      .select("userid, username, email, roleid, kelas, created_at, updated_at")
      .eq("kelas", teacherClass)
      .eq("roleid", siswaRoleId)

    if (studentsError) {
      console.error("Error fetching students:", studentsError)
      return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
    }

    if (!students || students.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Expand student IDs with verified aliases
    let studentIds = students.map(s => s.userid)
    studentIds = expandWithVerifiedAliases(studentIds)

    // PERFORMANCE: Single query to get all activities for these students
    const { data: activities, error: activitiesError } = await supabase
      .from("aktivitas")
      .select("userid, status, created_at")
      .in("userid", studentIds)

    if (activitiesError) {
      console.error("Error fetching activities:", activitiesError)
      // Continue without activities data rather than failing
    }

    // PERFORMANCE: Aggregate activity stats in memory (faster than multiple queries)
    const activityStats: Record<string, { total: number; completed: number; lastActivity?: string }> = {}
    
    for (const activity of activities || []) {
      const userId = activity.userid
      if (!activityStats[userId]) {
        activityStats[userId] = { total: 0, completed: 0 }
      }
      activityStats[userId].total++
      if (activity.status === "completed") {
        activityStats[userId].completed++
      }
      const timestamp = String(activity.created_at)
      if (!activityStats[userId].lastActivity || timestamp > activityStats[userId].lastActivity!) {
        activityStats[userId].lastActivity = timestamp
      }
    }

    // PERFORMANCE: Aggregate stats for verified aliases
    const aggregatedStats: Record<string, { total: number; completed: number; lastActivity?: string }> = {}
    for (const [userId, stats] of Object.entries(activityStats)) {
      const verifiedAliases = VERIFIED_ALIASES.get(userId)
      const primaryUserId = verifiedAliases?.[0] || userId
      
      if (!aggregatedStats[primaryUserId]) {
        aggregatedStats[primaryUserId] = { total: 0, completed: 0 }
      }
      
      aggregatedStats[primaryUserId].total += stats.total
      aggregatedStats[primaryUserId].completed += stats.completed
      
      if (!aggregatedStats[primaryUserId].lastActivity || 
          (stats.lastActivity && stats.lastActivity > aggregatedStats[primaryUserId].lastActivity!)) {
        aggregatedStats[primaryUserId].lastActivity = stats.lastActivity
      }
    }

    // PERFORMANCE: Build student map by primary ID to handle aliases
    const studentMap = new Map<string, any>()
    for (const student of students) {
      const primaryId = VERIFIED_ALIASES.get(student.userid)?.[0] || student.userid
      if (!studentMap.has(primaryId)) {
        studentMap.set(primaryId, student)
      }
    }

    // Build final response
    const now = Date.now()
    const data = Array.from(studentMap.entries()).map(([primaryId, student]) => {
      const stats = aggregatedStats[primaryId] || { total: 0, completed: 0 }
      const lastActivity = stats.lastActivity
      
      let status: "active" | "inactive" | "completed" = "inactive"
      if (lastActivity) {
        const diffDays = (now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
        status = diffDays <= 3 ? "active" : "inactive"
      }

      const verifiedName = VERIFIED_DISPLAY_NAMES.get(primaryId)
      const derived = nameFromEmail(student.email)
      const displayName = 
        student.username ||
        verifiedName ||
        derived ||
        student.email?.split('@')[0] ||
        `Siswa ${primaryId.slice(0, 8)}`

      return {
        id: primaryId,
        name: displayName,
        class: student.kelas || teacherClass,
        email: student.email || null,
        activitiesCount: stats.total,
        lastActivity,
        status,
        roleid: student.roleid,
      }
    })

    // Store in per-teacher cache
    TEACHER_CACHE.set(user.id, { data, expiresAt: Date.now() + CACHE_TTL_MS })
    
    // Clean up old cache entries (simple LRU)
    if (TEACHER_CACHE.size > 100) {
      const oldestKey = TEACHER_CACHE.keys().next().value
      if (oldestKey) TEACHER_CACHE.delete(oldestKey)
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error("Unexpected error:", err)
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 500 })
  }
}
