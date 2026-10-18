import { useState } from 'react'
import { formatIDR, totalsByCategory } from '../utils'
import CategoryBreakdown from './CategoryBreakdown'

export default function Summary({ expenses, incomeTotal, categories, selectedCategory, onSelectCategory }) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const rows = totalsByCategory(expenses, categories)
  const balance = incomeTotal - total
  const [showAll, setShowAll] = useState(false)
  // Top three keep the list close to the top; the selected one always shows
  const shown = showAll ? rows : rows.filter((r, i) => i < 3 || r.id === selectedCategory)

  return (
    <div className="card summary">
      <div className="summary-label">Total spent</div>
      <div className="summary-total display"><span className="highlight">{formatIDR(total)}</span></div>
      <div className="summary-count">
        {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
      </div>

      {incomeTotal > 0 && (
        <div className="income-line">
          <span>Income <b>{formatIDR(incomeTotal)}</b></span>
          <span className={balance < 0 ? 'negative' : 'positive'}>
            {balance < 0 ? 'Overspent' : 'Left over'} <b>{formatIDR(Math.abs(balance))}</b>
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <CategoryBreakdown rows={shown} total={total} selectedId={selectedCategory} onSelect={onSelectCategory} />
      )}
      {rows.length > 3 && (
        <button className="link-btn" aria-expanded={showAll} onClick={() => setShowAll(s => !s)}>
          {showAll ? 'Show less' : `Show all ${rows.length} categories`}
        </button>
      )}
    </div>
  )
}
