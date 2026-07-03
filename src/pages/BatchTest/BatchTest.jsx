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
