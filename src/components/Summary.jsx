import { formatNumber, monthLabel, totalsByCategory } from '../utils'
import CategoryBreakdown from './CategoryBreakdown'

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
        <CategoryBreakdown rows={rows} total={total} />
      )}
    </div>
  )
}
