"use client"

import * as React from "react"

import { StudentsList } from "@/components/teacher/StudentsList"

export default function KepsekClassPage({ params }: { params: Promise<{ kelas: string }> }) {
  const resolvedParams = React.use(params)
  const kelasParam = resolvedParams.kelas

  const kelas = React.useMemo(() => {
    try {
      return decodeURIComponent(kelasParam)
    } catch {
      return kelasParam
    }
  }, [kelasParam])

  return <StudentsList variant="kepsek" kelas={kelas} />
}
