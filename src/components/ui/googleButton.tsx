'use client'

import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'

interface GoogleSignInButtonProps {
  origin?: string
}

export default function GoogleSignInButton({ origin = '/' }: GoogleSignInButtonProps) {
  const supabase = createClient()

  const handleGoogleSignIn = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const destination = origin?.startsWith('/') ? origin : '/'
    const redirectUrl = baseUrl
      ? `${baseUrl}/auth/callback?origin=${encodeURIComponent(destination)}`
      : `https://g7kaih.tefa-bcs.org/auth/callback?origin=${encodeURIComponent(destination)}`

  const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    })
    
    if (error) {
      console.error('Error signing in:', error)
    }
  }

  return (
    <button 
      onClick={handleGoogleSignIn}
      className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-all duration-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <Image src='/googlelogo.svg' alt='google logo' width={20} height={20}/>
      <span className="text-sm font-medium">Continue with Google</span>
    </button>
  )
}