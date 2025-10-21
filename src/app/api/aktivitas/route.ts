import { uploadToCloudinary } from "@/utils/cloudinary"
import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

const JAKARTA_TZ = "Asia/Jakarta"
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024 // 3MB per image
const MAX_IMAGE_SIZE_MB = MAX_IMAGE_SIZE_BYTES / (1024 * 1024)

function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export async function GET() {
  try {
    const supabase = await createClient()
    // Fetch aktivitas with related kegiatan name
    const { data: acts, error } = await supabase
      .from("aktivitas")
      .select(
        "activityid, activityname, activitycontent, kegiatanid, userid, status, created_at, updated_at, kegiatan:kegiatanid(kegiatanid, kegiatanname)"
      )
      .order("created_at", { ascending: false })
    if (error) throw error

    // Merge usernames from user_profiles manually (no direct FK from aktivitas -> user_profiles)
    const userIds = Array.from(
      new Set((acts || []).map((a: any) => a.userid).filter(Boolean))
    ) as string[]

    let nameByUser = new Map<string, string | null>()
    if (userIds.length) {
      const { data: profiles, error: profErr } = await supabase
        .from("user_profiles")
        .select("userid, username")
        .in("userid", userIds)
      if (profErr) throw profErr
      for (const p of profiles || []) nameByUser.set(p.userid, p.username ?? null)
    }

    const result = (acts || []).map((a: any) => ({
      ...a,
      profile: a.userid ? { username: nameByUser.get(a.userid) ?? null } : null,
    }))

    return NextResponse.json({ data: result })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    )
  }
}

// Create a new aktivitas with submitted field values
// Payload shape:
// {
//   kegiatanid: string,
//   activityname?: string,
//   activitycontent?: string,
//   status?: string,
//   values: Array<{
//     categoryid: string,
//     fields: Array<{ key: string; type?: string; value: any }>
//   }>
// }
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() || ""
    let kegiatanid: string | undefined
    let activityname: string | undefined
    let activitycontent: string | undefined
    let status: string | undefined
    let values: Array<{ categoryid: string; fields: Array<{ key: string; type?: string; value: any }> }> = []
    const incomingFiles: Array<{ categoryid: string; field_key: string; file: File }> = []

    if (contentType.includes("multipart/form-data")) {
      const fd = await request.formData()
      kegiatanid = (fd.get("kegiatanid") as string) || undefined
      activityname = (fd.get("activityname") as string) || undefined
      activitycontent = (fd.get("activitycontent") as string) || undefined
      status = (fd.get("status") as string) || undefined
      const rawValues = fd.get("values") as string | null
      if (rawValues) {
        try {
          const parsed = JSON.parse(rawValues)
          if (Array.isArray(parsed)) values = parsed
        } catch {}
      }
      for (const [key, val] of fd.entries()) {
        if (typeof val === "object" && "arrayBuffer" in val && key.startsWith("file:")) {
          const parts = key.split(":")
          if (parts.length === 3) {
            const [, catId, fieldKey] = parts
            incomingFiles.push({ categoryid: catId, field_key: fieldKey, file: val as File })
          }
        }
      }
    } else {
      const body = await request.json().catch(() => null)
      kegiatanid = body?.kegiatanid
      activityname = body?.activityname
      activitycontent = body?.activitycontent
      status = body?.status
      values = Array.isArray(body?.values) ? body.values : []
    }

    if (!kegiatanid) {
      return NextResponse.json({ error: "kegiatanid wajib diisi" }, { status: 400 })
    }

    if (incomingFiles.length) {
      const oversized = incomingFiles.filter((f) => f.file.size > MAX_IMAGE_SIZE_BYTES)
      if (oversized.length) {
        const formatted = oversized
          .map((f) => {
            const sizeMb = f.file.size / (1024 * 1024)
            const rounded = sizeMb % 1 === 0 ? sizeMb.toFixed(0) : sizeMb.toFixed(1)
            return `${f.file.name || "berkas tanpa nama"} (${rounded}MB)`
          })
          .join(", ")

        return NextResponse.json(
          {
            error: `Ukuran file maksimal ${(MAX_IMAGE_SIZE_MB % 1 === 0 ? MAX_IMAGE_SIZE_MB.toFixed(0) : MAX_IMAGE_SIZE_MB.toFixed(1))}MB per gambar. File terlalu besar: ${formatted}`,
            code: "IMAGE_TOO_LARGE",
          },
          { status: 413 }
        )
      }
    }

    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    const userid = auth.user?.id
    if (!userid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Guard: allow only one submission per kegiatan per user per day
  const today = todayInJakarta() // YYYY-MM-DD in Asia/Jakarta
    const { data: existingToday, error: existingErr } = await supabase
      .from("aktivitas")
      .select("activityid, created_at")
      .eq("kegiatanid", kegiatanid)
      .eq("userid", userid)
      .eq("submitted_date", today)
      .maybeSingle()

    if (existingErr && existingErr.code !== "PGRST116") {
      throw existingErr
    }

    if (existingToday) {
      return NextResponse.json(
        {
          error: "Kamu sudah mengirim aktivitas untuk kegiatan ini hari ini. Silakan coba lagi besok.",
          last_submission: existingToday.created_at,
        },
        { status: 409 }
      )
    }

    // Ensure kegiatan exists (also get name for default title)
    const { data: keg, error: kegErr } = await supabase
      .from("kegiatan")
      .select("kegiatanid, kegiatanname")
      .eq("kegiatanid", kegiatanid)
      .single()
    if (kegErr || !keg) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 })
    }

    // Insert aktivitas row
    const fallbackName = (() => {
      const base = keg?.kegiatanname || "Aktivitas"
      // ISO without seconds for brevity
      const iso = new Date().toISOString().slice(0, 16).replace("T", " ")
      return `${base} - ${iso}`
    })()
    const nonNullName = (typeof activityname === "string" && activityname.trim().length > 0)
      ? activityname.trim()
      : fallbackName
    const nonNullContent = typeof activitycontent === "string" ? activitycontent : ""

    const insertRow: any = { kegiatanid, userid, activityname: nonNullName, activitycontent: nonNullContent }
    if (typeof status === "string" && status.trim().length > 0) insertRow.status = status
    const { data: act, error: actErr } = await supabase
      .from("aktivitas")
      .insert(insertRow)
      .select("activityid")
      .single()
    if (actErr) {
      if ((actErr as any)?.code === "23505") {
        return NextResponse.json(
          { error: "Kamu sudah mengirim aktivitas untuk kegiatan ini hari ini. Silakan coba lagi besok." },
          { status: 409 }
        )
      }
      throw actErr
    }

    const activityid = act.activityid as string

    if (values.length === 0) {
      // No field values provided; return success for activity creation only
      // If files exist, continue to process files
      if (!incomingFiles.length) {
        return NextResponse.json({ data: { activityid, inserted: 0, warnings: ["Tidak ada nilai field yang dikirim."] } }, { status: 201 })
      }
    }

    // Resolve fieldids for provided categories/keys
    type FieldRow = { fieldid: string; categoryid: string; field_key: string; type?: string }
    const categories = Array.from(new Set([
      ...values.map(v => v.categoryid).filter(Boolean),
      ...incomingFiles.map(f => f.categoryid).filter(Boolean),
    ]))
    const { data: fieldRows, error: fieldsErr } = await supabase
      .from("category_fields")
      .select("fieldid, categoryid, field_key, type")
      .in("categoryid", categories)
    if (fieldsErr) throw fieldsErr

    const fieldMap = new Map<string, FieldRow>() // key: categoryid|field_key
    for (const f of fieldRows || []) {
      fieldMap.set(`${f.categoryid}|${f.field_key}`, f as FieldRow)
    }

    const rows: any[] = []
    const warnings: string[] = []

    for (const group of values) {
      if (!group?.categoryid || !Array.isArray(group.fields)) continue
      for (const fld of group.fields) {
        const key = `${group.categoryid}|${fld.key}`
        const meta = fieldMap.get(key)
        if (!meta) {
          warnings.push(`Field tidak dikenal: category=${group.categoryid} key=${fld.key}`)
          continue
        }
        // Normalize value based on type; we store as text for now
        let value: string | null = null
        const t = (fld.type ?? meta.type ?? "text").toString()
        if (fld.value == null) {
          value = null
        } else if (t === "multiselect") {
          // Accept string or string[]; store as comma-separated
          const arr = Array.isArray(fld.value) ? fld.value : [String(fld.value)]
          value = arr.join(",")
        } else if (t === "text_image") {
          // Expect text only here (image handled separately via files)
          const textOnly = (fld && typeof fld.value === "object" && fld.value !== null && "text" in fld.value)
            ? (fld.value as any).text
            : fld.value
          value = textOnly != null ? String(textOnly) : null
        } else if (t === "image") {
          // Image bytes stored separately; keep value null or filename
          value = null
        } else if (t === "time" || t === "text") {
          value = String(fld.value)
        } else {
          // Fallback stringify
          value = String(fld.value)
        }

        rows.push({ activityid, fieldid: meta.fieldid, value })
      }
    }

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("aktivitas_field_values").insert(rows)
      if (insErr) throw insErr
    }

    // Handle file uploads -> upload to Cloudinary and store URLs
    if (incomingFiles.length > 0) {
      const imageRows: any[] = []
      for (const f of incomingFiles) {
        const meta = fieldMap.get(`${f.categoryid}|${f.field_key}`)
        if (!meta) {
          warnings.push(`File field tidak dikenal: category=${f.categoryid} key=${f.field_key}`)
          continue
        }
        
        // Safety guard: should be caught earlier, but keep warning fallback
        if (f.file.size > MAX_IMAGE_SIZE_BYTES) {
          const sizeMb = f.file.size / (1024 * 1024)
          const rounded = sizeMb % 1 === 0 ? sizeMb.toFixed(0) : sizeMb.toFixed(1)
          warnings.push(`File ${f.file.name} terlalu besar (${rounded}MB). Maksimal ${MAX_IMAGE_SIZE_MB % 1 === 0 ? MAX_IMAGE_SIZE_MB.toFixed(0) : MAX_IMAGE_SIZE_MB.toFixed(1)}MB.`)
          continue
        }
        
        try {
          const ab = await f.file.arrayBuffer()
          const buffer = Buffer.from(ab)
          
          console.log(`Uploading file to Cloudinary: ${f.file.name}, size: ${f.file.size} bytes`)
          
          // Upload to Cloudinary
          const { url, publicId } = await uploadToCloudinary(
            buffer,
            f.file.name || 'file',
            `g7-aktivitas/${activityid}`
          )
          
          console.log(`File uploaded successfully: ${url}`)
          
          imageRows.push({
            activityid,
            fieldid: meta.fieldid,
            filename: f.file.name || null,
            cloudinary_url: url,
            cloudinary_public_id: publicId,
            content_type: (f.file as any).type || "application/octet-stream",
          })
        } catch (uploadError: any) {
          console.error('Cloudinary upload error:', uploadError)
          warnings.push(`Gagal upload ${f.file.name}: ${uploadError.message}`)
        }
      }
      
      if (imageRows.length > 0) {
        console.log(`Saving ${imageRows.length} image URLs to database...`)
        
        // Save to aktivitas_field_images table
        const { error: imageErr } = await supabase
          .from("aktivitas_field_images")
          .insert(imageRows)
        
        if (imageErr) {
          console.error("Image URL insert error:", imageErr)
          return NextResponse.json(
            { error: `Gagal menyimpan URL gambar ke database: ${imageErr.message}` },
            { status: 500 }
          )
        } else {
          console.log(`Successfully saved ${imageRows.length} image URLs to database`)
        }
      }
    }

    return NextResponse.json({ data: { activityid, inserted: rows.length, warnings } }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    )
  }
}
