import { useState, type FormEvent } from 'react'
import { ArrowRight, Building2, LockKeyhole } from 'lucide-react'
import './auth.css'

export type AuthUser = { id: string; name: string; email: string }
type AuthMode = 'login' | 'register'

export default function AuthPage({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(mode === 'register' ? { name } : {}), email, password }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
          ? result.error
          : 'We could not sign you in. Please try again.'
        throw new Error(message)
      }
      if (!result || typeof result !== 'object' || !('user' in result)) throw new Error('The server returned an invalid sign-in response.')
      const user = result.user
      if (!user || typeof user !== 'object' || !('id' in user) || !('name' in user) || !('email' in user)
        || typeof user.id !== 'string' || typeof user.name !== 'string' || typeof user.email !== 'string') {
        throw new Error('The server returned an invalid sign-in response.')
      }
      onAuthenticated({ id: user.id, name: user.name, email: user.email })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not sign you in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="auth-page">
    <header className="auth-header">
      <a className="auth-brand" href="/" aria-label="Estateflow home">
        <span className="auth-brand-mark"><Building2 size={18} strokeWidth={2.4} /></span>
        <span>estate<span>flow</span></span>
      </a>
      <span className="auth-workspace"><i /> NORTHSTAR REALTY</span>
    </header>
    <section className="auth-content">
      <div className="auth-intro">
        <span className="auth-kicker"><LockKeyhole size={13} /> YOUR WORKSPACE, READY WHEN YOU ARE</span>
        <h1>Good deals start<br />with <span>good connections.</span></h1>
        <p>Sign in to manage your leads and keep every opportunity moving.</p>
        <div className="auth-promise"><span><i /></span><div><strong>Your workspace, in sync.</strong><small>Your CRM data is available after you sign in.</small></div></div>
      </div>
      <div className="auth-card">
        <div className="auth-card-heading">
          <span className="auth-card-icon"><LockKeyhole size={17} /></span>
          <div><h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p>{mode === 'login' ? 'Sign in to open your leads workspace.' : 'Register to access the leads workspace.'}</p></div>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError('') }}>Log in</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError('') }}>Register</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && <label>Full name<input autoComplete="name" name="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your name" maxLength={100} required /></label>}
          <label>Email address<input autoComplete="email" name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" maxLength={254} required /></label>
          <label>Password<input autoComplete={mode === 'register' ? 'new-password' : 'current-password'} name="password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'} minLength={mode === 'register' ? 8 : undefined} maxLength={128} required /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Log in to Leads' : 'Create account'} {!submitting && <ArrowRight size={16} />}
          </button>
        </form>
        <p className="auth-secure-note"><LockKeyhole size={12} /> Your password is securely encrypted.</p>
      </div>
    </section>
    <footer className="auth-footer"><span>© 2026 Estateflow</span><span>Real estate, in sync.</span></footer>
  </main>
}
