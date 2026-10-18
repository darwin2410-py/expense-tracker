import { dayLabel, formatIDR, groupByDay } from '../utils'

export default function ExpenseList({ expenses, categories, today, onEdit }) {
  const byId = new Map(categories.map(c => [c.id, c]))

  return groupByDay(expenses).map(group => (
    <section key={group.date} className="day fade-up">
      <div className="day-head">
        <span>{dayLabel(group.date, today)}</span>
        <span>{formatIDR(group.total)}</span>
      </div>
      <div className="card day-list">
        {group.items.map(e => {
          const cat = byId.get(e.category_id)
          return (
            <button key={e.id} className="expense" onClick={() => onEdit(e)}>
              <span className={`chip-dot${cat ? '' : ' none'}`} style={cat ? { '--chip-color': cat.color } : undefined} />
              <span className="expense-main">
                <span className="expense-cat">{cat?.name || 'Uncategorized'}</span>
                {e.note && <span className="expense-note">{e.note}</span>}
              </span>
              <span className="expense-amount">{formatIDR(e.amount)}</span>
            </button>
          )
        })}
      </div>
    </section>
  ))
}
