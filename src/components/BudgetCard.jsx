import { formatIDR } from '../utils'

export default function BudgetCard({ rows }) {
  return (
    <div className="card budgets">
      <div className="budgets-head">
        <span className="summary-label">This period</span>
      </div>
      <ul className="budget-list">
        {rows.map(r => {
          const state = r.pct > 100 ? 'over' : r.pct >= 80 ? 'near' : ''
          return (
            <li key={r.id} className={`budget ${state}`}>
              <div className="budget-head">
                <span className="cat-badge small" style={r.color ? { '--chip-color': r.color } : undefined} aria-hidden="true">{r.emoji || '∑'}</span>
                <span className="budget-name">{r.name}</span>
                <span className="budget-amount">{formatIDR(r.spent)} <small>/ {formatIDR(r.budget)}</small></span>
              </div>
              <div className="breakdown-track">
                <div className="budget-bar" style={{ width: `${Math.min(r.pct, 100)}%` }} />
              </div>
              <div className="budget-left">
                {r.left >= 0 ? `${formatIDR(r.left)} left` : `${formatIDR(-r.left)} over budget`}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
