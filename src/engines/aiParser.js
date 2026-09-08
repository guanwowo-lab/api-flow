import { getAiConfig } from './aiConfig'
import { callAi, extractJson } from './aiClient'

// 配置读写已迁移至 aiConfig.js，这里转发导出以兼容现有引用
export { getAiConfig, saveAiConfig, hasAiConfig } from './aiConfig'

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

  const { reply } = await callAi(prompt, { maxTokens: 16384, temperature: 0.1, config })
  const parsed = extractJson(reply)

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

