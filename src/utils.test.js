import { describe, it, expect } from 'vitest'
import { formatIDR, parseAmount, shiftMonth, monthRange, monthLabel, dayLabel, groupByDay, totalsByCategory, monthsBack, monthlyStats,
  filterExpenses, budgetStatus, recurringDate, dueRecurring, ordinal, noteSuggestions, toCSV, applyPending,
  periodKeyFor, periodRange, periodLabel, dateChipLabel, numpadPress, favoriteCategories, setAmountsHidden } from './utils'

describe('formatIDR', () => {
  it('uses dots as thousand separators', () => {
    expect(formatIDR(0)).toBe('Rp 0')
    expect(formatIDR(500)).toBe('Rp 500')
    expect(formatIDR(25000)).toBe('Rp 25.000')
    expect(formatIDR(1250000)).toBe('Rp 1.250.000')
  })
})

describe('parseAmount', () => {
  it('keeps only digits', () => {
    expect(parseAmount('Rp 25.000')).toBe(25000)
    expect(parseAmount('1,500')).toBe(1500)
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
  })
})

describe('months', () => {
  it('shifts across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
  it('builds a half open range', () => {
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' })
  })
  it('labels a month', () => {
    expect(monthLabel('2026-10')).toBe('October 2026')
  })
})

describe('dayLabel', () => {
  it('names today and yesterday', () => {
    expect(dayLabel('2026-10-18', '2026-10-18')).toBe('Today')
    expect(dayLabel('2026-10-17', '2026-10-18')).toBe('Yesterday')
    expect(dayLabel('2026-09-30', '2026-10-01')).toBe('Yesterday')
  })
  it('falls back to a short date', () => {
    expect(dayLabel('2026-10-15', '2026-10-18')).toBe('Thu, 15 Oct')
  })
})

describe('groupByDay', () => {
  it('groups newest day first with day totals', () => {
    const groups = groupByDay([
      { id: 'a', date: '2026-10-17', amount: 10000, created_at: '2026-10-17T08:00:00Z' },
      { id: 'b', date: '2026-10-18', amount: 5000, created_at: '2026-10-18T08:00:00Z' },
      { id: 'c', date: '2026-10-17', amount: 2000, created_at: '2026-10-17T09:00:00Z' },
    ])
    expect(groups.map(g => g.date)).toEqual(['2026-10-18', '2026-10-17'])
    expect(groups[1].total).toBe(12000)
    expect(groups[1].items.map(e => e.id)).toEqual(['c', 'a'])
  })
  it('leaves income out of the day total', () => {
    const [day] = groupByDay([
      { id: 'a', date: '2026-10-18', amount: 10000 },
      { id: 'b', date: '2026-10-18', amount: 500000, kind: 'income' },
    ])
    expect(day.total).toBe(10000)
    expect(day.items).toHaveLength(2)
  })
})

describe('totalsByCategory', () => {
  it('sums per category, biggest first, unknown as Uncategorized', () => {
    const cats = [{ id: 'f', name: 'Food', color: '#000' }, { id: 't', name: 'Transport', color: '#111' }]
    const rows = totalsByCategory([
      { category_id: 'f', amount: 10000 },
      { category_id: 't', amount: 30000 },
      { category_id: 'f', amount: 5000 },
      { category_id: null, amount: 1000 },
      { category_id: 'gone', amount: 2000 },
    ], cats)
    expect(rows.map(r => [r.name, r.total])).toEqual([
      ['Transport', 30000],
      ['Food', 15000],
      ['Uncategorized', 3000],
    ])
    expect(rows.map(r => r.count)).toEqual([1, 2, 2])
  })
})

describe('monthsBack', () => {
  it('lists months oldest first across a year', () => {
    expect(monthsBack('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('monthlyStats', () => {
  const cats = [{ id: 'f', name: 'Food', color: '#000' }, { id: 'b', name: 'Bills', color: '#111' }]
  const expenses = [
    { date: '2026-08-05', amount: 100000, category_id: 'f' },
    { date: '2026-09-02', amount: 60000, category_id: 'f' },
    { date: '2026-09-20', amount: 90000, category_id: 'b' },
    { date: '2026-10-01', amount: 30000, category_id: 'f' },
  ]
  const [aug, sep, oct] = monthlyStats(expenses, ['2026-08', '2026-09', '2026-10'], cats, '2026-10-10')

  it('totals each month and picks the biggest category', () => {
    expect(sep.total).toBe(150000)
    expect(sep.count).toBe(2)
    expect(sep.top.name).toBe('Bills')
    expect(sep.byCategory.map(r => [r.name, r.total, r.count])).toEqual([['Bills', 90000, 1], ['Food', 60000, 1]])
  })
  it('compares with the month before', () => {
    expect(aug.change).toBe(null)
    expect(sep.change).toBe(50)
    expect(oct.change).toBe(-80)
  })
  it('averages per day, so far for the current month', () => {
    expect(sep.avgPerDay).toBe(5000)
    expect(oct.avgPerDay).toBe(3000)
  })
  it('handles an empty month', () => {
    const [empty] = monthlyStats([], ['2026-07'], cats, '2026-10-10')
    expect(empty).toMatchObject({ total: 0, count: 0, avgPerDay: 0, top: null, byCategory: [], change: null })
  })
})

describe('monthlyStats income', () => {
  it('adds income and balance per month', () => {
    const [m] = monthlyStats([{ date: '2026-09-02', amount: 60000, category_id: null }], ['2026-09'], [], '2026-10-10',
      [{ date: '2026-09-25', amount: 100000 }, { date: '2026-08-25', amount: 999 }])
    expect(m.income).toBe(100000)
    expect(m.balance).toBe(40000)
  })
})

describe('filterExpenses', () => {
  const cats = [{ id: 'f', name: 'Food' }, { id: 't', name: 'Transport' }]
  const items = [
    { id: 1, category_id: 'f', note: 'Kopi susu' },
    { id: 2, category_id: 't', note: 'Gojek' },
    { id: 3, category_id: 'f', note: null },
    { id: 4, kind: 'income', note: 'Gaji kopi' },
  ]
  it('returns everything without a filter', () => {
    expect(filterExpenses(items, cats)).toBe(items)
  })
  it('keeps one category and drops income', () => {
    expect(filterExpenses(items, cats, { categoryId: 'f' }).map(e => e.id)).toEqual([1, 3])
  })
  it('searches notes and category names, ignoring case', () => {
    expect(filterExpenses(items, cats, { query: 'KOPI' }).map(e => e.id)).toEqual([1, 4])
    expect(filterExpenses(items, cats, { query: 'trans' }).map(e => e.id)).toEqual([2])
    expect(filterExpenses(items, cats, { categoryId: 'f', query: 'kopi' }).map(e => e.id)).toEqual([1])
  })
})

describe('budgetStatus', () => {
  const cats = [{ id: 'f', name: 'Food', color: '#1' }, { id: 't', name: 'Transport', color: '#2' }]
  const expenses = [{ category_id: 'f', amount: 80000 }, { category_id: 't', amount: 50000 }]
  it('puts the overall budget first and follows category order', () => {
    const rows = budgetStatus(expenses, [
      { id: 'b2', category_id: 't', amount: 40000 },
      { id: 'b1', category_id: 'f', amount: 100000 },
      { id: 'b0', category_id: null, amount: 200000 },
      { id: 'gone', category_id: 'x', amount: 1 },
    ], cats)
    expect(rows.map(r => [r.name, r.spent, r.left, r.pct])).toEqual([
      ['All spending', 130000, 70000, 65],
      ['Food', 80000, 20000, 80],
      ['Transport', 50000, -10000, 125],
    ])
  })
})

describe('recurring', () => {
  it('clamps the day to the end of the month', () => {
    expect(recurringDate('2026-02', 31)).toBe('2026-02-28')
    expect(recurringDate('2026-10', 5)).toBe('2026-10-05')
  })
  it('is due once the day has come and it was not added this month', () => {
    const rules = [
      { id: 'a', day_of_month: 1, last_added_month: '2026-09' },
      { id: 'b', day_of_month: 18, last_added_month: null },
      { id: 'c', day_of_month: 19, last_added_month: null },
      { id: 'd', day_of_month: 1, last_added_month: '2026-10' },
    ]
    expect(dueRecurring(rules, '2026-10-18').map(r => r.id)).toEqual(['a', 'b'])
  })
  it('names the day', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 31].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '31st'])
  })
})

describe('noteSuggestions', () => {
  it('orders by use and remembers the latest category', () => {
    const list = noteSuggestions([
      { note: 'Kopi', category_id: 'old', created_at: '2026-10-01' },
      { note: 'kopi ', category_id: 'new', created_at: '2026-10-05' },
      { note: 'Parkir', category_id: 't', created_at: '2026-10-06' },
      { note: '', category_id: 't', created_at: '2026-10-07' },
    ])
    expect(list).toEqual([
      { note: 'kopi', category_id: 'new', uses: 2 },
      { note: 'Parkir', category_id: 't', uses: 1 },
    ])
  })
})

describe('toCSV', () => {
  it('writes one row per entry, oldest first, escaped', () => {
    const csv = toCSV([
      { date: '2026-10-02', amount: 5000, category_id: 'f', note: 'Kopi, susu' },
      { date: '2026-10-01', amount: 900000, kind: 'income', note: 'Gaji' },
      { date: '2026-10-03', amount: 1000, category_id: null, note: '=cmd' },
    ], [{ id: 'f', name: 'Food' }])
    expect(csv).toBe(
      'Date,Type,Category,Note,Amount\n' +
      '2026-10-01,Income,,Gaji,900000\n' +
      '2026-10-02,Expense,Food,"Kopi, susu",5000\n' +
      "2026-10-03,Expense,Uncategorized,'=cmd,1000\n"
    )
  })
})

describe('applyPending', () => {
  const inOct = r => r.date.startsWith('2026-10')
  const rows = [{ id: 'a', date: '2026-10-01', amount: 1 }, { id: 'b', date: '2026-10-02', amount: 2 }]

  it('applies inserts, updates and deletes in order', () => {
    const list = applyPending(rows, [
      { table: 'expenses', type: 'insert', row: { id: 'c', date: '2026-10-03', amount: 3 } },
      { table: 'expenses', type: 'insert', row: { id: 'd', date: '2026-09-30', amount: 4 } },
      { table: 'expenses', type: 'update', id: 'a', fields: { amount: 10 } },
      { table: 'expenses', type: 'delete', id: 'b' },
      { table: 'incomes', type: 'delete', id: 'c' },
    ], 'expenses', inOct)
    expect(list).toEqual([{ id: 'a', date: '2026-10-01', amount: 10 }, { id: 'c', date: '2026-10-03', amount: 3 }])
  })

  it('drops a row moved to another month and does not add duplicates', () => {
    const list = applyPending(rows, [
      { table: 'expenses', type: 'update', id: 'a', fields: { date: '2026-09-01' } },
      { table: 'expenses', type: 'insert', row: { id: 'b', date: '2026-10-02', amount: 2 } },
    ], 'expenses', inOct)
    expect(list.map(r => r.id)).toEqual(['b'])
  })
})

describe('budget periods', () => {
  it('puts a date in the period of the month it started in', () => {
    expect(periodKeyFor('2026-10-03', 25)).toBe('2026-09')
    expect(periodKeyFor('2026-10-24', 25)).toBe('2026-09')
    expect(periodKeyFor('2026-10-25', 25)).toBe('2026-10')
    expect(periodKeyFor('2026-10-01', 1)).toBe('2026-10')
  })

  it('crosses the year', () => {
    expect(periodKeyFor('2027-01-10', 25)).toBe('2026-12')
    expect(periodRange('2026-12', 25)).toEqual({ start: '2026-12-25', end: '2027-01-25' })
    expect(periodLabel('2026-12', 25)).toBe('December 2026 · 25 Dec – 24 Jan')
  })

  it('handles February', () => {
    expect(periodLabel('2026-02', 1)).toBe('February 2026 · 1 Feb – 28 Feb')
    expect(periodLabel('2028-02', 1)).toBe('February 2028 · 1 Feb – 29 Feb')
    expect(periodLabel('2026-01', 28)).toBe('January 2026 · 28 Jan – 27 Feb')
    expect(periodLabel('2026-02', 28)).toBe('February 2026 · 28 Feb – 27 Mar')
    expect(periodKeyFor('2026-03-01', 28)).toBe('2026-02')
  })

  it('labels a payday period', () => {
    expect(periodLabel('2026-09', 25)).toBe('September 2026 · 25 Sep – 24 Oct')
    expect(periodRange('2026-09', 25)).toEqual({ start: '2026-09-25', end: '2026-10-25' })
    expect(periodRange('2026-09')).toEqual(monthRange('2026-09'))
  })

  it('groups monthly stats by period', () => {
    const expenses = [
      { amount: 100, date: '2026-09-24' },
      { amount: 200, date: '2026-09-25' },
      { amount: 300, date: '2026-10-24' },
      { amount: 400, date: '2026-10-25' },
    ]
    const [aug, sep] = monthlyStats(expenses, ['2026-08', '2026-09'], [], '2026-10-30', [], 25)
    expect(aug.total).toBe(100)
    expect(sep.total).toBe(500)
    expect(sep.avgPerDay).toBe(Math.round(500 / 30))
  })
})

describe('dateChipLabel', () => {
  it('names today and yesterday', () => {
    expect(dateChipLabel('2026-10-08', '2026-10-08')).toBe('Today · Thu 8 Oct')
    expect(dateChipLabel('2026-10-07', '2026-10-08')).toBe('Yesterday · Wed 7 Oct')
    expect(dateChipLabel('2026-10-06', '2026-10-08')).toBe('Tue 6 Oct')
  })
})

describe('numpadPress', () => {
  const type = keys => keys.reduce(numpadPress, 0)

  it('adds digits and removes the last one', () => {
    expect(type(['2', '5'])).toBe(25)
    expect(type(['2', '5', 'back'])).toBe(2)
    expect(type(['back'])).toBe(0)
    expect(type(['0', '0'])).toBe(0)
  })

  it('adds zeros with 00 and 000', () => {
    expect(type(['5', '00'])).toBe(500)
    expect(type(['2', '5', '000'])).toBe(25000)
    expect(type(['000'])).toBe(0)
  })

  it('multiplies by a million with jt', () => {
    expect(type(['2', 'jt'])).toBe(2000000)
    expect(type(['1', '5', 'jt'])).toBe(15000000)
    expect(type(['jt'])).toBe(0)
  })

  it('ignores presses past the limit', () => {
    expect(type(['9', '9', '9', 'jt', 'jt'])).toBe(999000000)
    expect(type(['9', '9', '9', '9', '9', '9', '9', '9', '9', '9', '9', '9', '9'])).toBe(999999999999)
  })
})

describe('favoriteCategories', () => {
  const cats = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => ({ id }))

  it('puts the most used first and keeps the order for ties', () => {
    const used = ['c', 'c', 'c', 'e', 'e', 'a', 'x', null].map(category_id => ({ category_id }))
    expect(favoriteCategories(cats, used).map(c => c.id)).toEqual(['c', 'e', 'a', 'b', 'd'])
  })

  it('falls back to category order with no history', () => {
    expect(favoriteCategories(cats, [], 4).map(c => c.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('hidden amounts', () => {
  it('masks formatIDR', () => {
    setAmountsHidden(true)
    expect(formatIDR(25000)).toBe('Rp •••••')
    setAmountsHidden(false)
    expect(formatIDR(25000)).toBe('Rp 25.000')
  })
})
