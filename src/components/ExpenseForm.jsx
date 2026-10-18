import { useEffect, useState } from 'react'
import CategoryPicker from './CategoryPicker'
import { formatNumber, parseAmount, getTodayKey } from '../utils'

export default function ExpenseForm({ expense, categories, defaultCategoryId, onSave, onDelete, onCreateCategory, onClose }) {
  const editing = !!expense
  const [amount, setAmount] = useState(expense ? formatNumber(expense.amount) : '')
  const [categoryId, setCategoryId] = useState(expense ? expense.category_id : defaultCategoryId)
  const [note, setNote] = useState(expense?.note || '')
  const [date, setDate] = useState(expense?.date || getTodayKey())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function changeAmount(value) {
    const n = parseAmount(value)
    setAmount(n ? formatNumber(n) : '')
  }

  async function submit(e) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!value || !date) return
    setBusy(true)
    const ok = await onSave({ amount: value, category_id: categoryId, note: note.trim() || null, date })
    if (!ok) setBusy(false)
  }

  async function createCategory(name, color) {
    const id = await onCreateCategory(name, color)
    if (id) setCategoryId(id)
    return !!id
  }

  return (
    <div className="overlay sheet-wrap" onClick={e => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <h2 id="sheet-title" className="serif">{editing ? 'Edit expense' : 'New expense'}</h2>

        <div>
          <label className="field-label" htmlFor="amount">Amount</label>
          <div className="amount-field">
            <span>Rp</span>
            <input id="amount" className="amount-input" inputMode="numeric" autoComplete="off"
              placeholder="0" value={amount} onChange={e => changeAmount(e.target.value)}
              autoFocus={!editing} required />
          </div>
        </div>

        <div>
          <span className="field-label">Category</span>
          <CategoryPicker categories={categories} selectedId={categoryId}
            onChange={setCategoryId} onCreate={createCategory} />
        </div>

        <div>
          <label className="field-label" htmlFor="note">Note</label>
          <input id="note" className="input" placeholder="Optional" maxLength={200}
            value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div>
          <label className="field-label" htmlFor="date">Date</label>
          <input id="date" className="input" type="date" required
            value={date} onChange={e => setDate(e.target.value)} />
        </div>

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
