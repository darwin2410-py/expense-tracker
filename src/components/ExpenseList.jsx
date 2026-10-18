import { dayLabel, formatIDR, groupByDay } from '../utils'

export default function ExpenseList({ items, categories, today, onEdit }) {
  const byId = new Map(categories.map(c => [c.id, c]))

  return groupByDay(items).map(group => (
    <section key={group.date} className="day">
      <div className="day-head">
        <span>{dayLabel(group.date, today)}</span>
        {group.total > 0 && <span>{formatIDR(group.total)}</span>}
      </div>
      <div className="card day-list">
        {group.items.map(e => {
          if (e.kind === 'income') return (
            <button key={e.id} className="expense income" onClick={() => onEdit(e)}>
              <span className="chip-dot" />
              <span className="expense-main">
                <span className="expense-cat">Income</span>
                {e.note && <span className="expense-note">{e.note}</span>}
              </span>
              <span className="expense-amount">+{formatIDR(e.amount)}</span>
            </button>
          )
          const cat = byId.get(e.category_id)
          return (
            <button key={e.id} className="expense" onClick={() => onEdit(e)}>
              <span className={`chip-dot${cat ? '' : ' none'}`} style={cat ? { '--chip-color': cat.color } : undefined} />
              <span className="expense-main">
                <span className="expense-cat">
                  {cat?.name || 'Uncategorized'}
                  {e.recurring_id && <span className="recurring-tag" title="Recurring"> &#8635;</span>}
                </span>
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
