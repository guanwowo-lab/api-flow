/**
 * AI 配置读写（localStorage）
 * 独立成模块，避免 aiClient 与 aiParser 之间的循环依赖
 */

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
