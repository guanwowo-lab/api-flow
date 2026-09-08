/**
 * 统一 AI 客户端
 * 集中管理：AI HTTP 调用、JSON 提取（代码块/注释清理）、截断 JSON 修复
 * 被 aiParser.js / simpleWorkflow.js / MatchPanel.jsx 复用，避免逻辑重复与漂移
 */

import { getAiConfig } from './aiConfig'

/**
 * 调用 AI Chat Completions 接口，返回文本回复
 * @param {string} prompt - 用户提示词
 * @param {object} [options]
 * @param {number} [options.maxTokens=8192]
 * @param {number} [options.temperature=0.2]
 * @param {object} [options.config] - 自定义配置（默认读取 getAiConfig()）
 * @returns {Promise<{reply: string, finishReason: string}>}
 */
export async function callAi(prompt, { maxTokens = 8192, temperature = 0.2, config } = {}) {
  const cfg = config || getAiConfig()
  if (!cfg.apiKey) throw new Error('请先配置 AI API Key')

  const apiUrl = `${cfg.baseUrl}/v1/chat/completions`

  let response
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (e) {
    if (e.message === 'Failed to fetch') {
      throw new Error('网络请求被阻止。可能是 CORS 跨域限制或网络不通。请检查 Base URL 是否能从浏览器访问', { cause: e })
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
    if (response.status === 429) {
      throw new Error('AI 请求被限流 (429)，请稍后重试')
    }
    throw new Error(`AI 请求失败 (${response.status}): ${errText.slice(0, 300)}`)
  }

  let data
  try { data = await response.json() } catch { throw new Error('AI 返回格式异常，无法解析 JSON 响应') }

  const reply = data?.choices?.[0]?.message?.content || ''
  const finishReason = data?.choices?.[0]?.finish_reason || ''

  if (!reply.trim()) {
    if (finishReason === 'length') {
      throw new Error('AI 返回被截断且内容为空，请减少输入长度')
    }
    throw new Error('AI 返回内容为空')
  }

  if (finishReason === 'length') {
    console.warn('AI 返回因长度限制被截断，将尝试解析部分内容')
  }

  return { reply, finishReason }
}

/**
 * 从 AI 回复文本中提取并解析 JSON
 * 处理：markdown 代码块、JS 注释、截断修复
 * @param {string} reply - AI 回复原文
 * @param {object} [options]
 * @param {'array'|'object'|'auto'} [options.prefer='auto'] - 期望的 JSON 顶层类型
 * @returns {any} 解析后的 JSON 值
 * @throws 解析失败时抛出带上下文的错误
 */
export function extractJson(reply, { prefer = 'auto' } = {}) {
  let jsonStr = reply

  // 1. 提取 markdown 代码块内容
  const codeBlock = reply.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) jsonStr = codeBlock[1]

  // 2. 移除 JS 风格注释（部分模型会在 JSON 里加注释）
  jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '')
  jsonStr = jsonStr.replace(/^\s*\/\/.*$/gm, '')

  // 3. 按期望类型定位 JSON 片段
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/)

  let raw
  if (prefer === 'array') raw = arrayMatch?.[0] || ''
  else if (prefer === 'object') raw = objectMatch?.[0] || ''
  else raw = arrayMatch?.[0] || objectMatch?.[0] || ''

  if (!raw) {
    throw new Error('AI 返回内容中未找到有效 JSON。返回内容: ' + reply.slice(0, 500))
  }

  // 4. 解析；失败则尝试修复截断
  try {
    return JSON.parse(raw)
  } catch (e) {
    const repaired = repairTruncatedJson(raw)
    if (repaired) {
      try {
        return JSON.parse(repaired)
      } catch {
        // fallthrough
      }
    }
    throw new Error('JSON 解析失败: ' + e.message + '\n返回: ' + reply.slice(0, 500), { cause: e })
  }
}

/**
 * 修复被截断的 JSON 字符串
 * @param {string} str
 * @returns {string|null} 修复后的字符串；无需/无法修复时返回 null
 */
export function repairTruncatedJson(str) {
  let s = str.trimEnd()

  // 移除末尾不完整的属性
  s = s.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '')
  s = s.replace(/,\s*"[^"]*"\s*:\s*\{[^}]*$/, '')
  s = s.replace(/,\s*"[^"]*"\s*:\s*\[[^\]]*$/, '')
  s = s.replace(/,\s*"[^"]*"\s*:\s*[^\s,\]}]*$/, '')
  s = s.replace(/,\s*"[^"]*"\s*$/, '')
  s = s.replace(/,\s*"[^"]*$/, '')
  s = s.replace(/,\s*$/, '')

  // 计算需要补齐的括号
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

  if (braceCount > 0 || bracketCount > 0 || inString) {
    if (inString) s += '"'
    for (let i = 0; i < braceCount; i++) s += '}'
    for (let i = 0; i < bracketCount; i++) s += ']'
    return s
  }

  return null
}
