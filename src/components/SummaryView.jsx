import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { formatIDR, formatNumber, getMonthKey, getTodayKey, monthLabel, monthRange, monthlyStats, monthsBack, shiftMonth, shortMonthLabel } from '../utils'
import Chip from './Chip'

const RANGES = [6, 12]

function changeText(change) {
  if (change === null) return null
  return `${change > 0 ? '+' : ''}${change}%`
}

function changeClass(change) {
  if (!change) return ''
  return change > 0 ? ' up' : ' down'
}

export default function SummaryView({ userId, categories, onBack, onOpenMonth }) {
  const today = getTodayKey()
  const currentMonth = getMonthKey(today)
  const [range, setRange] = useState(6)
  const [expenses, setExpenses] = useState(null)
  const [selected, setSelected] = useState(currentMonth)

  // Always load 13 months so the oldest month shown still has a "last month"
  useEffect(() => {
    async function load() {
      const start = monthRange(shiftMonth(currentMonth, -12)).start
      const end = monthRange(currentMonth).end
      const { data, error } = await supabase.from('expenses').select('amount, category_id, date')
        .eq('user_id', userId).gte('date', start).lt('date', end)
      if (error) console.error('summary error:', error)
      setExpenses(data || [])
    }
    load()
  }, [userId, currentMonth])

  if (!expenses) return (
    <div className="loading serif">
      <div className="loading-mark">Rp</div>
      <div className="loading-text">Loading</div>
    </div>
  )

  const stats = monthlyStats(expenses, monthsBack(currentMonth, range), categories, today)
  const max = Math.max(...stats.map(s => s.total), 1)
  const sel = stats.find(s => s.month === selected) || stats[stats.length - 1]

  function pickRange(r) {
    setRange(r)
    if (!monthsBack(currentMonth, r).includes(selected)) setSelected(currentMonth)
  }

  return (
    <div className="page dotted">
      <div className="container">
        <div className="monthly-header fade-up">
          <button className="btn-outline soft" onClick={onBack}>&#8249; Back</button>
          <h1 className="serif">Summary</h1>
        </div>

        <div className="chip-row range-tabs fade-up">
          {RANGES.map(r => (
            <Chip key={r} active={range === r} onClick={() => pickRange(r)}>{r} months</Chip>
          ))}
        </div>

        <div className="card chart-card fade-up" style={{ animationDelay: '0.05s' }}>
          <div className="summary-label">{monthLabel(sel.month)}</div>
          <div className="summary-total serif"><small>Rp</small>{formatNumber(sel.total)}</div>
          <div className="summary-count">Tap a bar to see that month</div>

          <div className="bars" role="list">
            {stats.map(s => (
              <button key={s.month} role="listitem"
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

        <div className="tiles fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="card tile">
            <div className="tile-label">vs last month</div>
            {sel.change === null
              ? <div className="tile-value muted">No data</div>
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
                  <span className={`chip-dot${sel.top.color ? '' : ' none'}`} style={sel.top.color ? { '--chip-color': sel.top.color } : undefined} />
                  {sel.top.name}
                </div>
              : <div className="tile-value muted">None</div>}
            {sel.top && <div className="tile-sub">{formatIDR(sel.top.total)}</div>}
          </div>
          <div className="card tile">
            <div className="tile-label">Expenses</div>
            <div className="tile-value">{sel.count}</div>
          </div>
        </div>

        <button className="btn-outline open-month fade-up" onClick={() => onOpenMonth(sel.month)}>
          See {monthLabel(sel.month)} expenses &#8250;
        </button>

        <div className="group-label">All months</div>
        <div className="card month-list fade-up">
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
      </div>
    </div>
  )
}
