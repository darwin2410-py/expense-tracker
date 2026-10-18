import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { getTodayKey, getMonthKey, monthRange, monthLabel, shiftMonth, applyPending, budgetStatus,
  dueRecurring, recurringDate, filterExpenses, formatIDR, noteSuggestions, toCSV } from './utils'
import { flush, readCache, readQueue, write, writeCache } from './offline'
import { useTheme } from './hooks/useTheme'
import Toast from './components/Toast'
import Summary from './components/Summary'
import BudgetCard from './components/BudgetCard'
import CategoryChips from './components/CategoryChips'
import ExpenseList from './components/ExpenseList'
import ExpenseForm from './components/ExpenseForm'
import SummaryView from './components/SummaryView'
import ManageView from './components/ManageView'

const UNDO_MS = 5000
const OFFLINE_MESSAGE = "You're offline. Try again when you're back online."

const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#D49B3A' },
  { name: 'Transport', color: '#4A90D9' },
  { name: 'Shopping', color: '#E85D9E' },
  { name: 'Bills', color: '#8B5CF6' },
  { name: 'Health', color: '#5B8C6F' },
  { name: 'Entertainment', color: '#C4653A' },
  { name: 'Other', color: '#8A847E' },
]

// Loads from Supabase and keeps a copy on the device, so the app still
// opens without a connection. Returns null when neither is available.
async function loadList(userId, name, query) {
  const { data, error } = await query
  if (error) {
    console.error(`${name} error:`, error)
    return readCache(userId, name)
  }
  writeCache(userId, name, data)
  return data
}

// Income rows carry kind: 'income' in the UI; the column does not exist
function toRow(item) {
  const { kind: _kind, ...row } = item
  return row
}

export default function App({ userId }) {
  const { theme, toggle: toggleTheme } = useTheme()
  const today = getTodayKey()
  const currentMonth = getMonthKey(today)
  const [month, setMonth] = useState(currentMonth)
  const [categories, setCategories] = useState([])
  const [budgets, setBudgets] = useState([])
  const [rules, setRules] = useState([])
  const [history, setHistory] = useState([])
  const [expenses, setExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loadedMonth, setLoadedMonth] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [filter, setFilter] = useState({ categoryId: null, query: '' })
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(() => readQueue(userId).length)
  const [form, setForm] = useState(null)
  const [view, setView] = useState('main')
  const [toast, setToast] = useState(null)
  const toastId = useRef(0)

  function showToast(message, type = 'success', extra = {}) {
    setToast({ message, type, key: ++toastId.current, ...extra })
  }

  const hideToast = useCallback(() => setToast(null), [])
  const closeForm = useCallback(() => setForm(null), [])

  // Adds this month's recurring expenses that are due and not added yet.
  // The unique (recurring_id, date) constraint keeps a second run from
  // adding them twice.
  async function addDueRecurring(list) {
    const due = dueRecurring(list, today)
    let added = 0
    for (const r of due) {
      const row = {
        id: crypto.randomUUID(), user_id: userId, amount: r.amount, category_id: r.category_id, note: r.note,
        date: recurringDate(currentMonth, r.day_of_month), recurring_id: r.id, created_at: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('expenses')
        .upsert(row, { onConflict: 'recurring_id,date', ignoreDuplicates: true }).select('id')
      if (error) { console.error('recurring insert error:', error); continue }
      const { error: markError } = await supabase.from('recurring_expenses')
        .update({ last_added_month: currentMonth }).eq('id', r.id)
      if (markError) console.error('recurring update error:', markError)
      setRules(rs => rs.map(x => x.id === r.id ? { ...x, last_added_month: currentMonth } : x))
      added += data.length
    }
    return added
  }

  useEffect(() => {
    async function load() {
      const categoriesQuery = () => supabase.from('expense_categories').select('*').eq('user_id', userId).order('created_at')
      let cats = await loadList(userId, 'categories', categoriesQuery())
      // First visit: give the user a starter set. The unique (user_id, name)
      // constraint makes this safe if it runs twice.
      if (cats && cats.length === 0 && navigator.onLine) {
        const now = Date.now()
        const rows = DEFAULT_CATEGORIES.map((c, i) => ({
          ...c, user_id: userId, created_at: new Date(now + i).toISOString()
        }))
        const { error: seedError } = await supabase.from('expense_categories')
          .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true })
        if (seedError) console.error('seed categories error:', seedError)
        cats = await loadList(userId, 'categories', categoriesQuery())
      }
      const [budgetRows, ruleRows, recent] = await Promise.all([
        loadList(userId, 'budgets', supabase.from('budgets').select('*').eq('user_id', userId)),
        loadList(userId, 'recurring', supabase.from('recurring_expenses').select('*').eq('user_id', userId).order('day_of_month')),
        loadList(userId, 'history', supabase.from('expenses').select('note, category_id, created_at')
          .eq('user_id', userId).not('note', 'is', null).order('created_at', { ascending: false }).limit(300)),
      ])
      setCategories(cats || [])
      setBudgets(budgetRows || [])
      setRules(ruleRows || [])
      setHistory(recent || [])
      setLoaded(true)
      if (ruleRows && navigator.onLine) {
        const added = await addDueRecurring(ruleRows)
        if (added) {
          showToast(`Added ${added} recurring ${added === 1 ? 'expense' : 'expenses'}`)
          setRefresh(n => n + 1)
        }
      }
    }
    load()
    // addDueRecurring only reads values that change with userId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { start, end } = monthRange(month)
      const inMonth = r => getMonthKey(r.date) === month
      const [exp, inc] = await Promise.all([
        loadList(userId, `expenses:${month}`, supabase.from('expenses').select('*')
          .eq('user_id', userId).gte('date', start).lt('date', end)),
        loadList(userId, `incomes:${month}`, supabase.from('incomes').select('*')
          .eq('user_id', userId).gte('date', start).lt('date', end)),
      ])
      if (cancelled) return
      if (!exp) showToast(navigator.onLine ? 'Failed to load expenses' : `${monthLabel(month)} is not saved on this device yet`, 'error')
      const ops = readQueue(userId)
      setExpenses(applyPending(exp || [], ops, 'expenses', inMonth))
      setIncomes(applyPending(inc || [], ops, 'incomes', inMonth))
      setLoadedMonth(month)
    }
    load()
    return () => { cancelled = true }
  }, [userId, month, refresh])

  useEffect(() => {
    async function goOnline() {
      setOnline(true)
      const { sent, left } = await flush(userId)
      setPending(left)
      if (sent) {
        showToast(`Synced ${sent} ${sent === 1 ? 'change' : 'changes'}`)
        setRefresh(n => n + 1)
      }
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    if (navigator.onLine) goOnline()
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [userId])

  // Expense and income writes work offline; they wait in a queue until the
  // connection is back. Returns false when the server rejected the write.
  async function save(op, failMessage) {
    const res = await write(userId, op)
    setPending(readQueue(userId).length)
    if (!res.ok) {
      console.error(`${op.table} ${op.type} error:`, res.error)
      showToast(failMessage, 'error')
      return false
    }
    return res
  }

  async function saveEntry({ kind, ...fields }) {
    const income = kind === 'income'
    const table = income ? 'incomes' : 'expenses'
    const setList = income ? setIncomes : setExpenses
    const editing = form.entry && toRow(form.entry)
    const inMonth = getMonthKey(fields.date) === month
    let res
    if (editing) {
      res = await save({ table, type: 'update', id: editing.id, fields }, 'Failed to save')
      if (!res) return false
      const updated = { ...editing, ...fields }
      setList(list => inMonth ? list.map(e => e.id === editing.id ? updated : e) : list.filter(e => e.id !== editing.id))
    } else {
      const row = { id: crypto.randomUUID(), user_id: userId, created_at: new Date().toISOString(), ...fields }
      res = await save({ table, type: 'insert', row }, `Failed to add ${income ? 'income' : 'expense'}`)
      if (!res) return false
      if (inMonth) setList(list => [...list, row])
      if (!income && row.note) setHistory(h => [row, ...h])
    }
    setForm(null)
    if (res.queued) showToast('Saved on this device for now')
    else if (!inMonth) showToast(`Saved to ${monthLabel(getMonthKey(fields.date))}`)
    return true
  }

  async function deleteEntry() {
    const income = form.entry.kind === 'income'
    const table = income ? 'incomes' : 'expenses'
    const row = toRow(form.entry)
    const res = await save({ table, type: 'delete', id: row.id }, 'Failed to delete')
    if (!res) return
    ;(income ? setIncomes : setExpenses)(list => list.filter(e => e.id !== row.id))
    setForm(null)
    showToast(`${income ? 'Income' : 'Expense'} deleted`, 'success', {
      duration: UNDO_MS, action: { label: 'Undo', onClick: () => undoDelete(table, row) }
    })
  }

  async function undoDelete(table, row) {
    setToast(null)
    const res = await save({ table, type: 'insert', row }, 'Failed to restore')
    if (!res) return
    if (getMonthKey(row.date) === month) (table === 'incomes' ? setIncomes : setExpenses)(list => [...list, row])
  }

  // Categories, budgets and recurring expenses need a connection

  function requireOnline() {
    if (navigator.onLine) return true
    showToast(OFFLINE_MESSAGE, 'error')
    return false
  }

  // Returns the new category id, or null when it failed
  async function createCategory(name, color) {
    if (!requireOnline()) return null
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

  async function updateCategory(id, fields) {
    if (!requireOnline()) return false
    const { error } = await supabase.from('expense_categories').update(fields).eq('id', id)
    if (error) {
      console.error('category update error:', error)
      showToast(error.code === '23505' ? 'That category already exists' : 'Failed to save category', 'error')
      return false
    }
    setCategories(cs => cs.map(c => c.id === id ? { ...c, ...fields } : c))
    return true
  }

  // Expenses keep their row with no category; the budget goes with it
  async function deleteCategory(id) {
    if (!requireOnline()) return false
    const { error } = await supabase.from('expense_categories').delete().eq('id', id)
    if (error) { console.error('category delete error:', error); showToast('Failed to delete category', 'error'); return false }
    setCategories(cs => cs.filter(c => c.id !== id))
    setBudgets(bs => bs.filter(b => b.category_id !== id))
    setRules(rs => rs.map(r => r.category_id === id ? { ...r, category_id: null } : r))
    setExpenses(es => es.map(e => e.category_id === id ? { ...e, category_id: null } : e))
    setFilter(f => f.categoryId === id ? { ...f, categoryId: null } : f)
    showToast('Category deleted')
    return true
  }

  // An amount of 0 removes the budget
  async function saveBudget(categoryId, amount) {
    if (!requireOnline()) return false
    const existing = budgets.find(b => (b.category_id ?? null) === categoryId)
    if (!amount) {
      if (!existing) return true
      const { error } = await supabase.from('budgets').delete().eq('id', existing.id)
      if (error) { console.error('budget delete error:', error); showToast('Failed to remove budget', 'error'); return false }
      setBudgets(bs => bs.filter(b => b.id !== existing.id))
      return true
    }
    const { data, error } = await supabase.from('budgets')
      .upsert({ user_id: userId, category_id: categoryId, amount }, { onConflict: 'user_id,category_id' })
      .select().single()
    if (error) { console.error('budget save error:', error); showToast('Failed to save budget', 'error'); return false }
    setBudgets(bs => [...bs.filter(b => b.id !== data.id && (b.category_id ?? null) !== categoryId), data])
    return true
  }

  async function saveRule(fields, rule) {
    if (!requireOnline()) return false
    let saved
    if (rule) {
      const { error } = await supabase.from('recurring_expenses').update(fields).eq('id', rule.id)
      if (error) { console.error('recurring update error:', error); showToast('Failed to save', 'error'); return false }
      saved = { ...rule, ...fields }
      setRules(rs => rs.map(r => r.id === rule.id ? saved : r))
    } else {
      saved = { id: crypto.randomUUID(), user_id: userId, last_added_month: null, created_at: new Date().toISOString(), ...fields }
      const { error } = await supabase.from('recurring_expenses').insert(saved)
      if (error) { console.error('recurring insert error:', error); showToast('Failed to save', 'error'); return false }
      setRules(rs => [...rs, saved].sort((a, b) => a.day_of_month - b.day_of_month))
    }
    const added = await addDueRecurring([saved])
    if (added) {
      showToast(`Added to ${monthLabel(currentMonth)}`)
      setRefresh(n => n + 1)
    }
    return true
  }

  // Expenses it already added stay
  async function deleteRule(rule) {
    if (!requireOnline()) return false
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', rule.id)
    if (error) { console.error('recurring delete error:', error); showToast('Failed to delete', 'error'); return false }
    setRules(rs => rs.filter(r => r.id !== rule.id))
    return true
  }

  function exportCSV() {
    const items = [...expenses, ...incomes.map(i => ({ ...i, kind: 'income' }))]
    const blob = new Blob([toCSV(items, categories)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${month}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
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

  if (view === 'manage') return (
    <>
      <ManageView categories={categories} budgets={budgets} rules={rules}
        theme={theme} onToggleTheme={toggleTheme} onBack={() => setView('main')}
        onCreateCategory={createCategory} onUpdateCategory={updateCategory} onDeleteCategory={deleteCategory}
        onSaveBudget={saveBudget} onSaveRule={saveRule} onDeleteRule={deleteRule} />
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type}
        action={toast.action} duration={toast.duration} onDone={hideToast} />}
    </>
  )

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const incomeItems = incomes.map(i => ({ ...i, kind: 'income' }))
  const allItems = [...expenses, ...incomeItems]
  const filtering = !!(filter.categoryId || filter.query.trim())
  const shown = filterExpenses(allItems, categories, filter)
  const shownSpent = shown.filter(e => e.kind !== 'income').reduce((sum, e) => sum + e.amount, 0)
  const budgetRows = budgetStatus(expenses, budgets, categories)
  const suggestions = noteSuggestions(history)

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
            <button className="btn-outline btn-theme" onClick={() => setView('manage')} title="Settings" aria-label="Settings">
              &#9881;
            </button>
          </div>
        </div>

        {(!online || pending > 0) && (
          <div className={`sync-banner${online ? ' syncing' : ''}`} role="status">
            {online
              ? `Syncing ${pending} ${pending === 1 ? 'change' : 'changes'}...`
              : pending
                ? `You're offline. ${pending} ${pending === 1 ? 'change is' : 'changes are'} waiting and will sync when you're back online.`
                : "You're offline. New entries are kept on this device until you're back online."}
          </div>
        )}

        <Summary month={month} isCurrentMonth={month >= currentMonth}
          expenses={expenses} incomeTotal={incomes.reduce((sum, i) => sum + i.amount, 0)} categories={categories}
          selectedCategory={filter.categoryId}
          onSelectCategory={id => setFilter(f => ({ ...f, categoryId: id }))}
          onPrev={() => setMonth(m => shiftMonth(m, -1))}
          onNext={() => setMonth(m => shiftMonth(m, 1))} />

        {budgetRows.length > 0 && <BudgetCard rows={budgetRows} onManage={() => setView('manage')} />}

        {(allItems.length > 0 || filtering) && (
          <div className="filters fade-up">
            <div className="search">
              <input className="input" type="search" placeholder="Search notes or categories" aria-label="Search"
                value={filter.query} onChange={e => setFilter(f => ({ ...f, query: e.target.value }))} />
            </div>
            <CategoryChips categories={categories} selectedId={filter.categoryId} emptyLabel="All"
              onChange={id => setFilter(f => ({ ...f, categoryId: id }))} />
            {filtering && (
              <div className="filter-result">
                <span>{shown.length} {shown.length === 1 ? 'result' : 'results'}{shownSpent ? ` · ${formatIDR(shownSpent)} spent` : ''}</span>
                <button className="link-btn" onClick={() => setFilter({ categoryId: null, query: '' })}>Clear</button>
              </div>
            )}
          </div>
        )}

        {loadedMonth === month && allItems.length === 0 && (
          <div className="empty fade-up">
            No expenses in {monthLabel(month)}.
          </div>
        )}

        {filtering && allItems.length > 0 && shown.length === 0 && (
          <div className="empty fade-up">Nothing matches.</div>
        )}

        <ExpenseList items={shown} categories={categories} today={today}
          onEdit={entry => setForm({ entry })} />

        <div className="footer serif">every rupiah counts</div>
        {allItems.length > 0 && (
          <button className="signout-btn" onClick={exportCSV}>Export {monthLabel(month)} as CSV</button>
        )}
        <button className="signout-btn" onClick={signOut}>Sign out</button>
      </div>

      <button className="fab" onClick={() => setForm({})} aria-label="Add expense or income">+</button>

      {form && (
        <ExpenseForm
          entry={form.entry}
          categories={categories}
          defaultCategoryId={filter.categoryId || categories[0]?.id || null}
          suggestions={suggestions}
          onSave={saveEntry}
          onDelete={deleteEntry}
          onCreateCategory={createCategory}
          onClose={closeForm}
        />
      )}

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type}
        action={toast.action} duration={toast.duration} onDone={hideToast} />}
    </div>
  )
}
