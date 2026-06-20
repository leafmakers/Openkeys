import { supabase } from './supabase'
import { User, Session } from '@supabase/supabase-js'

export class AuthService {
  private currentUser: User | null = null
  private currentSession: Session | null = null

  constructor() {
    this.initialize()
  }

  private async initialize() {
    // Get current session on startup
    const { data: { session } } = await supabase.auth.getSession()
    this.currentSession = session
    this.currentUser = session?.user ?? null
  }

  // Sign up with email and password
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  // Sign in with email and password
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    
    this.currentSession = data.session
    this.currentUser = data.user
    return data
  }

  // Sign in with Google
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })

    if (error) throw error
    return data
  }

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    
    this.currentSession = null
    this.currentUser = null
  }

  // Reset password
  async resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) throw error
    return data
  }

  // Update password
  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) throw error
    return data
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.currentUser
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUser
  }

  // Get current session (includes access token)
  getCurrentSession(): Session | null {
    return this.currentSession
  }

  // Get access token for API calls
  getAccessToken(): string | null {
    return this.currentSession?.access_token ?? null
  }
}

// Export singleton instance
export const authService = new AuthService()