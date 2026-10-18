import { formatIDR } from '../utils'

// With onSelect, each named category is a button that filters by it
export default function CategoryBreakdown({ rows, total, showCount = false, selectedId = null, onSelect }) {
  return (
    <ul className={`breakdown${selectedId ? ' has-selection' : ''}`}>
      {rows.map(r => {
        const pct = Math.round(r.total / total * 100)
        const content = <>
          <div className="breakdown-head">
            <span className={`chip-dot${r.color ? '' : ' none'}`} style={r.color ? { '--chip-color': r.color } : undefined} />
            <span className="breakdown-name">
              {r.name}
              {showCount && <span className="breakdown-count"> ({r.count})</span>}
            </span>
            <span className="breakdown-amount">{formatIDR(r.total)}</span>
            <span className="breakdown-pct">{pct}%</span>
          </div>
          <div className="breakdown-track">
            <div className={`breakdown-bar${r.color ? '' : ' none'}`}
              style={{ width: `${pct}%`, ...(r.color && { '--chip-color': r.color }) }} />
          </div>
        </>
        return (
          <li key={r.id ?? 'none'} className={selectedId === r.id ? 'selected' : ''}>
            {onSelect && r.id
              ? <button className="breakdown-btn" aria-pressed={selectedId === r.id}
                  onClick={() => onSelect(selectedId === r.id ? null : r.id)}>{content}</button>
              : content}
          </li>
        )
      })}
    </ul>
  )
}
