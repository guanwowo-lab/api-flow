const STORAGE_KEY_BASE = 'aiflow_ai_base_url'
const STORAGE_KEY_KEY = 'aiflow_ai_api_key'
const STORAGE_KEY_MODEL = 'aiflow_ai_model'
const STORAGE_KEY_HINT = 'aiflow_ai_hint'

export function getAiConfig() {
  let baseUrl = localStorage.getItem(STORAGE_KEY_BASE) || 'https://api.deepseek.com'
  if (baseUrl.includes('/anthropic')) {
    baseUrl = 'https://api.deepseek.com'
    localStorage.setItem(STORAGE_KEY_BASE, baseUrl)
  }
  return {
    baseUrl,
    apiKey: localStorage.getItem(STORAGE_KEY_KEY) || '',
    model: localStorage.getItem(STORAGE_KEY_MODEL) || 'deepseek-v4-pro',
    hint: localStorage.getItem(STORAGE_KEY_HINT) || '',
  }
}

export function saveAiConfig({ baseUrl, apiKey, model, hint }) {
  if (baseUrl !== undefined) localStorage.setItem(STORAGE_KEY_BASE, baseUrl)
  if (apiKey !== undefined) localStorage.setItem(STORAGE_KEY_KEY, apiKey)
  if (model !== undefined) localStorage.setItem(STORAGE_KEY_MODEL, model)
  if (hint !== undefined) localStorage.setItem(STORAGE_KEY_HINT, hint)
}

export function hasAiConfig() {
  const c = getAiConfig()
  return !!(c.apiKey && c.baseUrl)
}

const MAX_CHUNK = 28000

export async function aiParseDocument(text) {
  const config = getAiConfig()
  if (!config.apiKey) throw new Error('请先配置 AI API Key')

  if (text.length <= MAX_CHUNK) {
    return await callAiParse(text, config)
  }

  const chunks = splitIntoChunks(text, MAX_CHUNK)
  const allApis = []
  for (let i = 0; i < chunks.length; i++) {
    const apis = await callAiParse(`[第${i + 1}/${chunks.length}部分]\n\n${chunks[i]}`, config)
    allApis.push(...apis)
  }

  const seen = new Set()
  return allApis.filter((api) => {
    const key = (api.name || '') + '|' + (api.url || '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function splitIntoChunks(text, maxSize) {
  const paragraphs = text.split(/\n{2,}/)
  const chunks = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length > maxSize && current.length > 0) {
      chunks.push(current.trim())
      current = para
    } else {
      current += (current ? '\n\n' : '') + para
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks
}

async function callAiParse(content, config) {
  const prompt = `你是一个 API 文档解析器。请从以下文档内容中提取所有 API 接口信息，返回 JSON 数组。

每个接口对象格式：
{
  "name": "接口名称",
  "url": "接口路径（如 /api/v1/users）",
  "method": "GET/POST/PUT/DELETE/PATCH",
  "inputParams": [
    { "name": "参数名", "type": "string/int/object/array/boolean", "required": true/false, "description": "说明", "remark": "" }
  ],
  "outputParams": [
    { "name": "参数名", "type": "string/int/object/array/boolean", "required": false, "description": "说明", "remark": "" }
  ]
}

规则：
1. 如果参数是 object/array 类型且文档中描述了其子字段，请用 children 字段嵌套：{ "name": "parent", "type": "object", "children": [...] }
2. inputParams 的 required 根据文档中的"必填/可选"判断
3. outputParams 的 required 统一为 false
4. 如果文档中未明确标注 HTTP 方法，根据上下文推断
5. 只返回 JSON 数组，不要任何解释文字
${config.hint ? `\n用户提示：${config.hint}\n` : ''}
文档内容：
${content}`

  const apiUrl = `${config.baseUrl}/v1/chat/completions`

  let response
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 16384,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (e) {
    if (e.message === 'Failed to fetch') {
      throw new Error('网络请求被阻止。可能是 CORS 跨域限制或网络不通。请尝试：\n1. 检查 Base URL 是否能从浏览器访问\n2. 使用 CORS 代理或浏览器插件\n3. 确认 API 服务支持浏览器端调用')
    }
    throw e
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    if (response.status === 404) {
      throw new Error(`接口路径不存在 (404)。请检查设置中的 Base URL 是否正确，当前: ${apiUrl}`)
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(`API Key 无效或无权限 (${response.status})。请检查设置中的 API Key`)
    }
    throw new Error(`AI 请求失败 (${response.status}): ${errText.slice(0, 300)}`)
  }

  let data
  try { data = await response.json() } catch { throw new Error('AI 返回格式异常，无法解析 JSON 响应') }
  const reply = data?.choices?.[0]?.message?.content || ''

  let jsonStr = reply
  const codeBlock = reply.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) jsonStr = codeBlock[1]

  let arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/)

  let parsed
  try {
    if (arrayMatch) {
      parsed = JSON.parse(arrayMatch[0])
    } else if (objectMatch) {
      const obj = JSON.parse(objectMatch[0])
      parsed = Array.isArray(obj) ? obj : [obj]
    } else {
      throw new Error('未找到 JSON。返回内容: ' + reply.slice(0, 500))
    }
  } catch (e) {
    const raw = arrayMatch?.[0] || objectMatch?.[0] || ''
    const repaired = raw ? repairTruncatedJson(raw) : null
    if (repaired) {
      try { parsed = JSON.parse(repaired) } catch (e2) {
        throw new Error('JSON 解析失败: ' + e.message + '\n返回: ' + reply.slice(0, 500))
      }
    } else {
      throw new Error('JSON 解析失败: ' + e.message + '\n返回: ' + reply.slice(0, 500))
    }
  }

  return (Array.isArray(parsed) ? parsed : [parsed]).map(normalizeApi)
}

function normalizeApi(api) {
  return {
    name: api.name || '',
    url: api.url || '',
    method: (api.method || 'GET').toUpperCase(),
    inputParams: (api.inputParams || []).map(normalizeParam),
    outputParams: (api.outputParams || []).map(normalizeParam),
  }
}

function normalizeParam(p) {
  return {
    name: p.name || '',
    type: p.type || 'string',
    required: !!p.required,
    description: p.description || '',
    remark: p.remark || '',
    children: p.children ? p.children.map(normalizeParam) : [],
  }
}

function repairTruncatedJson(str) {
  let s = str.trimEnd()

  // 移除末尾不完整的属性
  s = s.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '')
  s = s.replace(/,\s*"[^"]*"\s*:\s*[^\s,\]}]*$/, '')
  s = s.replace(/,\s*"[^"]*"\s*$/, '')
  s = s.replace(/,\s*"[^"]*$/, '')

  let braceCount = 0, bracketCount = 0, inString = false, escaped = false
  for (const ch of s) {
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') braceCount++
    if (ch === '}') braceCount--
    if (ch === '[') bracketCount++
    if (ch === ']') bracketCount--
  }

  if (braceCount > 0 || bracketCount > 0) {
    if (inString) s += '"'
    for (let i = 0; i < braceCount; i++) s += '}'
    for (let i = 0; i < bracketCount; i++) s += ']'
    return s
  }

  return null
}
