"use client"

import { StudentActivityDetails } from "@/components/teacher/StudentActivityDetails"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ArrowLeft } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"

type Student = {
  id: string
  name: string
  class: string
  avatar?: string
  activitiesCount: number
  lastActivity: string
  status: "active" | "inactive" | "completed"
}

async function fetchStudentById(id: string, isGuruWali: boolean): Promise<Student | null> {
  try {
    const endpoint = isGuruWali ? `/api/guruwali/students/${id}` : `/api/teacher/students/${id}`
    const res = await fetch(endpoint, { cache: "no-store" })
    if (!res.ok) return null
    const json = await res.json()
    return json.data
  } catch {
    return null
  }
}

async function fetchStudentDetails(id: string, isGuruWali: boolean): Promise<any[]> {
  try {
    const endpoint = isGuruWali ? `/api/guruwali/students/${id}/details` : `/api/teacher/students/${id}/details`
    const response = await fetch(endpoint)
    const result = await response.json()
    return response.ok ? result.data || [] : []
  } catch {
    return []
  }
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const pathname = usePathname()
  const resolvedParams = React.use(params)
  const [student, setStudent] = React.useState<Student | null>(null)
  const [activities, setActivities] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [detailsLoading, setDetailsLoading] = React.useState(false)

  const isGuruWali = pathname.startsWith('/guruwali')

  React.useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [studentData, activitiesData] = await Promise.all([
        fetchStudentById(resolvedParams.id, isGuruWali),
        fetchStudentDetails(resolvedParams.id, isGuruWali)
      ])
      setStudent(studentData)
      setActivities(activitiesData)
      setLoading(false)
    })()
  }, [resolvedParams.id, isGuruWali])

  const handleBack = () => {
    router.push(isGuruWali ? '/guruwali/siswa' : '/guru/siswa')
  }

  const handleRefresh = async () => {
    if (!student) return
    setDetailsLoading(true)
    const activitiesData = await fetchStudentDetails(student.id, isGuruWali)
    setActivities(activitiesData)
    setDetailsLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Memuat detail aktivitas...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">Siswa tidak ditemukan</p>
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Daftar Siswa
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Detail Field - {student.name || `Siswa ${student.class}`}
              </h1>
              <p className="text-sm text-gray-500">Kelas {student.class}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {detailsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Memuat detail aktivitas...</p>
            </div>
          </div>
        ) : (
          <StudentActivityDetails
            student={student}
            activities={activities}
            onBack={handleBack}
            onRefresh={handleRefresh}
          />
        )}
      </div>
    </>
  )
}
