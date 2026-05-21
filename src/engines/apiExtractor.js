/**
 * 从纯文本中提取 API 接口结构化信息。
 * 支持两种文档格式：
 * 1) 编号式章节结构：5.1.1.接口名 → 5.1.1.1.服务地址 → 5.1.1.3.输入参数
 * 2) Markdown 标签式结构：# 接口名 → 请求方式: POST → 接口地址: /api
 */

const URL_LABELS = ['服务地址', '接口地址', '请求地址', 'API地址', 'URL', 'url']
const INPUT_LABELS = ['输入参数', '请求参数', '入参']
const OUTPUT_LABELS = ['输出参数', '返回参数', '响应参数', '出参']
const DESC_LABELS = ['服务描述', '接口描述', '功能描述', '接口说明']

const METHOD_RE = /(?:请求方式|请求方法|method)[：:\s]*(GET|POST|PUT|DELETE|PATCH)/i
const NAME_RE = /(?:接口名称|API名称|接口名|方法名)[：:\s]*(.+)/i
const URL_RE = /(?:接口地址|请求地址|API地址|URL|url|接口路径)[：:\s]*(\/[^\s,，。\n]+|\bhttps?:\/\/[^\s,，。\n]+)/i
const PARAM_SECTION = /(?:请求参数|输入参数|入参)[：:\s]*([\s\S]*?)(?=(?:返回参数|响应参数|输出参数|出参|$))/i
const RESPONSE_SECTION = /(?:返回参数|响应参数|输出参数|出参)[：:\s]*([\s\S]*?)(?=(?:请求参数|输入参数|入参|$))/i

export function extractApis(text) {
  const cleaned = cleanText(text)
  const blocks = splitIntoBlocks(cleaned)
  return blocks.map(extractApiFromBlock).filter((api) => api.name || api.url)
}

// ---- 文本清洗 ----

function cleanText(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false
      // 去掉纯噪声行：单个无意义字符
      if (/^[A-Za-z\)\-人白百]{1}$/.test(line)) return false
      return true
    })
    .map((line) => line.replace(/^[\)\-人白百]{1,3}(?=\d|[a-zA-Z_一-鿿])/, ''))
    .join('\n')
}

// ---- 分块：识别 API 级章节 ----

function splitIntoBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  let currentLines = []
  let currentApiName = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const section = parseSectionLine(trimmed)

    if (section && section.depth === 3 && section.title) {
      // API 级章节 (x.x.x.标题) → 开始新块
      if (currentLines.length > 0) {
        blocks.push({ heading: currentApiName, text: currentLines.join('\n') })
      }
      currentApiName = section.title
      currentLines = [trimmed]
    } else {
      currentLines.push(trimmed)
      // depth <= 2 的上级标题不作为 API 名称，仅作为上下文内容
    }
  }

  if (currentLines.length > 0) {
    blocks.push({ heading: currentApiName, text: currentLines.join('\n') })
  }

  // 如果没找到任何 API 级章节，回退到 Markdown 标题分块
  const hasApiSections = blocks.some((b) => b.heading)
  if (!hasApiSections) {
    return splitByMarkdownHeadings(text)
  }

  return blocks.filter((b) => b.heading)
}

function parseSectionLine(line) {
  // 匹配编号式章节：可选垃圾前缀 + N.N.N... 可选更多 + 空格/标点 + 标题
  const m = line.match(/^[\s\S]*?(\d+(?:\.\d+){1,})(?:\.\d+)*\.?\s*(.+)$/)
  if (!m) return null

  const numPart = m[1]          // e.g. "5.1.1" or "5.1.1.1"
  const depth = numPart.split('.').length
  const title = m[2].trim()

  // 过滤：标题不能是纯数字或空
  if (!title || /^\d+$/.test(title)) return null

  return { depth, numPart, title }
}

function splitByMarkdownHeadings(text) {
  const blocks = []
  const lines = text.split('\n')
  let currentBlock = ''
  let currentHeading = ''

  for (const line of lines) {
    const m = line.match(/^#{1,4}\s+(.+)/)
    if (m) {
      if (currentBlock.trim()) {
        blocks.push({ heading: currentHeading, text: currentBlock.trim() })
      }
      currentHeading = m[1]
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

// ---- 从块中提取 API 信息 ----

function extractApiFromBlock(block) {
  const fullText = block.heading + '\n' + block.text

  // 先尝试 Markdown 标签式提取
  const labelBased = tryLabelBasedExtraction(fullText, block.heading)
  if (labelBased && (labelBased.url || labelBased.inputParams.length > 0 || labelBased.outputParams.length > 0)) {
    return labelBased
  }

  // 按编号式子章节结构提取
  return subsectionBasedExtraction(block)
}

function tryLabelBasedExtraction(fullText, heading) {
  const nameMatch = fullText.match(NAME_RE)
  const urlMatch = fullText.match(URL_RE)
  const methodMatch = fullText.match(METHOD_RE)

  return {
    name: nameMatch ? nameMatch[1].trim() : cleanApiName(heading),
    url: urlMatch ? urlMatch[1].trim() : guessUrl(fullText),
    method: methodMatch ? methodMatch[1].toUpperCase() : guessMethod(fullText),
    inputParams: extractParams(fullText, PARAM_SECTION),
    outputParams: extractParams(fullText, RESPONSE_SECTION),
  }
}

function subsectionBasedExtraction(block) {
  const lines = block.text.split('\n')
  const api = {
    name: cleanApiName(block.heading),
    url: '',
    method: 'GET',
    inputParams: [],
    outputParams: [],
  }

  let currentSection = null
  let sectionContent = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const section = parseSectionLine(trimmed)

    if (section && section.depth >= 4) {
      // 保存上一段内容
      if (currentSection && sectionContent.length > 0) {
        applySectionContent(api, currentSection, sectionContent.join('\n'))
      }
      currentSection = classifySection(section.title)
      sectionContent = []
    } else if (section && section.depth <= 3) {
      // 上级标题，可能包含方法描述等信息
      sectionContent.push(trimmed)
    } else {
      sectionContent.push(trimmed)
    }
  }

  // 处理最后一段
  if (currentSection && sectionContent.length > 0) {
    applySectionContent(api, currentSection, sectionContent.join('\n'))
  }

  // 兜底
  if (!api.url) api.url = guessUrl(block.text)
  if (api.method === 'GET') api.method = guessMethod(block.text)

  return api
}

function classifySection(label) {
  for (const kw of URL_LABELS) {
    if (label.includes(kw)) return 'url'
  }
  for (const kw of INPUT_LABELS) {
    if (label.includes(kw)) return 'input'
  }
  for (const kw of OUTPUT_LABELS) {
    if (label.includes(kw)) return 'output'
  }
  for (const kw of DESC_LABELS) {
    if (label.includes(kw)) return 'desc'
  }
  return 'other'
}

function applySectionContent(api, sectionType, content) {
  switch (sectionType) {
    case 'url': {
      const m = content.match(/(\/[^\s,，。\n]{2,}|\bhttps?:\/\/[^\s,，。\n]+)/)
      if (m) api.url = m[1]
      api.method = guessMethod(content)  // URL 段落中可能包含请求方式
      break
    }
    case 'input':
      api.inputParams = extractParamsFromContent(content)
      break
    case 'output':
      api.outputParams = extractParamsFromContent(content)
      break
    case 'desc':
      api.method = guessMethod(content)
      break
  }
}

// ---- 参数提取 ----

function extractParams(text, sectionRe) {
  const m = text.match(sectionRe)
  if (!m) return []
  return extractParamsFromContent(m[1])
}

function isHeaderRow(line) {
  const headerKeywords = ['参数名', '参数名称', '字段名', '字段名称', '变量名',
    '名称', '类型', '必填', '说明', '描述', '备注', '序号', '编号']
  const firstCell = line.split(/\s*\|\s*|[\s,]{2,}/)[0]
  if (!firstCell) return false
  return headerKeywords.some((kw) => firstCell === kw || firstCell.includes(kw) && firstCell.length <= 5)
}

function extractParamsFromContent(content) {
  const lines = content.split('\n')
  const params = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // 跳过表头行和分隔行
    const bare = trimmed.replace(/^\||\|$/g, '').trim()
    if (isHeaderRow(bare)) continue
    if (/^[|+\-=]{3,}/.test(trimmed)) continue
    if (/^[|+\-=]{3,}/.test(trimmed)) continue

    const param = parseParamLine(trimmed)
    if (param) params.push(param)
  }

  return params.length > 0 ? params : parseParamListFallback(content)
}

function parseParamLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return null

  let clean = trimmed.replace(/^\||\|$/g, '').trim()

  // 方式1：管道分隔的表格行  name | type | required | description
  const pipeParts = clean.split(/\s*\|\s*/)
  if (pipeParts.length >= 2) {
    const name = pipeParts[0].trim()
    const type = pipeParts[1].trim()
    const third = pipeParts.length >= 3 ? pipeParts[2].trim() : ''
    const fourth = pipeParts.length >= 4 ? pipeParts[3].trim() : ''

    if (isValidParamName(name)) {
      const hasRequired = pipeParts.length >= 4
      const required = hasRequired ? /^(是|必填|Y|Yes|TRUE)$/i.test(third) : false
      const desc = hasRequired ? fourth : (third || '')
      return { name, type: type || 'string', required, description: desc }
    }
  }

  // 方式2：空格分隔  name  type  required?  description
  const words = clean.split(/\s+/)
  if (words.length >= 2 && isValidParamName(words[0])) {
    let descStart = 2
    if (words.length > 2 && /^(是|否|必填|可选)$/.test(words[2])) {
      descStart = 3
    }
    return {
      name: words[0],
      type: words[1],
      required: descStart > 2 || /(是|必填)/.test(clean),
      description: words.slice(descStart).join(' '),
    }
  }

  // 方式3：name(type) 或 name：type 格式
  const namedType = clean.match(/^(.+?)\s*[\(（：:]\s*(\w+)\s*[\)）]?\s*(.*)$/)
  if (namedType && isValidParamName(namedType[1].trim())) {
    return {
      name: namedType[1].trim(),
      type: namedType[2],
      required: /(是|必填)/.test(clean),
      description: namedType[3] || '',
    }
  }

  return null
}

function parseParamListFallback(text) {
  const params = []
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
      const blocked = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HTTP', 'API', 'URL',
        'THE', 'THIS', 'THAT', 'AND', 'FOR', 'WITH', 'WILL', 'FROM', 'WHEN', 'THEN']
      if (blocked.includes(name.toUpperCase())) continue
      if (name.length < 2) continue
      seen.add(name)
      params.push({ name, type: match[2], required: false, description: '' })
    }
  }
  return params
}

function isValidParamName(name) {
  if (!name || name.length > 50) return false
  if (/^[a-zA-Z_]\w*$/.test(name)) return true
  if (/[一-鿿]/.test(name)) return true
  return false
}

// ---- 兜底函数 ----

function cleanApiName(name) {
  if (!name) return ''
  return name.replace(/^[\)\s\-人白百]{1,3}/, '').trim()
}

function guessUrl(text) {
  // 先尝试找明确的 URL 模式
  let m = text.match(/(https?:\/\/[^\s,，。\n]+)/)
  if (m) return m[1]
  // 再尝试找路径
  m = text.match(/(\/[a-zA-Z][^\s,，。\n]{2,})/)
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
