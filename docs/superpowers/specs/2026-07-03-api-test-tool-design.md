# API Test Tool Design

> 基于云中鹤平台商城API对接服务规范 v1.0.16 构建的接口测试工具

## Overview

面向测试/QA人员的 Web API 测试工具，支持参数表单化测试、批量场景测试、历史记录管理与导出。

## Architecture

```
Browser (React SPA)
    │  HTTP (localhost)
Express Proxy (Node.js)
    │  HTTPS/POST
云中鹤平台 API (openapi2-show.haoxiny.com / openapi2.haoxiny.com)
```

- **React SPA**: 接口列表、表单测试、批量测试、历史记录四大页面
- **Express 代理层**: 签名计算（MD5/SM3）、请求转发、历史JSON文件存储
- **签名引擎**: 支持 MD5 32位小写 和 SM3 两种加密方式
- **并发启动**: concurrently 一键启动前后端

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + Vite (API-flow existing project) |
| Routing | React Router v6 |
| Styling | Pure CSS (no UI library) |
| Backend | Express.js (new `server/` directory) |
| Signature | crypto-js (MD5), sm-crypto (SM3) |
| Dev tooling | concurrently |

## Key Design Decisions

### 1. Interface Definitions as Config

Each API endpoint is defined in a static JSON config file under `src/config/api-defs/`. The UI auto-generates parameter forms from these definitions. This means the API document knowledge is codified in config files rather than hardcoded in components — updating for a new API version only requires editing JSON.

Config schema per interface:
- `id`, `name`, `category` (for tree grouping)
- `method`, `path` (HTTP details)
- `params` array: each has `name`, `label`, `required`, `type`, `autoFill` (optional binding to credential/timestamp), `sensitive` (for password fields)
- `signRequired`: whether this endpoint needs MD5/SM3 signing
- `responseMapping`: JSONPath to extract key fields (success, code, token)

### 2. Session-Only Credentials

appKey/appSecret are entered at the top bar and held only in React state for the browser session. They are never persisted to localStorage, cookies, or files. When the user closes the tab, credentials are gone. This satisfies the security requirement.

### 3. Batch Testing with Variable Chaining

Each step in a batch scenario can declare output variables (extracted from response JSON via JSONPath). Subsequent steps reference these via `{{variableName}}` syntax. The frontend engine resolves variables before sending each request.

Pre-built scenarios for common flows (token→product→order) are provided. Users can create and save custom scenarios.

### 4. History as Daily JSON Files

Backend stores history as `history/YYYY-MM-DD.json`, one file per day. Each record contains: interface ID, full request params, full response, timestamp, duration, pass/fail status. Supports filtering, replay (auto-fill params back into test form), and export (single or batch to JSON).

Auto-cleanup after 30 days.

## Scope (Phase 1)

Core modules only:
- Authentication: 获取AccessToken
- Product: 获取商品信息列表, 检索商品信息列表, 获取商品详情信息, 获取商品图片列表, 获取商品价格列表, 获取商品库存列表, 获取商品上下架列表, 获取商品销售区域列表
- Order: 提交订单, 预占确认订单, 取消订单, 获取订单列表, 获取订单详情, 获取订单物流, 获取订单发票

## Directory Structure

```
API-flow/
├── src/
│   ├── pages/
│   │   ├── ApiList/          # Left sidebar - interface tree
│   │   ├── ApiTest/          # Main test page - form + response
│   │   ├── BatchTest/        # Batch scenario testing
│   │   └── History/          # Test history records
│   ├── components/
│   │   ├── CredentialBar/    # Top credential input bar
│   │   ├── ParamForm/        # Dynamic parameter form generator
│   │   ├── ResponseViewer/   # JSON response display with validation
│   │   ├── InterfaceTree/    # Left sidebar interface navigation
│   │   └── Layout/           # App shell layout
│   ├── config/
│   │   ├── api-defs/         # Per-interface JSON definition files
│   │   └── api-registry.json # Index of all interfaces
│   ├── utils/
│   │   ├── variable-resolver.js  # {{var}} template engine
│   │   └── json-path.js          # JSONPath extraction
│   ├── App.jsx
│   └── main.jsx
├── server/
│   ├── index.js              # Express entry, serve static + API routes
│   ├── sign-engine.js        # MD5 / SM3 signature calculation
│   ├── proxy.js              # Forward requests to 云中鹤 API
│   └── history-store.js      # Read/write history JSON files
├── history/                  # Auto-generated daily JSON files
├── package.json              # Updated with server + concurrently scripts
└── vite.config.js            # Proxy config for dev
```

## UI Layout

```
┌──────────────────────────────────────────────────┐
│ 🔑 Credential Bar (appKey, appSecret, env toggle) │
├────────────┬─────────────────────────────────────┤
│ Interface  │ Main Content Area                    │
│ Tree       │  - ApiTest: param form + response    │
│ (300px)    │  - BatchTest: scenario steps         │
│            │  - History: filter + record list      │
└────────────┴─────────────────────────────────────┘
```

## API Routes (Local Proxy)

| Local Endpoint | Description |
|---------------|-------------|
| POST `/api/proxy` | Proxy request body: `{targetPath, params}` → signs and forwards to 云中鹤 |
| GET `/api/history` | List history records (supports query filters) |
| DELETE `/api/history/:id` | Delete a history record |
| GET `/api/history/export` | Export filtered records as JSON download |
| POST `/api/scenarios` | Save a batch test scenario |
| GET `/api/scenarios` | List saved scenarios |
| DELETE `/api/scenarios/:id` | Delete a scenario |
