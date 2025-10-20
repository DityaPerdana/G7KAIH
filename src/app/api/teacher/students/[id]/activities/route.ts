import { createAdminClient } from "@/utils/supabase/admin"
import { NextResponse, type NextRequest } from "next/server"

// In-memory cache for alias resolution (5 minute TTL)
const aliasCache = new Map<string, string[]>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let cacheCleared = false

// Verified duplicate mappings (manually curated to prevent cross-contamination)
const VERIFIED_ALIASES = new Map<string, string[]>([
  // Raditya Alfarisi - verified same person with different userids
  ['6f07ae03-187e-4e25-a519-9f72f96f22ff', ['6f07ae03-187e-4e25-a519-9f72f96f22ff', 'eca885ad-1119-48ca-8efe-91efcbfb54b4']],
  ['eca885ad-1119-48ca-8efe-91efcbfb54b4', ['6f07ae03-187e-4e25-a519-9f72f96f22ff', 'eca885ad-1119-48ca-8efe-91efcbfb54b4']]
])

// Clear contaminated cache entries (one-time fix)
function clearAliasCache() {
  if (!cacheCleared) {
    aliasCache.clear()
    cacheCleared = true
    console.log("[activities API] Cleared contaminated alias cache")
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Clear contaminated cache on first request after fix
    clearAliasCache()
    
    const { id: userid } = await params
    if (!userid) {
      return NextResponse.json({ error: "userid is required" }, { status: 400 })
    }
  const url = new URL(req.url)
  const month = url.searchParams.get("month") // YYYY-MM atau "latest"
  const date = url.searchParams.get("date") // YYYY-MM-DD untuk filter hari tertentu
  const includeAliases = /^(1|true|yes)$/i.test(url.searchParams.get("includeAliases") || "")
  const expandOptions = /^(1|true|yes)$/i.test(url.searchParams.get("expandOptions") || "")

    const supabase = await createAdminClient()

  // Check cache first (keyed by includeAliases flag)
  const cacheKey = `${userid}:${includeAliases ? 1 : 0}`
  let aliasIds = aliasCache.get(cacheKey)
    
    if (!aliasIds) {
      // Start with the requested userid
      const set = new Set<string>([userid])
      // Always include manually verified aliases for safety
      const verifiedAliases = VERIFIED_ALIASES.get(userid)
      if (verifiedAliases) for (const id of verifiedAliases) set.add(id)

      // Optionally include peers with exact same email/username (opt-in to avoid contamination)
      if (includeAliases) {
        const { data: prof } = await supabase
          .from("user_profiles")
          .select("username, email")
          .eq("userid", userid)
          .maybeSingle()
        const conditions: string[] = []
        if (prof?.username?.trim()) conditions.push(`username.eq.${prof.username.trim()}`)
        if (prof?.email?.trim()) conditions.push(`email.eq.${prof.email.trim()}`)
        if (conditions.length > 0) {
          const { data: peers } = await supabase
            .from("user_profiles")
            .select("userid")
            .or(conditions.join(','))
          for (const p of peers || []) set.add((p as any).userid)
        }
      }

      aliasIds = Array.from(set)

      // Cache for 5 minutes
      aliasCache.set(cacheKey, aliasIds)
      setTimeout(() => aliasCache.delete(cacheKey), CACHE_TTL)
    }

  console.log("[activities API] userid=", userid, "aliasIds=", aliasIds.length)

    async function getMonthBounds(target?: string): Promise<{ start: Date; end: Date; monthUsed: string } | null> {
      if (target === "latest") {
        const { data: latest, error: latestErr } = await supabase
          .from("aktivitas")
          .select("created_at")
          .in("userid", aliasIds || [userid])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (latestErr) throw latestErr
        if (!latest?.created_at) return null
        const d = new Date(latest.created_at as string)
        const y = d.getFullYear()
        const m = d.getMonth()
        return {
          start: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)),
          end: new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0)),
          monthUsed: `${y}-${String(m + 1).padStart(2, "0")}`,
        }
      }
      if (target && /^\d{4}-\d{2}$/.test(target)) {
        const [y, m] = target.split("-").map((n) => Number(n))
        return {
          start: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
          end: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)),
          monthUsed: target,
        }
      }
      const now = new Date()
      return {
        start: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)),
        monthUsed: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      }
    }

    let bounds = await getMonthBounds(month || undefined)
    if (!bounds) {
      console.log("[activities API] No bounds found for userid=", userid, "month=", month)
      return NextResponse.json({
        data: {},
        monthUsed: null,
        debug: {
          requestedMonth: month,
          userid,
          note: "No aktivitas found for this userid",
        },
      })
    }
    let { start, end, monthUsed } = bounds

    // Jika ada parameter date, filter berdasarkan hari tertentu
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const targetDate = new Date(date + "T00:00:00.000Z")
      const nextDay = new Date(targetDate)
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      
      start = targetDate
      end = nextDay
      monthUsed = date // Gunakan tanggal sebagai identifier
    }

    const { data: items, error } = await supabase
      .from("aktivitas")
      .select("activityid, activityname, activitycontent, status, created_at, categoryid, category:categoryid(categoryid, categoryname)")
      .in("userid", aliasIds)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: true })

    if (error) throw error

  let result = items || []
    console.log("[activities API] initial query count=", result.length, { monthUsed, start: start.toISOString(), end: end.toISOString() })
    
    // Skip fallback logic jika menggunakan filter tanggal spesifik
    if (!date) {
      // Fallback: if no items for requested month and request wasn't "latest", try latest month with data
      if (result.length === 0 && month !== "latest") {
        const latestBounds = await getMonthBounds("latest")
        if (latestBounds) {
          start = latestBounds.start
          end = latestBounds.end
          monthUsed = latestBounds.monthUsed
          const { data: latestItems, error: latestErr } = await supabase
            .from("aktivitas")
            .select("activityid, activityname, activitycontent, status, created_at, categoryid, category:categoryid(categoryid, categoryname)")
            .in("userid", aliasIds)
            .gte("created_at", start.toISOString())
            .lt("created_at", end.toISOString())
            .order("created_at", { ascending: true })
          if (latestErr) throw latestErr
          result = latestItems || []
    console.log("[activities API] latest month fallback count=", result.length, { monthUsed })
        }
      }

      // Final fallback: if still empty, try fetching recent entries regardless of month
      if ((result?.length ?? 0) === 0) {
        const { data: recent, error: recentErr } = await supabase
          .from("aktivitas")
          .select("activityid, activityname, activitycontent, status, created_at, categoryid, category:categoryid(categoryid, categoryname)")
          .in("userid", aliasIds)
          .order("created_at", { ascending: true })
          .limit(20)
        if (recentErr) throw recentErr
        result = recent || []
        console.log("[activities API] recent fallback count=", result.length)
      }
    }

    // Backfill categoryid untuk entries yang belum memilikinya
    try {
      const missingIds = (result || []).filter((r: any) => !r?.categoryid).map((r: any) => r.activityid)
      if (missingIds.length > 0) {
        const { data: hints, error: hintsErr } = await supabase
          .from("aktivitas_field_values")
          .select(
            "activityid, category_fields:fieldid(categoryid, category:categoryid(categoryid, categoryname))"
          )
          .in("activityid", missingIds)

        if (!hintsErr && hints) {
          const map = new Map<string, { categoryid?: string; category?: { categoryid: string; categoryname: string } }>()
          for (const row of hints as any[]) {
            const aid = row.activityid as string
            const cf = row?.category_fields
            const cid = cf?.categoryid
            const cname = cf?.category?.categoryname
            if (!aid || !cid) continue
            if (!map.has(aid)) {
              map.set(aid, { categoryid: cid, category: { categoryid: cid, categoryname: cname } })
            }
          }
          result = (result || []).map((r: any) =>
            r?.categoryid
              ? r
              : map.has(r.activityid)
              ? { ...r, categoryid: map.get(r.activityid)!.categoryid, category: map.get(r.activityid)!.category }
              : r
          )
        }
      }
    } catch {}

    // Build validation flags aggregated per activity from aktivitas_field_values
    let validationMap: Map<string, { teacher: boolean; parent: boolean }> = new Map()
    try {
      const activityIdsForFlags = Array.from(new Set((result || []).map((r: any) => r.activityid))).filter(Boolean)
      if (activityIdsForFlags.length > 0) {
        const { data: vrows } = await supabase
          .from('aktivitas_field_values')
          .select('activityid, isvalidatebyteacher, isvalidatebyparent')
          .in('activityid', activityIdsForFlags)
        if (vrows) {
          for (const r of vrows as any[]) {
            const aid = r.activityid as string
            const prev = validationMap.get(aid) || { teacher: false, parent: false }
            validationMap.set(aid, {
              teacher: prev.teacher || !!r.isvalidatebyteacher,
              parent: prev.parent || !!r.isvalidatebyparent,
            })
          }
        }
      }
    } catch {}

    // Optionally prepare per-activity multiselect options for expansion
    let optionsByActivity: Map<string, string[]> | null = null
    // Always prepare per-activity categories derived from field values (so non-multiselect categories show up)
    let categoriesByActivity: Map<string, { id: string; name: string }[]> | null = null
    if (expandOptions && (result?.length || 0) > 0) {
      try {
        const activityIds = Array.from(new Set((result || []).map((r: any) => r.activityid))).filter(Boolean)
        if (activityIds.length > 0) {
          const { data: fv, error: fvErr } = await supabase
            .from("aktivitas_field_values")
            .select("activityid, value, category_fields:fieldid(type, categoryid, category:categoryid(categoryid, categoryname))")
            .in("activityid", activityIds)
          if (!fvErr && fv) {
            optionsByActivity = new Map()
            categoriesByActivity = new Map()
            for (const row of fv as any[]) {
              const t = (row?.category_fields?.type || '').toLowerCase()
              const catId = row?.category_fields?.categoryid as string | undefined
              const catName = row?.category_fields?.category?.categoryname as string | undefined
              if (catId && catName) {
                const list = categoriesByActivity.get(row.activityid) || []
                if (!list.some((c) => c.id === catId)) {
                  list.push({ id: catId, name: catName })
                  categoriesByActivity.set(row.activityid, list)
                }
              }
              if (t !== 'multiselect') continue
              let vals: string[] = []
              const v = row?.value
              if (Array.isArray(v)) {
                vals = v.map(String)
              } else if (typeof v === 'string') {
                try {
                  const parsed = JSON.parse(v)
                  if (Array.isArray(parsed)) vals = parsed.map(String)
                  else vals = String(v).split(',').map(s => s.trim()).filter(Boolean)
                } catch {
                  vals = String(v).split(',').map(s => s.trim()).filter(Boolean)
                }
              } else if (v && typeof v === 'object') {
                // Sometimes jsonb comes as object; try common shapes
                const maybe = (v as any).values || (v as any).options || []
                if (Array.isArray(maybe)) vals = maybe.map(String)
              }
              if (vals.length > 0) {
                const aid = row.activityid as string
                const prev = optionsByActivity.get(aid) || []
                optionsByActivity.set(aid, Array.from(new Set([...prev, ...vals])))
              }
            }

            // Fallback: if no categories got populated (nested join may be restricted), build via two-step map
            const emptyCats = Array.from(categoriesByActivity.values()).every((arr) => (arr?.length || 0) === 0)
            if (emptyCats) {
              const fvFlat = (fv as any[]).map(r => ({ activityid: r.activityid as string, fieldid: (r as any).fieldid })).filter(r => r.fieldid)
              const fieldIds = Array.from(new Set(fvFlat.map(r => r.fieldid)))
              if (fieldIds.length > 0) {
                const { data: cf, error: cfErr } = await supabase
                  .from('category_fields')
                  .select('fieldid, categoryid, category:categoryid(categoryid, categoryname)')
                  .in('fieldid', fieldIds)
                if (!cfErr && cf) {
                  const f2c = new Map<string, { id: string, name: string }>()
                  for (const row of cf as any[]) {
                    const cid = row?.categoryid as string
                    const cname = row?.category?.categoryname as string
                    if (row?.fieldid && cid && cname) f2c.set(row.fieldid, { id: cid, name: cname })
                  }
                  categoriesByActivity = new Map()
                  for (const r of fvFlat) {
                    const cat = f2c.get(r.fieldid)
                    if (!cat) continue
                    const list = categoriesByActivity.get(r.activityid) || []
                    if (!list.some((c) => c.id === cat.id)) list.push(cat)
                    categoriesByActivity.set(r.activityid, list)
                  }
                }
              }
            }
          }
        }
      } catch {}
    }

    // Group per-day by category or expanded options; summarize counts and points
  const byDate: Record<string, any[]> = {}
    for (const a of result) {
      const d = new Date(a.created_at as string)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      const isCompleted = (a as any).status === "completed"
      const pts = isCompleted ? 10 : 0

      const arr = (byDate[key] ||= [])

      const aid = (a as any).activityid as string
      const expanded = optionsByActivity && optionsByActivity.get(aid)
    if (expandOptions && expanded && expanded.length > 0) {
        for (const opt of expanded) {
          const optId = `opt::${opt.toLowerCase()}`
          let entry = arr.find((e: any) => e.id === optId)
          if (!entry) {
            entry = {
              id: optId,
              title: opt,
              type: "category",
              count: 0,
              time,
        points: 0, // keep 0 to avoid inflating points when splitting
        activityIds: [] as string[],
        validatedByTeacher: false,
        validatedByParent: false,
            }
            arr.push(entry)
          }
          entry.count += 1
          entry.time = time
          entry.activityIds.push(aid)
          const flags = validationMap.get(aid)
          entry.validatedByTeacher = entry.validatedByTeacher || !!flags?.teacher
          entry.validatedByParent = entry.validatedByParent || !!flags?.parent
        }
        // Also add top-level categories present in this activity's fields
        const cats = categoriesByActivity?.get(aid) || []
        for (const c of cats) {
          let centry = arr.find((e: any) => e.id === c.id)
          if (!centry) {
            centry = {
              id: c.id,
              title: c.name,
              type: "category",
              count: 0,
              time,
        points: 0,
        activityIds: [] as string[],
        validatedByTeacher: false,
        validatedByParent: false,
            }
            arr.push(centry)
          }
          centry.count += 1
          centry.time = time
          centry.activityIds.push(aid)
          const flags2 = validationMap.get(aid)
          centry.validatedByTeacher = centry.validatedByTeacher || !!flags2?.teacher
          centry.validatedByParent = centry.validatedByParent || !!flags2?.parent
        }
      } else {
        const catId = (a as any).categoryid || "uncategorized"
        const catName = (a as any)?.category?.categoryname || "Tanpa Kategori"
        let entry = arr.find((e: any) => e.id === catId)
        if (!entry) {
          entry = {
            id: catId,
            title: catName,
            type: "category",
            count: 0,
            time, // last seen time (will update as we iterate chronological)
      points: 0,
      activityIds: [] as string[],
      validatedByTeacher: false,
      validatedByParent: false,
          }
          arr.push(entry)
        }
        entry.count += 1
        entry.points += pts
        entry.time = time
  entry.activityIds.push(aid)
  const flags = validationMap.get(aid)
  entry.validatedByTeacher = entry.validatedByTeacher || !!flags?.teacher
  entry.validatedByParent = entry.validatedByParent || !!flags?.parent
        // Ensure categories from fields are also represented
        if (categoriesByActivity) {
          const cats = categoriesByActivity.get(aid) || []
          for (const c of cats) {
            if (c.id === catId) continue
            let centry = arr.find((e: any) => e.id === c.id)
            if (!centry) {
              centry = {
                id: c.id,
                title: c.name,
                type: "category",
                count: 0,
                time,
        points: 0,
        activityIds: [] as string[],
        validatedByTeacher: false,
        validatedByParent: false,
              }
              arr.push(centry)
            }
            centry.count += 1
            centry.time = time
            centry.activityIds.push(aid)
            const flags3 = validationMap.get(aid)
            centry.validatedByTeacher = centry.validatedByTeacher || !!flags3?.teacher
            centry.validatedByParent = centry.validatedByParent || !!flags3?.parent
          }
        }
      }
    }

  console.log("[activities API] final grouped days=", Object.keys(byDate).length, "totalItems=", Object.values(byDate).reduce((n, arr) => n + (arr?.length || 0), 0))
  return NextResponse.json({
      data: byDate,
      monthUsed,
      debug: {
        requestedMonth: month,
        bounds: { start: start.toISOString(), end: end.toISOString() },
        totalItems: Object.values(byDate).reduce((n, arr) => n + (arr?.length || 0), 0),
        userid,
        aliasIds,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userid } = await params
    const body = await req.json().catch(() => ({})) as {
      action?: 'validate' | 'invalidate'
      by?: 'teacher' | 'parent'
      activityIds?: string[]
    }
    const action = body.action === 'invalidate' ? 'invalidate' : 'validate'
    const by = body.by === 'parent' ? 'parent' : 'teacher'
    const ids = Array.from(new Set((body.activityIds || []).filter(Boolean)))
    if (ids.length === 0) {
      return NextResponse.json({ error: 'activityIds is required' }, { status: 400 })
    }
  const column = by === 'parent' ? 'isvalidatebyparent' : 'isvalidatebyteacher'
    const value = action === 'validate'

    const supabase = await createAdminClient()
    // Update all field value rows for these activities
    const { error } = await supabase
      .from('aktivitas_field_values')
  .update({ [column]: value })
      .in('activityid', ids)

    if (error) throw error

    return NextResponse.json({ ok: true, updated: ids.length })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
