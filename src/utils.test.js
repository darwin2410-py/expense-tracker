import { describe, it, expect } from 'vitest'
import { formatIDR, parseAmount, shiftMonth, monthRange, monthLabel, dayLabel, groupByDay, totalsByCategory, monthsBack, monthlyStats } from './utils'

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
    expect(empty).toMatchObject({ total: 0, count: 0, avgPerDay: 0, top: null, change: null })
  })
})
