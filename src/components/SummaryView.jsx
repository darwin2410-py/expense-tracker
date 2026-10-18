import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { formatIDR, getTodayKey, monthLabel, monthlyStats, monthsBack, periodKeyFor, periodRange, shiftMonth, shortMonthLabel } from '../utils'
import Chip from './Chip'
import CategoryBreakdown from './CategoryBreakdown'

const RANGES = [6, 12]

function changeText(change) {
  if (change === null) return null
  return `${change > 0 ? '+' : ''}${change}%`
}

function changeClass(change) {
  if (!change) return ''
  return change > 0 ? ' up' : ' down'
}

export default function SummaryView({ userId, categories, startDay, onOpenMonth }) {
  const today = getTodayKey()
  const currentMonth = periodKeyFor(today, startDay)
  const [range, setRange] = useState(6)
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState(currentMonth)

  // Always load 13 months so the oldest month shown still has a "last month"
  useEffect(() => {
    async function load() {
      const start = periodRange(shiftMonth(currentMonth, -12), startDay).start
      const end = periodRange(currentMonth, startDay).end
      const [exp, inc] = await Promise.all([
        supabase.from('expenses').select('amount, category_id, date').eq('user_id', userId).gte('date', start).lt('date', end),
        supabase.from('incomes').select('amount, date').eq('user_id', userId).gte('date', start).lt('date', end),
      ])
      const error = exp.error || inc.error
      if (error) { console.error('summary error:', error); setFailed(true); return }
      setData({ expenses: exp.data, incomes: inc.data })
    }
    load()
  }, [userId, currentMonth, startDay])

  if (failed) return (
    <div className="empty">
      {navigator.onLine ? 'Could not load the summary. Try again later.' : 'The summary needs a connection. Try again when you are back online.'}
    </div>
  )

  if (!data) return <div className="empty" role="status">Loading...</div>

  const stats = monthlyStats(data.expenses, monthsBack(currentMonth, range), categories, today, data.incomes, startDay)
  const max = Math.max(...stats.map(s => s.total), 1)
  const sel = stats.find(s => s.month === selected) || stats[stats.length - 1]

  function pickRange(r) {
    setRange(r)
    if (!monthsBack(currentMonth, r).includes(selected)) setSelected(currentMonth)
  }

  return (
    <>

    <div className="chip-row range-tabs">
      {RANGES.map(r => (
        <Chip key={r} active={range === r} onClick={() => pickRange(r)}>{r} months</Chip>
      ))}
    </div>

    <div className="card chart-card fade-up" style={{ animationDelay: '0.05s' }}>
      <div className="summary-label">{monthLabel(sel.month)}</div>
      <div className="summary-total display">{formatIDR(sel.total)}</div>
      <div className="summary-count">Tap a bar to see that month</div>

      <div className="bars">
        {stats.map(s => (
          <button key={s.month}
            className={`bar-col${s.month === sel.month ? ' active' : ''}`}
            onClick={() => setSelected(s.month)}
            title={`${monthLabel(s.month)}: ${formatIDR(s.total)}`}
            aria-label={`${monthLabel(s.month)}: ${formatIDR(s.total)}`}
            aria-pressed={s.month === sel.month}>
            <span className="bar-track">
              <span className="bar" style={{ height: `${s.total / max * 100}%` }} />
            </span>
            <span className="bar-label">{shortMonthLabel(s.month)}</span>
          </button>
        ))}
      </div>
    </div>

    <div className="tiles">
      <div className="card tile">
        <div className="tile-label">vs last month</div>
        {sel.change === null
          ? <div className="tile-value muted">No spending</div>
          : <div className={`tile-value${changeClass(sel.change)}`}>
              {sel.change > 0 ? '▲' : sel.change < 0 ? '▼' : ''} {changeText(sel.change)}
            </div>}
      </div>
      <div className="card tile">
        <div className="tile-label">Avg per day</div>
        <div className="tile-value">{formatIDR(sel.avgPerDay)}</div>
      </div>
      <div className="card tile">
        <div className="tile-label">Top category</div>
        {sel.top
          ? <div className="tile-value tile-cat">
              <span className="cat-badge small" style={sel.top.color ? { '--chip-color': sel.top.color } : undefined} aria-hidden="true">{sel.top.emoji || '•'}</span>
              {sel.top.name}
            </div>
          : <div className="tile-value muted">No spending</div>}
        {sel.top && <div className="tile-sub">{formatIDR(sel.top.total)}</div>}
      </div>
      <div className="card tile">
        <div className="tile-label">Expenses</div>
        <div className="tile-value">{sel.count}</div>
      </div>
      {sel.income > 0 && <>
        <div className="card tile">
          <div className="tile-label">Income</div>
          <div className="tile-value">{formatIDR(sel.income)}</div>
        </div>
        <div className="card tile">
          <div className="tile-label">{sel.balance < 0 ? 'Overspent' : 'Left over'}</div>
          <div className={`tile-value${sel.balance < 0 ? ' up' : ' down'}`}>{formatIDR(Math.abs(sel.balance))}</div>
        </div>
      </>}
    </div>

    <div className="card by-category">
      <div className="summary-label">By category</div>
      {sel.byCategory.length
        ? <CategoryBreakdown rows={sel.byCategory} total={sel.total} showCount />
        : <p className="by-category-empty">No expenses in {monthLabel(sel.month)}.</p>}
    </div>

    <button className="btn-outline open-month" onClick={() => onOpenMonth(sel.month)}>
      See {monthLabel(sel.month)} expenses &#8250;
    </button>

    <div className="group-label">All months</div>
    <div className="card month-list">
      {[...stats].reverse().map(s => (
        <button key={s.month} className={`month-row${s.month === sel.month ? ' active' : ''}`}
          onClick={() => { setSelected(s.month); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <span className="month-row-main">
            <span className="month-row-name">{monthLabel(s.month)}</span>
            <span className="month-row-top">{s.top ? `Top: ${s.top.name}` : 'No expenses'}</span>
          </span>
          <span className="month-row-side">
            <span className="month-row-total">{formatIDR(s.total)}</span>
            {s.change !== null && <span className={`month-row-change${changeClass(s.change)}`}>{changeText(s.change)}</span>}
          </span>
        </button>
      ))}
    </div>
    </>
  )
}
