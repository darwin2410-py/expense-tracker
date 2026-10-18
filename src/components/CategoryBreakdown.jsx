import { formatIDR } from '../utils'

export default function CategoryBreakdown({ rows, total, showCount = false }) {
  return (
    <ul className="breakdown">
      {rows.map(r => {
        const pct = Math.round(r.total / total * 100)
        return (
          <li key={r.id ?? 'none'}>
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
          </li>
        )
      })}
    </ul>
  )
}
