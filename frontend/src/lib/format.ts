import type { Currency } from '../types'

const LOCALE = 'es-CO'
const CURRENCY = 'COP'

// Pesos sin decimales ($ 1.250.000); dólares con centavos (US$ 1.250,50).
const currencyFormats: Record<Currency, Intl.NumberFormat> = {
  COP: new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }),
  USD: new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }),
}

const compactCurrency = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const formatCurrency = (value: number, currency: Currency = 'COP') => currencyFormats[currency].format(value)
export const formatCompactCurrency = (value: number) => compactCurrency.format(value)
export const formatPercent = (value: number, maxDecimals = 0) =>
  new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: maxDecimals }).format(value)

/** "2026-10" -> "oct 2026" (o solo "oct" con short). */
export function formatMonth(month: string, short = false): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year!, m! - 1, 1)
  return date.toLocaleDateString(LOCALE, short ? { month: 'short' } : { month: 'long', year: 'numeric' })
}

export function formatDate(isoDate: string): string {
  const [year, m, d] = isoDate.split('-').map(Number)
  return new Date(year!, m! - 1, d).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
}

/** "2026-10-16" -> "jueves, 16 de octubre" (con withYear: "... de octubre de 2026"). */
export function formatLongDate(isoDate: string, withYear = false): string {
  const [year, m, d] = isoDate.split('-').map(Number)
  return new Date(year!, m! - 1, d).toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear && { year: 'numeric' }),
  })
}

/** Desplaza un mes "YYYY-MM" en `delta` meses (puede cruzar de año). */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year!, m! - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

/** "hace 3 días", "ayer", "hace 2 horas". */
export function formatRelative(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'hace un momento'
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
}

const pad = (n: number) => String(n).padStart(2, '0')

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

export function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Próxima fecha (hoy incluido) en que cae un día del mes; ajusta meses cortos. */
export function nextOccurrence(day: number, from = todayISO()): string {
  const [year, m] = from.split('-').map(Number)
  for (const offset of [0, 1]) {
    const lastDay = new Date(year!, m! + offset, 0).getDate()
    const date = `${new Date(year!, m! - 1 + offset, 1).getFullYear()}-${pad(((m! - 1 + offset) % 12) + 1)}-${pad(Math.min(day, lastDay))}`
    if (date >= from) return date
  }
  throw new Error('unreachable')
}

/** Primer y último día de un mes "YYYY-MM". */
export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number)
  const lastDay = new Date(year!, m!, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${pad(lastDay)}` }
}

/** Días desde hoy hasta una fecha ISO (negativo si ya pasó). */
export function daysUntil(isoDate: string): number {
  const [year, m, d] = isoDate.split('-').map(Number)
  const target = new Date(year!, m! - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/** "" -> undefined; si no, número. Para campos opcionales de formularios. */
export function optionalNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value)
}
