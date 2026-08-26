import type { Locale } from "../../lib/i18n/config";

export function Movement({
  value,
  locale = "es",
}: {
  value: number | null;
  locale?: Locale;
}) {
  const en = locale === "en";
  if (value === null) {
    const label = en
      ? "New since the latest update"
      : "Nueva desde la última actualización";
    return (
      <span aria-label={label} className="movement neutral" title={label}>
        {en ? "New" : "Nueva"}
      </span>
    );
  }
  if (value === 0) {
    const label = en
      ? "No change since the latest update"
      : "Sin cambios desde la última actualización";
    return (
      <span aria-label={label} className="movement neutral" title={label}>
        —
      </span>
    );
  }
  if (value > 0) {
    const label = en
      ? `Up ${value} ${value === 1 ? "place" : "places"}`
      : `Sube ${value} ${value === 1 ? "posición" : "posiciones"}`;
    return (
      <span aria-label={label} className="movement up" title={label}>
        ↑ {value}
      </span>
    );
  }
  const positions = Math.abs(value);
  const label = en
    ? `Down ${positions} ${positions === 1 ? "place" : "places"}`
    : `Baja ${positions} ${positions === 1 ? "posición" : "posiciones"}`;
  return (
    <span aria-label={label} className="movement down" title={label}>
      ↓ {positions}
    </span>
  );
}
