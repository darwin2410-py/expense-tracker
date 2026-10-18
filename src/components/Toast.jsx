import { useEffect } from 'react'

export default function Toast({ message, type, action, duration = 2500, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, duration)
    return () => clearTimeout(t)
  }, [onDone, duration])

  return (
    <div className={`toast${type === 'error' ? ' error' : ''}`} role="status">
      {message}
      {action && <button className="toast-action" onClick={action.onClick}>{action.label}</button>}
    </div>
  )
}
