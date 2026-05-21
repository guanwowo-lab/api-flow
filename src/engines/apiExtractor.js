/**
 * 从纯文本中提取 API 接口结构化信息
 * @param {string} text - 文档纯文本
 * @returns {Array<{name: string, url: string, method: string, inputParams: Array, outputParams: Array}>}
 */
export function extractApis(text) {
  const blocks = splitIntoBlocks(text)
  return blocks.map(extractApiFromBlock).filter((api) => api.name || api.url)
}

const METHOD_RE = /(?:请求方式|请求方法|method)[：:\s]*(GET|POST|PUT|DELETE|PATCH)/i
const URL_RE = /(?:接口地址|请求地址|API地址|URL|url|接口路径)[：:\s]*(\/[^\s,，。\n]+|\bhttps?:\/\/[^\s,，。\n]+)/i
const NAME_RE = /(?:接口名称|API名称|接口名|方法名)[：:\s]*(.+)/i
const PARAM_SECTION = /(?:请求参数|输入参数|入参)[：:\s]*([\s\S]*?)(?=(?:返回参数|响应参数|输出参数|出参|$))/i
const RESPONSE_SECTION = /(?:返回参数|响应参数|输出参数|出参)[：:\s]*([\s\S]*?)(?=(?:请求参数|输入参数|入参|\n(?:#{1,4}\s|第[一二三])|$))/i

function splitIntoBlocks(text) {
  const blocks = []
  const lines = text.split('\n')
  let currentBlock = ''
  let currentHeading = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headingMatch = line.match(/^(?:#{1,4}\s*)(.+)/)
    if (headingMatch) {
      if (currentBlock.trim()) {
        blocks.push({ heading: currentHeading, text: currentBlock.trim() })
      }
      currentHeading = headingMatch[1]
      currentBlock = ''
    } else {
      currentBlock += line + '\n'
    }
  }
  if (currentBlock.trim()) {
    blocks.push({ heading: currentHeading, text: currentBlock.trim() })
  }

  return blocks.length > 0 ? blocks : [{ heading: '', text }]
}

function extractApiFromBlock(block) {
  const fullText = block.heading + '\n' + block.text

  const nameMatch = fullText.match(NAME_RE)
  const urlMatch = fullText.match(URL_RE)
  const methodMatch = fullText.match(METHOD_RE)

  const api = {
    name: nameMatch ? nameMatch[1].trim() : block.heading || '',
    url: urlMatch ? urlMatch[1].trim() : guessUrl(fullText),
    method: methodMatch ? methodMatch[1].toUpperCase() : guessMethod(fullText),
    inputParams: extractParams(fullText, PARAM_SECTION),
    outputParams: extractParams(fullText, RESPONSE_SECTION),
  }

  return api
}

function guessUrl(text) {
  const m = text.match(/(\/[^\s,，。\n]{2,}|\bhttps?:\/\/[^\s,，。\n]+)/)
  return m ? m[1] : ''
}

function guessMethod(text) {
  const upper = text.toUpperCase()
  if (/\bPOST\b/.test(upper)) return 'POST'
  if (/\bDELETE\b/.test(upper)) return 'DELETE'
  if (/\bPUT\b/.test(upper)) return 'PUT'
  if (/\bPATCH\b/.test(upper)) return 'PATCH'
  return 'GET'
}

function extractParams(text, sectionRe) {
  const sectionMatch = text.match(sectionRe)
  if (!sectionMatch) return []

  const sectionText = sectionMatch[1]
  const params = []
  const lines = sectionText.split('\n')

  for (const line of lines) {
    const param = parseParamLine(line)
    if (param) params.push(param)
  }

  return params.length > 0 ? params : parseParamList(sectionText)
}

function parseParamLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Remove leading/trailing pipe separators
  const clean = trimmed.replace(/^\||\|$/g, '').trim()

  // Try 4-column: name | type | required | description
  const match4 = clean.match(/^(\w+)\s*[|,\s]+\s*(\w+)\s*[|,\s]+\s*(是|否|必填|可选)\s*[|,\s]+\s*(.*)$/)
  if (match4) {
    return {
      name: match4[1],
      type: match4[2],
      required: match4[3] === '是' || match4[3] === '必填',
      description: match4[4] || '',
    }
  }

  // Try 3-column: name | type | description
  const match3 = clean.match(/^(\w+)\s*[|,\s]+\s*(\w+)\s*[|,\s]+\s*(.+)$/)
  if (match3) {
    return {
      name: match3[1],
      type: match3[2],
      required: false,
      description: match3[3] || '',
    }
  }

  // Try word-based: name type required? description...
  const words = trimmed.split(/\s+/)
  if (words.length >= 2 && /^[a-zA-Z_]\w*$/.test(words[0])) {
    return {
      name: words[0],
      type: words[1] || 'string',
      required: trimmed.includes('必填') || trimmed.includes('是'),
      description: words.slice(2).join(' ') || '',
    }
  }

  return null
}

function parseParamList(text) {
  const params = []
  // Match: paramName (type) or paramName: type or `paramName` type
  const patterns = [
    /[`"]?(\w+)[`"]?\s*[\(（]\s*(\w+)\s*[\)）]/g,
    /(\w+)\s*[：:]\s*(\w+)/g,
  ]

  const seen = new Set()
  for (const re of patterns) {
    let match
    while ((match = re.exec(text)) !== null) {
      const name = match[1]
      if (seen.has(name)) continue
      const blocked = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HTTP', 'API', 'URL', 'THE', 'THIS', 'THAT', 'AND', 'FOR', 'WITH', 'WILL', 'FROM', 'WHEN', 'THEN']
      if (blocked.includes(name.toUpperCase())) continue
      if (name.length < 2) continue
      seen.add(name)
      params.push({ name, type: match[2], required: false, description: '' })
    }
  }
  return params
}
