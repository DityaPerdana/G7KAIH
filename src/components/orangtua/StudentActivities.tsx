"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity, Calendar, CheckCircle, Clock, Filter, GraduationCap, RotateCcw, User } from "lucide-react"
import React, { useEffect, useState } from "react"

type ValidationStatus = 'pending' | 'teacher_validated' | 'parent_validated' | 'fully_validated'

type FieldValue = {
  id: string
  value: any
  validation: {
    byTeacher: boolean
    byParent: boolean
    status: ValidationStatus
  }
  timestamps: {
    created: string
    updated: string
  }
  field: {
    id: string
    key: string
    label: string
    type: 'text' | 'time' | 'image' | 'text_image' | 'multiselect'
    required: boolean
    config?: any
    order: number
    category: {
      id: string
      name: string
    }
  }
  files?: Array<{
    filename: string
    url: string
    contentType: string
    createdAt: string
  }>
  activity: {
    id: string
    name: string
    content?: string
    status: string
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

type Student = {
  userid: string
  username: string
  email: string | null
  kelas: string | null
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

interface StudentActivitiesProps {
  studentId: string
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDateOnly(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function groupActivitiesByDate(activities: FieldValue[]): Record<string, FieldValue[]> {
  const groups: Record<string, FieldValue[]> = {}
  
  activities.forEach(activity => {
    const dateKey = new Date(activity.timestamps.created).toDateString()
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(activity)
  })
  
  // Sort activities within each group by time (newest first)
  Object.keys(groups).forEach(dateKey => {
    groups[dateKey].sort((a, b) => 
      new Date(b.timestamps.created).getTime() - new Date(a.timestamps.created).getTime()
    )
  })
  
  return groups
}

function groupActivitiesByActivity(activities: FieldValue[]): Record<string, FieldValue[]> {
  const groups: Record<string, FieldValue[]> = {}
  
  activities.forEach(activity => {
    const activityKey = `${activity.activity.kegiatan.name} - ${activity.activity.category.name}`
    if (!groups[activityKey]) {
      groups[activityKey] = []
    }
    groups[activityKey].push(activity)
  })
  
  // Sort activities within each group by time (newest first)
  Object.keys(groups).forEach(activityKey => {
    groups[activityKey].sort((a, b) => 
      new Date(b.timestamps.created).getTime() - new Date(a.timestamps.created).getTime()
    )
  })
  
  return groups
}

function getValidationBadge(status: ValidationStatus) {
  switch (status) {
    case 'fully_validated':
      return <Badge className="bg-green-600">Tervalidasi Lengkap</Badge>
    case 'teacher_validated':
      return <Badge className="bg-blue-600">Tervalidasi Guru</Badge>
    case 'parent_validated':
      return <Badge className="bg-yellow-600">Tervalidasi Orang Tua</Badge>
    case 'pending':
    default:
      return <Badge variant="outline">Menunggu Validasi</Badge>
  }
}

function renderFieldValue(field: FieldValue['field'], value: any, files?: any[], activityId?: string) {
  // Handle JSON string values and clean up quotes
  let parsedValue = value
  
  console.log('Rendering field:', field.label, 'Type:', field.type, 'Raw value:', value, 'Files:', files)
  
  if (typeof value === 'string') {
    // Remove surrounding quotes if they exist
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      parsedValue = value.slice(1, -1)
    } else if (value.startsWith('{') || value.startsWith('[')) {
      // Try to parse JSON objects/arrays
      try {
        parsedValue = JSON.parse(value)
      } catch {
        parsedValue = value
      }
    } else {
      parsedValue = value
    }
  }

  // Handle empty or null values
  if (parsedValue === null || parsedValue === undefined || parsedValue === '' || parsedValue === '""' || parsedValue === "''") {
    // Check if there are files for this field
    if (files && files.length > 0) {
      return (
        <div className="space-y-2">
          <span className="text-gray-500 italic">Tidak ada teks</span>
          {files.map((file, index) => {
            console.log('Loading image from Cloudinary:', file.url)
            return (
              <div key={index} className="mt-2">
                <img 
                  src={file.url}
                  alt={file.filename || field.label}
                  className="max-w-xs max-h-48 object-cover rounded border shadow-sm"
                  onError={(e) => {
                    console.error('Image load error for:', file.url)
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.nextElementSibling?.classList.remove('hidden')
                  }}
                  onLoad={() => {
                    console.log('Image loaded successfully:', file.url)
                  }}
                />
                <div className="hidden text-gray-500 text-sm mt-2">
                  Gambar tidak dapat dimuat: {file.filename}
                </div>
              </div>
            )
          })}
        </div>
      )
    }
    return <span className="text-gray-500 italic">Tidak ada data</span>
  }

  console.log('Parsed value:', parsedValue)

  switch (field.type) {
    case 'text':
      return <span className="font-medium text-gray-900">{String(parsedValue)}</span>
    case 'time':
      return (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          <span className="font-medium">{String(parsedValue)}</span>
        </div>
      )
    case 'image':
      if (parsedValue && typeof parsedValue === 'string' && parsedValue.length > 0) {
        return (
          <div className="mt-2">
            <img 
              src={parsedValue} 
              alt={field.label}
              className="max-w-xs max-h-48 object-cover rounded border shadow-sm"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                target.nextElementSibling?.classList.remove('hidden')
              }}
            />
            <div className="hidden text-gray-500 text-sm mt-2">
              Gambar tidak dapat dimuat
            </div>
          </div>
        )
      }
      return <span className="text-gray-500">Tidak ada gambar</span>
    case 'text_image':
      if (parsedValue && typeof parsedValue === 'object') {
        return (
          <div className="space-y-3">
            {parsedValue.text && parsedValue.text.trim() && (
              <div className="bg-white p-3 rounded border">
                <p className="font-medium text-gray-900">{parsedValue.text}</p>
              </div>
            )}
            {parsedValue.image && parsedValue.image.trim() && (
              <img 
                src={parsedValue.image} 
                alt={field.label}
                className="max-w-xs max-h-48 object-cover rounded border shadow-sm"
              />
            )}
          </div>
        )
      } else if (parsedValue && typeof parsedValue === 'string') {
        // Handle simple text input for text_image field
        return (
          <div className="space-y-3">
            <div className="bg-white p-3 rounded border">
              <p className="font-medium text-gray-900">{parsedValue}</p>
            </div>
            {/* Show files if available */}
            {files && files.length > 0 && files.map((file, index) => {
              console.log('Loading image from Cloudinary (with text):', file.url)
              return (
                <div key={index} className="mt-2">
                  <img 
                    src={file.url}
                    alt={file.filename || field.label}
                    className="max-w-xs max-h-48 object-cover rounded border shadow-sm"
                    onError={(e) => {
                      console.error('Image load error for:', file.url)
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.nextElementSibling?.classList.remove('hidden')
                    }}
                    onLoad={() => {
                      console.log('Image loaded successfully:', file.url)
                    }}
                  />
                  <div className="hidden text-gray-500 text-sm mt-2">
                    Gambar tidak dapat dimuat: {file.filename}
                  </div>
                </div>
              )
            })}
          </div>
        )
      } else if (files && files.length > 0) {
        // Only files, no text
        return (
          <div className="space-y-3">
            {files.map((file, index) => {
              console.log('Loading image from Cloudinary (files only):', file.url)
              return (
                <div key={index} className="mt-2">
                  <img 
                    src={file.url}
                    alt={file.filename || field.label}
                    className="max-w-xs max-h-48 object-cover rounded border shadow-sm"
                    onError={(e) => {
                      console.error('Image load error for:', file.url)
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.nextElementSibling?.classList.remove('hidden')
                    }}
                    onLoad={() => {
                      console.log('Image loaded successfully:', file.url)
                    }}
                  />
                  <div className="hidden text-gray-500 text-sm mt-2">
                    Gambar tidak dapat dimuat: {file.filename}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
      return <span className="text-gray-500">Tidak ada data</span>
    case 'multiselect':
      // Handle comma-separated values or array
      let options: string[] = []
      if (typeof parsedValue === 'string') {
        // Split by comma and clean up each option
        options = parsedValue.split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0 && item !== '""' && item !== "''")
      } else if (Array.isArray(parsedValue)) {
        options = parsedValue.filter(item => item && item.trim && item.trim().length > 0)
      }
      
      if (options.length > 0) {
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((item, index) => (
              <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800">
                {item}
              </Badge>
            ))}
          </div>
        )
      }
      return <span className="text-gray-500">Tidak ada pilihan</span>
    default:
      return <span className="font-medium text-gray-900">{String(parsedValue)}</span>
  }
}

export function StudentActivities({ studentId }: StudentActivitiesProps) {
  const [data, setData] = useState<StudentActivitiesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [validationFilter, setValidationFilter] = useState<string>('')
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'activity'>('date')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [kegiatanFilter, setKegiatanFilter] = useState<string>('')
  const [availableCategories, setAvailableCategories] = useState<Array<{id: string, name: string}>>([])
  const [availableKegiatan, setAvailableKegiatan] = useState<Array<{id: string, name: string}>>([])

  const fetchActivities = async (currentPage = 1, filters: Record<string, string> = {}) => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        ...filters,
        ...(categoryFilter && { categoryId: categoryFilter }),
        ...(kegiatanFilter && { kegiatanId: kegiatanFilter })
      })

      if (studentId) {
        params.set('studentId', studentId)
      }

      console.log('Fetching activities with params:', params.toString())
      
      const response = await fetch(`/api/orangtua/siswa/activities?${params}`)
      const result = await response.json()

      console.log('API Response:', result)
      console.log('Activities in response:', result.data?.activities?.length)
      console.log('Sample activity from response:', result.data?.activities?.[0])

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch activities')
      }

      // Debug logging for field values
      if (result.data && result.data.activities && result.data.activities.length > 0) {
        console.log('Field values received:', result.data.activities.length)
        result.data.activities.forEach((fv: any, index: number) => {
          console.log(`Field value ${index}:`, {
            id: fv.id,
            field_label: fv.field?.label,
            field_type: fv.field?.type,
            raw_value: fv.value,
            validated: fv.validation,
            aktivitas: fv.activity?.id
          })
        })
      } else {
        console.log('No field values in response')
      }

      setData(result.data || { activities: [], student: null, pagination: null })
      
      // Extract available categories and kegiatan from the data
      if (result.data?.activities) {
        const categories = new Map<string, string>()
        const kegiatan = new Map<string, string>()
        
        result.data.activities.forEach((activity: any) => {
          if (activity.field?.category?.id && activity.field?.category?.name) {
            categories.set(activity.field.category.id, activity.field.category.name)
          }
          if (activity.activity?.kegiatan?.id && activity.activity?.kegiatan?.name) {
            kegiatan.set(activity.activity.kegiatan.id, activity.activity.kegiatan.name)
          }
        })
        
        setAvailableCategories(Array.from(categories, ([id, name]) => ({ id, name })))
        setAvailableKegiatan(Array.from(kegiatan, ([id, name]) => ({ id, name })))
      }
    } catch (err: any) {
      console.error('Error fetching activities:', err)
      setError(err.message || 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  const handleValidationToggle = async (fieldValueId: string, currentStatus: boolean) => {
    try {
      setValidatingId(fieldValueId)
      
      const response = await fetch('/api/orangtua/siswa/activities', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fieldValueId,
          isValidatedByParent: !currentStatus
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update validation')
      }

      // Refresh the data
      await fetchActivities(page, validationFilter ? { validationStatus: validationFilter } : {})
    } catch (err: any) {
      console.error('Error updating validation:', err)
      alert(`Error: ${err.message}`)
    } finally {
      setValidatingId(null)
    }
  }

  const handleFilterChange = (filter: string) => {
    setValidationFilter(filter)
    setPage(1)
    fetchActivities(1, filter ? { validationStatus: filter } : {})
  }

  const handleCategoryChange = (categoryId: string) => {
    setCategoryFilter(categoryId)
    setPage(1)
    const filters: Record<string, string> = {}
    if (validationFilter) filters.validationStatus = validationFilter
    if (kegiatanFilter) filters.kegiatanId = kegiatanFilter
    if (categoryId) filters.categoryId = categoryId
    fetchActivities(1, filters)
  }

  const handleKegiatanChange = (kegiatanId: string) => {
    setKegiatanFilter(kegiatanId)
    setPage(1)
    const filters: Record<string, string> = {}
    if (validationFilter) filters.validationStatus = validationFilter
    if (categoryFilter) filters.categoryId = categoryFilter
    if (kegiatanId) filters.kegiatanId = kegiatanId
    fetchActivities(1, filters)
  }

  const handleResetFilters = () => {
    setValidationFilter('')
    setCategoryFilter('')
    setKegiatanFilter('')
    setPage(1)
    fetchActivities(1, {})
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchActivities(newPage, validationFilter ? { validationStatus: validationFilter } : {})
  }

  useEffect(() => {
    fetchActivities()
  }, [])

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Siswa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Siswa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">Error: {error}</p>
            <Button onClick={() => fetchActivities()}>
              Coba Lagi
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  console.log('Render check - data:', !!data)
  console.log('Render check - data.activities:', !!data?.activities)
  console.log('Render check - data.activities.length:', data?.activities?.length)

  if (!data || !data.activities || data.activities.length === 0) {
    const hasActiveFilters = validationFilter || categoryFilter || kegiatanFilter
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Siswa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-gray-600">
              {hasActiveFilters ? "Tidak Ada Aktivitas Sesuai Filter" : "Belum Ada Aktivitas"}
            </h3>
            <p className="text-gray-500 mb-4">
              {hasActiveFilters 
                ? "Tidak ada aktivitas yang sesuai dengan filter yang dipilih." 
                : "Siswa belum mengisi aktivitas apapun."
              }
            </p>
            {hasActiveFilters && (
              <Button 
                onClick={handleResetFilters}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Tampilkan Semua Aktivitas
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header dengan info siswa dan statistik */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Aktivitas Siswa - {data.student.username}
          </CardTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{data.pagination.total}</div>
              <div className="text-sm text-gray-600">Total Aktivitas</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {data.activities.filter(a => a.validation.status === 'fully_validated').length}
              </div>
              <div className="text-sm text-gray-600">Tervalidasi Lengkap</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {data.activities.filter(a => a.validation.status === 'pending').length}
              </div>
              <div className="text-sm text-gray-600">Menunggu Validasi</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {sortBy === 'date' 
                  ? Object.keys(groupActivitiesByDate(data.activities)).length
                  : Object.keys(groupActivitiesByActivity(data.activities)).length
                }
              </div>
              <div className="text-sm text-gray-600">
                {sortBy === 'date' ? 'Hari Aktif' : 'Jenis Aktivitas'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
            <span>Kelas: {data.student.kelas || '-'}</span>
          </div>
        </CardHeader>
      </Card>

      {/* Filter dan Kontrol */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter & Pengaturan
            </CardTitle>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Urutkan:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as 'date' | 'activity')}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="date">Berdasarkan Tanggal</option>
                <option value="activity">Berdasarkan Aktivitas</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter Dropdown */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Kegiatan:</label>
              <select 
                value={kegiatanFilter} 
                onChange={(e) => handleKegiatanChange(e.target.value)}
                className="w-full text-sm border rounded px-3 py-2"
              >
                <option value="">Semua Kegiatan</option>
                {availableKegiatan.map(kegiatan => (
                  <option key={kegiatan.id} value={kegiatan.id}>
                    {kegiatan.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Kategori:</label>
              <select 
                value={categoryFilter} 
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full text-sm border rounded px-3 py-2"
              >
                <option value="">Semua Kategori</option>
                {availableCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={handleResetFilters}
                variant="outline"
                className="flex items-center gap-2"
                size="sm"
              >
                <RotateCcw className="h-4 w-4" />
                Reset Filter
              </Button>
            </div>
          </div>
          
          {/* Filter Status Validasi */}
          <div className="mb-2">
            <label className="block text-sm font-medium mb-2">Status Validasi:</label>
          </div>
          <div className="flex flex-wrap gap-2">{/* validation filter buttons */}
            <Button
              size="sm"
              variant={validationFilter === '' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('')}
            >
              Semua
            </Button>
            <Button
              size="sm"
              variant={validationFilter === 'pending' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('pending')}
            >
              Menunggu Validasi
            </Button>
            <Button
              size="sm"
              variant={validationFilter === 'teacher' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('teacher')}
            >
              Tervalidasi Guru
            </Button>
            <Button
              size="sm"
              variant={validationFilter === 'parent' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('parent')}
            >
              Tervalidasi Orang Tua
            </Button>
            <Button
              size="sm"
              variant={validationFilter === 'both' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('both')}
            >
              Tervalidasi Lengkap
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Daftar Aktivitas - Dikelompokkan berdasarkan tanggal atau aktivitas */}
      <div className="space-y-6">
        {(() => {
          const groupedActivities = sortBy === 'date' 
            ? groupActivitiesByDate(data.activities)
            : groupActivitiesByActivity(data.activities)
          
          const sortedKeys = Object.keys(groupedActivities).sort((a, b) => {
            if (sortBy === 'date') {
              return new Date(b).getTime() - new Date(a).getTime()
            } else {
              return a.localeCompare(b)
            }
          })

          if (sortedKeys.length === 0) {
            return (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2 text-gray-600">
                      Tidak Ada Aktivitas
                    </h3>
                    <p className="text-gray-500">
                      Tidak ada aktivitas ditemukan untuk filter yang dipilih.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          return sortedKeys.map((groupKey) => {
            const activitiesForGroup = groupedActivities[groupKey]
            
            let groupLabel = groupKey
            let groupIcon = Calendar
            
            if (sortBy === 'date') {
              const dateObj = new Date(groupKey)
              const isToday = dateObj.toDateString() === new Date().toDateString()
              const isYesterday = dateObj.toDateString() === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()
              
              groupLabel = formatDateOnly(groupKey)
              if (isToday) {
                groupLabel = `Hari Ini - ${groupLabel}`
              } else if (isYesterday) {
                groupLabel = `Kemarin - ${groupLabel}`
              }
              groupIcon = Calendar
            } else {
              groupIcon = Activity
            }

            return (
              <div key={groupKey} className="space-y-4">
                {/* Header Grup */}
                <div className="sticky top-0 bg-white z-10 border-b pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {React.createElement(groupIcon, { className: "h-5 w-5 text-blue-600" })}
                      <h2 className="text-lg font-semibold text-gray-800">{groupLabel}</h2>
                      <Badge variant="outline" className="text-xs">
                        {activitiesForGroup.length} aktivitas
                      </Badge>
                    </div>
                    
                    {/* Ringkasan validasi untuk grup ini */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>{activitiesForGroup.filter((a: FieldValue) => a.validation.status === 'fully_validated').length} lengkap</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <span>{activitiesForGroup.filter((a: FieldValue) => a.validation.status === 'pending').length} pending</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span>{activitiesForGroup.filter((a: FieldValue) => a.validation.byParent && !a.validation.byTeacher).length} orangtua</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Aktivitas untuk grup ini */}
                <div className="space-y-4 ml-8">
                  {activitiesForGroup.map((fieldValue: FieldValue) => (
                    <Card key={fieldValue.id} className="shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <CardTitle className="text-base flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              {fieldValue.activity.name || 'Aktivitas Tanpa Nama'}
                            </CardTitle>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(fieldValue.timestamps.created)}
                              </span>
                              <span>Kegiatan: {fieldValue.activity.kegiatan.name}</span>
                              <span>Kategori: {fieldValue.activity.category.name}</span>
                            </div>
                          </div>
                          <div className="ml-4">
                            {getValidationBadge(fieldValue.validation.status)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Field Data */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-gray-800">
                                {fieldValue.field.label}
                              </h4>
                              <Badge variant="outline" className="text-xs">
                                {fieldValue.field.type}
                              </Badge>
                            </div>
                            <div className="text-gray-700">
                              {renderFieldValue(fieldValue.field, fieldValue.value, fieldValue.files)}
                            </div>
                          </div>

                          {/* Validasi Status dan Actions */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span className={fieldValue.validation.byTeacher ? "text-green-600 font-medium" : "text-gray-400"}>
                                  {fieldValue.validation.byTeacher ? "✓ Guru" : "○ Guru"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <GraduationCap className="h-4 w-4" />
                                <span className={fieldValue.validation.byParent ? "text-green-600 font-medium" : "text-gray-400"}>
                                  {fieldValue.validation.byParent ? "✓ Orang Tua" : "○ Orang Tua"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={fieldValue.validation.byParent ? "destructive" : "default"}
                                onClick={() => handleValidationToggle(fieldValue.id, fieldValue.validation.byParent)}
                                disabled={validatingId === fieldValue.id}
                              >
                                {validatingId === fieldValue.id ? (
                                  <>
                                    <Clock className="h-3 w-3 animate-spin mr-1" />
                                    Loading...
                                  </>
                                ) : fieldValue.validation.byParent ? (
                                  "Batalkan Validasi"
                                ) : (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Validasi
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Timestamps */}
                          {fieldValue.timestamps.updated !== fieldValue.timestamps.created && (
                            <div className="text-xs text-gray-500 border-t pt-2">
                              <span>Diperbarui: {formatDate(fieldValue.timestamps.updated)}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })
        })()}
      </div>

      {/* Pagination */}
      {data.pagination.totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Halaman {data.pagination.page} dari {data.pagination.totalPages} 
                ({data.pagination.total} total aktivitas)
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!data.pagination.hasPrev || loading}
                >
                  Sebelumnya
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!data.pagination.hasNext || loading}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
