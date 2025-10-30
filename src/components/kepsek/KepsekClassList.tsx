"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Users, Trophy, GraduationCap } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"

const CLASS_CACHE_TTL = 60_000

export type ClassSummary = {
  kelas: string
  totalStudents: number
  activeStudents: number
  averageActivity: number
  lastActivity?: string | null
}

function formatLastActivity(value?: string | null) {
  if (!value) return "Belum ada aktivitas"
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Belum ada aktivitas"
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return "Belum ada aktivitas"
  }
}

export function KepsekClassList() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const deferredSearch = useDeferredValue(searchTerm)
  const cacheRef = useRef<{ data: ClassSummary[]; timestamp: number } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadClasses = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && cacheRef.current) {
      const { data, timestamp } = cacheRef.current
      if (Date.now() - timestamp < CLASS_CACHE_TTL) {
        setClasses(data)
        setLoading(false)
        return
      }
    }

    setLoading(true)
    setError(null)
    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch("/api/kepsek/classes", {
        cache: "no-store",
        signal: controller.signal,
      })
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json?.error || "Gagal memuat daftar kelas")
      }

      const data: ClassSummary[] = json?.data ?? []
      setClasses(data)
      cacheRef.current = { data, timestamp: Date.now() }
    } catch (err) {
      if (!controller.signal.aborted) {
        const message = err instanceof Error ? err.message : "Gagal memuat daftar kelas"
        setError(message)
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadClasses()
    return () => abortRef.current?.abort()
  }, [loadClasses])

  const filteredClasses = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return classes
    return classes.filter((item) => item.kelas.toLowerCase().includes(query))
  }, [classes, deferredSearch])

  const metrics = useMemo(() => {
    const totalClasses = classes.length
    const totalStudents = classes.reduce((acc, cls) => acc + cls.totalStudents, 0)
    const activeStudents = classes.reduce((acc, cls) => acc + cls.activeStudents, 0)
    return { totalClasses, totalStudents, activeStudents }
  }, [classes])

  const handleOpenClass = (kelas: string) => {
    router.push(`/kepsek/kelas/${encodeURIComponent(kelas)}`)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">Memuat data kelas…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-600">{error}</div>
        <Button className="mt-4" onClick={() => loadClasses(true)}>
          Muat Ulang
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Panel Kelas</h1>
                <p className="text-sm text-gray-500">Pilih kelas untuk melihat daftar siswa</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari kelas..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
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
                  <GraduationCap className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Kelas</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.totalClasses}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Siswa</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.totalStudents}</p>
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
                  <p className="text-sm font-medium text-gray-600">Siswa Aktif</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.activeStudents}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Daftar Kelas</h2>
          {filteredClasses.length === 0 ? (
            <div className="text-sm text-gray-500">Tidak ada kelas yang cocok dengan pencarian.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClasses.map((kelasItem) => (
                <Card
                  key={kelasItem.kelas}
                  className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-1"
                  onClick={() => handleOpenClass(kelasItem.kelas)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Kelas {kelasItem.kelas}</CardTitle>
                      <span className="text-xs font-medium text-primary uppercase tracking-wide">{kelasItem.totalStudents} siswa</span>
                    </div>
                    <p className="text-sm text-gray-500">Aktivitas terakhir: {formatLastActivity(kelasItem.lastActivity)}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Siswa Aktif</span>
                        <span className="font-semibold">{kelasItem.activeStudents}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Rata-rata Aktivitas</span>
                        <span className="font-semibold">{kelasItem.averageActivity}</span>
                      </div>
                    </div>
                    <Button
                      className="w-full mt-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleOpenClass(kelasItem.kelas)
                      }}
                      size="sm"
                    >
                      Lihat Siswa
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
