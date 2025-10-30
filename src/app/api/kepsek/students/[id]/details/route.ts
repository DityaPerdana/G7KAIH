import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    const resolvedParams = await params

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const kegiatanId = searchParams.get("kegiatanId")
    const categoryId = searchParams.get("categoryId")

    const { data: studentProfile } = await adminSupabase
      .from("user_profiles")
      .select("userid, username")
      .eq("userid", resolvedParams.id)
      .single()

    if (!studentProfile) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    let activitiesQuery = adminSupabase
      .from("aktivitas")
      .select(
        `
        activityid,
        userid,
        created_at,
        kegiatan:kegiatanid (
          kegiatanid,
          kegiatanname
        ),
        category:categoryid (
          categoryid,
          categoryname
        ),
        aktivitas_field_values (
          id,
          fieldid,
          value,
          created_at,
          updated_at,
          isvalidatebyteacher,
          isvalidatebyparent,
          field:fieldid (
            fieldid,
            label,
            type,
            required
          )
        )
      `
      )
      .eq("userid", resolvedParams.id)
      .order("created_at", { ascending: false })

    if (startDate) {
      activitiesQuery = activitiesQuery.gte("created_at", startDate)
    }
    if (endDate) {
      activitiesQuery = activitiesQuery.lte("created_at", endDate)
    }
    if (kegiatanId) {
      activitiesQuery = activitiesQuery.eq("kegiatanid", kegiatanId)
    }
    if (categoryId) {
      activitiesQuery = activitiesQuery.eq("categoryid", categoryId)
    }

    const { data: activities, error: activitiesError } = await activitiesQuery

    if (activitiesError) {
      throw activitiesError
    }

    const activityIds = (activities || []).map((activity) => activity.activityid)
    let images: any[] = []

    if (activityIds.length > 0) {
      const { data: imageRows, error: imagesError } = await adminSupabase
        .from("aktivitas_field_images")
        .select("id, activityid, fieldid, filename, cloudinary_url")
        .in("activityid", activityIds)

      if (imagesError) {
        throw imagesError
      }

      images = imageRows || []
    }

    const activitiesWithFieldValues = (activities || []).map((activity) => {
      const fieldValues = (activity.aktivitas_field_values || []).map((fieldValue: any) => {
        const teacherValidated = Boolean(fieldValue.isvalidatebyteacher)
        const parentValidated = Boolean(fieldValue.isvalidatebyparent)
        const fieldImages = images.filter(
          (image) => image.activityid === activity.activityid && image.fieldid === fieldValue.fieldid
        )

        return {
          ...fieldValue,
          files: fieldImages.map((file: any) => ({
            id: file.id,
            filename: file.filename,
            url: file.cloudinary_url,
          })),
          validation: {
            status: teacherValidated && parentValidated
              ? "fully_validated"
              : teacherValidated
              ? "teacher_validated"
              : parentValidated
              ? "parent_validated"
              : "pending",
            byTeacher: teacherValidated,
            byParent: parentValidated,
          },
        }
      })

      return {
        ...activity,
        id: activity.activityid,
        student_name: studentProfile.username || `Siswa ${resolvedParams.id.slice(0, 8)}`,
        kegiatan_name: (activity as any)?.kegiatan?.kegiatanname || "Kegiatan Tidak Diketahui",
        submission_date: activity.created_at,
        field_values: fieldValues,
      }
    })

    return NextResponse.json({
      success: true,
      data: activitiesWithFieldValues,
      student: {
        id: resolvedParams.id,
        name: studentProfile.username || `Siswa ${resolvedParams.id.slice(0, 8)}`,
      },
    })
  } catch (error) {
    console.error("Error in kepsek student details endpoint", error)
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
