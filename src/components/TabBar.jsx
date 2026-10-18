const ICONS = {
  add: <path d="M12 5v14M5 12h14" />,
  activity: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  budget: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2" /></>,
  insight: <path d="M5 20V11M12 20V4M19 20v-6" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
}

const TABS = [
  { key: 'add', label: 'Add' },
  { key: 'activity', label: 'Activity' },
  { key: 'budget', label: 'Budget' },
  { key: 'insight', label: 'Insight' },
  { key: 'more', label: 'More' },
]

export default function TabBar({ tab, onChange }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(t => (
        <button key={t.key} type="button" className={`tab${tab === t.key ? ' active' : ''}`}
          aria-current={tab === t.key ? 'page' : undefined} onClick={() => onChange(t.key)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[t.key]}
          </svg>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
