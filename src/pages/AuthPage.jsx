import { useState } from 'react'
import { ArrowRight, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

function AuthPage() {
  const location = useLocation()
  const isRegister = location.pathname === '/register'
  const [message, setMessage] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setMessage('Authentication is not connected yet. No account details were sent or saved.')
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
        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && <label htmlFor="name">Your name<input id="name" name="name" autoComplete="name" required placeholder="Name" /></label>}
          <label htmlFor="email">Email address<span className="input-with-icon"><Mail size={16} aria-hidden="true" /><input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></span></label>
          <label htmlFor="password">Password<span className="input-with-icon"><LockKeyhole size={16} aria-hidden="true" /><input id="password" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={8} placeholder="At least 8 characters" /></span></label>
          <button className="button button-primary auth-submit" type="submit">{isRegister ? 'Create account' : 'Log in'} <ArrowRight size={16} aria-hidden="true" /></button>
          {message && <p className="form-status" role="status">{message}</p>}
        </form>
        <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Privoraa AI?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create an account'}</Link></p>
        <p className="auth-disclaimer">Authentication is a visual preview. Credentials are not transmitted.</p>
      </section>
    </div>
  )
}

export default AuthPage