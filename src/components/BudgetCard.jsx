import { formatIDR } from '../utils'

export default function BudgetCard({ rows, onManage }) {
  return (
    <div className="card budgets">
      <div className="budgets-head">
        <span className="summary-label">Budgets</span>
        <button className="link-btn" onClick={onManage}>Edit</button>
      </div>
      <ul className="budget-list">
        {rows.map(r => {
          const state = r.pct > 100 ? 'over' : r.pct >= 80 ? 'near' : ''
          return (
            <li key={r.id} className={`budget ${state}`}>
              <div className="budget-head">
                {r.color && <span className="chip-dot" style={{ '--chip-color': r.color }} />}
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
