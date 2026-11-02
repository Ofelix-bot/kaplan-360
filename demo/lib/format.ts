const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function sgd(amount: number) {
  return `S$${amount.toLocaleString("en-SG")}`
}

export function gpa(value: number) {
  return value.toFixed(2)
}

export function score(value: number) {
  return Number.isInteger(value) ? value.toFixed(1) : String(value)
}

export function duration(months: number | null) {
  if (months === null) return null
  if (months % 12 === 0) return months === 12 ? "1 year" : `${months / 12} years`
  return `${months} months`
}

/** Intake months from a 12-bit mask, e.g. "Jan, Aug". */
export function intakeMonths(mask: number) {
  const names = MONTHS.filter((_, i) => mask & (1 << i))
  return names.length ? names.join(", ") : null
}

export function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-SG")} ${n === 1 ? one : many}`
}
