"use client"

import { CommentSection } from "@/components/komentar/CommentSection"
import { StudentActivities } from "@/components/orangtua/StudentActivities"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import LogoutButton from "@/components/ui/logoutButton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCurrentUser } from "@/hooks/use-current-user"
import { Activity, GraduationCap, MessageCircle, User } from "lucide-react"
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

type ParentStudentData = {
  parent: Parent
  student: Student | null
  relationship_status: "no_relationship" | "linked" | "broken_link"
  available_students?: Student[]
  message?: string
}

export default function OrangTuaPage() {
  const { userId: currentUserId, loading: userLoading } = useCurrentUser()
  const [data, setData] = useState<ParentStudentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("activities")

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
      console.log('Parent-student data fetched:', result.data)
      console.log('Relationship status:', result.data?.relationship_status)
      console.log('Student data:', result.data?.student)
    } catch (err: any) {
      console.error("Error fetching parent-student data:", err)
      setError(err.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentUserId) {
      fetchParentStudentData()
    }
  }, [currentUserId])

  useEffect(() => {
    if (!userLoading && !currentUserId) {
      setLoading(false)
    }
  }, [userLoading, currentUserId])

  if (userLoading || loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
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
            <button 
              onClick={fetchParentStudentData} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Coba Lagi
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-600">Tidak ada data</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (data.relationship_status === "linked" && data.student) {
    console.log('Parent-student relationship is linked:', data.student)
    console.log('About to render StudentActivities with studentId:', data.student.userid)
    return (
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dashboard Orang Tua - {data.parent.username}
              </CardTitle>
              <LogoutButton />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <Avatar className="h-16 w-16">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${data.student.username}`} />
                <AvatarFallback className="text-lg">
                  {data.student.username?.charAt(0)?.toUpperCase() || "S"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-green-800">
                  Ananda: {data.student.username}
                </h3>
                <p className="text-green-600">
                  Kelas: {data.student.kelas || "Tidak diketahui"}
                </p>
                {data.student.email && (
                  <p className="text-sm text-green-600">
                    Email: {data.student.email}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">
                    Siswa Terhubung
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs untuk konten */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          
          <TabsContent value="activities" className="mt-6">
            <StudentActivities studentId={data.student.userid} />
          </TabsContent>
          
          <TabsContent value="comments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Komentar untuk {data.student.username}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-2">
                  Berikan komentar, saran, atau pertanyaan terkait aktivitas anak Anda
                </p>
              </CardHeader>
              <CardContent>
                {currentUserId ? (
                  <CommentSection 
                    siswaId={data.student.userid} 
                    currentUserId={currentUserId} 
                  />
                ) : (
                  <p className="text-gray-500">Loading...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Profil Siswa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Nama</label>
                    <p className="text-lg font-semibold">{data.student.username}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Kelas</label>
                    <p className="text-lg">{data.student.kelas || "Tidak diketahui"}</p>
                  </div>
                  {data.student.email && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      <p className="text-lg">{data.student.email}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <div className="mt-1">
                      <Badge variant="default" className="bg-green-600">
                        Aktif
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dashboard Orang Tua - {data.parent.username}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Student Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Informasi Siswa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.student ? (
            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <Avatar className="h-16 w-16">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${data.student.username}`} />
                <AvatarFallback className="text-lg">
                  {data.student.username?.charAt(0)?.toUpperCase() || "S"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-green-800">
                  {data.student.username}
                </h3>
                <p className="text-green-600">
                  Kelas: {data.student.kelas || "Tidak diketahui"}
                </p>
                {data.student.email && (
                  <p className="text-sm text-green-600">
                    Email: {data.student.email}
                  </p>
                )}
                <div className="mt-2">
                  <Badge variant="default" className="bg-green-600">
                    Siswa Terhubung
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <GraduationCap className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-gray-600">
                {data.relationship_status === "broken_link" 
                  ? "Koneksi Siswa Bermasalah"
                  : "Belum Ada Siswa Terhubung"
                }
              </h3>
              <p className="text-gray-500 mb-4">
                {data.message || "Belum ada siswa yang terhubung dengan akun orang tua Anda."}
              </p>
              
              {data.available_students && data.available_students.length > 0 ? (
                <div className="max-w-md mx-auto">
                  <p className="text-sm text-gray-600 mb-4">
                    Siswa yang tersedia: {data.available_students.length} siswa
                  </p>
                  <div className="space-y-2">
                    {data.available_students.map((student) => (
                      <div key={student.userid} className="p-3 border rounded text-left">
                        <span className="font-medium">{student.username}</span>
                        {student.kelas && (
                          <span className="text-sm text-gray-500 ml-2">
                            - Kelas: {student.kelas}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Tidak ada siswa yang tersedia. Silakan hubungi admin.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status Koneksi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${
              data.relationship_status === "linked" ? "bg-green-500" :
              data.relationship_status === "broken_link" ? "bg-red-500" :
              "bg-gray-400"
            }`}></div>
            <span className="font-medium">
              {data.relationship_status === "linked" ? "Terhubung dengan siswa" :
               data.relationship_status === "broken_link" ? "Koneksi bermasalah" :
               "Belum terhubung"}
            </span>
          </div>
          {data.relationship_status === "linked" && data.student && (
            <p className="text-sm text-gray-600 mt-2">
              Anda terhubung dengan siswa: <strong>{data.student.username}</strong>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}