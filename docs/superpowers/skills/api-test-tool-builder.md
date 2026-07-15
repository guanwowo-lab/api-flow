# Skill: API Test Tool Builder

> 通用接口测试工具构建范式 —— 从任意 API 文档到可用的接口测试平台

## 触发条件

用户提供一份 API 对接文档（PDF/Word/网页），希望构建一个可视化的接口测试工具。

## 适用场景

- 有一份第三方 API 对接规范文档，需要逐个测试接口
- 需要批量串联多个接口形成业务场景测试
- 需要保存测试历史记录供排查问题
- 需要接口文档与测试工具一体化，减少来回翻文档

## 前提判断

在开始实施前，先确认以下信息：

1. **文档格式**: PDF、docx、网页(Swagger/OpenAPI)、Markdown？
2. **使用者**: 开发人员、测试/QA、业务人员？
3. **工具形态**: Web 应用（推荐）、桌面应用、命令行？
4. **认证方式**: Token、appKey/appSecret 签名、OAuth？
5. **接口协议**: REST/HTTP POST、GET？JSON/XML？
6. **覆盖范围**: 全量接口还是一次性核心流程？

## 实施范式（5 个阶段）

---

### 阶段一：文档解析 → 结构化数据

**目标**: 将原始文档转为可编程的接口定义

**步骤**:
1. 提取文档文本（PDF 用 pdfplumber，docx 用 mammoth）
2. 从目录/索引页识别所有接口模块和接口名称
3. 对每个接口提取：
   - 服务地址（URL path）
   - 请求方式（POST/GET）
   - 输入参数表：字段名、类型(String/Integer/Double/List/Object)、是否必填(Y/N)、字段描述
   - 输出参数表：同上结构
   - 认证方式（是否需要签名/Token）
   - 接口调用示例（如有）

**输出**: 一份结构化的接口清单（表格/JSON）

---

### 阶段二：配置文件生成

**目标**: 将结构化数据转为前端可消费的 JSON 配置

**配置文件结构**（每个模块一个 JSON 文件）:

```json
[
  {
    "id": "英文唯一标识",
    "name": "中文接口名称",
    "category": "模块分类名",
    "method": "POST",
    "path": "/open/api/xxx/xxx",
    "signRequired": true/false,
    "params": [
      {
        "name": "字段名（与文档一致）",
        "label": "中文标签",
        "required": true/false,
        "type": "string|number|enum",
        "autoFill": "credential|accessToken|timestamp|null",
        "arrayType": true/false,
        "hidden": true/false,
        "default": "默认值",
        "options": ["枚举值1", "枚举值2"],
        "optionLabels": ["标签1", "标签2"],
        "sensitive": true/false,
        "docType": "String|Integer|Double|List|Object|Boolean|Date|Long",
        "docDesc": "来自文档的字段描述（不可更改）",
        "docNote": "补充备注"
      }
    ],
    "outputParams": [
      {
        "name": "字段名（支持路径如 result.xxx 和数组 result[].xxx）",
        "docType": "数据类型",
        "docDesc": "来自文档的字段描述（不可更改）"
      }
    ],
    "responseMapping": {
      "successField": "success",
      "codeField": "code",
      "tokenField": "result.accessToken"
    }
  }
]
```

**配置文件 + 注册索引**:

```json
// api-registry.json
{
  "modules": [
    { "key": "auth", "label": "认证服务", "file": "auth.json" },
    { "key": "module-a", "label": "模块A", "file": "module-a.json" }
  ]
}
```

**关键原则**:
- `name` 字段名必须与 API 文档完全一致，不能自行命名
- `docDesc` 必须复制文档原文，不能改写
- `docType` 使用文档中标注的实际数据类型
- 数组类型参数加 `"arrayType": true` 实现自动拆分
- 自动生成字段加 `"autoFill"` + 对应 `"hidden": true`
- 目录树排序通过 `CATEGORY_ORDER` 数组控制
- **`params` 为用户需填写的入参；`outputParams` 为接口出参文档**

---

### 阶段三：后端代理层搭建

**目标**: 解决 CORS、处理签名认证、保存历史

**核心模块**:

1. **签名引擎** (`server/sign-engine.js`)
   - 根据文档约定的签名算法实现（MD5/SM3/HMAC-SHA256 等）
   - 导出 `sign(appKey, appSecret, timestamp, grantType)` 函数

2. **请求代理** (`server/proxy.js`)
   - 接收 `{ targetPath, params, env, appKey, appSecret, signRequired }`
   - 如果 signRequired=true，自动签名并注入签名字段
   - 转发请求到目标 API，返回 `{ httpStatus, duration, data }`
   - 支持多环境切换（测试/生产 URL）

3. **历史存储** (`server/history-store.js`)
   - 每日 JSON 文件存储，最多 30 条
   - 存储路径放在 Vite 不监听的目录（如 `node_modules/.cache/`）
   - 提供 CRUD + 导出接口

**启动方式**: 用 `concurrently` 同时启动前端 Vite + 后端 Express

---

### 阶段四：前端组件映射

**目标**: 基于配置文件动态渲染 UI

**页面结构**:

| 全局左侧 | 顶部 | 内容区 |
|---------|------|--------|
| 接口目录树（分组折叠+搜索） | 凭据栏（Key/Secret/Token/环境切换） | 页签切换 |

**三个页签**:

1. **接口测试页**（三栏）:
   - 左：参数表单（根据 `params` 动态渲染，`autoFill` 字段只读灰底，`hidden` 字段不显示）
   - 中：响应结果（JSON 渲染，超大响应自动截断 + 显示全部 + 下载）
   - 右：接口文档（输入/输出参数表，含字段名、描述、类型、必填、备注）

2. **批量测试页**（两栏）:
   - 左：场景步骤链（点击全局目录树添加步骤，配置输出变量和 JSONPath，拖拽排序）
   - 右：运行结果（每步执行完实时展示）
   - 内联缺参表单（非弹窗，可同时看前一步输出）
   - 重试单步 + 继续执行后续步骤

3. **历史记录页**:
   - 筛选（接口、结果状态）、表格列表
   - 点击行弹窗展示完整请求/响应
   - 支持导出 JSON、删除

**参数智能填充优先级**: autoFill > 变量替换 > default 默认值 > 手动填写

**批量测试变量链**:
- 步骤定义 `outputVar` + `outputPath`（JSONPath），后续步骤用 `{{变量名}}` 引用
- 系统自动捕获常用字段（如 token、orderCode、goodsSkuCode 等）

---

### 阶段五：测试验证

1. 先单独测试认证接口，确认签名/Token 获取正常
2. 逐个测试各模块接口，验证字段名、数组格式是否正确
3. 配置批量场景，串联 Token → 查数据 → 提交 → 查询结果
4. 对比文档中的示例参数和返回结果，确认一致性

---

## URL 路径快速验证

如果接口报 `90001 请检查访问的接口地址是否正确`，说明 `path` 字段写错了。对比文档中的服务地址，确保完全一致。

常见错误：
- 自己猜测的路径名 vs 文档实际路径名
- 单复数不一致（如 `queryGoodsImage` vs `queryGoodsImageList`）
- 命名风格不一致（如 `submitOrder` vs `createOrder`）

## 参数格式快速验证

如果接口报 `10005 请求参数格式错误`，通常是因为：
- 文档要求数组类型 `["value"]`，但传了字符串 `"value"` → 加 `"arrayType": true`
- 文档要求 Integer 类型，但传了字符串 `"1"` → 加 `"type": "number"`
- 字段名与文档不一致 → 对比文档原文修正 `name` 字段

## 必须遵守的原则

1. `params[].name` 必须与 API 文档完全一致，不能自行命名
2. `outputParams[].docDesc` 必须复制文档原文，不能改写
3. API 路径 `path` 必须与文档服务地址完全一致
4. 所有文档中的入参字段（含非必填）都需要列入 `params`
5. 所有文档中的出参字段都需要列入 `outputParams`
6. 不要猜测参数，一切以文档为准
7. 历史文件存储路径必须在 Vite 监听范围之外
8. 凭据仅会话保留，不落盘
