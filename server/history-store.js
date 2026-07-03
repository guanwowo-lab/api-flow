import { Router } from 'express'
import { readFile, writeFile, unlink, readdir, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HISTORY_DIR = join(__dirname, '..', 'server', 'history')

function todayFile() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`
}

async function readHistory(file) {
  try {
    const data = await readFile(join(HISTORY_DIR, file), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeHistory(file, records) {
  // ensure dir exists
  try { await readdir(HISTORY_DIR) } catch { await mkdir(HISTORY_DIR, { recursive: true }) }
  await writeFile(join(HISTORY_DIR, file), JSON.stringify(records, null, 2), 'utf-8')
}

export function createHistoryRouter() {
  const router = Router()

  // Save a test result
  router.post('/history', async (req, res) => {
    const record = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...req.body, time: Date.now() }
    const file = todayFile()
    const records = await readHistory(file)
    records.push(record)
    await writeHistory(file, records)
    res.json({ success: true, id: record.id })
  })

  // Query history with filters
  router.get('/history', async (req, res) => {
    const { startDate, endDate, apiId, pass } = req.query
    const files = (await readdir(HISTORY_DIR).catch(() => [])).filter(f => f.endsWith('.json'))
    let all = []
    for (const file of files) {
      if (startDate && file < startDate) continue
      if (endDate && file > endDate) continue
      all = all.concat(await readHistory(file))
    }
    // Reverse chrono
    all.sort((a, b) => b.time - a.time)
    if (apiId) all = all.filter(r => r.apiId === apiId)
    if (pass !== undefined) all = all.filter(r => (pass === 'true') === r.pass)
    res.json(all)
  })

  // Delete a record
  router.delete('/history/:id', async (req, res) => {
    const { id } = req.params
    const files = (await readdir(HISTORY_DIR).catch(() => [])).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const records = await readHistory(file)
      const idx = records.findIndex(r => r.id === id)
      if (idx !== -1) {
        records.splice(idx, 1)
        await writeHistory(file, records)
        return res.json({ success: true })
      }
    }
    res.status(404).json({ success: false, desc: 'Record not found' })
  })

  // Export history as JSON download
  router.get('/history/export', async (req, res) => {
    const { startDate, endDate } = req.query
    const files = (await readdir(HISTORY_DIR).catch(() => [])).filter(f => f.endsWith('.json'))
    let all = []
    for (const file of files) {
      if (startDate && file < startDate) continue
      if (endDate && file > endDate) continue
      all = all.concat(await readHistory(file))
    }
    all.sort((a, b) => b.time - a.time)
    res.setHeader('Content-Disposition', 'attachment; filename="api-test-history.json"')
    res.json(all)
  })

  return router
}
