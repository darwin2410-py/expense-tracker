import { useState } from 'react'
import { formatIDR, formatNumber, ordinal, parseAmount } from '../utils'
import { COLORS } from '../colors'
import Chip from './Chip'
import ColorSwatches from './ColorSwatches'
import ExpenseForm from './ExpenseForm'

const TABS = [
  { key: 'categories', label: 'Categories' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'recurring', label: 'Recurring' },
]

function CategoryRow({ category, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    const ok = await onUpdate(category.id, { name: trimmed, color })
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
    <button className="manage-row" onClick={() => { setOpen(true); setName(category.name); setColor(category.color); setConfirming(false) }}>
      <span className="chip-dot" style={{ '--chip-color': category.color }} />
      <span className="manage-row-name">{category.name}</span>
      <span className="manage-row-side">Edit</span>
    </button>
  )

  return (
    <div className="manage-edit">
      <input className="input" value={name} maxLength={40} aria-label="Category name"
        onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} autoFocus />
      <ColorSwatches value={color} onChange={setColor} />
      {confirming && <p className="field-hint">Its expenses become Uncategorized and its budget is removed. Tap Delete again to confirm.</p>}
      <div className="edit-actions">
        <button className="btn danger" onClick={remove} disabled={busy}>{confirming ? 'Delete for good' : 'Delete'}</button>
        <button className="btn muted" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={busy || !name.trim()}>Save</button>
      </div>
    </div>
  )
}

function NewCategory({ onCreate }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0].hex)

  async function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (await onCreate(trimmed, color)) setName('')
  }

  return (
    <div className="card panel new-category-card">
      <div className="new-category-row">
        <input className="input" value={name} maxLength={40} placeholder="New category"
          onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button className="btn primary" onClick={add} disabled={!name.trim()}>Add</button>
      </div>
      <ColorSwatches value={color} onChange={setColor} />
    </div>
  )
}

function BudgetRow({ label, color, budget, onSave }) {
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
      {color ? <span className="chip-dot" style={{ '--chip-color': color }} /> : <span className="chip-dot none" />}
      <span className="manage-row-name">{label}</span>
      <span className="budget-input">
        <span>Rp</span>
        <input inputMode="numeric" placeholder="No budget" aria-label={`Budget for ${label}`} value={value}
          onChange={e => { const n = parseAmount(e.target.value); setValue(n ? formatNumber(n) : '') }}
          onKeyDown={e => e.key === 'Enter' && dirty && save()} />
      </span>
      {dirty && <button className="btn primary" onClick={save} disabled={busy}>Save</button>}
    </div>
  )
}

export default function ManageView({ categories, budgets, rules, theme, onToggleTheme, onBack,
  onCreateCategory, onUpdateCategory, onDeleteCategory, onSaveBudget, onSaveRule, onDeleteRule }) {
  const [tab, setTab] = useState('categories')
  const [ruleForm, setRuleForm] = useState(null)
  const catById = new Map(categories.map(c => [c.id, c]))
  const budgetFor = id => budgets.find(b => (b.category_id ?? null) === id)

  async function saveRule(fields) {
    const ok = await onSaveRule(fields, ruleForm.rule)
    if (ok) setRuleForm(null)
    return ok
  }

  async function deleteRule() {
    if (await onDeleteRule(ruleForm.rule)) setRuleForm(null)
  }

  return (
    <div className="page dotted">
      <div className="container">
        <div className="monthly-header fade-up">
          <button className="btn-outline soft" onClick={onBack}>&#8249; Back</button>
          <h1 className="serif">Settings</h1>
          <button className="btn-outline btn-theme push-right" onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-label="Switch theme">
            {theme === 'dark' ? '☀' : '☽'}
          </button>
        </div>

        <div className="chip-row range-tabs fade-up">
          {TABS.map(t => <Chip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</Chip>)}
        </div>

        {tab === 'categories' && <>
          <div className="card manage-list fade-up">
            {categories.map(c => (
              <CategoryRow key={c.id} category={c} onUpdate={onUpdateCategory} onDelete={onDeleteCategory} />
            ))}
          </div>
          <NewCategory onCreate={onCreateCategory} />
        </>}

        {tab === 'budgets' && <>
          <p className="manage-hint">Budgets repeat every month. Leave a field empty for no budget.</p>
          <div className="card manage-list fade-up">
            <BudgetRow key={`all-${budgetFor(null)?.amount}`} label="All spending" budget={budgetFor(null)}
              onSave={amount => onSaveBudget(null, amount)} />
            {categories.map(c => (
              <BudgetRow key={`${c.id}-${budgetFor(c.id)?.amount}`} label={c.name} color={c.color} budget={budgetFor(c.id)}
                onSave={amount => onSaveBudget(c.id, amount)} />
            ))}
          </div>
        </>}

        {tab === 'recurring' && <>
          <p className="manage-hint">
            Bills that come back every month. Each one is added to your expenses on its day, the first time you open the app on or after it.
          </p>
          {rules.length > 0 && (
            <div className="card manage-list fade-up">
              {rules.map(r => {
                const cat = catById.get(r.category_id)
                return (
                  <button key={r.id} className="manage-row" onClick={() => setRuleForm({ rule: r })}>
                    <span className={`chip-dot${cat ? '' : ' none'}`} style={cat ? { '--chip-color': cat.color } : undefined} />
                    <span className="manage-row-main">
                      <span className="manage-row-name">{r.note || cat?.name || 'Recurring expense'}</span>
                      <span className="manage-row-sub">Every {ordinal(r.day_of_month)}{cat ? ` · ${cat.name}` : ''}</span>
                    </span>
                    <span className="manage-row-amount">{formatIDR(r.amount)}</span>
                  </button>
                )
              })}
            </div>
          )}
          <button className="btn-outline open-month" onClick={() => setRuleForm({})}>+ Add recurring expense</button>
        </>}
      </div>

      {ruleForm && (
        <ExpenseForm mode="recurring" entry={ruleForm.rule} categories={categories}
          defaultCategoryId={categories.find(c => c.name === 'Bills')?.id || categories[0]?.id || null}
          onSave={saveRule} onDelete={deleteRule} onCreateCategory={onCreateCategory}
          onClose={() => setRuleForm(null)} />
      )}
    </div>
  )
}
