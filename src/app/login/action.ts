'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { sanitizeRedirectPath } from '@/utils/lib/sanitize-redirect'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    // Return specific error messages based on error type
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('Email atau password salah. Silakan periksa kembali.')
    } else if (error.message.includes('Email not confirmed')) {
      throw new Error('Email belum dikonfirmasi. Silakan periksa email Anda.')
    } else if (error.message.includes('Too many requests')) {
      throw new Error('Terlalu banyak percobaan login. Silakan coba lagi nanti.')
    } else {
      throw new Error(error.message || 'Terjadi kesalahan saat login')
    }
  }

  const requestedRedirect = sanitizeRedirectPath(formData.get('origin'))

  if (requestedRedirect) {
    try {
      await revalidatePath(requestedRedirect)
      await revalidatePath('/', 'layout')
    } catch (err) {
      // Ignore revalidation errors for dynamic paths
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Revalidation skipped for path:', requestedRedirect, err)
      }
    }
    redirect(requestedRedirect)
  }

  // Get user profile and redirect based on role
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('userid, username, roleid')
      .eq('userid', user.id)
      .single()

    if (profile?.roleid) {
      // Get role name
      const { data: roleData } = await supabase
        .from('role')
        .select('rolename')
        .eq('roleid', profile.roleid)
        .single()

      const roleName = roleData?.rolename

      // Redirect based on role
      switch (roleName) {
        case 'admin':
          redirect('/dashboard')
        case 'student':
          redirect('/siswa')
        case 'teacher':
          redirect('/guru')
        case 'guruwali':
          redirect('/guruwali')
        case 'parent':
          redirect('/orangtua')
        case 'unknown':
          redirect('/unknown')
        default:
          redirect('/unknown')
      }
    } else {
      redirect('/unknown')
    }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    redirect('/error')
  }

  // New signups always go to unknown for approval
  revalidatePath('/', 'layout')
  redirect('/unknown')
}