import { useEffect, useState } from 'react'
import { dateChipLabel, formatNumber, getTodayKey, numpadPress } from '../utils'
import CategoryChips from './CategoryChips'

const KEYS = [
  ['1', '1'], ['2', '2'], ['3', '3'], ['back', '⌫'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['jt', 'jt'],
  ['7', '7'], ['8', '8'], ['9', '9'],
  ['00', '00'], ['0', '0'], ['000', '000'],
]
const KEY_NAMES = { back: 'Delete last digit', jt: 'Times one million' }

// Quick entry: own numpad (no phone keyboard), favorite categories, date and
// note chips. Stays on screen after saving so the next entry can follow.
export default function AddScreen({ categories, favorites, suggestions, onSave }) {
  const today = getTodayKey()
  const [kind, setKind] = useState('expense')
  const [amount, setAmount] = useState(0)
  const [categoryId, setCategoryId] = useState(favorites[0]?.id || null)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const income = kind === 'income'
  const selected = categories.find(c => c.id === categoryId)
  const otherSelected = selected && !favorites.some(f => f.id === selected.id)

  function press(key) {
    setAmount(v => numpadPress(v, key))
  }

  // A hardware keyboard can type too, unless a text field has focus
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, select')) return
      const key = /^[0-9]$/.test(e.key) ? e.key : e.key === 'Backspace' ? 'back' : null
      if (!key) return
      e.preventDefault()
      setAmount(v => numpadPress(v, key))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function changeNote(value) {
    setNote(value)
    if (income) return
    const match = suggestions.find(s => s.note.toLowerCase() === value.trim().toLowerCase())
    if (match && categories.some(c => c.id === match.category_id)) setCategoryId(match.category_id)
  }

  function openPicker(e) {
    try { e.currentTarget.showPicker() } catch { /* the browser opens its own */ }
  }

  async function save() {
    if (!amount || busy) return
    const fields = { kind, amount, date, note: note.trim() || null }
    if (!income) fields.category_id = categoryId
    setBusy(true)
    const ok = await onSave(fields)
    setBusy(false)
    if (!ok) return
    setAmount(0)
    setNote('')
    setNoteOpen(false)
  }

  return (
    <div className="add-screen">
      <div className="segmented" role="group" aria-label="Type">
        <button type="button" aria-pressed={!income} className={!income ? 'active' : ''}
          onClick={() => setKind('expense')}>Expense</button>
        <button type="button" aria-pressed={income} className={income ? 'active income' : ''}
          onClick={() => setKind('income')}>Income</button>
      </div>

      <output className={`add-amount display${amount >= 1e9 ? ' long' : ''}`} aria-live="polite" aria-label="Amount">
        Rp {formatNumber(amount)}
      </output>

      {!income && (
        <div className="fav-grid" role="group" aria-label="Category">
          {favorites.map(c => (
            <button key={c.id} type="button" className={`fav${categoryId === c.id ? ' active' : ''}`}
              aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              <span className="fav-emoji" aria-hidden="true">{c.emoji || '•'}</span>
              <span className="fav-name">{c.name}</span>
            </button>
          ))}
          <button type="button" className={`fav${otherSelected ? ' active' : ''}`} aria-expanded={showAll}
            onClick={() => setShowAll(s => !s)}>
            <span className="fav-emoji" aria-hidden="true">{otherSelected ? selected.emoji || '•' : '⋯'}</span>
            <span className="fav-name">{otherSelected ? selected.name : 'Lainnya'}</span>
          </button>
        </div>
      )}

      {!income && showAll && (
        <CategoryChips categories={categories} selectedId={categoryId} emptyLabel="None"
          onChange={id => { setCategoryId(id); setShowAll(false) }} />
      )}

      <div className="chip-row add-chips">
        {/* The real date input sits on top of the chip, so a tap opens the
            phone's date picker and a click opens the browser's */}
        <span className="date-wrap">
          <span className="chip" aria-hidden="true">📅 {dateChipLabel(date, today)}</span>
          <input type="date" aria-label={`Date, ${dateChipLabel(date, today)}`} value={date}
            onClick={openPicker} onChange={e => e.target.value && setDate(e.target.value)} />
        </span>
        <button type="button" className={`chip note-chip${note ? ' active' : ''}`} aria-expanded={noteOpen}
          onClick={() => setNoteOpen(o => !o)}>
          <span aria-hidden="true">📝</span> {note.trim() || 'Note'}
        </button>
      </div>

      {noteOpen && (
        <div className="note-row">
          <input className="input" aria-label="Note" placeholder={income ? 'Salary, bonus, ...' : 'What was it for?'}
            maxLength={200} autoFocus autoComplete="off" list={income ? undefined : 'add-note-suggestions'}
            value={note} onChange={e => changeNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setNoteOpen(false)} />
          <button type="button" className="btn muted" onClick={() => setNoteOpen(false)}>Done</button>
          {!income && (
            <datalist id="add-note-suggestions">
              {suggestions.map(s => <option key={s.note} value={s.note} />)}
            </datalist>
          )}
        </div>
      )}

      <div className="numpad">
        {KEYS.map(([key, label]) => (
          <button key={key} type="button" className={`key key-${key}`} aria-label={KEY_NAMES[key]}
            onClick={() => press(key)}>{label}</button>
        ))}
        <button type="button" className="key key-save" disabled={!amount || busy} onClick={save}>
          {busy ? '...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
