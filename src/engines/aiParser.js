const STORAGE_KEY_BASE = 'aiflow_ai_base_url'
const STORAGE_KEY_KEY = 'aiflow_ai_api_key'
const STORAGE_KEY_MODEL = 'aiflow_ai_model'

export function getAiConfig() {
  return {
    baseUrl: localStorage.getItem(STORAGE_KEY_BASE) || 'https://api.deepseek.com/anthropic',
    apiKey: localStorage.getItem(STORAGE_KEY_KEY) || 'sk-6371a8cb8f984661b06d029522fc36bf',
    model: localStorage.getItem(STORAGE_KEY_MODEL) || 'deepseek-v4-pro',
  }
}

export function saveAiConfig({ baseUrl, apiKey, model }) {
  if (baseUrl !== undefined) localStorage.setItem(STORAGE_KEY_BASE, baseUrl)
  if (apiKey !== undefined) localStorage.setItem(STORAGE_KEY_KEY, apiKey)
  if (model !== undefined) localStorage.setItem(STORAGE_KEY_MODEL, model)
}

export function hasAiConfig() {
  const c = getAiConfig()
  return !!(c.apiKey && c.baseUrl)
}

/**
 * 使用 AI 从文档文本中提取 API 接口结构化信息
 * @param {string} text - 文档纯文本
 * @returns {Promise<Array<{name: string, url: string, method: string, inputParams: Array, outputParams: Array}>>}
 */
export async function aiParseDocument(text) {
  const config = getAiConfig()
  if (!config.apiKey) throw new Error('请先配置 AI API Key')

  // 限制文本长度，控制 token 消耗
  const maxChars = 30000
  const truncated = text.length > maxChars
    ? text.slice(0, maxChars) + '\n\n[文档过长，已截断前 ' + maxChars + ' 字符]'
    : text

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

文档内容：
${truncated}`

  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`AI 请求失败 (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const reply = data?.content?.[0]?.text || ''

  // 从 AI 回复中提取 JSON
  const jsonMatch = reply.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('AI 返回格式异常，未找到 JSON 数组')

  try {
    const apis = JSON.parse(jsonMatch[0])
    return apis.map(normalizeApi)
  } catch (e) {
    throw new Error('AI 返回的 JSON 解析失败: ' + e.message)
  }
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
