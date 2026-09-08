/**
 * 简化版 AI 工作流引擎
 * 3步流程：快速识别接口清单 → 分批提取参数详情 → 结果验证与增强
 * 不限制文档长度、接口数量、参数数量
 */

import { callAi, extractJson } from './aiClient'

/**
 * 执行简化的 3 步工作流
 * @param {string} docText - 文档文本（完整，不截断）
 * @param {(steps: Array) => void} [onStep] - 每步状态变化时的回调（用于 UI 实时展示进度）
 * @returns {Promise<{steps: Array, apis: Array}>}
 */
export async function executeSimpleWorkflow(docText, onStep) {
  const steps = []
  // 每次状态变化时通知 UI（传副本，避免外部持有引用后被内部修改）
  const emit = () => { if (onStep) onStep(steps.map(s => ({ ...s }))) }
  const startStep = (step, name, detail) => {
    steps.push({ step, name, status: 'running', detail })
    emit()
  }
  const finishStep = (result) => {
    const s = steps[steps.length - 1]
    s.status = 'success'
    s.result = result
    delete s.detail
    emit()
  }
  const updateDetail = (detail) => {
    const s = steps[steps.length - 1]
    s.detail = detail
    emit()
  }

  try {
    // Step 1: 快速识别接口清单（只要name、url、method）
    console.log('[Workflow] Step 1: 快速识别接口清单')
    startStep(1, '快速识别接口清单', '正在扫描文档...')
    const apiList = await identifyApiList(docText)
    finishStep({
      apiCount: apiList.length,
      confidence: 'high',
      issues: apiList.length === 0 ? ['未识别到任何接口'] : []
    })

    if (apiList.length === 0) {
      throw new Error('未识别到任何接口，请检查文档内容')
    }

    // Step 2: 分批提取参数详情
    console.log('[Workflow] Step 2: 分批提取参数详情')
    startStep(2, '提取参数详情', `共 ${apiList.length} 个接口，准备分批提取...`)
    const detailedApis = await extractApiDetails(docText, apiList, (current, total) => {
      updateDetail(`正在提取第 ${current}/${total} 批...`)
    })
    finishStep({
      extracted: detailedApis.length,
      batchCount: Math.ceil(apiList.length / 3) // 改为每批3个
    })

    // Step 3: 结果验证与质量增强
    console.log('[Workflow] Step 3: 验证与增强')
    startStep(3, '质量验证与增强', '正在验证...')
    const validationResult = validateAndEnhance(detailedApis)
    finishStep({
      validated: validationResult.validated,
      enhanced: validationResult.enhanced,
      warnings: validationResult.warnings
    })

    return {
      steps,
      apis: validationResult.finalApis,
      summary: {
        totalApis: validationResult.finalApis.length,
        confidence: 'high',
        qualityScore: validationResult.qualityScore
      }
    }
  } catch (error) {
    // 若最后一步处于 running 状态，标记为失败；否则追加错误步骤
    const last = steps[steps.length - 1]
    if (last && last.status === 'running') {
      last.status = 'error'
      last.error = error.message
      delete last.detail
    } else {
      steps.push({
        step: steps.length + 1,
        name: '工作流错误',
        status: 'error',
        error: error.message
      })
    }
    emit()
    throw error
  }
}

/**
 * Step 1: 快速识别接口清单（只提取核心信息，不要参数）
 */
async function identifyApiList(docText) {
  // 读取完整文档，不截断
  const prompt = `你是 API 文档分析专家。快速扫描文档，提取所有 API 接口的基本信息。

文档内容：
${docText}

返回 JSON 格式（极简版，只要核心字段）：
{
  "apis": [
    {
      "name": "接口名称",
      "url": "/api/path",
      "method": "GET|POST|PUT|DELETE|PATCH"
    }
  ]
}

要求：
1. 提取所有接口，不要遗漏
2. 只返回name、url、method三个字段
3. 不要提取参数信息
4. 只返回JSON，不要解释`

  const { reply } = await callAi(prompt, { maxTokens: 8000 })
  const result = extractJson(reply, { prefer: 'object' })
  return result.apis || []
}

/**
 * Step 2: 分批提取参数详情
 */
async function extractApiDetails(docText, apiList, onProgress) {
  const batchSize = 3 // 每批只处理3个接口，降低风险
  const detailedApis = []
  const totalBatches = Math.ceil(apiList.length / batchSize)

  // 分批处理
  for (let i = 0; i < apiList.length; i += batchSize) {
    const batch = apiList.slice(i, i + batchSize)
    if (onProgress) onProgress(Math.floor(i / batchSize) + 1, totalBatches)

    const apiNames = batch.map(api => api.name).join('、')
    const prompt = `你是 API 文档分析专家。从文档中提取以下接口的详细参数信息：

接口列表：${apiNames}

文档内容：
${docText}

返回 JSON 格式（简洁版）：
{
  "apis": [
    {
      "name": "接口名称",
      "url": "/api/path",
      "method": "GET|POST",
      "description": "简短描述",
      "inputParams": [
        {"name": "参数名", "type": "string", "required": true, "description": "说明"}
      ],
      "outputParams": [
        {"name": "参数名", "type": "string", "description": "说明"}
      ]
    }
  ]
}

要求：
1. 只返回上述${batch.length}个接口的详细信息
2. 提取所有参数（不限制数量）
3. description保持简短（不超过20字）
4. 只返回JSON，不要解释`

    const { reply } = await callAi(prompt, { maxTokens: 16000 })
    const result = extractJson(reply, { prefer: 'object' })
    if (result.apis && Array.isArray(result.apis)) {
      detailedApis.push(...result.apis)
    }
  }

  return detailedApis
}

/**
 * Step 3: 验证与增强结果
 */
function validateAndEnhance(apis) {
  const warnings = []
  let enhancedCount = 0  // 改名，避免与下面的 enhanced 对象冲突
  let filtered = 0  // 被过滤掉的接口数量

  const processedApis = apis.map(api => {
    const enhanced = { ...api }

    // 验证必填字段
    if (!api.name || api.name.trim() === '') {
      warnings.push(`接口缺少名称: ${api.url || '未知URL'}`)
      enhanced.name = api.url || '未命名接口'
      enhancedCount++
    }

    if (!api.url || api.url.trim() === '') {
      warnings.push(`接口"${api.name}"缺少 URL`)
    }

    // 归一化 HTTP 方法大小写后再校验，避免模型返回小写 post/get 被误改成 GET
    const method = (api.method || '').toUpperCase()
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      warnings.push(`接口"${api.name}"的 HTTP 方法无效: ${api.method}`)
      enhanced.method = 'GET' // 默认值
      enhancedCount++
    } else {
      enhanced.method = method
    }

    // 补全缺失的字段
    if (!enhanced.description) {
      enhanced.description = ''
    }

    if (!enhanced.inputParams || !Array.isArray(enhanced.inputParams)) {
      enhanced.inputParams = []
      enhancedCount++
    }

    if (!enhanced.outputParams || !Array.isArray(enhanced.outputParams)) {
      enhanced.outputParams = []
      enhancedCount++
    }

    // 确保参数结构完整
    enhanced.inputParams = enhanced.inputParams.map(p => ({
      name: p.name || '',
      type: p.type || 'string',
      required: p.required === true,
      description: p.description || '',
      remark: p.remark || ''
    }))

    enhanced.outputParams = enhanced.outputParams.map(p => ({
      name: p.name || '',
      type: p.type || 'string',
      description: p.description || '',
      remark: p.remark || ''
    }))

    return enhanced
  })

  // 过滤掉不完整的接口：缺少URL或者既没有输入参数也没有输出参数
  const finalApis = processedApis.filter(api => {
    // 检查 URL 是否有效
    if (!api.url || api.url.trim() === '') {
      filtered++
      warnings.push(`跳过无效接口"${api.name}"：缺少 URL`)
      return false
    }

    // 检查是否至少有一个参数
    const hasInputParams = api.inputParams && api.inputParams.length > 0 && api.inputParams.some(p => p.name)
    const hasOutputParams = api.outputParams && api.outputParams.length > 0 && api.outputParams.some(p => p.name)

    if (!hasInputParams && !hasOutputParams) {
      filtered++
      warnings.push(`跳过不完整接口"${api.name}"：既无输入参数也无输出参数`)
      return false
    }

    return true
  })

  // 计算质量分数（基于过滤后的接口）
  const totalFields = finalApis.length * 3 // name, url, method
  const validFields = finalApis.filter(api => api.url && api.url.trim()).length * 3
  const qualityScore = totalFields > 0 ? Math.round((validFields / totalFields) * 100) : 0

  return {
    finalApis,
    validated: finalApis.length,  // 验证通过的接口数 = 未被过滤掉的数量
    enhanced: enhancedCount,
    filtered,  // 被过滤掉的接口数
    warnings,
    qualityScore
  }
}
