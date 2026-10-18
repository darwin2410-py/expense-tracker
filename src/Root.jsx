import { useEffect, useState } from 'react'
import App from './App.jsx'
import Login from './components/Login.jsx'
import { supabase } from './supabase'

export default function Root() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div className="loading display">
      <div className="loading-mark">Rp</div>
      <div className="loading-text">Loading</div>
    </div>
  )
  if (!session) return <Login />
  return <App key={session.user.id} userId={session.user.id} />
}
