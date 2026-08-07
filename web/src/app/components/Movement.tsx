export function Movement({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span
        aria-label="Nueva desde la actualización anterior"
        className="movement neutral"
        title="Nueva desde la actualización anterior"
      >
        Nueva
      </span>
    );
  }
  if (value === 0) {
    return (
      <span
        aria-label="Sin cambios desde la actualización anterior"
        className="movement neutral"
        title="Sin cambios desde la actualización anterior"
      >
        —
      </span>
    );
  }
  if (value > 0) {
    const label = `Sube ${value} ${value === 1 ? "posición" : "posiciones"}`;
    return (
      <span aria-label={label} className="movement up" title={label}>
        ↑ {value}
      </span>
    );
  }
  const positions = Math.abs(value);
  const label = `Baja ${positions} ${
    positions === 1 ? "posición" : "posiciones"
  }`;
  return (
    <span aria-label={label} className="movement down" title={label}>
      ↓ {positions}
    </span>
  );
}
