import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { getTodayKey, getMonthKey, monthRange, monthLabel, shiftMonth } from './utils'
import { useTheme } from './hooks/useTheme'
import Toast from './components/Toast'
import Summary from './components/Summary'
import ExpenseList from './components/ExpenseList'
import ExpenseForm from './components/ExpenseForm'
import SummaryView from './components/SummaryView'

const UNDO_MS = 5000

const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#D49B3A' },
  { name: 'Transport', color: '#4A90D9' },
  { name: 'Shopping', color: '#E85D9E' },
  { name: 'Bills', color: '#8B5CF6' },
  { name: 'Health', color: '#5B8C6F' },
  { name: 'Entertainment', color: '#C4653A' },
  { name: 'Other', color: '#8A847E' },
]

export default function App({ userId }) {
  const { theme, toggle: toggleTheme } = useTheme()
  const today = getTodayKey()
  const currentMonth = getMonthKey(today)
  const [month, setMonth] = useState(currentMonth)
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loadedMonth, setLoadedMonth] = useState(null)
  const [form, setForm] = useState(null)
  const [view, setView] = useState('main')
  const [toast, setToast] = useState(null)
  const toastId = useRef(0)

  function showToast(message, type = 'success', extra = {}) {
    setToast({ message, type, key: ++toastId.current, ...extra })
  }

  const hideToast = useCallback(() => setToast(null), [])
  const closeForm = useCallback(() => setForm(null), [])

  useEffect(() => {
    async function load() {
      const query = () => supabase.from('expense_categories').select('*').eq('user_id', userId).order('created_at')
      let { data, error } = await query()
      // First visit: give the user a starter set. The unique (user_id, name)
      // constraint makes this safe if it runs twice.
      if (!error && data.length === 0) {
        const now = Date.now()
        const rows = DEFAULT_CATEGORIES.map((c, i) => ({
          ...c, user_id: userId, created_at: new Date(now + i).toISOString()
        }))
        const { error: seedError } = await supabase.from('expense_categories')
          .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true })
        if (seedError) console.error('seed categories error:', seedError)
        ;({ data, error } = await query())
      }
      if (error) console.error('categories error:', error)
      if (data) setCategories(data)
      setLoaded(true)
    }
    load()
  }, [userId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { start, end } = monthRange(month)
      const { data, error } = await supabase.from('expenses').select('*')
        .eq('user_id', userId).gte('date', start).lt('date', end)
      if (cancelled) return
      if (error) { console.error('expenses error:', error); showToast('Failed to load expenses', 'error') }
      setExpenses(data || [])
      setLoadedMonth(month)
    }
    load()
    return () => { cancelled = true }
  }, [userId, month])

  async function saveExpense(fields) {
    const editing = form.expense
    const inMonth = getMonthKey(fields.date) === month
    if (editing) {
      const { error } = await supabase.from('expenses').update(fields).eq('id', editing.id)
      if (error) { console.error('update error:', error); showToast('Failed to save', 'error'); return false }
      const updated = { ...editing, ...fields }
      setExpenses(list => inMonth ? list.map(e => e.id === editing.id ? updated : e) : list.filter(e => e.id !== editing.id))
    } else {
      const expense = { id: crypto.randomUUID(), user_id: userId, created_at: new Date().toISOString(), ...fields }
      const { error } = await supabase.from('expenses').insert(expense)
      if (error) { console.error('insert error:', error); showToast('Failed to add expense', 'error'); return false }
      if (inMonth) setExpenses(list => [...list, expense])
    }
    setForm(null)
    if (!inMonth) showToast(`Saved to ${monthLabel(getMonthKey(fields.date))}`)
    return true
  }

  async function deleteExpense() {
    const expense = form.expense
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
    if (error) { console.error('delete error:', error); showToast('Failed to delete', 'error'); return }
    setExpenses(list => list.filter(e => e.id !== expense.id))
    setForm(null)
    showToast('Expense deleted', 'success', { duration: UNDO_MS, action: { label: 'Undo', onClick: () => undoDelete(expense) } })
  }

  async function undoDelete(expense) {
    setToast(null)
    const { error } = await supabase.from('expenses').insert(expense)
    if (error) { console.error('undo error:', error); showToast('Failed to restore', 'error'); return }
    if (getMonthKey(expense.date) === month) setExpenses(list => [...list, expense])
  }

  // Returns the new category id, or null when it failed
  async function createCategory(name, color) {
    const cat = { id: crypto.randomUUID(), name, color, user_id: userId, created_at: new Date().toISOString() }
    const { error } = await supabase.from('expense_categories').insert(cat)
    if (error) {
      console.error('category insert error:', error)
      showToast(error.code === '23505' ? 'That category already exists' : 'Failed to create category', 'error')
      return null
    }
    setCategories(c => [...c, cat])
    return cat.id
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (!loaded) return (
    <div className="loading serif">
      <div className="loading-mark">Rp</div>
      <div className="loading-text">Loading</div>
    </div>
  )

  if (view === 'summary') return (
    <SummaryView userId={userId} categories={categories}
      onBack={() => setView('main')}
      onOpenMonth={m => { setMonth(m); setView('main'); window.scrollTo(0, 0) }} />
  )

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="page dotted">
      <div className="container">

        {/* Header */}
        <div className="header fade-up">
          <div>
            <p className="header-date">{dateStr}</p>
            <h1 className="serif">My Expenses</h1>
          </div>
          <div className="header-actions">
            <button className="btn-outline" onClick={() => setView('summary')}>Summary</button>
            <button className="btn-outline btn-theme" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? '☀' : '☽'}
            </button>
          </div>
        </div>

        <Summary month={month} isCurrentMonth={month >= currentMonth}
          expenses={expenses} categories={categories}
          onPrev={() => setMonth(m => shiftMonth(m, -1))}
          onNext={() => setMonth(m => shiftMonth(m, 1))} />

        {loadedMonth === month && expenses.length === 0 && (
          <div className="empty fade-up">
            No expenses in {monthLabel(month)}.
          </div>
        )}

        <ExpenseList expenses={expenses} categories={categories} today={today}
          onEdit={expense => setForm({ expense })} />

        <div className="footer serif">every rupiah counts</div>
        <button className="signout-btn" onClick={signOut}>Sign out</button>
      </div>

      <button className="fab" onClick={() => setForm({})} aria-label="Add expense">+</button>

      {form && (
        <ExpenseForm
          expense={form.expense}
          categories={categories}
          defaultCategoryId={categories[0]?.id || null}
          onSave={saveExpense}
          onDelete={deleteExpense}
          onCreateCategory={createCategory}
          onClose={closeForm}
        />
      )}

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type}
        action={toast.action} duration={toast.duration} onDone={hideToast} />}
    </div>
  )
}
