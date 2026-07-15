# API 测试工具使用指南

## 一、整体架构

```
浏览器 (React SPA) ──► Express 代理层 ──► 云中鹤平台 API
     │                      │
     │  参数表单化输入       │  MD5/SM3 签名
     │  批量场景串联         │  请求转发代理
     │  历史记录管理         │  历史数据存取
```

## 二、启动方式

```bash
cd API-flow
npm run dev:all    # 同时启动前端(5173) + 后端(3001)
```

## 三、接口定义驱动机制

所有接口信息存储在 `src/config/api-defs/*.json` 配置文件中，按模块分文件：

| 文件 | 模块 | 接口数 |
|------|------|--------|
| `auth.json` | 认证服务 | 1 |
| `basic-data.json` | 基础数据服务 | 11 |
| `product.json` | 商品服务 | 8 |
| `order.json` | 订单服务 | 7 |
| `aftersales.json` | 售后订单服务 | 7 |

每个接口定义包含：
- **基本信息**: `id`、`name`、`category`、`path`、`method`
- **输入参数 `params`**: `name`(字段名)、`label`(中文标签)、`required`(是否必填)、`type`(表单控件类型)、`autoFill`(自动填充来源)、`arrayType`(是否数组)、`hidden`(是否隐藏)、`docType`(数据类型)、`docDesc`(字段描述)、`desc`(备注)
- **输出参数 `outputParams`**: `name`、`docType`、`docDesc`（用于右侧接口说明面板）
- **签名配置**: `signRequired`(是否需要签名)
- **响应映射**: `responseMapping`(Token提取路径等)

### autoFill 自动填充机制

| autoFill 值 | 数据来源 | 说明 |
|-------------|---------|------|
| `credential` | 顶部凭据栏 appKey/appSecret | 首次选择接口时自动填入，之后凭据栏变化时同步更新 |
| `accessToken` | 顶部凭据栏 accessToken | 获取Token后自动填入后续接口 |
| `timestamp` | 系统当前时间 | 格式 yyyy-MM-dd HH:mm:ss |

### arrayType 数组参数处理

标记 `arrayType: true` 的参数，前端会自动将逗号分隔的字符串拆分为数组发送。例如用户输入 `3000119,3000120` → 发送 `["3000119","3000120"]`。

### hidden 隐藏参数

标记 `hidden: true` 的参数不在表单中显示，但在接口说明面板中保留。例如 `sign` 字段由后端签名引擎自动生成，用户无需填写。

## 四、页面功能

### 4.1 全局左侧目录树

按固定顺序展示所有接口模块：
1. 认证服务
2. 地址基础数据 → 分类基础数据 → 品牌基础数据 → 快递公司基础数据
3. 商品服务
4. 订单服务
5. 售后订单服务

点击接口的行为取决于当前处于哪个页签：
- **接口测试页**: 跳转到该接口的测试表单
- **批量测试页**: 将该接口添加到场景步骤链

### 4.2 接口测试页（三栏布局）

| 左栏 | 中栏 | 右栏 |
|------|------|------|
| 参数输入表单 | 响应结果（JSON） | 接口说明（输入+输出参数表） |

**操作流程：**
1. 在顶部凭据栏输入 `appKey` 和 `appSecret`
2. 在左侧目录树选择接口，表单自动生成，必填字段标红 `*`
3. 灰色只读字段为自动填充（凭据、Token、时间戳），无需手动输入
4. 填写其他业务参数后点击「发送请求」
5. 响应结果显示在中间栏，包含 HTTP 状态、业务码、完整 JSON
6. 大数据响应（>50KB）自动截断显示，可点击「显示全部」展开
7. 支持「复制」和「下载」完整响应数据

**Token 自动传递：** 调用获取AccessToken成功后，Token 自动提取到顶部凭据栏，后续接口的 `accessToken` 参数自动填入。

### 4.3 批量测试页（两栏布局）

| 左栏 | 右栏 |
|------|------|
| 场景步骤 + 运行按钮 | 运行结果（实时更新） |

**场景构建：**
1. 切换到批量测试页签
2. 从左侧全局目录树点击接口 → 自动添加到场景步骤链
3. 每个步骤可配置：
   - **输出变量名**: 如 `token`
   - **输出路径**: JSONPath 如 `result.accessToken`
   - 后续步骤引用: `{{token}}`

**场景运行：**
1. 点击「运行场景」，从上到下顺序执行
2. 每步参数填充优先级：
   - ① `autoFill` 字段（凭据/Token/时间戳）
   - ② `{{变量}}` 替换（上一步输出值）
   - ③ `default` 默认值（API 配置中的预设值）
3. 必填参数缺失 → 步骤卡片展开蓝色内联表单，用户补充后点「确认并继续」
4. 所有预填值均可手动修改
5. 每步执行完结果**实时更新**到右侧面板

**重试与继续：**
- 失败步骤点击「重试」→ 展开橙色内联表单，修改参数后单独重试该步骤
- 中途停止后点击「继续执行」→ 从下一个未执行步骤继续

**自动输出捕获：** 系统自动从响应中捕获常用字段传递给后续步骤：

| 字段 | 传递目标 |
|------|---------|
| `accessToken` | 凭据栏 + `{{__accessToken}}` |
| `goodsSkuCode` | `{{goodsSkuCode}}` |
| `parentOrderCode` | `{{parentOrderCode}}` |
| `orderCode` | `{{orderCode}}` |
| `returnOrderCode` | `{{returnOrderCode}}` |

### 4.4 历史记录页

- 记录最近 30 条调用历史，超出自动淘汰
- 支持按接口、通过/失败状态筛选
- 每条记录显示：结果标识、接口名、响应码、耗时、时间
- 点击行弹出详情弹窗：左侧请求参数 JSON，右侧响应数据 JSON
- 支持导出为 JSON 文件、删除单条记录

## 五、批量测试典型流程示例

```
Step 1: 获取AccessToken
  ├─ 输出变量: token = result.accessToken
  └─ 执行 → 拿到 token

Step 2: 获取商品详情信息
  ├─ accessToken = {{token}}（自动填入）
  ├─ goodsSkuCode = 3000119（手动填写）
  └─ 执行 → 拿到商品详情，自动捕获 goodsSkuCode

Step 3: 提交订单
  ├─ accessToken = {{token}}（自动填入）
  ├─ goodsSkuCodes = {{goodsSkuCode}}（自动填入）
  ├─ 缺: orderAmount, provinceId, cityId... → 弹窗补充
  └─ 执行 → 拿到 parentOrderCode

Step 4: 获取订单详情
  ├─ accessToken = {{token}}（自动填入）
  ├─ parentOrderCode = {{parentOrderCode}}（自动填入）
  └─ 执行 → 查看完整订单数据
```

## 六、后端处理流程

### 签名引擎 (`server/sign-engine.js`)

支持 MD5 和 SM3 两种加密方式：
1. 先对 `appSecret` 明文进行加密 → `encryptedSecret`
2. 拼接字符串: `appKey + appSecret(明文) + timestamp + appSecret(明文)`
3. 对拼接串加密 → `sign`

### 代理层 (`server/proxy.js`)

1. 接收前端请求: `{ targetPath, params, env, appKey, appSecret, signRequired }`
2. 如果 `signRequired=true` 且有凭据 → 自动生成时间戳和签名，注入到请求体
3. 将完整请求体 POST 到云中鹤平台（测试/生产环境）
4. 返回: `{ httpStatus, duration, data }`

### 历史存储 (`server/history-store.js`)

- 文件位置: `node_modules/.cache/api-tester/history/YYYY-MM-DD.json`（Vite 不监听此目录，避免页面刷新）
- 每条记录包含: `id`、`apiId`、`apiName`、`requestParams`、`response`、`pass`、`time`
- 最多保留 30 条

## 七、配置文件字段说明

### param 字段定义

| 属性 | 类型 | 说明 |
|------|------|------|
| `name` | string | 字段名，与 API 文档一致 |
| `label` | string | 中文标签，表单和文档中显示 |
| `required` | boolean | 是否必填 |
| `type` | string | 表单控件: `string`/`number`/`enum` |
| `autoFill` | string | 自动填充: `credential`/`accessToken`/`timestamp` |
| `arrayType` | boolean | 是否需要转为数组发送 |
| `hidden` | boolean | 是否在表单中隐藏（文档仍显示） |
| `default` | any | 默认值 |
| `docType` | string | 数据类型: `String`/`Integer`/`Double`/`List`/`Object`/`Boolean`/`Date`/`Long` |
| `docDesc` | string | 字段描述（来自 PDF） |
| `desc`/`docNote` | string | 备注信息 |
| `options` | array | enum 类型的可选项值 |
| `optionLabels` | array | enum 类型的可选项标签 |

### outputParam 字段定义

| 属性 | 说明 |
|------|------|
| `name` | 字段名，支持点号路径如 `result.accessToken` 和数组路径如 `result[].goodsSkuCode` |
| `docType` | 数据类型 |
| `docDesc` | 字段描述（来自 PDF，不能更改） |
