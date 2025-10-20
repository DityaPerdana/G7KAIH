"use client"

import { Button } from '@/components/ui/button'
import GoogleSignInButton from '@/components/ui/googleButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { Suspense, useEffect, useState } from 'react'
import { login } from './action'
import { sanitizeRedirectPath } from '@/utils/lib/sanitize-redirect'

declare global {
  interface Window {
    grecaptcha: {
      render: (element: string, opts: { sitekey: string }) => void
      getResponse: () => string
      reset: () => void
    }
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageSkeleton() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="animate-pulse space-y-6 w-full max-w-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-gray-200" />
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-3 w-28 bg-gray-100 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-12 bg-gray-100 rounded" />
          <div className="h-12 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}

function LoginPageContent() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const originParam = sanitizeRedirectPath(searchParams.get('origin')) ?? '/'

  useEffect(() => {
    if (document.getElementById("recaptcha-script")) return
    
    // Fungsi untuk render reCAPTCHA setelah siap
    const renderRecaptcha = () => {
      const sitekey = process.env.NEXT_PUBLIC_DATA_SITEKEY
      if (sitekey && window.grecaptcha && window.grecaptcha.render) {
        try {
          window.grecaptcha.render("recaptcha-container", {
            sitekey: sitekey,
          })
        } catch (error) {
          console.error("Error rendering reCAPTCHA:", error)
        }
      }
    }

    // Set callback global untuk reCAPTCHA
    (window as any).onRecaptchaLoad = renderRecaptcha

    const script = document.createElement("script")
    script.id = "recaptcha-script"
    script.src = `https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit`
    script.async = true
    script.defer = true
    document.body.appendChild(script)
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    
    try {
      // Tunggu grecaptcha siap
      if (!window.grecaptcha || !window.grecaptcha.getResponse) {
        setError("reCAPTCHA belum siap. Silakan reload halaman.")
        setLoading(false)
        return
      }
      
      const token = window.grecaptcha.getResponse()
      if (!token) {
        setError("Silakan selesaikan reCAPTCHA terlebih dahulu.")
        setLoading(false)
        return
      }
      
      const formData = new FormData(e.currentTarget)
      formData.append("g-recaptcha-response", token)
      
      if (!formData.get('origin')) {
        formData.append('origin', originParam)
      }

      await login(formData)
      router.refresh()
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err?.message || "Terjadi kesalahan saat login. Silakan coba lagi.")
    } finally {
      setLoading(false)
      // Reset reCAPTCHA setelah submit
      if (window.grecaptcha && window.grecaptcha.reset) {
        window.grecaptcha.reset()
      }
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start pt-16 px-6">
      {/* Logo */}
      <div className="mb-8">
        <Image 
          src='/bcslogo.webp' 
          alt='logo smk 4 pyk' 
          width={120} 
          height={120}
          className="rounded-full"
        />
      </div>

      {/* Title and Subtitle */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Login page
        </h1>
        <p className="text-gray-500 text-sm">
          Halaman login G7KAIH
        </p>
      </div>

      {/* Email and Password Login Form */}
      <div className="w-full max-w-sm mb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="origin" value={originParam} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Masukkan email anda"
              required
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan password anda"
                required
                className="w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7-1.275 4.057-5.065 7-9.543 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {/* Google reCAPTCHA v2 widget */}
          <div className="my-4">
            <div id="recaptcha-container"></div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Memproses..." : "Login"}
          </Button>
        </form>
      </div>

      {/* Divider */}
      <div className="w-full max-w-sm mb-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">Atau</span>
          </div>
        </div>
      </div>

      {/* Google Sign In Button */}
      <div className="w-full max-w-sm mb-6">
        <GoogleSignInButton origin={originParam} />
      </div>

      {/* Terms and Conditions */}
      <div className="flex items-start mb-8 w-full max-w-sm">
        <label htmlFor="terms" className="text-sm text-gray-600">
          Dengan menggunakan aplikasi anda setuju dengan{' '}
          <Link href="/tos" className="text-blue-600 underline">
            Term of Service kami.
          </Link>
        </label>
      </div>
    </div>
  )
}