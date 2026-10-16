// Servidor local (npm run dev / start). En Vercel la entrada es src/app.ts.
import app from './app.js'
import { PORT } from './config/env.js'

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`)
})
