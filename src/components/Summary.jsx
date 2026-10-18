import { formatIDR, formatNumber, monthLabel, totalsByCategory } from '../utils'

export default function Summary({ month, isCurrentMonth, expenses, categories, onPrev, onNext }) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const rows = totalsByCategory(expenses, categories)

  return (
    <div className="card summary fade-up" style={{ animationDelay: '0.05s' }}>
      <div className="month-nav">
        <button className="month-btn" onClick={onPrev} aria-label="Previous month">&#8249;</button>
        <span>{monthLabel(month)}</span>
        <button className="month-btn" onClick={onNext} disabled={isCurrentMonth} aria-label="Next month">&#8250;</button>
      </div>

      <div className="summary-label">Total spent</div>
      <div className="summary-total serif"><small>Rp</small>{formatNumber(total)}</div>
      <div className="summary-count">
        {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
      </div>

      {rows.length > 0 && (
        <ul className="breakdown">
          {rows.map(r => {
            const pct = Math.round(r.total / total * 100)
            return (
              <li key={r.id ?? 'none'}>
                <div className="breakdown-head">
                  <span className={`chip-dot${r.color ? '' : ' none'}`} style={r.color ? { '--chip-color': r.color } : undefined} />
                  <span className="breakdown-name">{r.name}</span>
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
      )}
    </div>
  )
}
