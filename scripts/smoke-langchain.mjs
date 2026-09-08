/**
 * LangChain 链路冒烟测试（临时脚本）
 * 起一个本地 mock 的 OpenAI 兼容服务，验证 callAiJson 完整链：
 * 提示词模板 → ChatOpenAI → StringOutputParser → sanitize → JsonOutputParser
 * 覆盖：脏输出清洗、截断修复、429 错误映射
 */
import http from 'node:http'
import { createServer as createViteServer } from 'vite'

// ---------- mock OpenAI 兼容服务 ----------
// 通过请求里的 model 字段切换不同的模拟场景
const SCENARIOS = {
  // 场景1：真实模型常见的脏输出——前后说明文字 + markdown 围栏 + JS 注释
  dirty: '好的，以下是提取结果：\n```json\n{\n  "apis": [\n    // 第一个接口\n    { "name": "查询用户", "url": "/api/v1/users", "method": "GET" }\n  ]\n}\n```\n以上就是全部接口。',
  // 场景2：因长度限制被截断的 JSON 数组（连闭合 ] 都没有）
  truncated: '[\n  { "name": "创建订单", "url": "/api/v1/orders", "method": "POST" },\n  { "name": "取消订单", "url": "/api/v1/orders/cancel", "meth',
  // 场景3：截断的对象形态（{"apis":[...} 结构，simpleWorkflow 的真实返回形态）
  truncobj: '{\n  "apis": [\n    { "name": "查询库存", "url": "/api/v1/stock", "method": "GET", "inputParams": [{"name": "skuId", "type": "string", "required": true}] },\n    { "name": "库存变更", "url": "/api/v1/stock/change", "inputPa',
  // 场景4：auto 模式下模型只返回单个对象（无数组）
  objonly: '{ "name": "删除用户", "url": "/api/v1/users/delete", "method": "POST" }',
  // 场景5：限流
  ratelimit: null,
}

const mock = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    const parsed = JSON.parse(body)
    const scenario = parsed.model
    if (scenario === 'ratelimit') {
      res.writeHead(429, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'rate limited', type: 'rate_limit_error' } }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      id: 'mock-1', object: 'chat.completion', created: Date.now(), model: scenario,
      choices: [{ index: 0, message: { role: 'assistant', content: SCENARIOS[scenario] }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 50, total_tokens: 60 },
    }))
  })
})

await new Promise((r) => mock.listen(0, '127.0.0.1', r))
const port = mock.address().port
const baseUrl = `http://127.0.0.1:${port}/v1`
console.log(`[mock] OpenAI 兼容服务已启动: ${baseUrl}`)

// ---------- 通过 Vite 加载 aiClient（源码是无扩展名 ESM 导入） ----------
const vite = await createViteServer({ server: { middlewareMode: true }, logLevel: 'error' })
const { callAiJson } = await vite.ssrLoadModule('/src/engines/aiClient.js')

const cfg = (model) => ({ baseUrl, apiKey: 'sk-test-mock', model })
let pass = 0
let fail = 0
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log(`✅ ${name}`) } else { fail++; console.log(`❌ ${name}: ${detail}`) }
}

// 测试1：脏输出（说明文字+围栏+注释）→ 应清洗后成功解析为对象
try {
  const r = await callAiJson('提取接口', { config: cfg('dirty'), prefer: 'object' })
  check('脏输出清洗（说明文字+围栏+注释）', r?.apis?.[0]?.url === '/api/v1/users', JSON.stringify(r))
} catch (e) { check('脏输出清洗（说明文字+围栏+注释）', false, e.message) }

// 测试2：截断 JSON 数组（无闭合]）→ 应修复并返回完整的第一个元素
try {
  const r = await callAiJson('提取接口', { config: cfg('truncated'), prefer: 'array' })
  check('截断 JSON 数组自动修复', Array.isArray(r) && r[0]?.name === '创建订单', JSON.stringify(r))
} catch (e) { check('截断 JSON 数组自动修复', false, e.message) }

// 测试3：截断的 {"apis":[...]} 对象（simpleWorkflow 真实返回形态）→ 应修复出第一个完整接口
try {
  const r = await callAiJson('提取接口', { config: cfg('truncobj'), prefer: 'object' })
  check('截断 {"apis":[...]} 对象自动修复', r?.apis?.[0]?.url === '/api/v1/stock', JSON.stringify(r))
} catch (e) { check('截断 {"apis":[...]} 对象自动修复', false, e.message) }

// 测试4：auto 模式 + 模型只返回单个对象 → 应正常解析（不因缺少数组而报错）
try {
  const r = await callAiJson('提取接口', { config: cfg('objonly') })
  check('auto 模式解析单个对象', r?.url === '/api/v1/users/delete', JSON.stringify(r))
} catch (e) { check('auto 模式解析单个对象', false, e.message) }

// 测试5：429 → 应映射为中文限流错误
try {
  await callAiJson('提取接口', { config: cfg('ratelimit') })
  check('429 错误映射', false, '未抛出错误')
} catch (e) { check('429 错误映射', /限流|429/.test(e.message), e.message) }

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
await vite.close()
mock.close()
process.exit(fail > 0 ? 1 : 0)
