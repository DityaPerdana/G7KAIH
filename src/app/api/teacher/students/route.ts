import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// Lightweight in-memory cache for the full response (helps repeated loads in short bursts)
let CACHE: { data: any; expiresAt: number } | null = null
const CACHE_TTL_MS = 0 // Disable cache for debugging

// Verified duplicate mappings (manually curated to prevent cross-contamination)
const VERIFIED_ALIASES = new Map<string, string[]>([
  // Raditya Alfarisi - verified same person with different userids
  ['6f07ae03-187e-4e25-a519-9f72f96f22ff', ['6f07ae03-187e-4e25-a519-9f72f96f22ff', 'eca885ad-1119-48ca-8efe-91efcbfb54b4']],
  ['eca885ad-1119-48ca-8efe-91efcbfb54b4', ['6f07ae03-187e-4e25-a519-9f72f96f22ff', 'eca885ad-1119-48ca-8efe-91efcbfb54b4']]
])

// Optional verified display names for known users (improves UX when metadata is missing)
const VERIFIED_DISPLAY_NAMES = new Map<string, string>([
  ['6f07ae03-187e-4e25-a519-9f72f96f22ff', 'Raditya Alfarisi'],
  ['eca885ad-1119-48ca-8efe-91efcbfb54b4', 'Raditya Alfarisi'],
])

function nameFromEmail(email?: string | null): string | null {
  if (!email) return null
  const local = String(email).split('@')[0]
  if (!local) return null
  // Replace separators with spaces, then title-case
  const words = local.replace(/[._-]+/g, ' ').split(' ').filter(Boolean)
  if (words.length === 0) return null
  const pretty = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return pretty
}

// Expand a list of userIds with any verified alias groups that intersect the list
function expandWithVerifiedAliases(ids: string[]): string[] {
  const set = new Set(ids)
  for (const [primary, list] of VERIFIED_ALIASES.entries()) {
    // If any id from this alias group is present, add the whole group (including primary)
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
    console.log("Service key exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
    
    // Get current user to verify they are a teacher
    const authSupabase = await createClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current user's profile to get their class and verify they are a teacher
    const { data: teacherProfile, error: profileError } = await authSupabase
      .from('user_profiles')
      .select('userid, username, kelas, roleid, is_guruwali')
      .eq('userid', user.id)
      .single()

    if (profileError || !teacherProfile) {
      return NextResponse.json({ 
        error: "Teacher profile not found" 
      }, { status: 403 })
    }

    // Verify user is a teacher (roleid 2) or guru wali (roleid 6)
    if (teacherProfile.roleid !== 2 && teacherProfile.roleid !== 6) {
      return NextResponse.json({ 
        error: "Only teachers can access this endpoint" 
      }, { status: 403 })
    }

    const teacherClass = teacherProfile.kelas
    const isGuruWaliAccess = teacherProfile.roleid === 6 || Boolean(teacherProfile.is_guruwali)
    
    if (!teacherClass && !isGuruWaliAccess) {
      return NextResponse.json({ 
        error: "Teacher must have a class assigned" 
      }, { status: 400 })
    }

    console.log("Teacher verified:", teacherProfile.username, "Class:", teacherClass)
    
    // Serve from cache when fresh - but we need to filter by teacher's class
    if (CACHE && Date.now() < CACHE.expiresAt) {
      const cachedData = isGuruWaliAccess
        ? CACHE.data
        : CACHE.data.filter((student: any) => student.class === teacherClass)
      return NextResponse.json({ data: cachedData })
    }

    const supabase = await createClient()

    const { data: roles, error: roleErr } = await supabase
      .from("role")
      .select("roleid, rolename")

    if (roleErr) throw roleErr

    const siswaRoleId = roles?.find((r) =>
      String(r.rolename).toLowerCase() === "siswa" ||
      String(r.rolename).toLowerCase() === "student"
    )?.roleid || 5

    const studentSelect = "userid, username, email, roleid, kelas, created_at, updated_at, guruwali_userid"
    const studentMap = new Map<string, any>()

    if (teacherClass) {
      const { data: classStudents, error: classErr } = await supabase
        .from("user_profiles")
        .select(studentSelect)
        .eq("roleid", siswaRoleId)
        .eq("kelas", teacherClass)

      if (classErr) throw classErr
      for (const student of classStudents || []) {
        if (student?.userid) studentMap.set(student.userid, student)
      }
    }

    if (isGuruWaliAccess) {
      const { data: assignedStudents, error: assignedErr } = await supabase
        .from("user_profiles")
        .select(studentSelect)
        .eq("roleid", siswaRoleId)
        .eq("guruwali_userid", teacherProfile.userid)

      if (assignedErr) throw assignedErr
      for (const student of assignedStudents || []) {
        if (student?.userid) studentMap.set(student.userid, student)
      }
    }

    const profilesData: any[] = Array.from(studentMap.values())

    if (profilesData.length === 0) {
      CACHE = { data: [], expiresAt: Date.now() + CACHE_TTL_MS }
      return NextResponse.json({ data: [] })
    }

    let userIds: string[] = profilesData.map((p: any) => p.userid)
    userIds = expandWithVerifiedAliases(userIds)

    const { data: acts, error: actsErr } = await supabase
      .from("aktivitas")
      .select("userid, status, created_at")
      .in("userid", userIds)

    if (actsErr) throw actsErr

    const activityRows: any[] = acts || []

    // Consolidate into byUser from acts
    const byUser: Record<string, { total: number; completed: number; last?: string }> = {}
    for (const a of activityRows) {
      const u = a.userid as string
      if (!u) continue
      if (!byUser[u]) byUser[u] = { total: 0, completed: 0, last: undefined }
      byUser[u].total++
      if (a.status === "completed") byUser[u].completed++
      const ts = String(a.created_at)
      if (!byUser[u].last || ts > byUser[u].last!) byUser[u].last = ts
    }

    // Aggregate stats for verified aliases (e.g., Raditya Alfarisi duplicate accounts)
  const aggregatedByUser: Record<string, { total: number; completed: number; last?: string }> = {}
    for (const [userid, stats] of Object.entries(byUser)) {
      const verifiedAliases = VERIFIED_ALIASES.get(userid)
      if (verifiedAliases) {
        // Use the first verified alias as the primary userid for aggregation
        const primaryUserId = verifiedAliases[0]
        if (!aggregatedByUser[primaryUserId]) {
          aggregatedByUser[primaryUserId] = { total: 0, completed: 0, last: undefined }
        }
        
        aggregatedByUser[primaryUserId].total += stats.total
        aggregatedByUser[primaryUserId].completed += stats.completed
        if (!aggregatedByUser[primaryUserId].last || (stats.last && stats.last > aggregatedByUser[primaryUserId].last!)) {
          aggregatedByUser[primaryUserId].last = stats.last
        }
      } else {
        aggregatedByUser[userid] = stats
      }
    }

    const now = Date.now()
  // De-duplicate secondary IDs in verified alias groups (show only primary card)
    const aliasPrimaryById = new Map<string, string>()
    for (const [primary, list] of VERIFIED_ALIASES.entries()) {
      for (const id of list) aliasPrimaryById.set(id, primary)
    }

    // Build a profile map that prefers primary IDs and drops secondary duplicates
    const mapProfile = new Map<string, any>()
  for (const p of (profilesData || []) as any[]) {
      const uid = p.userid
      const primary = aliasPrimaryById.get(uid) || uid
      // Keep first occurrence only (prefer whichever comes first)
      if (!mapProfile.has(primary)) {
        mapProfile.set(primary, p)
      }
    }

    // Re-hydrate missing usernames/emails from user_profiles (single batched query)
    const missingIds: string[] = Array.from(mapProfile.entries())
      .filter(([, p]) => !p?.username && !p?.email)
      .map(([uid]) => uid)
    if (missingIds.length > 0) {
      const { data: refill, error: refillErr } = await supabase
        .from("user_profiles")
        .select("userid, username, email, roleid, kelas, created_at, updated_at, guruwali_userid")
        .in("userid", missingIds)
      if (!refillErr && refill) {
        for (const r of refill) {
          if (!r?.userid) continue
          // Replace placeholder entry with real profile row
          mapProfile.set(r.userid, { ...(mapProfile.get(r.userid) || {}), ...r })
        }
      }
    }

  // No extra DB fallback needed; aggregation already covered per-id totals/last

    // Enrich names/emails for profiles missing email/username using Admin Auth API
    const toEnrich = Array.from(mapProfile.entries())
      .filter(([, p]) => !p?.username && !p?.email)
      .map(([uid]) => uid)
    const authMap = new Map<string, { email?: string; name?: string }>()
    if (toEnrich.length > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminClient = await createAdminClient()
        await Promise.all(
          toEnrich.map(async (uid) => {
            try {
              const { data: adminData, error: adminError } = await adminClient.auth.admin.getUserById(uid)
              if (adminError || !adminData?.user) return

              const user = adminData.user as any
              const meta: any = user.user_metadata || user.raw_user_meta_data || {}
              let fullName: string | undefined = meta.full_name || meta.name
              let email: string | undefined = user.email

              if (!fullName && Array.isArray(user.identities)) {
                for (const ident of user.identities) {
                  const idata: any = ident.identity_data || {}
                  const n = idata.full_name || idata.name || [idata.given_name, idata.family_name].filter(Boolean).join(" ")
                  const e = idata.email
                  if (!fullName && n) fullName = n
                  if (!email && e) email = e
                }
              }

              authMap.set(uid, { email, name: fullName })
            } catch {
              // ignore per-user fetch errors
            }
          })
        )
      } catch {
        // Service role unavailable; skip admin enrichment gracefully
      }
    }

    // Return profiles (plus placeholders) as cards, de-duped by verified alias primary ID
    let data = Array.from(mapProfile.entries()).map(([uid, prof]: [string, any]) => {
      const primaryUid = uid
      const profMerged = mapProfile.get(primaryUid) || {}
      const stats = aggregatedByUser[primaryUid] || { total: 0, completed: 0, last: undefined }
      const lastActivity = stats.last
      let status: "active" | "inactive" | "completed" = "inactive"
  if (lastActivity) {
        const diffDays = (now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
        status = diffDays <= 3 ? "active" : "inactive"
      }

  const auth = authMap.get(uid) || {}
      const verifiedName = VERIFIED_DISPLAY_NAMES.get(primaryUid)
      const emailForName = profMerged.email || auth.email
      const derived = nameFromEmail(emailForName)
      const displayName =
        profMerged.username ||
        verifiedName ||
        auth.name ||
        derived ||
        (profMerged.email || auth.email)?.split('@')[0] ||
        `Siswa ${primaryUid.slice(0, 8)}`

      return {
        id: primaryUid,
        name: displayName,
        class: profMerged.kelas || "",
        email: profMerged.email || auth.email || null,
        activitiesCount: stats.total,
        lastActivity,
        status,
        roleid: profMerged.roleid,
      }
    })

    if (siswaRoleId) {
      data = data.filter(d => d.roleid === siswaRoleId)
    }

    if (teacherClass && !isGuruWaliAccess) {
      data = data.filter(d => d.class === teacherClass)
    }

    CACHE = { data, expiresAt: Date.now() + CACHE_TTL_MS }
    console.log("Final student count:", data.length)
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 500 })
  }
}
