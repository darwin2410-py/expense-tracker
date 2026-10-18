import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { getTodayKey, getMonthKey, monthLabel, shiftMonth, applyPending, budgetStatus, dueRecurring, recurringDate,
  filterExpenses, formatIDR, noteSuggestions, toCSV, periodKeyFor, periodRange, periodLabel, favoriteCategories,
  setAmountsHidden } from './utils'
import { flush, readCache, readQueue, write, writeCache } from './offline'
import { useTheme } from './hooks/useTheme'
import Toast from './components/Toast'
import Summary from './components/Summary'
import BudgetCard from './components/BudgetCard'
import CategoryChips from './components/CategoryChips'
import ExpenseList from './components/ExpenseList'
import ExpenseForm from './components/ExpenseForm'
import SummaryView from './components/SummaryView'
import AddScreen from './components/AddScreen'
import TabBar from './components/TabBar'
import { BudgetsPanel, CategoriesPanel, RecurringPanel } from './components/Panels'

const UNDO_MS = 5000
const OFFLINE_MESSAGE = "You're offline. Try again when you're back online."

const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#D49B3A', emoji: '🍜' },
  { name: 'Transport', color: '#4A90D9', emoji: '🚗' },
  { name: 'Shopping', color: '#E85D9E', emoji: '🛍️' },
  { name: 'Bills', color: '#8B5CF6', emoji: '🧾' },
  { name: 'Health', color: '#5B8C6F', emoji: '💊' },
  { name: 'Entertainment', color: '#C4653A', emoji: '🎬' },
  { name: 'Other', color: '#8A847E', emoji: '📦' },
]

const TITLES = { add: 'Add', activity: 'Activity', budget: 'Budget', insight: 'Insight', more: 'More' }

// Hiding amounts is a per-device choice, so it lives in localStorage only
const HIDE_KEY = 'hide-amounts'

function readHidden() {
  try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false }
}

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
  const [startDay, setStartDay] = useState(null)
  const [month, setMonth] = useState(currentMonth)
  const [tab, setTab] = useState('add')
  const [hidden, setHidden] = useState(readHidden)
  const [categories, setCategories] = useState([])
  const [budgets, setBudgets] = useState([])
  const [rules, setRules] = useState([])
  const [history, setHistory] = useState([])
  const [usage, setUsage] = useState([])
  const [expenses, setExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loadedMonth, setLoadedMonth] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [filter, setFilter] = useState({ categoryId: null, query: '' })
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(() => readQueue(userId).length)
  const [form, setForm] = useState(null)
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
      const [budgetRows, ruleRows, recent, settings] = await Promise.all([
        loadList(userId, 'budgets', supabase.from('budgets').select('*').eq('user_id', userId)),
        loadList(userId, 'recurring', supabase.from('recurring_expenses').select('*').eq('user_id', userId).order('day_of_month')),
        loadList(userId, 'history', supabase.from('expenses').select('note, category_id, created_at')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(300)),
        // No row yet means the period starts on the 1st
        loadList(userId, 'settings', supabase.from('user_settings').select('period_start_day')
          .eq('user_id', userId).maybeSingle()),
      ])
      const day = settings?.period_start_day || 1
      setStartDay(day)
      setMonth(periodKeyFor(today, day))
      setCategories(cats || [])
      setBudgets(budgetRows || [])
      setRules(ruleRows || [])
      setHistory(recent || [])
      // Favorites are worked out once, so the tiles do not move while typing
      setUsage(recent || [])
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
    if (startDay === null) return
    let cancelled = false
    async function load() {
      const { start, end } = periodRange(month, startDay)
      const inMonth = r => periodKeyFor(r.date, startDay) === month
      const [exp, inc] = await Promise.all([
        loadList(userId, `expenses:${month}@${startDay}`, supabase.from('expenses').select('*')
          .eq('user_id', userId).gte('date', start).lt('date', end)),
        loadList(userId, `incomes:${month}@${startDay}`, supabase.from('incomes').select('*')
          .eq('user_id', userId).gte('date', start).lt('date', end)),
      ])
      if (cancelled) return
      if (!exp) showToast(navigator.onLine ? "Couldn't load your expenses. Check your connection and reopen the app." : `${monthLabel(month)} is not saved on this device yet`, 'error')
      const ops = readQueue(userId)
      setExpenses(applyPending(exp || [], ops, 'expenses', inMonth))
      setIncomes(applyPending(inc || [], ops, 'incomes', inMonth))
      setLoadedMonth(month)
    }
    load()
    return () => { cancelled = true }
  }, [userId, month, startDay, refresh])

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

  const inPeriod = date => periodKeyFor(date, startDay) === month

  // New entries come from the Add screen, which stays open for the next one
  async function addEntry({ kind, ...fields }) {
    const income = kind === 'income'
    const table = income ? 'incomes' : 'expenses'
    const row = { id: crypto.randomUUID(), user_id: userId, created_at: new Date().toISOString(), ...fields }
    const res = await save({ table, type: 'insert', row }, `Couldn't add this ${income ? 'income' : 'expense'}. Try again.`)
    if (!res) return false
    if (inPeriod(row.date)) (income ? setIncomes : setExpenses)(list => [...list, row])
    if (!income) setHistory(h => [row, ...h])
    const cat = categories.find(c => c.id === row.category_id)
    const what = income ? 'income' : cat ? `${cat.emoji ? cat.emoji + ' ' : ''}${cat.name}` : 'expense'
    showToast(`${res.queued ? 'Saved offline' : 'Saved'}: ${formatIDR(row.amount)} ${what}`, 'success', {
      duration: UNDO_MS, action: { label: 'Undo', onClick: () => undoAdd(table, row) }
    })
    return true
  }

  async function undoAdd(table, row) {
    setToast(null)
    const res = await save({ table, type: 'delete', id: row.id }, "Couldn't undo. Delete it from Activity.")
    if (!res) return
    ;(table === 'incomes' ? setIncomes : setExpenses)(list => list.filter(e => e.id !== row.id))
    setHistory(h => h.filter(e => e.id !== row.id))
  }

  // Editing an entry from Activity
  async function saveEntry({ kind, ...fields }) {
    const income = kind === 'income'
    const table = income ? 'incomes' : 'expenses'
    const setList = income ? setIncomes : setExpenses
    const editing = toRow(form.entry)
    const stays = inPeriod(fields.date)
    const res = await save({ table, type: 'update', id: editing.id, fields }, "Couldn't save. Try again.")
    if (!res) return false
    const updated = { ...editing, ...fields }
    setList(list => stays ? list.map(e => e.id === editing.id ? updated : e) : list.filter(e => e.id !== editing.id))
    setForm(null)
    if (res.queued) showToast("Saved offline. It syncs when you're back online.")
    else if (!stays) showToast(`Saved to ${monthLabel(periodKeyFor(fields.date, startDay))}`)
    return true
  }

  async function deleteEntry() {
    const income = form.entry.kind === 'income'
    const table = income ? 'incomes' : 'expenses'
    const row = toRow(form.entry)
    const res = await save({ table, type: 'delete', id: row.id }, "Couldn't delete. Try again.")
    if (!res) return
    ;(income ? setIncomes : setExpenses)(list => list.filter(e => e.id !== row.id))
    setForm(null)
    showToast(`${income ? 'Income' : 'Expense'} deleted`, 'success', {
      duration: UNDO_MS, action: { label: 'Undo', onClick: () => undoDelete(table, row) }
    })
  }

  async function undoDelete(table, row) {
    setToast(null)
    const res = await save({ table, type: 'insert', row }, "Couldn't bring it back. Add it again by hand.")
    if (!res) return
    if (inPeriod(row.date)) (table === 'incomes' ? setIncomes : setExpenses)(list => [...list, row])
  }

  // Categories, budgets, recurring expenses and settings need a connection

  function requireOnline() {
    if (navigator.onLine) return true
    showToast(OFFLINE_MESSAGE, 'error')
    return false
  }

  // Returns the new category id, or null when it failed
  async function createCategory(name, color, emoji = null) {
    if (!requireOnline()) return null
    const cat = { id: crypto.randomUUID(), name, color, emoji, user_id: userId, created_at: new Date().toISOString() }
    const { error } = await supabase.from('expense_categories').insert(cat)
    if (error) {
      console.error('category insert error:', error)
      showToast(error.code === '23505' ? 'You already have a category with that name' : "Couldn't add the category. Try again.", 'error')
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
      showToast(error.code === '23505' ? 'You already have a category with that name' : "Couldn't save the category. Try again.", 'error')
      return false
    }
    setCategories(cs => cs.map(c => c.id === id ? { ...c, ...fields } : c))
    return true
  }

  // Expenses keep their row with no category; the budget goes with it
  async function deleteCategory(id) {
    if (!requireOnline()) return false
    const { error } = await supabase.from('expense_categories').delete().eq('id', id)
    if (error) { console.error('category delete error:', error); showToast("Couldn't delete the category. Try again.", 'error'); return false }
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
      if (error) { console.error('budget delete error:', error); showToast("Couldn't remove the budget. Try again.", 'error'); return false }
      setBudgets(bs => bs.filter(b => b.id !== existing.id))
      return true
    }
    const { data, error } = await supabase.from('budgets')
      .upsert({ user_id: userId, category_id: categoryId, amount }, { onConflict: 'user_id,category_id' })
      .select().single()
    if (error) { console.error('budget save error:', error); showToast("Couldn't save the budget. Try again.", 'error'); return false }
    setBudgets(bs => [...bs.filter(b => b.id !== data.id && (b.category_id ?? null) !== categoryId), data])
    return true
  }

  async function saveRule(fields, rule) {
    if (!requireOnline()) return false
    let saved
    if (rule) {
      const { error } = await supabase.from('recurring_expenses').update(fields).eq('id', rule.id)
      if (error) { console.error('recurring update error:', error); showToast("Couldn't save. Try again.", 'error'); return false }
      saved = { ...rule, ...fields }
      setRules(rs => rs.map(r => r.id === rule.id ? saved : r))
    } else {
      saved = { id: crypto.randomUUID(), user_id: userId, last_added_month: null, created_at: new Date().toISOString(), ...fields }
      const { error } = await supabase.from('recurring_expenses').insert(saved)
      if (error) { console.error('recurring insert error:', error); showToast("Couldn't save. Try again.", 'error'); return false }
      setRules(rs => [...rs, saved].sort((a, b) => a.day_of_month - b.day_of_month))
    }
    const added = await addDueRecurring([saved])
    if (added) {
      showToast(`Added to your ${monthLabel(currentMonth)} expenses`)
      setRefresh(n => n + 1)
    }
    return true
  }

  // Expenses it already added stay
  async function deleteRule(rule) {
    if (!requireOnline()) return false
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', rule.id)
    if (error) { console.error('recurring delete error:', error); showToast("Couldn't delete. Try again.", 'error'); return false }
    setRules(rs => rs.filter(r => r.id !== rule.id))
    return true
  }

  async function saveStartDay(day) {
    if (!requireOnline()) return
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: userId, period_start_day: day, updated_at: new Date().toISOString() })
    if (error) { console.error('settings save error:', error); showToast("Couldn't save the setting. Try again.", 'error'); return }
    writeCache(userId, 'settings', { period_start_day: day })
    setStartDay(day)
    setMonth(periodKeyFor(today, day))
  }

  function toggleHidden() {
    const next = !hidden
    setHidden(next)
    try { localStorage.setItem(HIDE_KEY, next ? '1' : '0') } catch { /* storage blocked */ }
  }

  function exportCSV() {
    const items = [...expenses, ...incomes.map(i => ({ ...i, kind: 'income' }))]
    const blob = new Blob([toCSV(items, categories)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${month}${startDay > 1 ? `-from-${startDay}` : ''}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  function changeTab(t) {
    setTab(t)
    window.scrollTo(0, 0)
  }

  setAmountsHidden(hidden)

  if (!loaded) return (
    <div className="loading display">
      <div className="loading-mark">Rp</div>
      <div className="loading-text">Loading</div>
    </div>
  )

  const currentPeriod = periodKeyFor(today, startDay)
  const incomeItems = incomes.map(i => ({ ...i, kind: 'income' }))
  const allItems = [...expenses, ...incomeItems]
  const filtering = !!(filter.categoryId || filter.query.trim())
  const shown = filterExpenses(allItems, categories, filter)
  const shownSpent = shown.filter(e => e.kind !== 'income').reduce((sum, e) => sum + e.amount, 0)
  const budgetRows = budgetStatus(expenses, budgets, categories)
  const suggestions = noteSuggestions(history)
  const navigable = tab === 'activity' || tab === 'budget'

  return (
    <div className="page">
      <div className="container">
        <header className="app-header">
          <div className="app-header-main">
            <h1 className="display">{TITLES[tab]}</h1>
            {tab === 'add' && <p className="period-label">{periodLabel(currentPeriod, startDay)}</p>}
          </div>
          <button className="icon-btn eye-btn" onClick={toggleHidden} aria-pressed={hidden}
            aria-label="Hide amounts" title={hidden ? 'Show amounts' : 'Hide amounts'}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              {hidden && <path d="M4 4l16 16" />}
            </svg>
          </button>
        </header>

        {navigable && (
          <div className="period-nav">
            <button className="icon-btn" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Previous period">&#8249;</button>
            <span className="period-label" aria-live="polite">{periodLabel(month, startDay)}</span>
            <button className="icon-btn" onClick={() => setMonth(m => shiftMonth(m, 1))}
              disabled={month >= currentPeriod} aria-label="Next period">&#8250;</button>
          </div>
        )}

        {(!online || pending > 0) && (
          <div className={`sync-banner${online ? ' syncing' : ''}`} role="status">
            {online
              ? `Syncing ${pending} ${pending === 1 ? 'change' : 'changes'}...`
              : pending
                ? `You're offline. ${pending} ${pending === 1 ? 'change is' : 'changes are'} waiting and will sync when you're back online.`
                : "You're offline. New entries are kept on this device until you're back online."}
          </div>
        )}

        <main>
          {tab === 'add' && (
            <AddScreen categories={categories} favorites={favoriteCategories(categories, usage)}
              suggestions={suggestions} onSave={addEntry} />
          )}

          {tab === 'activity' && <>
            <Summary expenses={expenses} incomeTotal={incomes.reduce((sum, i) => sum + i.amount, 0)} categories={categories}
              selectedCategory={filter.categoryId}
              onSelectCategory={id => setFilter(f => ({ ...f, categoryId: id }))} />

            {(allItems.length > 0 || filtering) && (
              <div className="filters">
                <input className="input" type="search" placeholder="Search notes or categories" aria-label="Search"
                  value={filter.query} onChange={e => setFilter(f => ({ ...f, query: e.target.value }))} />
                <CategoryChips categories={categories} selectedId={filter.categoryId} emptyLabel="All"
                  onChange={id => setFilter(f => ({ ...f, categoryId: id }))} />
                {filtering && (
                  <div className="filter-result">
                    <span>{shown.length} {shown.length === 1 ? 'match' : 'matches'}{shownSpent ? `, ${formatIDR(shownSpent)} spent` : ''}</span>
                    <button className="link-btn" onClick={() => setFilter({ categoryId: null, query: '' })}>Clear</button>
                  </div>
                )}
              </div>
            )}

            {loadedMonth === month && allItems.length === 0 && (
              <div className="empty">
                {month === currentPeriod
                  ? <>Nothing here yet this period. <button className="link-btn" onClick={() => changeTab('add')}>Add an expense</button></>
                  : `No expenses in ${monthLabel(month)}.`}
              </div>
            )}

            {filtering && allItems.length > 0 && shown.length === 0 && (
              <div className="empty">Nothing matches this search. Try another word or clear the filter.</div>
            )}

            <ExpenseList items={shown} categories={categories} today={today}
              onEdit={entry => setForm({ entry })} />
          </>}

          {tab === 'budget' && <>
            {budgetRows.length > 0 && <BudgetCard rows={budgetRows} />}
            <h2 className="section-title display">Budgets</h2>
            <BudgetsPanel categories={categories} budgets={budgets} onSaveBudget={saveBudget} />
            <h2 className="section-title display">Recurring</h2>
            <RecurringPanel categories={categories} rules={rules} onCreateCategory={createCategory}
              onSaveRule={saveRule} onDeleteRule={deleteRule} />
          </>}

          {tab === 'insight' && (
            <SummaryView userId={userId} categories={categories} startDay={startDay}
              onOpenMonth={m => { setMonth(m); changeTab('activity') }} />
          )}

          {tab === 'more' && <>
            <h2 className="section-title display">Settings</h2>
            <div className="card manage-list">
              <div className="manage-row setting-row">
                <label className="manage-row-main" htmlFor="start-day">
                  <span className="manage-row-name">Month starts on day</span>
                  <span className="manage-row-sub">Your payday. Totals, budgets and exports follow it.</span>
                </label>
                <select id="start-day" className="input select" value={startDay}
                  onChange={e => saveStartDay(Number(e.target.value))}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="manage-row setting-row">
                <span className="manage-row-main" id="dark-label">
                  <span className="manage-row-name">Dark mode</span>
                </span>
                <button className="switch" role="switch" aria-checked={theme === 'dark'} aria-labelledby="dark-label"
                  onClick={toggleTheme}><span /></button>
              </div>
            </div>

            <h2 className="section-title display">Data</h2>
            <div className="more-actions">
              <button className="btn-outline" onClick={exportCSV} disabled={allItems.length === 0}>
                Export {monthLabel(month)} as CSV
              </button>
            </div>

            <h2 className="section-title display">Categories</h2>
            <p className="manage-hint">Tap a category to change its name, emoji or color.</p>
            <CategoriesPanel categories={categories} onCreate={createCategory}
              onUpdate={updateCategory} onDelete={deleteCategory} />

            <div className="more-actions signout">
              <button className="btn-outline" onClick={signOut}>Sign out</button>
            </div>
          </>}
        </main>
      </div>

      <TabBar tab={tab} onChange={changeTab} />

      {form && (
        <ExpenseForm
          entry={form.entry}
          categories={categories}
          defaultCategoryId={null}
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
