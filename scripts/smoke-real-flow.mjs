/**
 * 真实流程冒烟测试
 * 不直接测 aiClient 封装，而是驱动 UI 实际调用的三条引擎链路：
 *   1. executeSimpleWorkflow —— 3 步智能工作流（DocumentUploader「AI 智能工作流」模式）
 *   2. aiParseDocument —— 单次 AI 解析（DocumentUploader「AI 智能解析」模式）
 *   3. callAiJson(prefer:'array') —— MatchPanel 接口匹配的调用形态（含 429 退避重试模拟）
 * 配置走真实路径：垫一个 localStorage，引擎内部通过 getAiConfig() 读取。
 * mock 服务按提示词内容区分场景，其中 Step2 故意返回截断 JSON，验证真实流程中的自动修复。
 */
import http from 'node:http'
import { createServer as createViteServer } from 'vite'

// ---------- 垫 localStorage（引擎通过 getAiConfig() 读取真实配置路径） ----------
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

// ---------- 模拟文档（4 个接口，凑出 2 个批次） ----------
const DOC = `订单系统对接文档
1. 创建订单 POST /api/v1/orders 入参: skuId(string,必填), count(int,必填) 出参: orderId(string)
2. 查询订单 GET /api/v1/orders/query 入参: orderId(string,必填) 出参: status(string)
3. 取消订单 POST /api/v1/orders/cancel 入参: orderId(string,必填) 出参: success(boolean)
4. 订单列表 GET /api/v1/orders/list 入参: page(int) 出参: items(array)`

// ---------- mock 回复（按提示词内容切换场景） ----------
const step1Reply = `好的，扫描完成：
\`\`\`json
{
  "apis": [
    { "name": "创建订单", "url": "/api/v1/orders", "method": "POST" },
    { "name": "查询订单", "url": "/api/v1/orders/query", "method": "GET" },
    { "name": "取消订单", "url": "/api/v1/orders/cancel", "method": "POST" },
    { "name": "订单列表", "url": "/api/v1/orders/list", "method": "GET" }
  ]
}
\`\`\``

// 第一批详情：干净输出
const detailBatch1 = JSON.stringify({
  apis: [
    { name: '创建订单', url: '/api/v1/orders', method: 'POST', description: '创建新订单',
      inputParams: [
        { name: 'skuId', type: 'string', required: true, description: '商品ID' },
        { name: 'count', type: 'int', required: true, description: '数量' },
      ],
      outputParams: [{ name: 'orderId', type: 'string', description: '订单号' }] },
    { name: '查询订单', url: '/api/v1/orders/query', method: 'GET', description: '查询订单状态',
      inputParams: [{ name: 'orderId', type: 'string', required: true, description: '订单号' }],
      outputParams: [{ name: 'status', type: 'string', description: '状态' }] },
    { name: '取消订单', url: '/api/v1/orders/cancel', method: 'POST', description: '取消订单',
      inputParams: [{ name: 'orderId', type: 'string', required: true, description: '订单号' }],
      outputParams: [{ name: 'success', type: 'boolean', description: '是否成功' }] },
  ],
})

// 第二批详情：故意截断（模拟长度限制），验证真实流程中的自动修复
const detailBatch2Truncated = `{
  "apis": [
    { "name": "订单列表", "url": "/api/v1/orders/list", "method": "GET", "description": "分页查询订单",
      "inputParams": [ { "name": "page", "type": "int", "required": false, "description": "页码" } ],
      "outputParams": [ { "name": "items", "type": "array", "description": "订单列表" } ] },
    { "name": "幽灵接口", "url": "/api/v1/ghost", "inputPa`

// aiParser（单次解析）：返回 JSON 数组 + 注释脏输出
const aiParserReply = `以下是解析结果：
[
  // 用户接口
  { "name": "查询用户", "url": "/api/v1/users", "method": "GET",
    "inputParams": [ { "name": "userId", "type": "string", "required": true, "description": "用户ID", "remark": "" } ],
    "outputParams": [ { "name": "nickname", "type": "string", "required": false, "description": "昵称", "remark": "" } ] }
]`

// MatchPanel 匹配建议：数组
const matchReply = JSON.stringify([
  { theirParam: 'skuId', ourParam: 'sku_id', matched: true, remark: '已匹配' },
  { theirParam: 'count', ourParam: '', matched: false, remark: '无对应' },
])

let matchAttempts = 0 // 前 1 次返回 429，验证 MatchPanel 的退避重试路径

const mock = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    const parsed = JSON.parse(body)
    const userMsg = (parsed.messages || []).map((m) => m.content).join('\n')
    const reply = (content) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        id: 'mock-1', object: 'chat.completion', created: Date.now(), model: parsed.model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 50, total_tokens: 60 },
      }))
    }

    if (userMsg.includes('快速扫描文档')) return reply(step1Reply)
    if (userMsg.includes('提取以下接口的详细参数信息')) {
      // 按提示词中“接口列表：xxx”一行区分批次（不能全文匹配——文档正文里也含接口名）
      const listLine = userMsg.match(/接口列表：(.*)/)?.[1] || ''
      return reply(listLine.includes('订单列表') ? detailBatch2Truncated : detailBatch1)
    }
    if (userMsg.includes('API 文档解析器')) return reply(aiParserReply)
    if (userMsg.includes('参数匹配')) {
      matchAttempts++
      if (matchAttempts === 1) {
        res.writeHead(429, { 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: { message: 'rate limited' } }))
      }
      return reply(matchReply)
    }
    return reply('{}')
  })
})

await new Promise((r) => mock.listen(0, '127.0.0.1', r))
const baseUrl = `http://127.0.0.1:${mock.address().port}/v1`
console.log(`[mock] OpenAI 兼容服务已启动: ${baseUrl}`)

// 写入真实配置路径（localStorage），引擎内部自行读取
localStorage.setItem('aiflow_ai_base_url', baseUrl)
localStorage.setItem('aiflow_ai_api_key', 'sk-test-mock')
localStorage.setItem('aiflow_ai_model', 'mock-model')

// ---------- 通过 Vite 加载真实引擎模块 ----------
const vite = await createViteServer({ server: { middlewareMode: true }, logLevel: 'error' })
const { executeSimpleWorkflow } = await vite.ssrLoadModule('/src/engines/simpleWorkflow.js')
const { aiParseDocument } = await vite.ssrLoadModule('/src/engines/aiParser.js')
const { callAiJson } = await vite.ssrLoadModule('/src/engines/aiClient.js')

let pass = 0
let fail = 0
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log(`✅ ${name}`) } else { fail++; console.log(`❌ ${name}: ${detail}`) }
}

// ===== 流程1：3 步智能工作流（DocumentUploader「AI 智能工作流」模式） =====
try {
  const stepEvents = []
  const result = await executeSimpleWorkflow(DOC, (steps) => stepEvents.push(steps))
  const apis = result.apis
  check('工作流 Step1 识别 4 个接口', result.steps[0]?.result?.apiCount === 4, JSON.stringify(result.steps[0]))
  check('工作流 Step2 截断批次自动修复（提取出订单列表）',
    apis.some((a) => a.url === '/api/v1/orders/list'), JSON.stringify(apis.map((a) => a.url)))
  check('工作流 Step3 过滤不完整接口（幽灵接口被剔除）',
    !apis.some((a) => a.url === '/api/v1/ghost'), JSON.stringify(apis.map((a) => a.url)))
  check('工作流最终产出 4 个完整接口且质量分 100',
    apis.length === 4 && result.summary.qualityScore === 100,
    `count=${apis.length} score=${result.summary.qualityScore}`)
  check('工作流进度回调按步推送（≥6 次状态变化）', stepEvents.length >= 6, `events=${stepEvents.length}`)
} catch (e) { fail++; console.log(`❌ 3 步智能工作流: ${e.message}`) }

// ===== 流程2：单次 AI 解析（DocumentUploader「AI 智能解析」模式） =====
try {
  const apis = await aiParseDocument('用户接口文档：查询用户 GET /api/v1/users')
  check('AI 智能解析（脏输出数组+归一化）',
    apis.length === 1 && apis[0].url === '/api/v1/users' && apis[0].inputParams[0].required === true,
    JSON.stringify(apis))
} catch (e) { check('AI 智能解析（脏输出数组+归一化）', false, e.message) }

// ===== 流程3：MatchPanel 匹配调用形态（prefer:'array' + 429 退避重试） =====
try {
  const prompt = '你是接口参数匹配专家。请对以下参数做参数匹配并返回 JSON 数组…（模拟 MatchPanel 提示词）'
  let suggestions = null
  let lastError = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      suggestions = await callAiJson(prompt, { maxTokens: 16384, temperature: 0.1, prefer: 'array' })
      lastError = null
      break
    } catch (err) {
      lastError = err
      const isRateLimit = /429|限流/.test(err.message)
      if (!isRateLimit || attempt === 2) break
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  check('接口匹配：首次 429 → 退避重试成功',
    !lastError && Array.isArray(suggestions) && suggestions[0]?.theirParam === 'skuId' && matchAttempts === 2,
    lastError?.message || JSON.stringify(suggestions))
} catch (e) { check('接口匹配：首次 429 → 退避重试成功', false, e.message) }

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
mock.close()
process.exit(fail > 0 ? 1 : 0)
