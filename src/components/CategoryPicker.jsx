import { useState } from 'react'
import CategoryChips from './CategoryChips'
import Chip from './Chip'

const COLORS = [
  { hex: '#5B8C6F', name: 'Sage' },
  { hex: '#D49B3A', name: 'Amber' },
  { hex: '#C4653A', name: 'Clay' },
  { hex: '#4A90D9', name: 'Blue' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#E85D9E', name: 'Pink' },
  { hex: '#1F7A6D', name: 'Teal' },
  { hex: '#8A847E', name: 'Stone' },
]

export default function CategoryPicker({ categories, selectedId, onChange, onCreate }) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0].hex)

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    const ok = await onCreate(name, newColor)
    if (!ok) return
    setNewName('')
    setShowNew(false)
  }

  return (
    <div>
      <CategoryChips categories={categories} selectedId={selectedId} onChange={onChange}>
        <Chip type="button" className="dashed" onClick={() => setShowNew(s => !s)}>+ New</Chip>
      </CategoryChips>

      {showNew && (
        <div className="new-category">
          <div className="new-category-row">
            <input className="input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
              placeholder="Category name"
              autoFocus
            />
            <button type="button" className="btn primary" onClick={handleCreate}>Add</button>
          </div>
          <div className="chip-row">
            {COLORS.map(c => (
              <button key={c.hex} type="button" title={c.name} aria-label={c.name}
                className={`swatch${newColor === c.hex ? ' active' : ''}`}
                style={{ background: c.hex }}
                onClick={() => setNewColor(c.hex)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
