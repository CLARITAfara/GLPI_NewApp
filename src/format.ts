/** Formate une date ISO en date/heure FR lisible */
export function formatDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}
