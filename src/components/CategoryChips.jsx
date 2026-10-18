import Chip from './Chip'

export default function CategoryChips({ categories, selectedId, onChange, emptyLabel = 'None', children }) {
  return (
    <div className="chip-row">
      <Chip active={!selectedId} onClick={() => onChange(null)}>{emptyLabel}</Chip>
      {categories.map(c => (
        <Chip key={c.id} dot color={c.color} active={selectedId === c.id}
          onClick={() => onChange(selectedId === c.id ? null : c.id)}>
          {c.name}
        </Chip>
      ))}
      {children}
    </div>
  )
}
