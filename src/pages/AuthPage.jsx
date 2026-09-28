import { useState } from 'react'
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

function AuthPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, authMode, supabaseConfiguration, isInitializing, authError, signIn, register, startFounderPreview } = useAuth()
  const isRegister = location.pathname === '/register'
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (isInitializing) {
    return <div className="auth-loading" role="status">Checking your session…</div>
  }

  if (user && !busy) {
    const destination = user.role === 'founder' && user.permissionState === 'normal'
      ? '/founder'
      : user.permissionState === 'unknown'
        ? '/access-denied'
        : '/'
    return <Navigate to={destination} replace />
  }

  const destination = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search ?? ''}`
    : '/'

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(true)
    setMessage('')
    const fields = new FormData(form)
    const credentials = Object.fromEntries(fields.entries())

    try {
      if (isRegister) await register({ email: credentials.email, password: credentials.password, name: credentials.name })
      else await signIn({ email: credentials.email, password: credentials.password })
      navigate(destination, { replace: true })
    } catch (error) {
      if (error?.code === 'email_confirmation_required') form.reset()
      setMessage(error?.safe ? error.message : 'Authentication could not be completed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleFounderPreview() {
    setBusy(true)
    setMessage('')
    try {
      await startFounderPreview()
      navigate('/founder', { replace: true })
    } catch {
      setMessage('Founder preview is unavailable for this authentication adapter.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-aside">
        <span className="brand-mark"><Sparkles size={19} aria-hidden="true" /></span>
        <p className="eyebrow">PRIVORAA AI</p>
        <h1>Create.<br />Learn.<br />Imagine.</h1>
          <p>A creative space for visual learning, built with curiosity and care.</p>
      </section>
      <section className="panel auth-panel">
        <p className="eyebrow">YOUR WORKSPACE</p>
        <h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2>
        <p className="auth-copy">{isRegister ? 'Start a new learning workspace.' : 'Log in to continue to your workspace.'}</p>
        <div className="auth-mode-note"><ShieldCheck size={15} aria-hidden="true" /><span>{authMode === 'demo' ? `UI-only demo authentication. Supabase public config: ${supabaseConfiguration.status}. No credentials are sent to a server.` : supabaseConfiguration.configured ? 'Supabase Auth is active. Role and permission state are read from the protected database profile.' : `Supabase Auth is unavailable (${supabaseConfiguration.status}). Sign-in fails closed until valid public configuration is supplied.`}</span></div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && <label htmlFor="name">Your name<input id="name" name="name" autoComplete="name" required placeholder="Name" /></label>}
          <label htmlFor="email">Email address<span className="input-with-icon"><Mail size={16} aria-hidden="true" /><input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></span></label>
          <label htmlFor="password">Password<span className="input-with-icon"><LockKeyhole size={16} aria-hidden="true" /><input id="password" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={8} placeholder="At least 8 characters" /></span></label>
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? isRegister ? 'Creating account…' : 'Signing in…' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={16} aria-hidden="true" /></button>
          {(message || authError) && <p className="form-status" role="status">{message || authError}</p>}
        </form>
        {!isRegister && authMode === 'demo' && (
          <div className="founder-preview-action">
            <span>For interface review only</span>
            <button className="button button-secondary" type="button" disabled={busy} onClick={handleFounderPreview}><ShieldCheck size={15} aria-hidden="true" /> Preview founder area</button>
          </div>
        )}
        <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Privoraa AI?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create an account'}</Link></p>
        <p className="auth-disclaimer">UI/demo authentication is not identity verification or security. Production access must be authorized by the backend.</p>
      </section>
    </div>
  )
}

export default AuthPage