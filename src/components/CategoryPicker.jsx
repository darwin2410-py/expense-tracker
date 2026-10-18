import { useState } from 'react'
import CategoryChips from './CategoryChips'
import Chip from './Chip'
import ColorSwatches from './ColorSwatches'
import { COLORS } from '../colors'

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
          <ColorSwatches value={newColor} onChange={setNewColor} />
        </div>
      )}
    </div>
  )
}
