"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectEmpty, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select-improved"
import { isParentRole } from "@/utils/lib/roles"
import { Link, Unlink, Users } from "lucide-react"
import { useEffect, useState } from "react"

type User = {
  userid: string
  username: string
  email: string | null
  roleid: number
  kelas: string | null
  parent_of_userid?: string | null
}

type ParentStudentRelation = {
  parent: User
  student: User | null
}

export function ParentStudentManager() {
  const [parents, setParents] = useState<User[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [relations, setRelations] = useState<ParentStudentRelation[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedParent, setSelectedParent] = useState<string>("")
  const [selectedStudent, setSelectedStudent] = useState<string>("")

  const fetchData = async () => {
    try {
      setError(null)
      
      // Fetch all users
      const response = await fetch("/api/user-profiles")
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch users")
      }

      const users = result.data || []
      
      // Separate parents and students
  const parentUsers = users.filter((u: User) => isParentRole(u.roleid))
      const studentUsers = users.filter((u: User) => u.roleid === 5)
      
      setParents(parentUsers)
      setStudents(studentUsers)

      // Build relations
      const relationList: ParentStudentRelation[] = parentUsers.map((parent: User) => {
        const student = parent.parent_of_userid 
          ? studentUsers.find((s: User) => s.userid === parent.parent_of_userid)
          : null
        
        return { parent, student: student || null }
      })

      setRelations(relationList)
    } catch (err: any) {
      console.error("Error fetching data:", err)
      setError(err.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRelation = async () => {
    if (!selectedParent || !selectedStudent) {
      setError("Pilih orang tua dan siswa")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/link-parent-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          parentId: selectedParent, 
          studentId: selectedStudent 
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create relation")
      }

      // Reset form
      setSelectedParent("")
      setSelectedStudent("")
      
      // Refresh data
      await fetchData()
    } catch (err: any) {
      console.error("Error creating relation:", err)
      setError(err.message || "Failed to create relation")
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveRelation = async (parentId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus relasi ini?")) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Update parent to remove relation
      const response = await fetch(`/api/user-profiles/${parentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_of_userid: null }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to remove relation")
      }

      // Refresh data
      await fetchData()
    } catch (err: any) {
      console.error("Error removing relation:", err)
      setError(err.message || "Failed to remove relation")
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manajemen Relasi Orang Tua - Siswa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Create New Relation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Orang Tua</label>
              <Select value={selectedParent} onValueChange={setSelectedParent}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih orang tua..." />
                </SelectTrigger>
                <SelectContent searchable searchPlaceholder="Cari orang tua...">
                  {parents.length === 0 ? (
                    <SelectEmpty>Tidak ada orang tua tersedia</SelectEmpty>
                  ) : (
                    parents.map((parent) => (
                      <SelectItem 
                        key={parent.userid} 
                        value={parent.userid}
                        searchableText={`${parent.username} ${parent.email}`}
                      >
                        {parent.username} ({parent.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Siswa</label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih siswa..." />
                </SelectTrigger>
                <SelectContent searchable searchPlaceholder="Cari siswa...">
                  {students.length === 0 ? (
                    <SelectEmpty>Tidak ada siswa tersedia</SelectEmpty>
                  ) : (
                    students.map((student) => (
                      <SelectItem 
                        key={student.userid} 
                        value={student.userid}
                        searchableText={`${student.username} ${student.kelas}`}
                      >
                        {student.username} - {student.kelas}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleCreateRelation}
              disabled={submitting || !selectedParent || !selectedStudent}
              className="flex items-center gap-2"
            >
              <Link className="h-4 w-4" />
              {submitting ? "Menghubungkan..." : "Hubungkan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Relations */}
      <Card>
        <CardHeader>
          <CardTitle>Relasi yang Ada</CardTitle>
        </CardHeader>
        <CardContent>
          {relations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Belum ada relasi orang tua - siswa</p>
          ) : (
            <div className="space-y-3">
              {relations.map((relation) => (
                <div key={relation.parent.userid} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">{relation.parent.username}</div>
                      <div className="text-sm text-gray-600">{relation.parent.email}</div>
                      <Badge variant="secondary">Orang Tua</Badge>
                    </div>
                    
                    {relation.student ? (
                      <>
                        <div className="text-gray-400">→</div>
                        <div>
                          <div className="font-medium">{relation.student.username}</div>
                          <div className="text-sm text-gray-600">Kelas: {relation.student.kelas}</div>
                          <Badge variant="outline">Siswa</Badge>
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-500 italic">Belum terhubung dengan siswa</div>
                    )}
                  </div>

                  {relation.student && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveRelation(relation.parent.userid)}
                      disabled={submitting}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Unlink className="h-4 w-4" />
                      Putus
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
