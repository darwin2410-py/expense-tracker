import { COLORS } from '../colors'

export default function ColorSwatches({ value, onChange }) {
  return (
    <div className="chip-row">
      {COLORS.map(c => (
        <button key={c.hex} type="button" title={c.name} aria-label={c.name} aria-pressed={value === c.hex}
          className={`swatch${value === c.hex ? ' active' : ''}`}
          style={{ background: c.hex }}
          onClick={() => onChange(c.hex)}
        />
      ))}
    </div>
  )
}
