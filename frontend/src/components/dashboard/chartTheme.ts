// Paleta categórica validada (CVD y contraste) para fondo claro #fcfcfb.
// Orden fijo: un color sigue siempre a la misma serie.
export const SERIES = {
  income: '#2a78d6', // slot 1 - azul
  expense: '#eb6834', // slot 2 - naranja
  saved: '#1baf7a', // slot 3 - aqua (contraste < 3:1: el gráfico ofrece tabla)
} as const

// Gastos por categoría: magnitud de una sola serie -> un solo tono.
export const SINGLE_HUE = '#2a78d6'

export const CHROME = {
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  tick: '#898781',
  ink: '#0b0b0b',
  inkSecondary: '#52514e',
  surface: '#fcfcfb',
} as const

export const TICK_STYLE = { fill: CHROME.tick, fontSize: 12 }
