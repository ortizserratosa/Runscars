export function Movement({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="movement neutral">Nueva</span>;
  }
  if (value === 0) {
    return <span className="movement neutral">—</span>;
  }
  if (value > 0) {
    return <span className="movement up">↑ {value}</span>;
  }
  return <span className="movement down">↓ {Math.abs(value)}</span>;
}
