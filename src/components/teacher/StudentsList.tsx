"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Search, Trophy, User } from "lucide-react"
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

type StudentVariant = "teacher" | "guruwali" | "kepsek"

const STUDENT_CACHE_TTL = 60_000

interface FetchStudentsOptions {
  variant: StudentVariant
  kelas?: string
  signal?: AbortSignal
}

async function fetchStudents({ variant, kelas, signal }: FetchStudentsOptions): Promise<Student[]> {
  let endpoint = "/api/teacher/students"

  if (variant === "guruwali") {
    endpoint = "/api/guruwali/students"
  } else if (variant === "kepsek") {
    const params = kelas ? `?kelas=${encodeURIComponent(kelas)}` : ""
    endpoint = `/api/kepsek/students${params}`
  }

  const response = await fetch(endpoint, { cache: "no-store", signal })
  const json = await response
    .json()
    .catch(() => ({} as { data?: Student[]; error?: string }))

  if (!response.ok) {
    throw new Error(json?.error || "Failed to load students")
  }

  return json?.data ?? []
}

function formatLastActivity(lastActivity?: string) {
  if (!lastActivity) return "-"

  try {
    const date = new Date(lastActivity)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    }
    if (diffDays === 1) {
      return "Kemarin"
    }
    if (diffDays <= 7) {
      return `${diffDays} hari lalu`
    }

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return "-"
  }
}

const getStatusColor = (status: Student["status"]) => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800"
    case "completed":
      return "bg-blue-100 text-blue-800"
    case "inactive":
    default:
      return "bg-gray-100 text-gray-800"
  }
}

const getStatusText = (status: Student["status"]) => {
  switch (status) {
    case "active":
      return "Aktif"
    case "completed":
      return "Selesai"
    case "inactive":
    default:
      return "Tidak Aktif"
  }
}

const decodeURIComponentSafe = (value?: string) => {
  if (!value) return undefined
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

type StudentsListProps = {
  variant?: StudentVariant
  kelas?: string
}

export function StudentsList({ variant, kelas }: StudentsListProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const derivedVariant = React.useMemo<StudentVariant>(() => {
    if (variant) return variant
    if (pathname.startsWith("/guruwali")) return "guruwali"
    if (pathname.startsWith("/kepsek")) return "kepsek"
    return "teacher"
  }, [variant, pathname])

  const kelasFilter = kelas ?? (derivedVariant === "kepsek" ? decodeURIComponentSafe(pathname.split("/kepsek/kelas/")[1]?.split("/")[0] ?? "") : undefined)

  const [students, setStudents] = React.useState<Student[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState("")

  const deferredSearch = React.useDeferredValue(searchTerm)
  const cacheRef = React.useRef<Map<string, { timestamp: number; data: Student[] }>>(new Map())
  const abortRef = React.useRef<AbortController | null>(null)

  const cacheKey = React.useMemo(() => {
    const kelasKey = kelasFilter ? kelasFilter.toLowerCase() : "all"
    return `${derivedVariant}-${kelasKey}`
  }, [derivedVariant, kelasFilter])

  const fetchAndCacheStudents = React.useCallback(
    async (forceRefresh = false) => {
      const now = Date.now()

      if (derivedVariant === "kepsek" && !kelasFilter) {
        setError("Pilih kelas terlebih dahulu")
        setStudents([])
        setLoading(false)
        return
      }

      if (!forceRefresh) {
        const cached = cacheRef.current.get(cacheKey)
        if (cached) {
          setStudents(cached.data)
          if (now - cached.timestamp < STUDENT_CACHE_TTL) {
            setLoading(false)
            return
          }
        } else {
          setLoading(true)
        }
      } else {
        cacheRef.current.delete(cacheKey)
        setLoading(true)
      }

      setError(null)
      abortRef.current?.abort()

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const data = await fetchStudents({
          variant: derivedVariant,
          kelas: kelasFilter,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        setStudents(data)
        cacheRef.current.set(cacheKey, { timestamp: Date.now(), data })
        setLoading(false)
      } catch (error) {
        if (controller.signal.aborted) return
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
            ? error
            : "Failed to load students"
        setError(message)
        setLoading(false)
      }
    },
    [derivedVariant, kelasFilter, cacheKey]
  )

  React.useEffect(() => {
    fetchAndCacheStudents()
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchAndCacheStudents])

  const filteredStudents = React.useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return students

    return students.filter((student) => {
      const name = (student.name || "").toLowerCase()
      const cls = (student.class || "").toLowerCase()
      return name.includes(query) || cls.includes(query)
    })
  }, [students, deferredSearch])

  const metrics = React.useMemo(() => {
    const total = students.length
    let active = 0
    let activitySum = 0

    for (const student of students) {
      if (student.status === "active") active += 1
      activitySum += student.activitiesCount ?? 0
    }

    const average = total > 0 ? Math.round(activitySum / total) : 0

    return { total, active, average }
  }, [students])

  const handleViewStudent = React.useCallback(
    (student: Student, mode: "kalender" | "detail") => {
      if (derivedVariant === "kepsek") {
        router.push(`/kepsek/kelas/siswa/${student.id}`)
        return
      }

      const basePath = derivedVariant === "guruwali" ? "/guruwali" : "/guru"
      router.push(`${basePath}/siswa/${student.id}/${mode}`)
    },
    [derivedVariant, router]
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">Memuat data…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    )
  }

  const headerTitle = derivedVariant === "kepsek" && kelasFilter
    ? `Kelas ${kelasFilter}`
    : "Panel Aktivitas"
  const headerSubtitle = derivedVariant === "kepsek"
    ? "Pantau aktivitas siswa di kelas ini"
    : "Pantau aktivitas siswa"

  return (
    <>
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{headerTitle}</h1>
                <p className="text-sm text-gray-500">{headerSubtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari siswa atau kelas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Siswa</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Trophy className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Siswa Aktif</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Trophy className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Rata-rata Aktivitas</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.average}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Daftar Siswa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudents.map((student) => (
              <Card
                key={student.id}
                className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-1"
                onClick={() => handleViewStudent(student, "kalender")}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={student.avatar} />
                        <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                          {(student.name || student.class || "?")
                            .split(" ")
                            .filter(Boolean)
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">
                          {student.name && student.name !== "Unknown"
                            ? student.name
                            : student.class
                            ? `Siswa ${student.class}`
                            : `Siswa ${student.id.slice(0, 8)}`}
                        </CardTitle>
                        <p className="text-sm text-gray-500">Kelas {student.class || "-"}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(student.status)}>
                      {getStatusText(student.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Aktivitas</span>
                      <span className="font-semibold">{student.activitiesCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Aktivitas Terakhir</span>
                      <span className="text-sm text-gray-500">{formatLastActivity(student.lastActivity)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewStudent(student, "kalender")
                      }}
                      size="sm"
                    >
                      Kalender
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewStudent(student, "detail")
                      }}
                      size="sm"
                    >
                      Detail Field
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
