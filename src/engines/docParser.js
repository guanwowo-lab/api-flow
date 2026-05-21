import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

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
    const text = content.items.map((item) => item.str).join(' ')
    pages.push(text)
  }

  return { text: pages.join('\n'), sourceName: file.name }
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
