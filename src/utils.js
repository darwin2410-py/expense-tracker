const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT_MONTHS = MONTHS.map(m => m.slice(0, 3))
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(n) { return String(n).padStart(2, '0') }

export function toDateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getTodayKey() {
  return toDateKey(new Date())
}

function parseKey(key) {
  const [y, m, d = 1] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 25000 -> "25.000"
export function formatNumber(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function formatIDR(n) {
  return 'Rp ' + formatNumber(n)
}

// "Rp 25.000" -> 25000. Anything that is not a digit is ignored.
export function parseAmount(str) {
  const digits = String(str).replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

export function getMonthKey(dateKey) {
  return dateKey.slice(0, 7)
}

export function shiftMonth(monthKey, delta) {
  const d = parseKey(monthKey)
  d.setMonth(d.getMonth() + delta)
  return toDateKey(d).slice(0, 7)
}

// Date range for a month query: start inclusive, end exclusive
export function monthRange(monthKey) {
  return { start: `${monthKey}-01`, end: `${shiftMonth(monthKey, 1)}-01` }
}

export function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export function dayLabel(dateKey, todayKey) {
  if (dateKey === todayKey) return 'Today'
  const yesterday = parseKey(todayKey)
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateKey === toDateKey(yesterday)) return 'Yesterday'
  const d = parseKey(dateKey)
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`
}

// Newest day first, newest entry first inside a day
export function groupByDay(expenses) {
  const groups = new Map()
  for (const e of expenses) {
    if (!groups.has(e.date)) groups.set(e.date, { date: e.date, total: 0, items: [] })
    const g = groups.get(e.date)
    g.total += e.amount
    g.items.push(e)
  }
  const list = [...groups.values()].sort((a, b) => b.date.localeCompare(a.date))
  list.forEach(g => g.items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')))
  return list
}

// Spending per category, biggest first. Expenses without a known category
// end up in a single "Uncategorized" row.
export function totalsByCategory(expenses, categories) {
  const byId = new Map(categories.map(c => [c.id, c]))
  const totals = new Map()
  for (const e of expenses) {
    const cat = byId.get(e.category_id)
    const key = cat ? cat.id : null
    if (!totals.has(key)) totals.set(key, { id: key, name: cat?.name || 'Uncategorized', color: cat?.color || null, total: 0, count: 0 })
    const row = totals.get(key)
    row.total += e.amount
    row.count += 1
  }
  return [...totals.values()].sort((a, b) => b.total - a.total)
}

export function shortMonthLabel(monthKey) {
  return SHORT_MONTHS[Number(monthKey.slice(5, 7)) - 1]
}

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// The last `count` months ending at `lastMonth`, oldest first
export function monthsBack(lastMonth, count) {
  return Array.from({ length: count }, (_, i) => shiftMonth(lastMonth, i - count + 1))
}

// Per month: total, count, average per day, spending per category and the change
// against the month before. The current month averages over the days so far.
export function monthlyStats(expenses, months, categories, todayKey) {
  const byMonth = new Map()
  for (const e of expenses) {
    const key = getMonthKey(e.date)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key).push(e)
  }
  const currentMonth = getMonthKey(todayKey)
  return months.map(month => {
    const list = byMonth.get(month) || []
    const total = list.reduce((sum, e) => sum + e.amount, 0)
    const prevTotal = (byMonth.get(shiftMonth(month, -1)) || []).reduce((sum, e) => sum + e.amount, 0)
    const days = month === currentMonth ? Number(todayKey.slice(8, 10)) : daysInMonth(month)
    const byCategory = totalsByCategory(list, categories)
    return {
      month,
      total,
      count: list.length,
      avgPerDay: Math.round(total / days),
      top: byCategory[0] || null,
      byCategory,
      change: prevTotal ? Math.round((total - prevTotal) / prevTotal * 100) : null,
    }
  })
}
