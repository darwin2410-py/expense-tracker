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

// ponytail: module-level flag set by App before each render, so every
// formatIDR call masks without threading a prop; a context if this grows
let amountsHidden = false
export function setAmountsHidden(hidden) { amountsHidden = hidden }

export function formatIDR(n) {
  return amountsHidden ? 'Rp •••••' : 'Rp ' + formatNumber(n)
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

// Budget periods start on a payday (1-28) instead of the 1st. A period is
// named after the month it starts in, so with day 25, 2026-10-03 is in the
// "2026-09" period (25 Sep - 24 Oct).
export function periodKeyFor(dateKey, startDay = 1) {
  const month = getMonthKey(dateKey)
  return Number(dateKey.slice(8, 10)) >= startDay ? month : shiftMonth(month, -1)
}

// Start inclusive, end exclusive, like monthRange
export function periodRange(periodKey, startDay = 1) {
  return { start: `${periodKey}-${pad(startDay)}`, end: `${shiftMonth(periodKey, 1)}-${pad(startDay)}` }
}

function addDays(dateKey, n) {
  const d = parseKey(dateKey)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

function shortDate(dateKey) {
  return `${Number(dateKey.slice(8, 10))} ${SHORT_MONTHS[Number(dateKey.slice(5, 7)) - 1]}`
}

// "September 2026 · 25 Sep – 24 Oct"
export function periodLabel(periodKey, startDay = 1) {
  const { start, end } = periodRange(periodKey, startDay)
  return `${monthLabel(periodKey)} · ${shortDate(start)} – ${shortDate(addDays(end, -1))}`
}

function periodDays(periodKey, startDay) {
  const { start, end } = periodRange(periodKey, startDay)
  return Math.round((parseKey(end) - parseKey(start)) / 86400000)
}

// "Today · Thu 8 Oct", "Yesterday · Wed 7 Oct", "Tue 6 Oct"
export function dateChipLabel(dateKey, todayKey) {
  const d = parseKey(dateKey)
  const day = `${DAY_NAMES[d.getDay()]} ${shortDate(dateKey)}`
  if (dateKey === todayKey) return `Today · ${day}`
  if (dateKey === addDays(todayKey, -1)) return `Yesterday · ${day}`
  return day
}

const MAX_AMOUNT = 999_999_999_999

// Numpad keys: '0'-'9', '00', '000', 'jt' (times a million) and 'back'.
// A press that would go past MAX_AMOUNT is ignored.
export function numpadPress(value, key) {
  let next
  if (key === 'back') next = Math.floor(value / 10)
  else if (key === 'jt') next = value * 1_000_000
  else if (key === '00') next = value * 100
  else if (key === '000') next = value * 1000
  else next = value * 10 + Number(key)
  return next > MAX_AMOUNT ? value : next
}

// Categories by how often recent expenses used them; ties keep their own order
export function favoriteCategories(categories, expenses, limit = 5) {
  const uses = new Map()
  for (const e of expenses) if (e.category_id) uses.set(e.category_id, (uses.get(e.category_id) || 0) + 1)
  return categories
    .map((c, i) => ({ c, i, n: uses.get(c.id) || 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, limit)
    .map(x => x.c)
}

export function dayLabel(dateKey, todayKey) {
  if (dateKey === todayKey) return 'Today'
  const yesterday = parseKey(todayKey)
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateKey === toDateKey(yesterday)) return 'Yesterday'
  const d = parseKey(dateKey)
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`
}

// Newest day first, newest entry first inside a day. Day totals only count spending.
export function groupByDay(expenses) {
  const groups = new Map()
  for (const e of expenses) {
    if (!groups.has(e.date)) groups.set(e.date, { date: e.date, total: 0, items: [] })
    const g = groups.get(e.date)
    if (e.kind !== 'income') g.total += e.amount
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
    if (!totals.has(key)) totals.set(key, { id: key, name: cat?.name || 'Uncategorized', color: cat?.color || null, emoji: cat?.emoji || null, total: 0, count: 0 })
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

// Per month: total, count, average per day, spending per category, income and
// the change against the month before. The current month averages over the days so far.
export function monthlyStats(expenses, months, categories, todayKey, incomes = [], startDay = 1) {
  const incomeByMonth = new Map()
  for (const i of incomes) {
    const key = periodKeyFor(i.date, startDay)
    incomeByMonth.set(key, (incomeByMonth.get(key) || 0) + i.amount)
  }
  const byMonth = new Map()
  for (const e of expenses) {
    const key = periodKeyFor(e.date, startDay)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key).push(e)
  }
  const currentMonth = periodKeyFor(todayKey, startDay)
  return months.map(month => {
    const list = byMonth.get(month) || []
    const total = list.reduce((sum, e) => sum + e.amount, 0)
    const prevTotal = (byMonth.get(shiftMonth(month, -1)) || []).reduce((sum, e) => sum + e.amount, 0)
    const days = month === currentMonth
      ? Math.round((parseKey(todayKey) - parseKey(periodRange(month, startDay).start)) / 86400000) + 1
      : periodDays(month, startDay)
    const byCategory = totalsByCategory(list, categories)
    const income = incomeByMonth.get(month) || 0
    return {
      month,
      total,
      count: list.length,
      avgPerDay: Math.round(total / days),
      top: byCategory[0] || null,
      byCategory,
      change: prevTotal ? Math.round((total - prevTotal) / prevTotal * 100) : null,
      income,
      balance: income - total,
    }
  })
}

// Search by note or category name, and/or keep one category
export function filterExpenses(items, categories, { categoryId = null, query = '' } = {}) {
  const q = query.trim().toLowerCase()
  if (!categoryId && !q) return items
  const names = new Map(categories.map(c => [c.id, c.name.toLowerCase()]))
  return items.filter(e => {
    if (categoryId && (e.kind === 'income' || e.category_id !== categoryId)) return false
    if (!q) return true
    return (e.note || '').toLowerCase().includes(q) || (names.get(e.category_id) || '').includes(q)
  })
}

// Spent against each budget. The overall budget (no category) comes first.
export function budgetStatus(expenses, budgets, categories) {
  const byCategory = new Map(totalsByCategory(expenses, categories).map(r => [r.id, r.total]))
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const order = new Map(categories.map((c, i) => [c.id, i]))
  return budgets
    .filter(b => !b.category_id || order.has(b.category_id))
    .map(b => {
      const cat = categories.find(c => c.id === b.category_id)
      const spent = b.category_id ? byCategory.get(b.category_id) || 0 : total
      return {
        id: b.id,
        categoryId: b.category_id,
        name: cat ? cat.name : 'All spending',
        color: cat ? cat.color : null,
        emoji: cat ? cat.emoji || null : null,
        budget: b.amount,
        spent,
        left: b.amount - spent,
        pct: Math.round(spent / b.amount * 100),
      }
    })
    .sort((a, b) => (a.categoryId ? order.get(a.categoryId) + 1 : 0) - (b.categoryId ? order.get(b.categoryId) + 1 : 0))
}

// The date a recurring expense falls on in a month. Day 31 becomes the
// last day of shorter months.
export function recurringDate(monthKey, day) {
  return `${monthKey}-${pad(Math.min(day, daysInMonth(monthKey)))}`
}

// Rules that should be added for the current month and have not been yet
export function dueRecurring(rules, todayKey) {
  const month = getMonthKey(todayKey)
  return rules.filter(r => r.last_added_month !== month && recurringDate(month, r.day_of_month) <= todayKey)
}

export function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'
  return n + s
}

// Notes used before, most used first, with the category they were last used with
export function noteSuggestions(expenses, limit = 30) {
  const notes = new Map()
  const sorted = [...expenses].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  for (const e of sorted) {
    const note = (e.note || '').trim()
    if (!note) continue
    const key = note.toLowerCase()
    if (!notes.has(key)) notes.set(key, { note, category_id: e.category_id, uses: 0 })
    notes.get(key).uses++
  }
  return [...notes.values()].sort((a, b) => b.uses - a.uses).slice(0, limit)
}

function csvCell(value) {
  let s = String(value ?? '')
  // Stop spreadsheet apps from running a note as a formula
  if (/^[=+\-@]/.test(s)) s = "'" + s
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(items, categories) {
  const names = new Map(categories.map(c => [c.id, c.name]))
  const rows = [...items]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.created_at || '').localeCompare(b.created_at || ''))
    .map(e => [
      e.date,
      e.kind === 'income' ? 'Income' : 'Expense',
      e.kind === 'income' ? '' : names.get(e.category_id) || 'Uncategorized',
      e.note || '',
      e.amount,
    ])
  return [['Date', 'Type', 'Category', 'Note', 'Amount'], ...rows].map(r => r.map(csvCell).join(',')).join('\n') + '\n'
}

// Shows changes still waiting to be sent (see offline.js) on top of rows
// loaded from the server or the cache
export function applyPending(rows, ops, table, inScope) {
  let list = [...rows]
  for (const op of ops) {
    if (op.table !== table) continue
    if (op.type === 'insert') {
      if (!list.some(r => r.id === op.row.id) && inScope(op.row)) list.push(op.row)
    } else if (op.type === 'update') {
      list = list.map(r => r.id === op.id ? { ...r, ...op.fields } : r).filter(r => r.id !== op.id || inScope(r))
    } else {
      list = list.filter(r => r.id !== op.id)
    }
  }
  return list
}
