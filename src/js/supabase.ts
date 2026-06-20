import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase: any

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your_supabase') || supabaseAnonKey.includes('your_supabase')) {
  console.warn('Supabase not configured. Authentication features will be disabled.')
  // Create a mock client for development
  const mockClient = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      signUp: () => Promise.reject(new Error('Supabase not configured')),
      signInWithPassword: () => Promise.reject(new Error('Supabase not configured')),
      signInWithOAuth: () => Promise.reject(new Error('Supabase not configured')),
      signOut: () => Promise.reject(new Error('Supabase not configured')),
      resetPasswordForEmail: () => Promise.reject(new Error('Supabase not configured')),
      updateUser: () => Promise.reject(new Error('Supabase not configured')),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    }
  }
  
  supabase = mockClient
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })

  // Auth event listeners
  supabase.auth.onAuthStateChange((event: any, session: any) => {
    console.log('Auth state changed:', event, session?.user?.email)
    
    // Dispatch custom event for UI updates
    const authEvent = new CustomEvent('authStateChange', {
      detail: { event, session, user: session?.user }
    })
    document.dispatchEvent(authEvent)
  })
}

export { supabase }