import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const creds = { email: email.trim(), password }
    const { data, error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword(creds)
      : await supabase.auth.signUp({ ...creds, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (error) { setMessage({ type: 'error', text: error.message }); return }
    if (mode === 'signup' && !data.session) {
      setMessage({ type: 'info', text: 'Check your email to confirm your account, then sign in.' })
      setMode('signin')
    }
  }

  return (
    <div className="page dotted">
      <div className="container">
        <form className="card login fade-up" onSubmit={submit}>
          <h1 className="display">My Expenses</h1>
          <p className="login-sub">{mode === 'signin' ? 'Sign in to continue' : 'Create your account'}</p>
          <input className="input" type="email" autoComplete="email" placeholder="Email"
            value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password} onChange={e => setPassword(e.target.value)} required />
          {message && <p className={`login-msg ${message.type}`}>{message.text}</p>}
          <button className="login-btn" type="submit" disabled={busy}>
            {busy ? '...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
          <button type="button" className="login-switch"
            onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setMessage(null) }}>
            {mode === 'signin' ? 'No account yet? Sign up' : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
