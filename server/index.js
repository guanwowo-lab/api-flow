import express from 'express'
import cors from 'cors'
import { createProxyRouter } from './proxy.js'
import { createHistoryRouter } from './history-store.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use('/api', createProxyRouter())
app.use('/api', createHistoryRouter())

const PORT = process.env.SERVER_PORT || 3001
app.listen(PORT, () => {
  console.log(`[api-test] Proxy server running on http://localhost:${PORT}`)
})
