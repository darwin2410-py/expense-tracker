export default function Chip({ active, color, dot, className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`chip${active ? ' active' : ''} ${className}`}
      aria-pressed={active === undefined ? undefined : !!active}
      style={color ? { '--chip-color': color } : undefined}
      {...props}
    >
      {dot && <span className="chip-dot" />}
      {children}
    </button>
  )
}
