import { useState } from 'react'
import { formatIDR, formatNumber, ordinal, parseAmount } from '../utils'
import { COLORS } from '../colors'
import ColorSwatches from './ColorSwatches'
import ExpenseForm from './ExpenseForm'

function CategoryRow({ category, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)
  const [emoji, setEmoji] = useState(category.emoji || '')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    const ok = await onUpdate(category.id, { name: trimmed, color, emoji: emoji.trim() || null })
    setBusy(false)
    if (ok) setOpen(false)
  }

  async function remove() {
    if (!confirming) { setConfirming(true); return }
    setBusy(true)
    const ok = await onDelete(category.id)
    if (!ok) { setBusy(false); setConfirming(false) }
  }

  if (!open) return (
    <button className="manage-row" onClick={() => { setOpen(true); setName(category.name); setColor(category.color); setEmoji(category.emoji || ''); setConfirming(false) }}>
      <span className="cat-badge" style={{ '--chip-color': category.color }} aria-hidden="true">{category.emoji || '•'}</span>
      <span className="manage-row-name">{category.name}</span>
      <span className="manage-row-side">Edit</span>
    </button>
  )

  return (
    <div className="manage-edit">
      <div className="new-category-row">
        <input className="input emoji-input" value={emoji} maxLength={8} aria-label="Emoji" placeholder="🙂"
          onChange={e => setEmoji(e.target.value)} />
        <input className="input" value={name} maxLength={40} aria-label="Category name"
          onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} autoFocus />
      </div>
      <ColorSwatches value={color} onChange={setColor} />
      {confirming && <p className="field-hint">Expenses in {category.name} stay, without a category. Its budget is removed.</p>}
      <div className="edit-actions">
        <button className="btn danger" onClick={remove} disabled={busy}>{confirming ? `Delete ${category.name}` : 'Delete'}</button>
        <button className="btn muted" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={busy || !name.trim()}>Save</button>
      </div>
    </div>
  )
}

function NewCategory({ onCreate }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [color, setColor] = useState(COLORS[0].hex)

  async function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (await onCreate(trimmed, color, emoji.trim() || null)) { setName(''); setEmoji('') }
  }

  return (
    <div className="card panel new-category-card">
      <div className="new-category-row">
        <input className="input emoji-input" value={emoji} maxLength={8} aria-label="Emoji for the new category" placeholder="🙂"
          onChange={e => setEmoji(e.target.value)} />
        <input className="input" value={name} maxLength={40} placeholder="New category" aria-label="New category name"
          onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button className="btn primary" onClick={add} disabled={!name.trim()}>Add</button>
      </div>
      <ColorSwatches value={color} onChange={setColor} />
    </div>
  )
}

function BudgetRow({ label, color, emoji, budget, onSave }) {
  const initial = budget ? formatNumber(budget.amount) : ''
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const dirty = value !== initial

  async function save() {
    setBusy(true)
    await onSave(parseAmount(value))
    setBusy(false)
  }

  return (
    <div className="manage-row budget-row">
      <span className="cat-badge" style={color ? { '--chip-color': color } : undefined} aria-hidden="true">{emoji || '∑'}</span>
      <span className="manage-row-name">{label}</span>
      <span className="budget-input">
        <span>Rp</span>
        <input inputMode="numeric" placeholder="0" aria-label={`Budget for ${label}`} value={value}
          onChange={e => { const n = parseAmount(e.target.value); setValue(n ? formatNumber(n) : '') }}
          onKeyDown={e => e.key === 'Enter' && dirty && save()} />
      </span>
      {dirty && <button className="btn primary" onClick={save} disabled={busy}>Save</button>}
    </div>
  )
}

export function CategoriesPanel({ categories, onCreate, onUpdate, onDelete }) {
  return <>
    <div className="card manage-list">
      {categories.map(c => (
        <CategoryRow key={c.id} category={c} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
    <NewCategory onCreate={onCreate} />
  </>
}

export function BudgetsPanel({ categories, budgets, onSaveBudget }) {
  const budgetFor = id => budgets.find(b => (b.category_id ?? null) === id)
  return <>
    <p className="manage-hint">Budgets repeat every period. Leave a field empty for no budget.</p>
    <div className="card manage-list">
      <BudgetRow key={`all-${budgetFor(null)?.amount}`} label="All spending" budget={budgetFor(null)}
        onSave={amount => onSaveBudget(null, amount)} />
      {categories.map(c => (
        <BudgetRow key={`${c.id}-${budgetFor(c.id)?.amount}`} label={c.name} color={c.color} emoji={c.emoji}
          budget={budgetFor(c.id)} onSave={amount => onSaveBudget(c.id, amount)} />
      ))}
    </div>
  </>
}

export function RecurringPanel({ categories, rules, onCreateCategory, onSaveRule, onDeleteRule }) {
  const [ruleForm, setRuleForm] = useState(null)
  const catById = new Map(categories.map(c => [c.id, c]))

  async function saveRule(fields) {
    const ok = await onSaveRule(fields, ruleForm.rule)
    if (ok) setRuleForm(null)
    return ok
  }

  async function deleteRule() {
    if (await onDeleteRule(ruleForm.rule)) setRuleForm(null)
  }

  return <>
    <p className="manage-hint">
      Bills that come back every month. Each one is added to your expenses on its day, the first time you open the app on or after it.
    </p>
    {rules.length > 0 && (
      <div className="card manage-list">
        {rules.map(r => {
          const cat = catById.get(r.category_id)
          return (
            <button key={r.id} className="manage-row" onClick={() => setRuleForm({ rule: r })}>
              <span className="cat-badge" style={cat ? { '--chip-color': cat.color } : undefined} aria-hidden="true">{cat?.emoji || '↻'}</span>
              <span className="manage-row-main">
                <span className="manage-row-name">{r.note || cat?.name || 'Recurring expense'}</span>
                <span className="manage-row-sub">{cat ? `${cat.name}, every` : 'Every'} {ordinal(r.day_of_month)}</span>
              </span>
              <span className="manage-row-amount">{formatIDR(r.amount)}</span>
            </button>
          )
        })}
      </div>
    )}
    <button className="btn-outline open-month" onClick={() => setRuleForm({})}>+ Add recurring expense</button>

    {ruleForm && (
      <ExpenseForm mode="recurring" entry={ruleForm.rule} categories={categories}
        defaultCategoryId={categories.find(c => c.name === 'Bills')?.id || categories[0]?.id || null}
        onSave={saveRule} onDelete={deleteRule} onCreateCategory={onCreateCategory}
        onClose={() => setRuleForm(null)} />
    )}
  </>
}
