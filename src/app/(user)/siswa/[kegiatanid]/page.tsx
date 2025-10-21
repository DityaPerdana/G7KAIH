"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"

type Field = {
  key: string
  label: string
  type: "text" | "time" | "image" | "text_image" | "multiselect"
  required?: boolean
  config?: any
  order?: number
}

type Category = {
  categoryid: string
  categoryname: string
  inputs?: Field[]
}

type SubmissionStatus = {
  canSubmit: boolean
  lastSubmittedAt: string | null
}

type KegiatanDetail = {
  kegiatanname: string
  categories: Category[]
  submissionStatus?: SubmissionStatus
}

const ALLOWED_FIELD_TYPES: Field["type"][] = ["text", "time", "image", "text_image", "multiselect"]
function normalizeFieldType(value: any): Field["type"] {
  const next = typeof value === "string" ? value.trim().toLowerCase() : ""
  return (ALLOWED_FIELD_TYPES as string[]).includes(next) ? (next as Field["type"]) : "text"
}

function coerceArray(raw: any): any[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === "object") return Object.values(parsed)
    } catch {
      return []
    }
  }
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.data)) return raw.data
    const values = Object.values(raw)
    if (values.every((item) => item && typeof item === "object")) return values
  }
  return []
}

function normalizeFields(raw: any): Field[] {
  const acc: Field[] = []
  coerceArray(raw).forEach((item: any, index: number) => {
    const key = typeof item?.key === "string" ? item.key : null
    if (!key) return
    const label = typeof item?.label === "string" ? item.label : ""
    const type = normalizeFieldType(item?.type)
    const config = item?.config && typeof item.config === "object" ? item.config : undefined
    acc.push({
      key,
      label,
      type,
      required: !!item?.required,
      order: Number.isFinite(item?.order) ? Number(item.order) : index,
      config,
    })
  })
  return acc.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

function normalizeCategories(raw: any): Category[] {
  if (!Array.isArray(raw)) return []
  const result: Category[] = []
  raw.forEach((cat: any) => {
    const rawId = cat?.categoryid
    const categoryid = typeof rawId === "string" ? rawId : rawId != null ? String(rawId) : ""
    if (!categoryid) return
    result.push({
      categoryid,
      categoryname: typeof cat?.categoryname === "string" ? cat.categoryname : "",
      inputs: normalizeFields(cat?.inputs),
    })
  })
  return result
}

function resolveOptions(field: Field): string[] {
  const raw = field?.config?.options
  if (Array.isArray(raw)) return raw.map((opt) => String(opt))
  if (typeof raw === "string") {
    return raw
      .split(/\r?\n|,/)
      .map((opt) => opt.trim())
      .filter(Boolean)
  }
  return []
}

const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024
const MAX_IMAGE_SIZE_MB = MAX_IMAGE_SIZE_BYTES / (1024 * 1024)
const MAX_IMAGE_SIZE_LABEL = MAX_IMAGE_SIZE_MB % 1 === 0 ? `${MAX_IMAGE_SIZE_MB.toFixed(0)}MB` : `${MAX_IMAGE_SIZE_MB.toFixed(1)}MB`

function formatSizeMb(bytes: number) {
  const sizeMb = bytes / (1024 * 1024)
  return sizeMb % 1 === 0 ? `${sizeMb.toFixed(0)}MB` : `${sizeMb.toFixed(1)}MB`
}

export default function SiswaKegiatanDetail() {
  const params = useParams<{ kegiatanid: string | string[] }>()
  const router = useRouter()
  const kegiatanid = Array.isArray(params?.kegiatanid)
    ? params.kegiatanid[0]
    : params?.kegiatanid

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<KegiatanDetail | null>(null)
  const [values, setValues] = React.useState<Record<string, Record<string, any>>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = React.useState<string | null>(null)
  const [fileErrors, setFileErrors] = React.useState<Record<string, string>>({})
  const locked = data?.submissionStatus?.canSubmit === false
  const lastSubmitted = data?.submissionStatus?.lastSubmittedAt
    ? new Date(data.submissionStatus.lastSubmittedAt).toLocaleString("id-ID")
    : null

  React.useEffect(() => {
    let active = true
    if (!kegiatanid) {
      setError("Kegiatan tidak ditemukan")
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/kegiatan/${kegiatanid}`, { cache: "no-store" })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(json?.error || `Gagal memuat data (${res.status})`)
        }
        const payload: KegiatanDetail | undefined = json?.data ?? json
        if (!payload) throw new Error("Data tidak ditemukan")
        if (active) {
          const submissionStatus: SubmissionStatus = payload.submissionStatus ?? {
            canSubmit: true,
            lastSubmittedAt: null,
          }
          const normalizedCategories = normalizeCategories(payload.categories)
          setData({
            kegiatanname: typeof payload.kegiatanname === "string" ? payload.kegiatanname : "",
            categories: normalizedCategories,
            submissionStatus,
          })
          const seed: Record<string, Record<string, any>> = {}
          for (const c of normalizedCategories) seed[c.categoryid] = {}
          setValues(seed)
          setFileErrors({})
        }
      } catch (e: any) {
        if (active) setError(e?.message || "Terjadi kesalahan")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [kegiatanid])

  const fieldKey = (categoryid: string, key: string) => `${categoryid}-${key}`

  const setFieldValue = (categoryid: string, key: string, val: any) => {
    if (locked) return
    setValues((prev) => ({
      ...prev,
      [categoryid]: {
        ...(prev[categoryid] || {}),
        [key]: val,
      },
    }))
  }

  const updateFileError = (fullKey: string, message: string | null) => {
    setFileErrors((prev) => {
      const next = { ...prev }
      if (message) next[fullKey] = message
      else delete next[fullKey]
      return next
    })
  }

  const validateRequired = (): string | null => {
    if (!data) return "Tidak ada data"
    for (const cat of data.categories || []) {
      for (const f of cat.inputs || []) {
        if (f.required) {
          const v = values?.[cat.categoryid]?.[f.key]
          if (
            v == null ||
            (typeof v === "string" && v.trim() === "") ||
            (Array.isArray(v) && v.length === 0)
          ) {
            return `Kolom wajib: ${f.label} (Kategori: ${cat.categoryname})`
          }
        }
      }
    }
    return null
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(null)
    if (locked) {
      setSubmitError("Kamu sudah mengirim aktivitas hari ini. Coba lagi besok.")
      return
    }
    const invalid = validateRequired()
    if (invalid) {
      setSubmitError(invalid)
      return
    }

    const activeFileError = Object.values(fileErrors).find(Boolean)
    if (activeFileError) {
      setSubmitError(activeFileError)
      return
    }

    try {
      setSubmitting(true)
      // Build multipart form-data to carry files + values JSON
      const valuesArray = (data?.categories || []).map((c) => ({
        categoryid: c.categoryid,
        fields: (c.inputs || []).map((f) => {
          const cur = values?.[c.categoryid]?.[f.key]
          if (f.type === "multiselect") {
            return { key: f.key, type: f.type, value: Array.isArray(cur) ? cur : [] }
          }
          if (f.type === "image") {
            // value stored via file part
            return { key: f.key, type: f.type, value: null }
          }
          if (f.type === "text_image") {
            const textVal = cur && typeof cur === "object" ? cur.text ?? "" : ""
            return { key: f.key, type: f.type, value: textVal }
          }
          return { key: f.key, type: f.type, value: cur ?? null }
        }),
      }))

      const fd = new FormData()
      fd.append("kegiatanid", String(kegiatanid))
      fd.append("values", JSON.stringify(valuesArray))
      for (const c of data?.categories || []) {
        for (const f of c.inputs || []) {
          const cur = values?.[c.categoryid]?.[f.key]
          if (f.type === "image" && cur instanceof File) {
            if (cur.size > MAX_IMAGE_SIZE_BYTES) {
              throw new Error(`File ${cur.name} lebih besar dari batas ${MAX_IMAGE_SIZE_LABEL}.`)
            }
            fd.append(`file:${c.categoryid}:${f.key}`, cur, cur.name)
          }
          if (f.type === "text_image" && cur && typeof cur === "object" && cur.image instanceof File) {
            const imageFile = cur.image as File
            if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
              throw new Error(`File ${imageFile.name} lebih besar dari batas ${MAX_IMAGE_SIZE_LABEL}.`)
            }
            fd.append(`file:${c.categoryid}:${f.key}`, imageFile, imageFile.name)
          }
        }
      }

      const res = await fetch("/api/aktivitas", {
        method: "POST",
        body: fd,
      })

      let rawText = ""
      try {
        rawText = await res.text()
      } catch {
        rawText = ""
      }

      let json: any = null
      if (rawText) {
        try {
          json = JSON.parse(rawText)
        } catch {
          json = null
        }
      }

      if (res.status === 409) {
        setSubmitError(json?.error || "Kamu sudah mengirim aktivitas hari ini. Coba lagi besok.")
        setData((prev) =>
          prev
            ? {
                ...prev,
                submissionStatus: {
                  canSubmit: false,
                  lastSubmittedAt: json?.last_submission ?? prev.submissionStatus?.lastSubmittedAt ?? null,
                },
              }
            : prev
        )
        return
      }

      if (res.status === 413) {
        const message = (json?.error && String(json.error)) || `Ukuran file maksimal ${MAX_IMAGE_SIZE_LABEL} per gambar.`
        setSubmitError(message)
        return
      }

      if (!res.ok) {
        const trimmed = rawText.trim()
        const fallbackMessage = json?.error
          ? String(json.error)
          : trimmed
            ? trimmed.startsWith("<")
              ? "Terjadi kesalahan pada server. Coba lagi nanti."
              : trimmed
            : "Gagal menyimpan aktivitas"
        throw new Error(fallbackMessage)
      }

      setSubmitSuccess("Aktivitas berhasil dikirim.")
  setFileErrors({})
      setTimeout(() => router.push("/siswa"), 900)
    } catch (e: any) {
      const message = e?.message || "Terjadi kesalahan saat mengirim"
      if (typeof message === "string" && message.includes("413")) {
        setSubmitError(`Ukuran file maksimal ${MAX_IMAGE_SIZE_LABEL} per gambar.`)
      } else {
        setSubmitError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (c: Category, f: Field) => {
    const fieldId = fieldKey(c.categoryid, f.key)
    const v = values?.[c.categoryid]?.[f.key]
    const disabled = locked || submitting
    const fileError = fileErrors[fieldId]

    const inputClass = "h-11 rounded-lg border-emerald-100 bg-white/80 text-sm focus-visible:border-emerald-400 focus-visible:ring-emerald-200 disabled:bg-slate-100 disabled:text-slate-500"

    switch (f.type) {
      case "text":
        return (
          <Input
            id={fieldId}
            type="text"
            className={inputClass}
            required={f.required}
            value={v ?? ""}
            disabled={disabled}
            onChange={(e) => setFieldValue(c.categoryid, f.key, e.target.value)}
            placeholder={f.label}
          />
        )
      case "time":
        return (
          <Input
            id={fieldId}
            type="time"
            className={inputClass}
            required={f.required}
            value={v ?? ""}
            disabled={disabled}
            onChange={(e) => setFieldValue(c.categoryid, f.key, e.target.value)}
          />
        )
      case "multiselect": {
        const opts = resolveOptions(f)
        const selected: string[] = Array.isArray(v) ? v : []
        return (
          <div
            id={fieldId}
            className="rounded-xl border border-dashed border-emerald-100 bg-white/70 p-3 text-sm text-slate-600"
          >
            <div className="flex flex-wrap gap-2">
              {opts.length === 0 && <span className="text-xs text-slate-500">Belum ada opsi.</span>}
              {opts.map((o) => {
                const checked = selected.includes(o)
                return (
                  <label
                    key={o}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 transition ${
                      checked
                        ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                        : "border-slate-200 bg-white/80 text-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-emerald-200 text-emerald-600"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => {
                        const next = new Set(selected)
                        if (e.target.checked) next.add(o)
                        else next.delete(o)
                        setFieldValue(c.categoryid, f.key, Array.from(next))
                      }}
                    />
                    <span>{o}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      }
      case "image":
        return (
          <div className="rounded-xl border border-dashed border-emerald-100 bg-white/70 p-3 space-y-2">
            <input
              id={fieldId}
              type="file"
              accept={f?.config?.accept || "image/*"}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100/80 file:px-4 file:py-2 file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                if (!file) {
                  updateFileError(fieldId, null)
                  setFieldValue(c.categoryid, f.key, null)
                  return
                }

                if (file.size > MAX_IMAGE_SIZE_BYTES) {
                  const message = `Ukuran file ${file.name} (${formatSizeMb(file.size)}) melebihi batas ${MAX_IMAGE_SIZE_LABEL}.`
                  updateFileError(fieldId, message)
                  setSubmitError(message)
                  setFieldValue(c.categoryid, f.key, null)
                  e.target.value = ""
                  return
                }

                updateFileError(fieldId, null)
                setSubmitError(null)
                setFieldValue(c.categoryid, f.key, file)
              }}
            />
            <p className="text-xs text-slate-500">Maksimum {MAX_IMAGE_SIZE_LABEL} per gambar. Format: JPG, PNG, atau sesuai ketentuan kegiatan.</p>
            {fileError && <p className="text-xs text-red-600">{fileError}</p>}
          </div>
        )
      case "text_image":
        return (
          <div className="space-y-3">
            <Input
              id={fieldId}
              type="text"
              className={inputClass}
              placeholder={f.label}
              value={v?.text ?? ""}
              disabled={disabled}
              onChange={(e) =>
                setFieldValue(c.categoryid, f.key, { ...(v || {}), text: e.target.value })
              }
            />
            <div className="rounded-xl border border-dashed border-emerald-100 bg-white/70 p-3 space-y-2">
              <input
                type="file"
                accept={f?.config?.accept || "image/*"}
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100/80 file:px-4 file:py-2 file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
                disabled={disabled}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  const current = (v && typeof v === "object") ? v : {}
                  if (!file) {
                    updateFileError(fieldId, null)
                    setFieldValue(c.categoryid, f.key, { ...current, image: null })
                    return
                  }

                  if (file.size > MAX_IMAGE_SIZE_BYTES) {
                    const message = `Ukuran file ${file.name} (${formatSizeMb(file.size)}) melebihi batas ${MAX_IMAGE_SIZE_LABEL}.`
                    updateFileError(fieldId, message)
                    setSubmitError(message)
                    setFieldValue(c.categoryid, f.key, { ...current, image: null })
                    e.target.value = ""
                    return
                  }

                  updateFileError(fieldId, null)
                  setSubmitError(null)
                  setFieldValue(c.categoryid, f.key, { ...current, image: file })
                }}
              />
              <p className="text-xs text-slate-500">Maksimum {MAX_IMAGE_SIZE_LABEL} per gambar. Format: JPG, PNG, atau sesuai ketentuan kegiatan.</p>
              {fileError && <p className="text-xs text-red-600">{fileError}</p>}
            </div>
          </div>
        )
      default:
        return (
          <Input
            id={fieldId}
            type="text"
            className={inputClass}
            value={v ?? ""}
            disabled={disabled}
            onChange={(e) => setFieldValue(c.categoryid, f.key, e.target.value)}
          />
        )
    }
  }

  const summary = React.useMemo(
    () => {
      if (!data) return { categoryCount: 0, requiredCount: 0, fieldCount: 0 }
      return data.categories.reduce(
        (acc, cat) => {
          acc.categoryCount += 1
          const fields = cat.inputs || []
          acc.fieldCount += fields.length
          acc.requiredCount += fields.filter((f) => f.required).length
          return acc
        },
        { categoryCount: 0, requiredCount: 0, fieldCount: 0 }
      )
    },
    [data]
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-45%] h-[540px] rounded-full bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.2),transparent_60%)]"
      />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
        <Card className="border-emerald-100/70 bg-white/85 shadow-xl shadow-emerald-100/50 backdrop-blur">
          <CardHeader className="flex flex-col gap-4 border-b border-emerald-50/60 pb-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl text-slate-900">{data?.kegiatanname || "Detail Kegiatan"}</CardTitle>
              <p className="max-w-2xl text-sm text-slate-600">
                Isi aktivitasmu sesuai kategori yang tersedia. Pastikan semua kolom wajib sudah terlengkapi sebelum dikirim.
              </p>
              {lastSubmitted && (
                <p className="text-xs text-slate-600">Terakhir mengirim: {lastSubmitted}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-3 md:items-stretch">
              <Badge
                className={
                  locked
                    ? "border border-amber-200 bg-amber-100 text-amber-800"
                    : "border border-emerald-200 bg-emerald-100 text-emerald-800"
                }
              >
                {locked ? "Sudah mengirim hari ini" : "Siap untuk dikumpulkan"}
              </Badge>
              <Button variant="ghost" size="sm" asChild className="justify-end text-emerald-600 hover:text-emerald-700">
                <Link href="/siswa">&larr; Kembali ke daftar</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 py-5 text-xs text-slate-600">
            <Badge className="border border-emerald-100 bg-white/70 text-emerald-800">
              {summary.categoryCount} kategori
            </Badge>
            <Badge className="border border-emerald-100 bg-white/70 text-emerald-800">
              {summary.fieldCount} kolom
            </Badge>
            <Badge className="border border-emerald-100 bg-emerald-50 text-emerald-700">
              {summary.requiredCount} wajib diisi
            </Badge>
          </CardContent>
        </Card>

        {loading && (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-40 rounded-2xl border border-emerald-100/60 bg-white/60" />
            <Skeleton className="h-40 rounded-2xl border border-emerald-100/60 bg-white/60" />
            <Skeleton className="h-40 rounded-2xl border border-emerald-100/60 bg-white/60" />
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50/90 text-red-700">
            <CardContent className="py-5 text-sm">{error}</CardContent>
          </Card>
        )}

        {!loading && !error && data && (
          <form onSubmit={onSubmit} className="space-y-6">
            {locked && (
                  <Card className="border-amber-200 bg-amber-50/90 text-amber-800">
                <CardContent className="space-y-1 py-4 text-sm">
                  <p className="font-medium">Pengiriman harian sudah dilakukan.</p>
                  <p className="text-xs">
                    Kamu sudah mengirim aktivitas untuk kegiatan ini hari ini{lastSubmitted ? ` (terakhir ${lastSubmitted})` : ""}. Silakan coba lagi besok.
                  </p>
                </CardContent>
              </Card>
            )}

            {data.categories?.length ? (
              data.categories.map((c) => (
                <Card key={c.categoryid} className="border-emerald-100/70 bg-white/80 shadow-sm">
                  <CardHeader className="flex flex-col gap-2 border-b border-emerald-50/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-lg text-slate-900">{c.categoryname}</CardTitle>
                    <Badge className="border border-emerald-100 bg-emerald-50 text-emerald-700">
                      {(c.inputs?.filter((f) => f.required).length || 0)} wajib diisi
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-5 py-5">
                    {(c.inputs || []).length === 0 ? (
                      <p className="text-sm text-slate-600">Tidak ada field untuk kategori ini.</p>
                    ) : (
                      (c.inputs || []).map((f) => (
                        <div key={f.key} className="space-y-3 rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-inner">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <label
                              htmlFor={`${c.categoryid}-${f.key}`}
                              className="text-sm font-medium text-slate-700"
                            >
                              {f.label}
                            </label>
                            {f.required && (
                              <Badge className="border border-rose-100 bg-rose-50 text-rose-600">Wajib</Badge>
                            )}
                          </div>
                          {renderField(c, f)}
                          <p className="text-[11px] text-slate-500">
                            {f.type === "multiselect"
                              ? "Bisa memilih lebih dari satu opsi."
                              : f.type === "image" || f.type === "text_image"
                              ? "File gambar akan dikirim dan disimpan di database."
                              : "Masukkan jawaban terbaikmu."}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-dashed border-slate-200 bg-white/80">
                <CardContent className="py-8 text-center text-sm text-slate-500">
                  Belum ada kategori untuk kegiatan ini.
                </CardContent>
              </Card>
            )}

            {submitError && (
              <Card className="border-red-200 bg-red-50/90 text-red-700">
                <CardContent className="py-4 text-sm">{submitError}</CardContent>
              </Card>
            )}
            {submitSuccess && (
              <Card className="border-emerald-200 bg-emerald-50/90 text-emerald-700">
                <CardContent className="py-4 text-sm">{submitSuccess}</CardContent>
              </Card>
            )}

            <div className="sticky bottom-6 z-10 flex flex-col gap-3 rounded-2xl border border-emerald-100/70 bg-white/90 p-4 shadow-xl backdrop-blur md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-slate-600">
                {locked
                  ? "Kamu perlu menunggu hingga esok hari untuk mengisi kembali."
                  : "Pastikan seluruh kolom wajib sudah terisi sebelum menekan tombol kirim."}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="submit"
                  disabled={submitting || locked}
                  className="bg-emerald-600 px-6 text-sm font-medium shadow-md hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {submitting ? "Mengirim…" : "Kirim Aktivitas"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/siswa")}
                  className="text-sm"
                >
                  Batal
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

