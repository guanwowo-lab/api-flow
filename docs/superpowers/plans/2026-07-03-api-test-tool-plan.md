# API Test Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Web API testing tool for QA teams within the existing API-flow project, supporting form-based testing, batch scenario testing, and history management.

**Architecture:** React SPA frontend + Express proxy backend. The Express layer handles MD5/SM3 signing and forwards requests to the 云中鹤 platform API, solving CORS and keeping credentials server-side. API interface definitions are stored as static JSON configs that drive dynamic form generation.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4, Express.js, crypto-js (MD5), sm-crypto (SM3), react-router-dom v6

## Global Constraints

- Credentials (appKey/appSecret) are session-only, never persisted to disk or localStorage
- Scope: core APIs only — auth, product (8), order (7) — ~16 interfaces total
- All interface definitions driven by JSON config files under `src/config/api-defs/`
- History stored as daily JSON files in `server/history/`
- Environment toggle between test (openapi2-show.haoxiny.com) and production (openapi2.haoxiny.com)

---

### Task 1: Install new dependencies and scaffold server directory

**Files:**
- Modify: `package.json`
- Create: `server/index.js`

**Interfaces:**
- Produces: Express server on port 3001, with `/api/proxy`, `/api/history`, `/api/scenarios` routes

- [ ] **Step 1: Install backend dependencies**

```bash
cd "d:\VS code\MyCodes\API-flow" && npm install express cors crypto-js sm-crypto concurrently --save
```

- [ ] **Step 2: Add server scripts to package.json**

Read package.json, then replace the `scripts` block:

```json
"scripts": {
  "dev": "vite",
  "dev:server": "node server/index.js",
  "dev:all": "concurrently \"npm run dev\" \"npm run dev:server\"",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

- [ ] **Step 3: Create minimal Express server entry**

```js
import express from 'express'
import cors from 'cors'
import { createProxyRouter } from './proxy.js'
import { createHistoryRouter } from './history-store.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use('/api', createProxyRouter())
app.use('/api', createHistoryRouter())

const PORT = process.env.SERVER_PORT || 3001
app.listen(PORT, () => {
  console.log(`[api-test] Proxy server running on http://localhost:${PORT}`)
})
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json server/index.js
git commit -m "feat: add Express server scaffold with dependencies"
```

---

### Task 2: Build sign engine

**Files:**
- Create: `server/sign-engine.js`

**Interfaces:**
- Produces: `sign(params, appKey, appSecret, grantType)` → signature string
- Produces: `md5Encrypt(secret)` → MD5 32-char lowercase hex
- Produces: `sm3Encrypt(secret, appKey)` → SM3 hex string

- [ ] **Step 1: Write sign engine module**

```js
import CryptoJS from 'crypto-js'
import { sm3 } from 'sm-crypto'

/**
 * MD5 32-bit lowercase
 */
export function md5Encrypt(str) {
  return CryptoJS.MD5(str).toString().toLowerCase()
}

/**
 * SM3 hash using sm-crypto library
 * Returns 64-char hex string
 */
export function sm3Encrypt(str) {
  return sm3(str)
}

/**
 * Generate API signature per 云中鹤 spec section 2.6
 *
 * Rules:
 * 1. Encrypt appSecret with MD5 or SM3 first → encryptedSecret
 * 2. Concatenate: appKey + plainAppSecret + timestamp + plainAppSecret
 * 3. Encrypt the concatenated string with MD5 or SM3 → final sign
 *
 * @param {string} appKey
 * @param {string} appSecret - plain text appSecret
 * @param {string} timestamp - format yyyy-MM-dd HH:mm:ss
 * @param {'MD5'|'SM3'} grantType
 * @returns {string} sign string
 */
export function sign(appKey, appSecret, timestamp, grantType = 'MD5') {
  const encrypt = grantType === 'SM3' ? sm3Encrypt : md5Encrypt

  // Step 1: encrypt the appSecret first for transmission
  const encryptedSecret = encrypt(appSecret)

  // Step 2: concatenate for sign: appKey + plainSecret + timestamp + plainSecret
  const signStr = appKey + appSecret + timestamp + appSecret

  // Step 3: encrypt the sign string
  const signValue = encrypt(signStr)

  return {
    encryptedSecret,
    sign: signValue,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/sign-engine.js
git commit -m "feat: add MD5/SM3 sign engine"
```

---

### Task 3: Build history store

**Files:**
- Create: `server/history-store.js`

**Interfaces:**
- Produces: `createHistoryRouter()` → Express Router with GET/DELETE `/api/history`, GET `/api/history/export`

- [ ] **Step 1: Write history store module**

```js
import { Router } from 'express'
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HISTORY_DIR = join(__dirname, '..', 'server', 'history')

function todayFile() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`
}

async function readHistory(file) {
  try {
    const data = await readFile(join(HISTORY_DIR, file), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeHistory(file, records) {
  // ensure dir exists
  try { await readdir(HISTORY_DIR) } catch { await mkdir(HISTORY_DIR, { recursive: true }) }
  await writeFile(join(HISTORY_DIR, file), JSON.stringify(records, null, 2), 'utf-8')
}

export function createHistoryRouter() {
  const router = Router()

  // Save a test result
  router.post('/history', async (req, res) => {
    const record = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...req.body, time: Date.now() }
    const file = todayFile()
    const records = await readHistory(file)
    records.push(record)
    await writeHistory(file, records)
    res.json({ success: true, id: record.id })
  })

  // Query history with filters
  router.get('/history', async (req, res) => {
    const { startDate, endDate, apiId, pass } = req.query
    const files = (await readdir(HISTORY_DIR).catch(() => [])).filter(f => f.endsWith('.json'))
    let all = []
    for (const file of files) {
      if (startDate && file < startDate) continue
      if (endDate && file > endDate) continue
      all = all.concat(await readHistory(file))
    }
    // Reverse chrono
    all.sort((a, b) => b.time - a.time)
    if (apiId) all = all.filter(r => r.apiId === apiId)
    if (pass !== undefined) all = all.filter(r => (pass === 'true') === r.pass)
    res.json(all)
  })

  // Delete a record
  router.delete('/history/:id', async (req, res) => {
    const { id } = req.params
    const files = (await readdir(HISTORY_DIR).catch(() => [])).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const records = await readHistory(file)
      const idx = records.findIndex(r => r.id === id)
      if (idx !== -1) {
        records.splice(idx, 1)
        await writeHistory(file, records)
        return res.json({ success: true })
      }
    }
    res.status(404).json({ success: false, desc: 'Record not found' })
  })

  // Export history as JSON download
  router.get('/history/export', async (req, res) => {
    const { startDate, endDate } = req.query
    const files = (await readdir(HISTORY_DIR).catch(() => [])).filter(f => f.endsWith('.json'))
    let all = []
    for (const file of files) {
      if (startDate && file < startDate) continue
      if (endDate && file > endDate) continue
      all = all.concat(await readHistory(file))
    }
    all.sort((a, b) => b.time - a.time)
    res.setHeader('Content-Disposition', 'attachment; filename="api-test-history.json"')
    res.json(all)
  })

  return router
}
```

- [ ] **Step 2: Commit**

```bash
git add server/history-store.js
git commit -m "feat: add history store with CRUD + export"
```

---

### Task 4: Build API proxy endpoint

**Files:**
- Create: `server/proxy.js`

**Interfaces:**
- Produces: `createProxyRouter()` → Express Router with POST `/api/proxy`
- Consumes: `sign` from `sign-engine.js`

- [ ] **Step 1: Write proxy module**

```js
import { Router } from 'express'
import { sign } from './sign-engine.js'

// Environment base URLs
const ENV_URLS = {
  test: 'https://openapi2-show.haoxiny.com',
  prod: 'https://openapi2.haoxiny.com',
}

function formatTimestamp(d = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function createProxyRouter() {
  const router = Router()

  router.post('/proxy', async (req, res) => {
    const { targetPath, params, env, appKey, appSecret, grantType, signRequired } = req.body

    if (!targetPath || !params) {
      return res.status(400).json({ success: false, desc: 'Missing targetPath or params' })
    }

    const baseUrl = ENV_URLS[env] || ENV_URLS.test
    const url = baseUrl + targetPath

    const body = { ...params }

    if (signRequired && appKey && appSecret) {
      const timestamp = formatTimestamp()
      const { encryptedSecret, sign: signValue } = sign(appKey, appSecret, timestamp, grantType || 'MD5')
      body.appKey = appKey
      body.appSecret = encryptedSecret
      body.sign = signValue
      body.timestamp = timestamp
      if (grantType) body.grantType = grantType
    }

    try {
      const start = Date.now()
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      const duration = Date.now() - start

      res.json({
        httpStatus: response.status,
        duration,
        data,
      })
    } catch (err) {
      res.status(502).json({
        success: false,
        desc: `Proxy error: ${err.message}`,
        httpStatus: 502,
        duration: 0,
        data: null,
      })
    }
  })

  return router
}
```

- [ ] **Step 2: Commit**

```bash
git add server/proxy.js
git commit -m "feat: add API proxy endpoint with auto-signing"
```

---

### Task 5: Create API definition configs

**Files:**
- Create: `src/config/api-registry.json`
- Create: `src/config/api-defs/auth.json`
- Create: `src/config/api-defs/product.json`
- Create: `src/config/api-defs/order.json`

**Interfaces:**
- Produces: Structured JSON configs consumed by InterfaceTree and ParamForm components

- [ ] **Step 1: Create auth.json**

```json
[
  {
    "id": "queryAccessToken",
    "name": "获取AccessToken",
    "category": "认证服务",
    "method": "POST",
    "path": "/open/api/access/queryAccessToken",
    "signRequired": true,
    "params": [
      { "name": "appKey", "label": "接口访问秘钥Key", "required": true, "type": "string" },
      { "name": "appSecret", "label": "接口访问秘钥密码", "required": true, "type": "string", "sensitive": true },
      { "name": "timestamp", "label": "请求时间戳", "required": true, "type": "string", "autoFill": "timestamp" },
      { "name": "grantType", "label": "授权加密类型", "required": false, "type": "enum", "options": ["MD5", "SM3"], "default": "MD5" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code", "tokenField": "result.accessToken" }
  }
]
```

- [ ] **Step 2: Create product.json**

```json
[
  {
    "id": "queryGoodsList",
    "name": "获取商品信息列表",
    "category": "商品服务",
    "method": "POST",
    "path": "/open/api/goods/queryGoodsList",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "pageNum", "label": "页码", "required": false, "type": "number", "default": 1 },
      { "name": "pageSize", "label": "每页数量", "required": false, "type": "number", "default": 20 },
      { "name": "categoryCode", "label": "分类编码", "required": false, "type": "string" },
      { "name": "brandCode", "label": "品牌编码", "required": false, "type": "string" },
      { "name": "goodsName", "label": "商品名称", "required": false, "type": "string" },
      { "name": "stockStatus", "label": "库存状态", "required": false, "type": "enum", "options": ["", "1001", "1002"], "optionLabels": ["全部", "有库存", "无库存"] },
      { "name": "addressCode", "label": "可销售区域编码", "required": false, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "searchGoodsList",
    "name": "检索商品信息列表",
    "category": "商品服务",
    "method": "POST",
    "path": "/open/api/goods/searchGoodsList",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "pageNum", "label": "页码", "required": false, "type": "number", "default": 1 },
      { "name": "pageSize", "label": "每页数量", "required": false, "type": "number", "default": 20 },
      { "name": "keyword", "label": "搜索关键词", "required": false, "type": "string" },
      { "name": "categoryCode", "label": "分类编码", "required": false, "type": "string" },
      { "name": "brandCode", "label": "品牌编码", "required": false, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "queryGoodsDetail",
    "name": "获取商品详情信息",
    "category": "商品服务",
    "method": "POST",
    "path": "/open/api/goods/queryGoodsDetail",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "skuCode", "label": "SKU编码", "required": true, "type": "string" },
      { "name": "goodsCode", "label": "商品编码", "required": false, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "queryGoodsImages",
    "name": "获取商品图片列表",
    "category": "商品服务",
    "method": "POST",
    "path": "/open/api/goods/queryGoodsImages",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "skuCode", "label": "SKU编码（多个用逗号分隔）", "required": true, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "queryGoodsPriceList",
    "name": "获取商品价格列表",
    "category": "商品服务",
    "method": "POST",
    "path": "/open/api/goods/queryGoodsPriceList",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "skuCodes", "label": "SKU编码（多个用逗号分隔）", "required": true, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "queryGoodsStockList",
    "name": "获取商品库存列表",
    "category": "商品服务",
    "method": "POST",
    "path": "/open/api/goods/queryGoodsStockList",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "skuCodes", "label": "SKU编码（多个用逗号分隔）", "required": true, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "queryGoodsOnOffSale",
    "name": "获取商品上下架列表",
    "category": "商品服务",
    "method": "POST",
    "path": "/open/api/goods/queryGoodsOnOffSaleList",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "pageNum", "label": "页码", "required": false, "type": "number", "default": 1 },
      { "name": "pageSize", "label": "每页数量", "required": false, "type": "number", "default": 20 }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "queryGoodsSaleAreas",
    "name": "获取商品销售区域列表",
    "category": "商品服务",
    "method": "POST",
    "path": "/open/api/goods/queryGoodsSaleAreas",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "skuCodes", "label": "SKU编码（多个用逗号分隔）", "required": true, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  }
]
```

- [ ] **Step 3: Create order.json**

```json
[
  {
    "id": "submitOrder",
    "name": "提交订单",
    "category": "订单服务",
    "method": "POST",
    "path": "/open/api/order/submitOrder",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "submitState", "label": "提交状态", "required": true, "type": "enum", "options": ["1001", "1002"], "optionLabels": ["1001-预占库存(草稿)", "1002-直接生成正式订单"], "default": "1001" },
      { "name": "orderCode", "label": "订单号", "required": true, "type": "string" },
      { "name": "skuCode", "label": "SKU编码", "required": true, "type": "string" },
      { "name": "quantity", "label": "数量", "required": true, "type": "number", "default": 1 },
      { "name": "receiverName", "label": "收货人姓名", "required": true, "type": "string" },
      { "name": "receiverMobile", "label": "收货人手机号", "required": true, "type": "string" },
      { "name": "receiverAddress", "label": "收货详细地址", "required": true, "type": "string" },
      { "name": "provinceCode", "label": "省编码", "required": true, "type": "string" },
      { "name": "cityCode", "label": "市编码", "required": true, "type": "string" },
      { "name": "areaCode", "label": "区编码", "required": true, "type": "string" },
      { "name": "streetCode", "label": "街道编码", "required": false, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "confirmOrder",
    "name": "预占确认订单",
    "category": "订单服务",
    "method": "POST",
    "path": "/open/api/order/confirmOrder",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "orderCode", "label": "订单号", "required": true, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "cancelOrder",
    "name": "取消订单",
    "category": "订单服务",
    "method": "POST",
    "path": "/open/api/order/cancelOrder",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "orderCode", "label": "订单号", "required": true, "type": "string" },
      { "name": "cancelReason", "label": "取消原因", "required": false, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "queryOrderList",
    "name": "获取订单列表",
    "category": "订单服务",
    "method": "POST",
    "path": "/open/api/order/queryOrderList",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "pageNum", "label": "页码", "required": false, "type": "number", "default": 1 },
      { "name": "pageSize", "label": "每页数量", "required": false, "type": "number", "default": 20 },
      { "name": "orderStatus", "label": "订单状态", "required": false, "type": "string" },
      { "name": "startTime", "label": "开始时间", "required": false, "type": "string" },
      { "name": "endTime", "label": "结束时间", "required": false, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "queryOrderDetail",
    "name": "获取订单详情",
    "category": "订单服务",
    "method": "POST",
    "path": "/open/api/order/queryOrderDetail",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "orderCode", "label": "订单号", "required": true, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "queryOrderLogistics",
    "name": "获取订单物流",
    "category": "订单服务",
    "method": "POST",
    "path": "/open/api/order/queryOrderLogistics",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "orderCode", "label": "订单号", "required": true, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  },
  {
    "id": "queryOrderInvoice",
    "name": "获取订单发票",
    "category": "订单服务",
    "method": "POST",
    "path": "/open/api/order/queryOrderInvoice",
    "signRequired": false,
    "params": [
      { "name": "accessToken", "label": "接口授权访问令牌", "required": true, "type": "string", "autoFill": "accessToken" },
      { "name": "orderCode", "label": "订单号", "required": true, "type": "string" }
    ],
    "responseMapping": { "successField": "success", "codeField": "code" }
  }
]
```

- [ ] **Step 4: Create api-registry.json (index of all interface definitions)**

```json
{
  "modules": [
    { "key": "auth", "label": "认证服务", "file": "auth.json" },
    { "key": "product", "label": "商品服务", "file": "product.json" },
    { "key": "order", "label": "订单服务", "file": "order.json" }
  ]
}
```

- [ ] **Step 5: Commit**

```bash
git add src/config/
git commit -m "feat: add API definition configs for auth, product, order modules"
```

---

### Task 6: Build CredentialBar component

**Files:**
- Create: `src/components/CredentialBar/CredentialBar.jsx`

**Interfaces:**
- Produces: `<CredentialBar credentials={} onChange={} env={} onEnvChange={} />`
- Props: `credentials` = `{appKey, appSecret, accessToken}`, `onChange` callback, `env` string, `onEnvChange` callback

- [ ] **Step 1: Write CredentialBar component**

```jsx
export default function CredentialBar({ credentials, onChange, env, onEnvChange }) {
  const { appKey, appSecret, accessToken } = credentials

  const update = (key, value) => onChange({ ...credentials, [key]: value })

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 text-white text-sm">
      <span className="font-semibold whitespace-nowrap">API Test Tool</span>

      <label className="flex items-center gap-1 ml-4">
        appKey:
        <input
          type="text"
          value={appKey || ''}
          onChange={e => update('appKey', e.target.value)}
          className="w-28 px-2 py-0.5 text-gray-900 rounded text-xs"
          placeholder="appKey"
        />
      </label>

      <label className="flex items-center gap-1">
        appSecret:
        <input
          type="password"
          value={appSecret || ''}
          onChange={e => update('appSecret', e.target.value)}
          className="w-36 px-2 py-0.5 text-gray-900 rounded text-xs"
          placeholder="appSecret"
        />
      </label>

      <label className="flex items-center gap-1 ml-2">
        环境:
        <select
          value={env}
          onChange={e => onEnvChange(e.target.value)}
          className="px-2 py-0.5 text-gray-900 rounded text-xs"
        >
          <option value="test">测试环境</option>
          <option value="prod">生产环境</option>
        </select>
      </label>

      {accessToken && (
        <span className="ml-auto text-xs text-green-400">
          Token: {accessToken.slice(0, 20)}...
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CredentialBar/CredentialBar.jsx
git commit -m "feat: add CredentialBar component"
```

---

### Task 7: Build InterfaceTree component

**Files:**
- Create: `src/components/InterfaceTree/InterfaceTree.jsx`

**Interfaces:**
- Produces: `<InterfaceTree apis={[]} selectedId={} onSelect={} />`
- `apis` is flattened array with `{id, name, category}`, `selectedId` is currently selected, `onSelect(id)` callback

- [ ] **Step 1: Write InterfaceTree component**

```jsx
import { useState } from 'react'

export default function InterfaceTree({ apis, selectedId, onSelect, onToggle }) {
  const grouped = {}
  for (const api of apis) {
    if (!grouped[api.category]) grouped[api.category] = []
    grouped[api.category].push(api)
  }

  const [search, setSearch] = useState('')

  const filtered = search
    ? apis.filter(a => a.name.includes(search) || a.id.includes(search))
    : null

  return (
    <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200">
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          placeholder="搜索接口..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-400"
        />
      </div>

      {filtered ? (
        <div className="flex-1 overflow-auto p-2">
          {filtered.map(api => (
            <div
              key={api.id}
              onClick={() => onSelect(api.id)}
              className={`px-3 py-2 text-sm cursor-pointer rounded mb-0.5 hover:bg-blue-50 ${
                selectedId === api.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              {api.name}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {Object.entries(grouped).map(([category, items]) => (
            <CategoryGroup
              key={category}
              category={category}
              items={items}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryGroup({ category, items, selectedId, onSelect }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
      >
        <span className="text-xs">{open ? '▼' : '▶'}</span>
        {category} ({items.length})
      </div>
      {open && (
        <div className="pb-1">
          {items.map(api => (
            <div
              key={api.id}
              onClick={() => onSelect(api.id)}
              className={`pl-8 pr-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${
                selectedId === api.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              {api.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/InterfaceTree/InterfaceTree.jsx
git commit -m "feat: add InterfaceTree component with search and category grouping"
```

---

### Task 8: Build ParamForm component

**Files:**
- Create: `src/components/ParamForm/ParamForm.jsx`

**Interfaces:**
- Produces: `<ParamForm params={[]} values={{}} onChange={} onSubmit={} loading={} />`
- `params` is array from API definition, `values` is `{[paramName]: value}`, `onChange(name, value)` callback

- [ ] **Step 1: Write ParamForm component**

```jsx
import { useEffect } from 'react'

export default function ParamForm({ params, values, onChange, onSubmit, loading }) {
  // Auto-fill fields on first render or when params change
  useEffect(() => {
    if (!params) return
    for (const p of params) {
      if (p.autoFill && !values[p.name]) {
        onChange(p.name, p.default || '')
      }
    }
  }, [params?.map(p => p.id || p.name).join(',')])

  const missingRequired = params?.filter(p => p.required && !values[p.name] && !p.autoFill)

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit() }}
      className="space-y-3"
    >
      {params?.map(param => (
        <div key={param.name}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {param.label}
            {param.required && <span className="text-red-500 ml-0.5">*</span>}
            {param.autoFill === 'accessToken' && (
              <span className="text-xs text-gray-400 ml-2">(从顶部凭据自动填入)</span>
            )}
            {param.autoFill === 'timestamp' && (
              <span className="text-xs text-gray-400 ml-2">(自动生成)</span>
            )}
          </label>

          {param.type === 'enum' ? (
            <select
              value={values[param.name] || param.default || ''}
              onChange={e => onChange(param.name, e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-400"
            >
              {param.options?.map((opt, i) => (
                <option key={opt} value={opt}>
                  {param.optionLabels?.[i] || opt}
                </option>
              ))}
            </select>
          ) : param.type === 'number' ? (
            <input
              type="number"
              value={values[param.name] ?? param.default ?? ''}
              onChange={e => onChange(param.name, e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-400"
            />
          ) : (
            <input
              type={param.sensitive ? 'password' : 'text'}
              value={values[param.name] || ''}
              onChange={e => onChange(param.name, e.target.value)}
              placeholder={param.autoFill ? '自动填充...' : `输入${param.label}`}
              readOnly={!!param.autoFill}
              className={`w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-400 ${
                param.autoFill ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
              }`}
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={loading || (missingRequired && missingRequired.length > 0)}
        className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '发送中...' : '发送请求'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ParamForm/ParamForm.jsx
git commit -m "feat: add dynamic ParamForm component with auto-fill support"
```

---

### Task 9: Build ResponseViewer component

**Files:**
- Create: `src/components/ResponseViewer/ResponseViewer.jsx`

**Interfaces:**
- Produces: `<ResponseViewer response={} />`
- `response` = `{ httpStatus, duration, data: { success, code, desc, result } }` or null

- [ ] **Step 1: Write ResponseViewer component**

```jsx
export default function ResponseViewer({ response }) {
  if (!response) {
    return (
      <div className="text-sm text-gray-400 py-8 text-center">
        发送请求后，响应结果将显示在此处
      </div>
    )
  }

  const { httpStatus, duration, data } = response
  const isHttpOk = httpStatus >= 200 && httpStatus < 300
  const isSuccess = data?.success === true
  const codeOk = data?.code === '00000'

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center gap-3 text-sm">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          isHttpOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          HTTP {httpStatus}
        </span>

        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {isSuccess ? '✅ 成功' : '❌ 失败'}
        </span>

        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          codeOk ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>
          code: {data?.code || 'N/A'}
        </span>

        {data?.desc && (
          <span className="text-gray-500 text-xs">{data.desc}</span>
        )}

        <span className="ml-auto text-xs text-gray-400">{duration}ms</span>
      </div>

      {/* Error display */}
      {!isSuccess && data?.desc && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {data.desc}
        </div>
      )}

      {/* JSON display */}
      <div className="relative">
        <pre className="p-3 bg-gray-900 text-gray-100 text-xs rounded overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
        <button
          onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}
          className="absolute top-2 right-2 px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600"
        >
          复制
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ResponseViewer/ResponseViewer.jsx
git commit -m "feat: add ResponseViewer component with validation and copy"
```

---

### Task 10: Build ApiTest page

**Files:**
- Create: `src/pages/ApiTest/ApiTest.jsx`

**Interfaces:**
- Produces: `<ApiTest credentials={} env={} onTokenUpdate={} />` — main test page combining ParamForm + ResponseViewer
- Consumes: `api-registry.json` and all `api-defs/*.json` for interface definitions

- [ ] **Step 1: Write ApiTest page**

```jsx
import { useState, useMemo, useCallback, useEffect } from 'react'
import ParamForm from '../../components/ParamForm/ParamForm'
import ResponseViewer from '../../components/ResponseViewer/ResponseViewer'

const LOCAL_PROXY = 'http://localhost:3001/api/proxy'

export default function ApiTest({ api, credentials, env, onTokenUpdate }) {
  const [values, setValues] = useState({})
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)

  // Reset values when switching interfaces
  useEffect(() => {
    setValues({})
    setResponse(null)
  }, [api?.id])

  const handleParamChange = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!api) return
    setLoading(true)
    setResponse(null)

    // Build params, resolving auto-fill fields
    const params = { ...values }
    if (api.signRequired) {
      params.appKey = params.appKey || credentials.appKey
      params.appSecret = params.appSecret || credentials.appSecret
    } else {
      params.accessToken = params.accessToken || credentials.accessToken
    }

    try {
      const res = await fetch(LOCAL_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPath: api.path,
          params,
          env,
          appKey: credentials.appKey,
          appSecret: credentials.appSecret,
          grantType: params.grantType || 'MD5',
          signRequired: api.signRequired,
        }),
      })
      const result = await res.json()
      setResponse(result)

      // Auto-save to history
      fetch('http://localhost:3001/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiId: api.id,
          apiName: api.name,
          requestParams: params,
          response: result,
          pass: result.data?.success === true && result.data?.code === '00000',
        }),
      }).catch(() => {})

      // Extract token from auth response
      if (api.id === 'queryAccessToken' && result.data?.result?.accessToken) {
        onTokenUpdate(result.data.result.accessToken)
      }
    } catch (err) {
      setResponse({ httpStatus: 0, duration: 0, data: { success: false, code: 'ERROR', desc: err.message } })
    } finally {
      setLoading(false)
    }
  }, [api, values, credentials, env, onTokenUpdate])

  if (!api) {
    return <div className="flex items-center justify-center h-full text-gray-400">请从左侧选择一个接口</div>
  }

  return (
    <div className="grid grid-cols-2 gap-6 p-6 h-full">
      <div className="overflow-auto">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">{api.name}</h2>
        <p className="text-xs text-gray-500 mb-4">
          POST {api.path}
        </p>
        <ParamForm
          params={api.params}
          values={values}
          onChange={handleParamChange}
          onSubmit={handleSubmit}
          loading={loading}
        />
      </div>
      <div className="overflow-auto border-l border-gray-200 pl-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">响应结果</h3>
        <ResponseViewer response={response} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ApiTest/ApiTest.jsx
git commit -m "feat: add ApiTest page with proxy integration and auto-save history"
```

---

### Task 11: Build BatchTest page

**Files:**
- Create: `src/pages/BatchTest/BatchTest.jsx`

**Interfaces:**
- Produces: `<BatchTest apis={[]} credentials={} env={} onTokenUpdate={} />`

- [ ] **Step 1: Write BatchTest page**

```jsx
import { useState, useCallback } from 'react'
import ResponseViewer from '../../components/ResponseViewer/ResponseViewer'

const LOCAL_PROXY = 'http://localhost:3001/api/proxy'

const PRESET_SCENARIOS = [
  {
    name: '获取Token → 查商品',
    steps: [
      { apiId: 'queryAccessToken', outputVar: 'token', outputPath: 'result.accessToken' },
      { apiId: 'queryGoodsList', inputVars: { accessToken: '{{token}}' } },
    ],
  },
  {
    name: '完整下单流程',
    steps: [
      { apiId: 'queryAccessToken', outputVar: 'token', outputPath: 'result.accessToken' },
      { apiId: 'queryGoodsDetail', inputVars: { accessToken: '{{token}}' } },
      { apiId: 'submitOrder', inputVars: { accessToken: '{{token}}' } },
    ],
  },
]

function findApi(apis, id) { return apis.find(a => a.id === id) }

function resolveVars(obj, vars) {
  if (!obj) return obj
  const resolved = {}
  for (const [k, v] of Object.entries(obj)) {
    resolved[k] = typeof v === 'string' ? v.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] || '') : v
  }
  return resolved
}

function extractValue(data, path) {
  return path.split('.').reduce((obj, key) => obj?.[key], data) || ''
}

export default function BatchTest({ apis, credentials, env, onTokenUpdate }) {
  const [scenario, setScenario] = useState(PRESET_SCENARIOS[0])
  const [results, setResults] = useState([])
  const [running, setRunning] = useState(false)

  const runScenario = useCallback(async () => {
    setRunning(true)
    setResults([])
    const vars = {}
    const stepResults = []

    for (const step of scenario.steps) {
      const api = findApi(apis, step.apiId)
      if (!api) {
        stepResults.push({ step: step.apiId, error: 'API not found' })
        continue
      }

      const params = { ...resolveVars(step.inputVars || {}, vars) }

      try {
        const res = await fetch(LOCAL_PROXY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetPath: api.path,
            params,
            env,
            appKey: credentials.appKey,
            appSecret: credentials.appSecret,
            signRequired: api.signRequired,
          }),
        })
        const result = await res.json()
        stepResults.push({ step: api.name, success: result.data?.success, result, duration: result.duration })

        if (step.outputVar && result.data?.success) {
          vars[step.outputVar] = extractValue(result.data, step.outputPath)
        }
        if (api.id === 'queryAccessToken' && result.data?.result?.accessToken) {
          vars.token = result.data.result.accessToken
          onTokenUpdate(result.data.result.accessToken)
        }

        // Save to history
        fetch('http://localhost:3001/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiId: api.id,
            apiName: api.name,
            requestParams: params,
            response: result,
            pass: result.data?.success === true && result.data?.code === '00000',
          }),
        }).catch(() => {})
      } catch (err) {
        stepResults.push({ step: api.name, success: false, result: { data: { desc: err.message } } })
      }
    }

    setResults(stepResults)
    setRunning(false)
  }, [scenario, apis, credentials, env, onTokenUpdate])

  const passCount = results.filter(r => r.success).length

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <select
          value={scenario.name}
          onChange={e => {
            const s = PRESET_SCENARIOS.find(s => s.name === e.target.value)
            if (s) setScenario(s)
          }}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
        >
          {PRESET_SCENARIOS.map(s => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
        <button
          onClick={runScenario}
          disabled={running}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {running ? '执行中...' : '运行场景'}
        </button>
      </div>

      <div className="flex-1 overflow-auto space-y-3">
        {scenario.steps.map((step, i) => {
          const result = results[i]
          return (
            <div key={i} className="border border-gray-200 rounded">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-sm">
                <span className="text-gray-400 font-mono">Step {i + 1}</span>
                <span className="font-medium">{findApi(apis, step.apiId)?.name || step.apiId}</span>
                {result && (
                  <>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded ${result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {result.success ? '通过' : '失败'}
                    </span>
                    <span className="text-xs text-gray-400">{result.duration}ms</span>
                  </>
                )}
                {!result && <span className="ml-auto text-xs text-gray-400">等待执行</span>}
              </div>
              {result && (
                <div className="p-3">
                  <ResponseViewer response={result.result} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {results.length > 0 && (
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200 text-sm">
          <span className="font-medium">结果统计:</span>
          <span className="text-green-600">通过 {passCount}/{results.length}</span>
          <span className="text-gray-400">|</span>
          <span>总耗时 {results.reduce((sum, r) => sum + (r.duration || 0), 0)}ms</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/BatchTest/BatchTest.jsx
git commit -m "feat: add BatchTest page with preset scenarios and variable chaining"
```

---

### Task 12: Build History page

**Files:**
- Create: `src/pages/History/History.jsx`

**Interfaces:**
- Produces: `<History apis={[]} />`

- [ ] **Step 1: Write History page**

```jsx
import { useState, useEffect, useCallback } from 'react'

export default function History({ apis }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ apiId: '', pass: '' })
  const [expanded, setExpanded] = useState(null)
  const [selected, setSelected] = useState(new Set())

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.apiId) params.set('apiId', filters.apiId)
      if (filters.pass) params.set('pass', filters.pass)
      const res = await fetch(`http://localhost:3001/api/history?${params}`)
      const data = await res.json()
      setRecords(data)
    } catch { setRecords([]) }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { loadHistory() }, [loadHistory])

  const handleDelete = async (id) => {
    await fetch(`http://localhost:3001/api/history/${id}`, { method: 'DELETE' })
    loadHistory()
  }

  const handleExport = async () => {
    const ids = selected.size > 0 ? [...selected] : records.map(r => r.id)
    const all = records.filter(r => ids.includes(r.id))
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `api-test-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReplay = (record) => {
    // Store replay data in sessionStorage for the test page to pick up
    sessionStorage.setItem('apitester_replay', JSON.stringify({
      apiId: record.apiId,
      params: record.requestParams,
    }))
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'apiTest' } }))
  }

  const toggleSelect = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const formatTime = (ts) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filters.apiId}
          onChange={e => setFilters(f => ({ ...f, apiId: e.target.value }))}
          className="px-2 py-1 text-sm border border-gray-300 rounded"
        >
          <option value="">全部接口</option>
          {apis.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <select
          value={filters.pass}
          onChange={e => setFilters(f => ({ ...f, pass: e.target.value }))}
          className="px-2 py-1 text-sm border border-gray-300 rounded"
        >
          <option value="">全部结果</option>
          <option value="true">通过</option>
          <option value="false">失败</option>
        </select>

        <button onClick={loadHistory} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">刷新</button>

        <div className="ml-auto flex gap-2">
          <button onClick={handleExport} className="px-3 py-1 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">
            导出 {selected.size > 0 ? `选中(${selected.size})` : '全部'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center text-gray-400 py-8">加载中...</div>
        ) : records.length === 0 ? (
          <div className="text-center text-gray-400 py-8">暂无测试记录</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="p-2 w-8"><input type="checkbox" onChange={e => {
                  if (e.target.checked) setSelected(new Set(records.map(r => r.id)))
                  else setSelected(new Set())
                }} /></th>
                <th className="p-2 w-10">结果</th>
                <th className="p-2">接口</th>
                <th className="p-2 w-20">耗时</th>
                <th className="p-2 w-40">时间</th>
                <th className="p-2 w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <>
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-2">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                    </td>
                    <td className="p-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${r.pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {r.pass ? '✅' : '❌'}
                      </span>
                    </td>
                    <td className="p-2 font-medium text-gray-700">{r.apiName || r.apiId}</td>
                    <td className="p-2 text-gray-500">{r.response?.duration || '-'}ms</td>
                    <td className="p-2 text-gray-500 text-xs">{formatTime(r.time)}</td>
                    <td className="p-2">
                      <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-blue-600 hover:underline mr-2">查看</button>
                      <button onClick={() => handleReplay(r)} className="text-blue-600 hover:underline mr-2">重放</button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:underline">删除</button>
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr key={`${r.id}-detail`}>
                      <td colSpan={6} className="p-4 bg-gray-50">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <h4 className="font-semibold text-gray-600 mb-1">请求参数</h4>
                            <pre className="bg-gray-900 text-gray-100 p-2 rounded overflow-auto max-h-64">
                              {JSON.stringify(r.requestParams, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-600 mb-1">响应数据</h4>
                            <pre className="bg-gray-900 text-gray-100 p-2 rounded overflow-auto max-h-64">
                              {JSON.stringify(r.response?.data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/History/History.jsx
git commit -m "feat: add History page with filters, detail view, replay, and export"
```

---

### Task 13: Build Layout shell and wire up App.jsx

**Files:**
- Modify: `src/App.jsx`
- Create: `src/components/Layout/Layout.jsx`

**Interfaces:**
- Produces: App shell with CredentialBar, left sidebar (InterfaceTree), and content area switching between ApiTest / BatchTest / History

- [ ] **Step 1: Write Layout component**

```jsx
import { useState, useMemo } from 'react'
import CredentialBar from '../CredentialBar/CredentialBar'
import InterfaceTree from '../InterfaceTree/InterfaceTree'
import ApiTest from '../../pages/ApiTest/ApiTest'
import BatchTest from '../../pages/BatchTest/BatchTest'
import History from '../../pages/History/History'

// Load all API definitions statically (Vite glob import)
const apiModules = import.meta.glob('../../config/api-defs/*.json', { eager: true, import: 'default' })
let allApis = []
for (const mod of Object.values(apiModules)) {
  allApis = allApis.concat(mod)
}

const NAV_ITEMS = [
  { key: 'apiTest', label: '接口测试' },
  { key: 'batchTest', label: '批量测试' },
  { key: 'history', label: '历史记录' },
]

export default function Layout() {
  const [credentials, setCredentials] = useState({ appKey: '', appSecret: '', accessToken: '' })
  const [env, setEnv] = useState('test')
  const [activeView, setActiveView] = useState('apiTest')
  const [selectedApiId, setSelectedApiId] = useState(null)

  const selectedApi = useMemo(
    () => allApis.find(a => a.id === selectedApiId),
    [selectedApiId]
  )

  // Listen for navigation events from History replay
  function handleNavChange(view, apiId) {
    setActiveView(view)
    if (apiId) setSelectedApiId(apiId)
  }

  // Expose navigation handler globally for replay
  window.handleNav = (view, apiId) => {
    setActiveView(view)
    if (apiId) setSelectedApiId(apiId)
  }

  return (
    <div className="h-screen flex flex-col">
      <CredentialBar
        credentials={credentials}
        onChange={setCredentials}
        env={env}
        onEnvChange={setEnv}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-72 flex-shrink-0 overflow-hidden">
          <InterfaceTree
            apis={allApis}
            selectedId={selectedApiId}
            onSelect={id => {
              setSelectedApiId(id)
              setActiveView('apiTest')
            }}
          />
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Nav tabs */}
          <div className="flex border-b border-gray-200 bg-white px-4">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeView === item.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {activeView === 'apiTest' && (
              <ApiTest
                api={selectedApi}
                credentials={credentials}
                env={env}
                onTokenUpdate={token => setCredentials(prev => ({ ...prev, accessToken: token }))}
              />
            )}
            {activeView === 'batchTest' && (
              <BatchTest
                apis={allApis}
                credentials={credentials}
                env={env}
                onTokenUpdate={token => setCredentials(prev => ({ ...prev, accessToken: token }))}
              />
            )}
            {activeView === 'history' && (
              <History apis={allApis} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update App.jsx to render Layout as a separate route**

Replace the content of `src/App.jsx`:

```jsx
import Layout from './components/Layout/Layout'

export default function App() {
  return <Layout />
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout/Layout.jsx src/App.jsx
git commit -m "feat: add Layout shell with nav tabs and wire up App.jsx"
```

---

### Task 14: Configure Vite proxy for dev server

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1: Add proxy config to vite.config.js**

Replace `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 2: Update all frontend fetch calls to use relative paths**

The ApiTest, BatchTest, and History pages use `http://localhost:3001/api/...`. After the Vite proxy, they can use relative paths `/api/...`. Replace all occurrences of `http://localhost:3001/api/` with `/api/` in:
- `src/pages/ApiTest/ApiTest.jsx`
- `src/pages/BatchTest/BatchTest.jsx`
- `src/pages/History/History.jsx`

- [ ] **Step 3: Commit**

```bash
git add vite.config.js src/pages/ApiTest/ApiTest.jsx src/pages/BatchTest/BatchTest.jsx src/pages/History/History.jsx
git commit -m "feat: add Vite proxy config for /api routes"
```

---

### Task 15: Test the full application

- [ ] **Step 1: Start both frontend and backend**

```bash
npm run dev:all
```
Expected: Frontend on http://localhost:5173, backend on http://localhost:3001

- [ ] **Step 2: Verify UI loads**

Open http://localhost:5173 in browser.
Expected: CredentialBar at top, InterfaceTree on left with "认证服务", "商品服务", "订单服务" categories, empty content area showing "请从左侧选择一个接口"

- [ ] **Step 3: Verify interface selection**

Click "获取AccessToken" in the tree.
Expected: ApiTest page shows with appKey, appSecret, timestamp, grantType form fields. Submit button visible.

- [ ] **Step 4: Verify batch test page**

Click "批量测试" tab.
Expected: Scenario dropdown showing "获取Token → 查商品" and "完整下单流程", Run button visible.

- [ ] **Step 5: Verify history page**

Click "历史记录" tab.
Expected: Filter dropdowns, empty table with "暂无测试记录".

- [ ] **Step 6: Verify server health**

```bash
curl http://localhost:3001/api/history
```
Expected: `[]` (empty array)

- [ ] **Step 7: Commit**

```bash
git commit --allow-empty -m "chore: verify full application startup"
```
