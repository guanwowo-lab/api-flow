import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * 根据文件类型或 URL 提取文本内容
 * @param {File|string} input - File 对象（.docx/.pdf）或 URL 字符串
 * @returns {Promise<{text: string, sourceName: string}>}
 */
export async function parseDocument(input) {
  if (typeof input === 'string') {
    return parseUrl(input)
  }

  const file = input
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'docx') {
    return parseDocx(file)
  }
  if (ext === 'pdf') {
    return parsePdf(file)
  }
  throw new Error(`不支持的文件格式: .${ext}`)
}

async function parseDocx(file) {
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return { text: result.value, sourceName: file.name }
}

async function parsePdf(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = extractTextWithLayout(content.items)
    pages.push(text)
  }

  return { text: pages.join('\n'), sourceName: file.name }
}

function extractTextWithLayout(items) {
  if (!items || items.length === 0) return ''

  const sorted = [...items].sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5]
    if (Math.abs(yDiff) > 2) return yDiff
    return a.transform[4] - b.transform[4]
  })

  let result = ''
  let lastY = sorted[0]?.transform[5]
  let lastX = sorted[0]?.transform[4]

  for (const item of sorted) {
    const y = item.transform[5]
    const x = item.transform[4]

    if (lastY !== undefined && Math.abs(y - lastY) > 2) {
      result += '\n'
    } else if (lastX !== undefined && lastY !== undefined && x < lastX) {
      // same line but left of previous — likely a new line too
    } else if (lastX !== undefined && x - lastX > 5) {
      result += ' '
    }

    result += item.str
    lastY = y
    lastX = x + (item.width || 0)
  }

  return result
}

async function parseUrl(url) {
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const html = await resp.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('script, style, nav, footer, header').forEach((el) => el.remove())
    const text = doc.body?.textContent || ''
    return { text: text.replace(/\s{3,}/g, '\n').trim(), sourceName: new URL(url).hostname }
  } catch (e) {
    if (e.message.includes('Failed to fetch') || e.message.includes('CORS')) {
      throw new Error('CORS: 无法直接抓取该链接，请手动粘贴文档内容')
    }
    throw e
  }
}
