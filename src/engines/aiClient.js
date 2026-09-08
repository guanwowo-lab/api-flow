/**
 * 统一 AI 客户端 - 基于 LangChain 深度集成
 * - callAi: 提示词模板 → ChatOpenAI → StringOutputParser（文本链）
 * - callAiJson: 文本链 → sanitize（清洗/修复）→ JsonOutputParser（JSON 链）
 * - sanitizeJsonText / extractJson / repairTruncatedJson: JSON 清洗与截断修复
 * 被 aiParser.js / simpleWorkflow.js / MatchPanel.jsx 复用，避免逻辑重复与漂移
 */

import { ChatOpenAI } from '@langchain/openai'
import { StringOutputParser, JsonOutputParser } from '@langchain/core/output_parsers'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { RunnableLambda } from '@langchain/core/runnables'
import { getAiConfig } from './aiConfig'

/**
 * 获取 LangChain Chat 模型实例
 * @param {object} [options]
 * @param {number} [options.maxTokens=8192]
 * @param {number} [options.temperature=0.2]
 * @param {object} [options.config] - 自定义配置（默认读取 getAiConfig()）
 * @returns {ChatOpenAI}
 */
function getChatModel({ maxTokens = 8192, temperature = 0.2, config } = {}) {
  const cfg = config || getAiConfig()
  if (!cfg.apiKey) throw new Error('请先配置 AI API Key')

  return new ChatOpenAI({
    model: cfg.model,
    temperature,
    maxTokens,
    apiKey: cfg.apiKey, // v1.x 参数名为 apiKey（旧版 openAIApiKey 已不识别，会误报缺少凭证）
    configuration: {
      baseURL: cfg.baseUrl,
      dangerouslyAllowBrowser: true, // 允许从浏览器直接调用
    },
  })
}

/**
 * 将 LangChain / SDK 错误转换为用户友好的中文错误
 * LangChain v1 的 APIError 携带 status 与 response，优先按状态码判定
 * @param {Error} e - 原始错误
 * @param {object} options - 调用时的 options（用于读取 config.baseUrl）
 * @returns {Error} 转换后的错误（cause 保留原始错误）
 */
function mapAiError(e, options = {}) {
  const status = e?.status ?? e?.response?.status
  if (status === 401 || status === 403) {
    return new Error(`API Key 无效或无权限 (${status})。请检查设置中的 API Key`, { cause: e })
  }
  if (status === 404) {
    const cfg = options.config || getAiConfig()
    return new Error(`接口路径不存在 (404)。请检查设置中的 Base URL 是否正确，当前: ${cfg.baseUrl}`, { cause: e })
  }
  if (status === 429) {
    return new Error('AI 请求被限流 (429)，请稍后重试', { cause: e })
  }
  // 无 status 时回退到错误文本探测（覆盖 CORS/网络层）
  const msg = e?.message || ''
  if (msg.includes('fetch') || msg.includes('Failed to fetch')) {
    return new Error('网络请求被阻止。可能是 CORS 跨域限制或网络不通。请检查 Base URL 是否能从浏览器访问', { cause: e })
  }
  if (status && status >= 500) {
    return new Error(`AI 服务端错误 (${status})，请稍后重试`, { cause: e })
  }
  return e
}

/**
 * 调用 AI Chat Completions 接口，返回文本回复
 * @param {string} prompt - 用户提示词
 * @param {object} [options]
 * @param {number} [options.maxTokens=8192]
 * @param {number} [options.temperature=0.2]
 * @param {object} [options.config] - 自定义配置（默认读取 getAiConfig()）
 * @returns {Promise<{reply: string, finishReason: string}>}
 */
export async function callAi(prompt, options = {}) {
  try {
    const model = getChatModel(options)
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ['user', '{input}']
    ])

    // LangChain 链：提示词模板 → 模型 → 文本输出
    const chain = promptTemplate.pipe(model).pipe(new StringOutputParser())

    const reply = await chain.invoke({ input: prompt })

    if (!reply || !reply.trim()) {
      throw new Error('AI 返回内容为空')
    }

    return { reply, finishReason: 'stop' }

  } catch (e) {
    throw mapAiError(e, options)
  }
}

/**
 * 调用 AI 并直接返回解析后的 JSON（完整 LangChain 链式管道）
 * 链结构：提示词模板 → 模型 → 文本输出 → JSON 清洗/修复 → JsonOutputParser
 *
 * 之所以在 JsonOutputParser 前插入 sanitize 步骤：实测 JsonOutputParser 只能
 * 处理"干净 JSON / markdown 围栏 JSON"，无法处理前后夹杂说明文字、JS 注释、
 * 因长度限制被截断的 JSON —— 这些恰是真实模型输出的高频问题。
 *
 * @param {string} prompt - 用户提示词
 * @param {object} [options]
 * @param {number} [options.maxTokens=8192]
 * @param {number} [options.temperature=0.2]
 * @param {string} [options.prefer='auto'] - 期望的 JSON 类型：'array' | 'object' | 'auto'
 * @param {object} [options.config] - 自定义配置（默认读取 getAiConfig()）
 * @returns {Promise<object|array>} 解析后的 JSON
 */
export async function callAiJson(prompt, options = {}) {
  const { prefer = 'auto' } = options
  try {
    const model = getChatModel(options)
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ['user', '{input}']
    ])

    // JSON 清洗步骤：去围栏/注释、定位 JSON 主体、修复截断
    const sanitizeStep = RunnableLambda.from((text) => {
      if (!text || !text.trim()) throw new Error('AI 返回内容为空')
      return sanitizeJsonText(text, { prefer })
    })

    const chain = promptTemplate
      .pipe(model)
      .pipe(new StringOutputParser())
      .pipe(sanitizeStep)
      .pipe(new JsonOutputParser())

    return await chain.invoke({ input: prompt })

  } catch (e) {
    throw mapAiError(e, options)
  }
}

/**
 * 清洗 AI 回复文本，输出可直接 JSON.parse 的字符串
 * 步骤：去 Markdown 围栏 → 去块/行注释 → 定位 JSON 主体 → 必要时修复截断
 * 被 callAiJson（LangChain 链中间步骤）与 extractJson（传统路径）复用
 * @param {string} reply - AI 文本回复
 * @param {object} [options]
 * @param {string} [options.prefer='auto'] - 期望的 JSON 类型：'array' | 'object' | 'auto'
 * @returns {string} 清洗后的 JSON 字符串
 * @throws {Error} 找不到 JSON 主体或无法修复时抛出
 */
export function sanitizeJsonText(reply, { prefer = 'auto' } = {}) {
  let cleaned = reply

  // 1. 去除 Markdown 代码块
  cleaned = cleaned.replace(/^```(?:json)?\r?\n?/m, '').replace(/\r?\n?```\s*$/m, '')

  // 2. 去除 /* */ 块注释
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')

  // 3. 去除行末 // 注释（保留字符串内的 //）
  const lines = cleaned.split('\n')
  cleaned = lines.map((line) => {
    let inString = false
    let escaped = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (escaped) { escaped = false; continue }
      if (char === '\\') { escaped = true; continue }
      if (char === '"') { inString = !inString; continue }
      if (!inString && char === '/' && line[i + 1] === '/') {
        return line.slice(0, i)
      }
    }
    return line
  }).join('\n')

  // 4. 定位 JSON 主体
  const arrStart = cleaned.indexOf('[')
  const objStart = cleaned.indexOf('{')

  let useArray
  if (prefer === 'array') useArray = true
  else if (prefer === 'object') useArray = false
  else if (arrStart === -1) useArray = false // auto：缺失一方时取存在的那方
  else if (objStart === -1) useArray = true
  else useArray = arrStart < objStart

  const startIdx = useArray ? arrStart : objStart
  let endIdx = useArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}')

  if (startIdx === -1) {
    throw new Error('AI 回复中未找到有效的 JSON 对象或数组')
  }
  // 闭合符号本身被截断时，截取到末尾，交由下方的截断修复处理
  if (endIdx < startIdx) endIdx = cleaned.length - 1

  const jsonStr = cleaned.slice(startIdx, endIdx + 1)

  // 5. 校验可解析性，失败则尝试修复截断
  try {
    JSON.parse(jsonStr)
    return jsonStr
  } catch (e) {
    const repaired = repairTruncatedJson(jsonStr)
    if (!repaired) throw new Error('AI 返回的 JSON 格式错误且无法修复', { cause: e })
    try {
      JSON.parse(repaired)
      return repaired
    } catch (e2) {
      throw new Error('AI 返回的 JSON 格式错误且无法修复', { cause: e2 })
    }
  }
}

/**
 * 从 AI 回复中提取 JSON（清洗 + 解析）
 * @param {string} reply - AI 文本回复
 * @param {object} [options]
 * @param {string} [options.prefer='auto'] - 期望的 JSON 类型：'array' | 'object' | 'auto'
 * @returns {object|array} 解析后的 JSON 对象或数组
 * @throws {Error} 解析失败时抛出，cause 包含原始 JSON.parse 错误
 */
export function extractJson(reply, { prefer = 'auto' } = {}) {
  return JSON.parse(sanitizeJsonText(reply, { prefer }))
}

/**
 * 修复截断的 JSON 字符串
 * 适用于 AI 返回因长度限制被截断的场景
 * @param {string} str - 可能被截断的 JSON 字符串
 * @returns {string|null} 修复后的 JSON 字符串，或 null（如果无需修复）
 */
export function repairTruncatedJson(str) {
  if (!str || str.trim() === '') return null

  let s = str
  let modified = false

  // 1-7. 移除末尾不完整的属性（7 个正则模式）
  const truncPatterns = [
    /(,\s*)$/,                              // 末尾孤立逗号
    /(,\s*"[^"]*"?\s*)$/,                   // 逗号 + 不完整键
    /(,\s*"[^"]*"\s*:\s*)$/,                // 逗号 + 键 + 冒号（值缺失）
    /(,\s*"[^"]*"\s*:\s*"[^"]*"?\s*)$/,     // 逗号 + 键:值（值字符串可能不完整）
    /(,\s*"[^"]*"\s*:\s*\[[^\]]*?\s*)$/,    // 逗号 + 键:数组（数组不完整）
    /(,\s*"[^"]*"\s*:\s*{[^}]*?\s*)$/,      // 逗号 + 键:对象（对象不完整）
    /(,\s*"[^"]*"\s*:\s*[^,}\]]*?\s*)$/,    // 逗号 + 键:任意值（原始类型不完整）
  ]

  for (const pattern of truncPatterns) {
    const before = s
    s = s.replace(pattern, '')
    if (s !== before) modified = true
  }

  // 8. 补全缺失的引号和括号
  // 用栈记录开括号的出现顺序，闭合时逆序补全，确保 JSON 嵌套顺序正确
  // （旧实现按计数器补全：先闭合栈后闭合花括号，数组套对象截断时会补成 `]}`，嵌套顺序颠倒）
  let inString = false
  let escaped = false
  const openStack = [] // 存 '{' / '['，按出现顺序

  for (let i = 0; i < s.length; i++) {
    const char = s[i]
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (inString) continue
    if (char === '{' || char === '[') openStack.push(char)
    if (char === '}' || char === ']') openStack.pop()
  }

  let suffix = ''
  if (inString) { suffix += '"'; modified = true }
  while (openStack.length > 0) {
    // 最后打开的先闭合：'['→']'，'{'→'}'
    suffix += openStack.pop() === '[' ? ']' : '}'
    modified = true
  }

  return modified ? s + suffix : null
}
