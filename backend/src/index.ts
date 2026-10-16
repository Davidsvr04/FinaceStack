import { createApp } from './app.js'
import { assertSupabaseEnv, PORT } from './config/env.js'

assertSupabaseEnv()

createApp().listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`)
})
