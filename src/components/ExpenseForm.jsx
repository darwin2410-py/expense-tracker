import { useEffect, useRef, useState } from 'react'
import CategoryPicker from './CategoryPicker'
import Chip from './Chip'
import { formatNumber, parseAmount, getTodayKey, getMonthKey, monthLabel, ordinal, recurringDate } from '../utils'

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000]

// One form for three things: an expense or income entry (mode "entry"), or a
// recurring expense (mode "recurring", which asks for a day of the month
// instead of a date).
export default function ExpenseForm({ entry, mode = 'entry', categories, defaultCategoryId, suggestions = [],
  onSave, onDelete, onCreateCategory, onClose }) {
  const editing = !!entry
  const recurring = mode === 'recurring'
  const [kind, setKind] = useState(entry?.kind || 'expense')
  const [amount, setAmount] = useState(entry ? formatNumber(entry.amount) : '')
  const [categoryId, setCategoryId] = useState(entry ? entry.category_id ?? null : defaultCategoryId)
  const [categoryTouched, setCategoryTouched] = useState(editing)
  const [note, setNote] = useState(entry?.note || '')
  const [date, setDate] = useState(entry?.date || getTodayKey())
  const [day, setDay] = useState(entry?.day_of_month || Number(getTodayKey().slice(8, 10)))
  const [addNow, setAddNow] = useState(false)
  const [busy, setBusy] = useState(false)
  const income = kind === 'income'
  const today = getTodayKey()
  const dayNumber = Math.min(31, Math.max(1, Number(day) || 1))
  // A new rule whose day already passed this month is only added for this
  // month when asked, so a bill paid by hand is not counted twice
  const askAddNow = recurring && !editing && recurringDate(getMonthKey(today), dayNumber) <= today

  const sheetRef = useRef(null)

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Keep keyboard focus inside the sheet while it is open, and return it to
  // whatever opened the sheet afterwards
  useEffect(() => {
    const sheet = sheetRef.current
    const opener = document.activeElement
    if (!sheet.contains(document.activeElement)) sheet.focus()
    function trap(e) {
      if (e.key !== 'Tab') return
      const items = [...sheet.querySelectorAll('button:not(:disabled), input, [tabindex="0"]')]
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    sheet.addEventListener('keydown', trap)
    return () => {
      sheet.removeEventListener('keydown', trap)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  function changeAmount(value) {
    const n = parseAmount(value)
    setAmount(n ? formatNumber(n) : '')
  }

  function pickCategory(id) {
    setCategoryId(id)
    setCategoryTouched(true)
  }

  // Picking a note used before also picks the category it was used with,
  // unless a category was chosen by hand
  function changeNote(value) {
    setNote(value)
    if (categoryTouched || income) return
    const match = suggestions.find(s => s.note.toLowerCase() === value.trim().toLowerCase())
    if (match && categories.some(c => c.id === match.category_id)) setCategoryId(match.category_id)
  }

  async function submit(e) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!value) return
    const fields = { amount: value, note: note.trim() || null }
    if (!income) fields.category_id = categoryId
    if (recurring) {
      fields.day_of_month = dayNumber
      if (askAddNow && !addNow) fields.last_added_month = getMonthKey(today)
    }
    else { fields.date = date; fields.kind = kind }
    if (!recurring && !date) return
    setBusy(true)
    const ok = await onSave(fields)
    if (!ok) setBusy(false)
  }

  async function createCategory(name, color) {
    const id = await onCreateCategory(name, color)
    if (id) pickCategory(id)
    return !!id
  }

  const noun = recurring ? 'recurring expense' : income ? 'income' : 'expense'
  const title = `${editing ? 'Edit' : 'New'} ${noun}`

  return (
    <div className="overlay sheet-wrap" onClick={e => e.target === e.currentTarget && onClose()}>
      <form className="sheet" ref={sheetRef} tabIndex={-1} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <h2 id="sheet-title" className="display">{title}</h2>

        {!editing && !recurring && (
          <div className="segmented" role="group" aria-label="Type">
            <button type="button" aria-pressed={!income} className={!income ? 'active' : ''}
              onClick={() => setKind('expense')}>Expense</button>
            <button type="button" aria-pressed={income} className={income ? 'active income' : ''}
              onClick={() => setKind('income')}>Income</button>
          </div>
        )}

        <div>
          <label className="field-label" htmlFor="amount">Amount</label>
          <div className="amount-field">
            <span>Rp</span>
            <input id="amount" className="amount-input" inputMode="numeric" autoComplete="off"
              placeholder="0" value={amount} onChange={e => changeAmount(e.target.value)}
              autoFocus={!editing} required />
          </div>
          <div className="chip-row quick-amounts">
            {QUICK_AMOUNTS.map(n => (
              <Chip key={n} active={parseAmount(amount) === n} onClick={() => setAmount(formatNumber(n))}>
                {formatNumber(n)}
              </Chip>
            ))}
          </div>
        </div>

        {!income && (
          <div>
            <span className="field-label">Category</span>
            <CategoryPicker categories={categories} selectedId={categoryId}
              onChange={pickCategory} onCreate={createCategory} />
          </div>
        )}

        <div>
          <label className="field-label" htmlFor="note">Note</label>
          <input id="note" className="input" placeholder={income ? 'Salary, bonus, ...' : 'Optional'} maxLength={200}
            list={income ? undefined : 'note-suggestions'} autoComplete="off"
            value={note} onChange={e => changeNote(e.target.value)} />
          {!income && (
            <datalist id="note-suggestions">
              {suggestions.map(s => <option key={s.note} value={s.note} />)}
            </datalist>
          )}
        </div>

        {recurring ? (
          <div>
            <label className="field-label" htmlFor="day">Day of the month</label>
            <input id="day" className="input" type="number" inputMode="numeric" min={1} max={31} required
              value={day} onChange={e => setDay(e.target.value)} />
            <p className="field-hint">
              Added on the {ordinal(dayNumber)} of every month when you open the app.
              Shorter months use their last day.
            </p>
            {askAddNow && (
              <label className="check-row">
                <input type="checkbox" checked={addNow} onChange={e => setAddNow(e.target.checked)} />
                Also add it to {monthLabel(getMonthKey(today))} now
              </label>
            )}
          </div>
        ) : (
          <div>
            <label className="field-label" htmlFor="date">Date</label>
            <input id="date" className="input" type="date" required
              value={date} onChange={e => setDate(e.target.value)} />
          </div>
        )}

        <div className="sheet-actions">
          {editing && <button type="button" className="btn danger" onClick={onDelete} disabled={busy}>Delete</button>}
          <button type="button" className="btn muted" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || !parseAmount(amount)}>
            {busy ? '...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
