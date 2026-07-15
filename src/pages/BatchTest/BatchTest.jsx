import { useState, useCallback, useRef, useEffect } from 'react'
import ResponseViewer from '../../components/ResponseViewer/ResponseViewer'

const LOCAL_PROXY = '/api/proxy'

const apiModules = import.meta.glob('../../config/api-defs/*.json', { eager: true, import: 'default' })
let allApis = []
for (const mod of Object.values(apiModules)) { allApis = allApis.concat(mod) }

function findApi(id) { return allApis.find(a => a.id === id) }

function buildInitialParams(api, vars) {
  const params = {}
  for (const p of (api.params || [])) {
    if (p.hidden) continue
    if (p.autoFill === 'timestamp') {
      const d = new Date()
      const pad = n => String(n).padStart(2, '0')
      params[p.name] = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    } else if (p.autoFill === 'credential' && p.name === 'appKey') {
      params[p.name] = vars.__appKey || ''
    } else if (p.autoFill === 'credential' && p.name === 'appSecret') {
      params[p.name] = vars.__appSecret || ''
    } else if (p.autoFill === 'accessToken') {
      params[p.name] = vars.__accessToken || ''
    } else if (vars[p.name] !== undefined) {
      params[p.name] = vars[p.name]
    } else if (p.default !== undefined) {
      params[p.name] = p.default
    }
  }
  return params
}

function getMissingRequired(api, params) {
  return (api.params || []).filter(p => p.required && !p.hidden && (!params[p.name] && params[p.name] !== 0))
}

// Shared: process params + execute API call
async function processAndExecute(api, params, creds, env) {
  // Array conversion
  for (const p of (api.params || [])) {
    if (p.arrayType && params[p.name]) {
      const val = params[p.name]
      params[p.name] = typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(Boolean) : [val]
    }
    if (p.type === 'number' && params[p.name] !== '' && params[p.name] != null) {
      params[p.name] = Number(params[p.name])
    }
  }
  // Build goodsSkuList
  if (params.goodsSkuCodes) {
    const codes = String(params.goodsSkuCodes).split(',').map(s => s.trim()).filter(Boolean)
    const prices = params.sellPrices ? String(params.sellPrices).split(',').map(s => s.trim()).filter(Boolean) : []
    const qtys = params.sellQtys ? String(params.sellQtys).split(',').map(s => s.trim()).filter(Boolean) : []
    params.goodsSkuList = codes.map((c, i) => ({ goodsSkuCode: c, sellPrice: Number(prices[i] || 0), sellQty: Number(qtys[i] || 1) }))
    delete params.goodsSkuCodes; delete params.sellPrices; delete params.sellQtys
  }
  // Build orderInvoice
  if (params.invoiceTitle || params.invoiceContent || params.invoiceSubjectType) {
    const inv = {}
    if (params.invoiceTitle) inv.invoiceTitle = params.invoiceTitle
    if (params.invoiceContent) inv.invoiceContent = params.invoiceContent
    if (params.invoiceSubjectType) inv.invoiceSubjectType = Number(params.invoiceSubjectType)
    if (params.invoiceTaxNo) inv.invoiceTaxNo = params.invoiceTaxNo
    params.orderInvoice = inv
  }
  delete params.invoiceTitle; delete params.invoiceContent; delete params.invoiceSubjectType; delete params.invoiceTaxNo
  // Clean empty
  for (const key of Object.keys(params)) {
    if (params[key] === '' || params[key] === undefined || params[key] === null) delete params[key]
  }
  // Credentials
  if (api.signRequired) {
    params.appKey = params.appKey || creds.appKey
    params.appSecret = params.appSecret || creds.appSecret
  } else {
    params.accessToken = params.accessToken || creds.accessToken
  }

  const res = await fetch(LOCAL_PROXY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetPath: api.path, params, env, appKey: params.appKey || creds.appKey, appSecret: params.appSecret || creds.appSecret, grantType: params.grantType || 'MD5', signRequired: api.signRequired }),
  })
  return await res.json()
}

function extractOutputs(result, step, vars, onTokenUpdate) {
  const api = findApi(step.apiId)
  if (step.outputVar && result?.data?.success && step.outputPath) {
    vars[step.outputVar] = step.outputPath.split('.').reduce((o, k) => o?.[k], result.data)
  }
  if (api?.id === 'queryAccessToken' && result?.data?.result?.accessToken) {
    vars.__accessToken = result.data.result.accessToken
    if (onTokenUpdate) onTokenUpdate(result.data.result.accessToken)
  }
  if (result?.data?.result) {
    const r = result.data.result
    if (Array.isArray(r) && r.length > 0) {
      for (const key of ['goodsSkuCode', 'goodsCode', 'orderCode', 'parentOrderCode', 'returnOrderCode', 'addressCode', 'categoryCode', 'brandCode', 'expressCode']) {
        if (r[0][key] !== undefined && vars[key] === undefined) vars[key] = r[0][key]
      }
    }
    if (r.parentOrderCode && vars.parentOrderCode === undefined) vars.parentOrderCode = r.parentOrderCode
    if (r.orderCode && vars.orderCode === undefined) vars.orderCode = r.orderCode
  }
}

export default function BatchTest({ credentials, env, onTokenUpdate }) {
  const [scenarioSteps, setScenarioSteps] = useState([])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([])
  const [currentStepIdx, setCurrentStepIdx] = useState(-1)
  const [pendingResolve, setPendingResolve] = useState(null)
  const [pendingParams, setPendingParams] = useState({})
  const [pendingApi, setPendingApi] = useState(null)
  const [retryingIdx, setRetryingIdx] = useState(-1)
  const [retryParams, setRetryParams] = useState({})
  const runningRef = useRef(false)
  const stepResultsRef = useRef([])
  const varsRef = useRef({})

  const addStep = useCallback((apiId) => {
    if (runningRef.current) return
    const api = findApi(apiId)
    if (!api) return
    setScenarioSteps(prev => {
      if (prev.find(s => s.apiId === apiId && s._idx > Date.now() - 1000)) return prev
      return [...prev, { apiId: api.id, apiName: api.name, _idx: Date.now(), outputVar: '', outputPath: '' }]
    })
  }, [])

  useEffect(() => {
    const handler = e => addStep(e.detail)
    window.addEventListener('batchAddApi', handler)
    return () => window.removeEventListener('batchAddApi', handler)
  }, [addStep])

  const removeStep = useCallback((idx) => setScenarioSteps(prev => prev.filter((_, i) => i !== idx)), [])
  const updateStep = useCallback((idx, key, value) => setScenarioSteps(prev => prev.map((s, i) => i === idx ? { ...s, [key]: value } : s)), [])

  const waitForParams = useCallback((api, prefill) => new Promise(resolve => {
    setPendingApi(api); setPendingParams({ ...prefill }); setPendingResolve(() => resolve)
  }), [])

  const handleInlineConfirm = useCallback(() => {
    if (!pendingResolve) return
    const r = pendingResolve; setPendingResolve(null); setPendingApi(null); setPendingParams({}); r(pendingParams)
  }, [pendingResolve, pendingParams])

  const handleInlineSkip = useCallback(() => {
    if (!pendingResolve) return
    const r = pendingResolve; setPendingResolve(null); setPendingApi(null); setPendingParams({}); r(null)
  }, [pendingResolve])

  // --- Run full scenario ---
  const runScenario = useCallback(async () => {
    if (scenarioSteps.length === 0 || runningRef.current) return
    runningRef.current = true; setRunning(true); setResults([])
    const steps = [...scenarioSteps]
    const vars = { __appKey: credentials.appKey, __appSecret: credentials.appSecret, __accessToken: credentials.accessToken }
    varsRef.current = vars
    const sres = []; stepResultsRef.current = sres

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]; const api = findApi(step.apiId)
      if (!api) { sres.push({ step: step.apiName, success: false, result: { data: { desc: 'API not found' } }, duration: 0 }); setResults([...sres]); continue }
      setCurrentStepIdx(i)
      let params = buildInitialParams(api, vars)
      const missing = getMissingRequired(api, params)
      if (missing.length > 0) {
        const confirmed = await waitForParams(api, params)
        if (!confirmed) { sres.push({ step: step.apiName, success: false, result: { data: { desc: '用户跳过' } }, duration: 0 }); setResults([...sres]); continue }
        params = { ...confirmed }
      }
      try {
        const result = await processAndExecute(api, params, credentials, env)
        sres.push({ step: step.apiName, success: result?.data?.success, result, duration: result?.duration || 0 })
        setResults([...sres])
        extractOutputs(result, step, vars, onTokenUpdate)
        fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiId: api.id, apiName: api.name, requestParams: params, response: result, pass: result?.data?.success === true && result?.data?.code === '00000' }) }).catch(() => {})
      } catch (err) { sres.push({ step: step.apiName, success: false, result: { data: { desc: err.message } }, duration: 0 }); setResults([...sres]) }
    }
    setCurrentStepIdx(-1); setRunning(false); runningRef.current = false
  }, [scenarioSteps, credentials, env, onTokenUpdate, waitForParams])

  // --- Continue from next incomplete step ---
  const continueFromNext = useCallback(async () => {
    const steps = [...scenarioSteps]; const lastIdx = stepResultsRef.current.length - 1
    if (lastIdx >= steps.length - 1 || runningRef.current) return
    runningRef.current = true; setRunning(true)

    for (let i = lastIdx + 1; i < steps.length; i++) {
      const step = steps[i]; const api = findApi(step.apiId)
      if (!api) { stepResultsRef.current.push({ step: step.apiName, success: false, result: { data: { desc: 'API not found' } }, duration: 0 }); setResults([...stepResultsRef.current]); continue }
      setCurrentStepIdx(i)
      let params = buildInitialParams(api, varsRef.current)
      const missing = getMissingRequired(api, params)
      if (missing.length > 0) {
        const confirmed = await waitForParams(api, params)
        if (!confirmed) { stepResultsRef.current.push({ step: step.apiName, success: false, result: { data: { desc: '用户跳过' } }, duration: 0 }); setResults([...stepResultsRef.current]); continue }
        params = { ...confirmed }
      }
      try {
        const result = await processAndExecute(api, params, credentials, env)
        stepResultsRef.current.push({ step: step.apiName, success: result?.data?.success, result, duration: result?.duration || 0 })
        setResults([...stepResultsRef.current])
        extractOutputs(result, step, varsRef.current, onTokenUpdate)
        fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiId: api.id, apiName: api.name, requestParams: params, response: result, pass: result?.data?.success === true && result?.data?.code === '00000' }) }).catch(() => {})
      } catch (err) { stepResultsRef.current.push({ step: step.apiName, success: false, result: { data: { desc: err.message } }, duration: 0 }); setResults([...stepResultsRef.current]) }
    }
    setCurrentStepIdx(-1); setRunning(false); runningRef.current = false
  }, [scenarioSteps, credentials, env, onTokenUpdate, waitForParams])

  // --- Retry single step ---
  const startRetry = useCallback((idx) => {
    const api = findApi(scenarioSteps[idx]?.apiId)
    if (!api) return
    setRetryingIdx(idx); setRetryParams(buildInitialParams(api, varsRef.current))
  }, [scenarioSteps])

  const handleRetryConfirm = useCallback(async (idx) => {
    const step = scenarioSteps[idx]; const api = findApi(step?.apiId)
    if (!api) return; setRetryingIdx(-1)
    try {
      const result = await processAndExecute(api, { ...retryParams }, credentials, env)
      stepResultsRef.current[idx] = { step: step.apiName, success: result?.data?.success, result, duration: result?.duration || 0 }
      setResults([...stepResultsRef.current])
      extractOutputs(result, step, varsRef.current, onTokenUpdate)
    } catch (err) { stepResultsRef.current[idx] = { step: step.apiName, success: false, result: { data: { desc: err.message } }, duration: 0 }; setResults([...stepResultsRef.current]) }
    setRetryParams({})
  }, [scenarioSteps, retryParams, credentials, env, onTokenUpdate])

  const passCount = results.filter(r => r.success).length

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left: Scenario Steps */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 p-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">场景步骤</span>
          <span className="text-xs text-gray-400">从左侧点击接口添加</span>
          {results.length > 0 && results.length < scenarioSteps.length && (
            <button onClick={continueFromNext} disabled={running} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-400">
              继续执行 (从Step {results.length + 1})
            </button>
          )}
          <button onClick={runScenario} disabled={running || scenarioSteps.length === 0} className="ml-auto px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400">
            {running ? `执行中...` : results.length > 0 ? '重新运行' : '运行场景'}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {scenarioSteps.length === 0 && <div className="text-sm text-gray-400 py-8 text-center">从左侧点击接口添加到场景中</div>}
          {scenarioSteps.map((step, i) => {
            const api = findApi(step.apiId); const result = results[i]
            return (
              <div key={step._idx} className={`border rounded ${currentStepIdx === i ? 'border-blue-400 ring-1 ring-blue-200' : result ? (result.success ? 'border-green-300' : 'border-red-300') : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-sm">
                  <span className="text-gray-400 font-mono text-xs">Step {i + 1}</span>
                  <span className="font-medium text-gray-700">{step.apiName}</span>
                  {result && <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{result.success ? '通过' : '失败'} {result.duration}ms</span>}
                  {!result && currentStepIdx === i && <span className="ml-auto text-xs text-blue-500">执行中...</span>}
                  {result && <button onClick={() => startRetry(i)} className="text-blue-500 hover:text-blue-700 text-xs">重试</button>}
                  {!running && <button onClick={() => removeStep(i)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>}
                </div>

                {!running && !result && (
                  <div className="px-3 py-2 flex items-center gap-2 text-xs border-t border-gray-100 bg-white">
                    <span className="text-gray-500">输出变量:</span>
                    <input type="text" placeholder="变量名" value={step.outputVar || ''} onChange={e => updateStep(i, 'outputVar', e.target.value)} className="w-20 px-1.5 py-0.5 border border-gray-300 rounded text-xs" />
                    <span className="text-gray-400">=</span>
                    <input type="text" placeholder="JSONPath" value={step.outputPath || ''} onChange={e => updateStep(i, 'outputPath', e.target.value)} className="w-40 px-1.5 py-0.5 border border-gray-300 rounded text-xs" />
                    <span className="text-gray-400">引用: {`{{${step.outputVar || '变量名'}}}`}</span>
                  </div>
                )}

                {/* Retry form */}
                {retryingIdx === i && (
                  <div className="px-3 py-2 border-t border-orange-200 bg-orange-50">
                    <p className="text-xs text-orange-600 mb-2">修改参数后重试</p>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {(api?.params || []).filter(p => !p.hidden).map(p => (
                        <div key={p.name} className="flex items-center gap-2">
                          <label className={`text-xs w-28 flex-shrink-0 ${p.required && (!retryParams[p.name] && retryParams[p.name] !== 0) ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{p.label}{p.required && '*'}</label>
                          {p.type === 'enum' ? <select value={retryParams[p.name] || p.default || ''} onChange={e => setRetryParams(prev => ({ ...prev, [p.name]: e.target.value }))} className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">{p.options?.map((o, j) => <option key={o} value={o}>{p.optionLabels?.[j] || o}</option>)}</select>
                          : <input type={p.type === 'number' ? 'number' : 'text'} value={retryParams[p.name] ?? ''} onChange={e => setRetryParams(prev => ({ ...prev, [p.name]: e.target.value }))} className={`flex-1 px-2 py-0.5 text-xs border rounded ${p.required && (!retryParams[p.name] && retryParams[p.name] !== 0) ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setRetryingIdx(-1)} className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">取消</button>
                      <button onClick={() => handleRetryConfirm(i)} className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700">重试</button>
                    </div>
                  </div>
                )}

                {/* Missing params form */}
                {pendingResolve && currentStepIdx === i && retryingIdx !== i && (
                  <div className="px-3 py-2 border-t border-blue-200 bg-blue-50">
                    <p className="text-xs text-blue-600 mb-2">以下必填参数缺少值，请填写后继续</p>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {(pendingApi?.params || []).filter(p => !p.hidden).map(p => (
                        <div key={p.name} className="flex items-center gap-2">
                          <label className={`text-xs w-28 flex-shrink-0 ${p.required && (!pendingParams[p.name] && pendingParams[p.name] !== 0) ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{p.label}{p.required && '*'}</label>
                          {p.type === 'enum' ? <select value={pendingParams[p.name] || p.default || ''} onChange={e => setPendingParams(prev => ({ ...prev, [p.name]: e.target.value }))} className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">{p.options?.map((o, j) => <option key={o} value={o}>{p.optionLabels?.[j] || o}</option>)}</select>
                          : <input type={p.type === 'number' ? 'number' : 'text'} value={pendingParams[p.name] ?? ''} onChange={e => setPendingParams(prev => ({ ...prev, [p.name]: e.target.value }))} className={`flex-1 px-2 py-0.5 text-xs border rounded ${p.required && (!pendingParams[p.name] && pendingParams[p.name] !== 0) ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={handleInlineSkip} className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">跳过</button>
                      <button onClick={handleInlineConfirm} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">确认并继续</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: Results */}
      <div className="w-[45%] flex-shrink-0 flex flex-col overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">运行结果</span>
          {results.length > 0 && <span className="text-xs text-gray-400">通过 {passCount}/{results.length} | 总耗时 {results.reduce((s, r) => s + (r.duration || 0), 0)}ms</span>}
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {results.length === 0 && <div className="text-sm text-gray-400 py-8 text-center">运行场景后结果将显示在此处</div>}
          {results.map((r, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-400">Step {i + 1}</span>
                <span className="text-xs font-medium text-gray-600">{scenarioSteps[i]?.apiName || r.step}</span>
                <span className={`text-xs px-1 py-0.5 rounded ${r.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.success ? '通过' : '失败'} {r.duration || '-'}ms</span>
              </div>
              <ResponseViewer response={r.result} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
