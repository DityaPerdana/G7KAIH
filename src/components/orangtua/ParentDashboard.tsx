"use client"

import { CommentSection } from "@/components/komentar/CommentSection"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCurrentUser } from "@/hooks/use-current-user"
import { AlertCircle, Calendar, CheckCircle, ChevronLeft, ChevronRight, GraduationCap, MessageCircle, User } from "lucide-react"
import { useEffect, useState } from "react"

type Student = {
  userid: string
  username: string
  kelas: string | null
  email: string | null
}

type Parent = {
  userid: string
  username: string
  email: string | null
  roleid: number
}

type FieldValue = {
  id: string
  value: any
  validation: {
    byTeacher: boolean
    byParent: boolean
    status: "pending" | "teacher_validated" | "parent_validated" | "fully_validated"
  }
  timestamps: {
    created: string
    updated: string
  }
  field: {
    id: string
    key: string
    label: string
    type: "text" | "time" | "image" | "text_image" | "multiselect"
    required: boolean
    config: any
    order: number
    category: {
      id: string
      name: string
    }
  }
  activity: {
    id: string
    name: string
    content?: string
    status?: string
    timestamps: {
      created: string
      updated: string
    }
    kegiatan: {
      id: string
      name: string
    }
    category: {
      id: string
      name: string
    }
  }
}

type StudentActivitiesData = {
  student: Student
  activities: FieldValue[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters: {
    kegiatanId?: string
    categoryId?: string
    validationStatus?: string
  }
}

type Activity = {
  id: string
  title: string
  type: "category" | "habit" | "task" | "achievement"
  status?: "completed" | "pending" | "missed"
  time: string
  description?: string
  points?: number
  count?: number
  activityIds?: string[]
  validatedByTeacher?: boolean
  validatedByParent?: boolean
}

type ParentStudentData = {
  parent: Parent
  student: Student | null
  relationship_status: "no_relationship" | "linked" | "broken_link"
  available_students?: Student[]
  message?: string
}

export function ParentDashboard() {
  const { userId: currentUserId, loading: userLoading } = useCurrentUser()
  const [data, setData] = useState<ParentStudentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linkingStudent, setLinkingStudent] = useState(false)
  const [studentActivities, setStudentActivities] = useState<StudentActivitiesData | null>(null)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"activities" | "comments">("activities")
  const [validationFilter, setValidationFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ]

  const fetchParentStudentData = async () => {
    try {
      setError(null)
      setLoading(true)
      const response = await fetch("/api/orangtua/siswa")
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch parent-student data")
      }

      setData(result.data)
    } catch (err: any) {
      console.error("Error fetching parent-student data:", err)
      setError(err.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const linkToStudent = async (studentId: string) => {
    try {
      setLinkingStudent(true)
      setError(null)
      
      const response = await fetch("/api/orangtua/siswa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ student_userid: studentId }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to link to student")
      }

      // Refresh data after successful linking
      await fetchParentStudentData()
    } catch (err: any) {
      console.error("Error linking to student:", err)
      setError(err.message || "Failed to link to student")
    } finally {
      setLinkingStudent(false)
    }
  }

  const fetchStudentActivities = async (page: number = 1) => {
    if (!data?.student) return
    
    try {
      setActivitiesLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20"
      })
      
      if (validationFilter !== "all") {
        params.append("validationStatus", validationFilter)
      }

      if (data.student?.userid) {
        params.set("studentId", data.student.userid)
      }
      
      const response = await fetch(`/api/orangtua/siswa/activities?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch student activities")
      }

      setStudentActivities(result.data)
    } catch (err: any) {
      console.error("Error fetching student activities:", err)
      setStudentActivities(null)
    } finally {
      setActivitiesLoading(false)
    }
  }

  const validateActivity = async (fieldValueId: string, isValidated: boolean) => {
    try {
      const response = await fetch("/api/orangtua/siswa/activities", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fieldValueId,
          isValidatedByParent: isValidated
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update validation")
      }

      // Refresh activities after validation
      await fetchStudentActivities(currentPage)
    } catch (err: any) {
      console.error("Error validating activity:", err)
      setError(err.message || "Failed to validate activity")
    }
  }

  useEffect(() => {
    if (currentUserId) {
      fetchParentStudentData()
    }
  }, [currentUserId])

  useEffect(() => {
    if (data?.student) {
      fetchStudentActivities(1)
      setCurrentPage(1)
    }
  }, [data?.student, validationFilter])

  if (userLoading || loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!currentUserId) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Anda harus login untuk mengakses halaman ini</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error}</p>
            <Button onClick={fetchParentStudentData} className="mt-4">
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data?.student) {
    return (
      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            
            {data?.relationship_status === "broken_link" ? (
              <>
                <AlertCircle className="mx-auto h-8 w-8 text-orange-500 mb-2" />
                <h3 className="text-lg font-semibold mb-2 text-orange-600">Koneksi Siswa Bermasalah</h3>
                <p className="text-gray-600 mb-4">
                  Koneksi dengan siswa mengalami masalah. Silakan pilih siswa yang baru.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-2">Belum Ada Siswa Terkait</h3>
                <p className="text-gray-600 mb-4">
                  Belum ada siswa yang terkait dengan akun orang tua Anda.
                </p>
              </>
            )}

            {data?.message && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-4">
                <p className="text-sm text-blue-600">{data.message}</p>
              </div>
            )}

            {/* Student Selection */}
            {data?.available_students && data.available_students.length > 0 && (
              <div className="max-w-md mx-auto">
                <h4 className="text-md font-medium mb-3">Pilih Siswa untuk Dimonitor:</h4>
                {linkingStudent ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-600">Menghubungkan dengan siswa...</p>
                  </div>
                ) : (
                  <Select onValueChange={(value) => linkToStudent(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih siswa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {data.available_students.map((student) => (
                        <SelectItem key={student.userid} value={student.userid}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{student.username}</span>
                            {student.kelas && (
                              <span className="text-sm text-gray-500">Kelas: {student.kelas}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {(!data?.available_students || data.available_students.length === 0) && (
              <p className="text-sm text-gray-500">
                Tidak ada siswa yang tersedia. Silakan hubungi admin.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const student = data.student

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dashboard Orang Tua
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${student.username}`} />
              <AvatarFallback>{student.username?.charAt(0) || "S"}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold">{student.username}</h3>
              <p className="text-sm text-gray-600">Kelas: {student.kelas || "Tidak diketahui"}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">Siswa</Badge>
                {data?.relationship_status === "linked" && (
                  <div className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    <span>Terhubung</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "activities" ? "default" : "outline"}
          onClick={() => setActiveTab("activities")}
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          Aktivitas Siswa
        </Button>
        <Button
          variant={activeTab === "comments" ? "default" : "outline"}
          onClick={() => setActiveTab("comments")}
          className="flex items-center gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          Komentar
        </Button>
      </div>

      {/* Activities Tab */}
      {activeTab === "activities" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Aktivitas {student.username}</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={validationFilter} onValueChange={setValidationFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter validasi..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="pending">Menunggu Validasi</SelectItem>
                    <SelectItem value="teacher">Divalidasi Guru</SelectItem>
                    <SelectItem value="parent">Divalidasi Ortu</SelectItem>
                    <SelectItem value="both">Validasi Lengkap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 border rounded animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : !studentActivities || studentActivities.activities.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {validationFilter === "all" 
                    ? "Belum ada aktivitas yang disubmit" 
                    : "Tidak ada aktivitas dengan filter validasi ini"}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {studentActivities.activities.map((fieldValue) => (
                    <div key={fieldValue.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-lg">{fieldValue.activity.name}</h4>
                          <p className="text-sm text-gray-600">
                            {fieldValue.activity.kegiatan.name} - {fieldValue.activity.category.name}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge 
                            variant={
                              fieldValue.validation.status === "fully_validated" ? "default" :
                              fieldValue.validation.status === "teacher_validated" ? "secondary" :
                              fieldValue.validation.status === "parent_validated" ? "outline" : 
                              "secondary"
                            }
                          >
                            {fieldValue.validation.status === "fully_validated" ? "Validasi Lengkap" :
                             fieldValue.validation.status === "teacher_validated" ? "Divalidasi Guru" :
                             fieldValue.validation.status === "parent_validated" ? "Divalidasi Ortu" : 
                             "Menunggu Validasi"}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(fieldValue.timestamps.created).toLocaleDateString("id-ID")}
                          </span>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {fieldValue.field.category.name}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {fieldValue.field.label}
                          </span>
                          {fieldValue.field.required && (
                            <span className="text-red-500 text-xs">*wajib</span>
                          )}
                        </div>
                        
                        <div className="bg-gray-50 p-3 rounded">
                          {fieldValue.field.type === "text" && (
                            <p className="text-sm">{fieldValue.value}</p>
                          )}
                          {fieldValue.field.type === "time" && (
                            <p className="text-sm">⏰ {fieldValue.value}</p>
                          )}
                          {fieldValue.field.type === "image" && (
                            <div className="text-sm text-blue-600">🖼️ Gambar telah diupload</div>
                          )}
                          {fieldValue.field.type === "text_image" && (
                            <div>
                              <p className="text-sm mb-2">{fieldValue.value?.text || ""}</p>
                              {fieldValue.value?.image && (
                                <div className="text-sm text-blue-600">🖼️ Gambar telah diupload</div>
                              )}
                            </div>
                          )}
                          {fieldValue.field.type === "multiselect" && (
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(fieldValue.value) && fieldValue.value.map((option: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {option}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <CheckCircle className={`h-4 w-4 ${fieldValue.validation.byTeacher ? "text-green-500" : "text-gray-300"}`} />
                            <span className={fieldValue.validation.byTeacher ? "text-green-600" : "text-gray-500"}>
                              Guru
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CheckCircle className={`h-4 w-4 ${fieldValue.validation.byParent ? "text-blue-500" : "text-gray-300"}`} />
                            <span className={fieldValue.validation.byParent ? "text-blue-600" : "text-gray-500"}>
                              Orang Tua
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {!fieldValue.validation.byParent ? (
                            <Button
                              size="sm"
                              onClick={() => validateActivity(fieldValue.id, true)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Validasi
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => validateActivity(fieldValue.id, false)}
                            >
                              Batalkan Validasi
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {studentActivities.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="text-sm text-gray-600">
                      Halaman {studentActivities.pagination.page} dari {studentActivities.pagination.totalPages}
                      ({studentActivities.pagination.total} total aktivitas)
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!studentActivities.pagination.hasPrev}
                        onClick={() => {
                          const newPage = currentPage - 1
                          setCurrentPage(newPage)
                          fetchStudentActivities(newPage)
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!studentActivities.pagination.hasNext}
                        onClick={() => {
                          const newPage = currentPage + 1
                          setCurrentPage(newPage)
                          fetchStudentActivities(newPage)
                        }}
                      >
                        Selanjutnya
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comments Tab */}
      {activeTab === "comments" && (
        <CommentSection siswaId={student.userid} currentUserId={currentUserId} />
      )}
    </div>
  )
}
