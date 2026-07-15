import { useState, useCallback, useEffect, useRef } from 'react'
import ParamForm from '../../components/ParamForm/ParamForm'
import ResponseViewer from '../../components/ResponseViewer/ResponseViewer'
import ApiDocPanel from '../../components/ApiDocPanel/ApiDocPanel'

const LOCAL_PROXY = '/api/proxy'

export default function ApiTest({ api, credentials, env, onTokenUpdate }) {
  const [values, setValues] = useState({})
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  // Reset values and response when switching APIs
  useEffect(() => {
    if (!api) return
    const initial = {}
    for (const p of api.params) {
      if (p.autoFill === 'timestamp') {
        const d = new Date()
        const pad = n => String(n).padStart(2, '0')
        initial[p.name] = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      } else if (p.autoFill === 'credential' && p.name === 'appKey') {
        initial[p.name] = credentials.appKey || ''
      } else if (p.autoFill === 'credential' && p.name === 'appSecret') {
        initial[p.name] = credentials.appSecret || ''
      } else if (p.autoFill === 'accessToken') {
        initial[p.name] = credentials.accessToken || ''
      } else if (p.default !== undefined) {
        initial[p.name] = p.default
      }
    }
    setValues(initial)
    setResponse(null)
  }, [api?.id])

  // Sync credential changes to form fields (only when values differ)
  useEffect(() => {
    if (!api) return
    setValues(prev => {
      let next = null
      for (const p of api.params) {
        if (p.autoFill === 'credential' && p.name === 'appKey' && prev.appKey !== credentials.appKey) {
          if (!next) next = { ...prev }
          next.appKey = credentials.appKey
        } else if (p.autoFill === 'credential' && p.name === 'appSecret' && prev.appSecret !== credentials.appSecret) {
          if (!next) next = { ...prev }
          next.appSecret = credentials.appSecret
        } else if (p.autoFill === 'accessToken' && prev[p.name] !== credentials.accessToken) {
          if (!next) next = { ...prev }
          next[p.name] = credentials.accessToken
        }
      }
      return next || prev
    })
  }, [credentials.appKey, credentials.appSecret, credentials.accessToken, api?.id])

  // Extract token from response — runs AFTER render stabilizes
  useEffect(() => {
    const token = response?.data?.result?.accessToken
    if (!token || !response?.data?.success) return
    onTokenUpdate(token)
  }, [response?.data?.result?.accessToken, response?.data?.success, onTokenUpdate])

  // Restore replay params from sessionStorage
  useEffect(() => {
    if (!api) return
    try {
      const replayStr = sessionStorage.getItem('apitester_replay')
      if (replayStr) {
        const replay = JSON.parse(replayStr)
        if (replay.apiId === api.id) {
          setValues(replay.params || {})
          sessionStorage.removeItem('apitester_replay')
        }
      }
    } catch {}
  }, [api])

  const handleParamChange = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!api || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)

    const params = { ...values }
    // Convert arrayType params to arrays
    if (api.params) {
      for (const p of api.params) {
        if (p.arrayType && params[p.name]) {
          const val = params[p.name]
          params[p.name] = typeof val === 'string'
            ? val.split(',').map(s => s.trim()).filter(Boolean)
            : [val]
        }
        // Convert number type values from string to number
        if (p.type === 'number' && params[p.name] !== '' && params[p.name] !== undefined && params[p.name] !== null) {
          params[p.name] = Number(params[p.name])
        }
      }
    }
    // Build goodsSkuList array from comma-separated fields
    if (params.goodsSkuCodes) {
      const codes = String(params.goodsSkuCodes).split(',').map(s => s.trim()).filter(Boolean)
      const prices = params.sellPrices ? String(params.sellPrices).split(',').map(s => s.trim()).filter(Boolean) : []
      const qtys = params.sellQtys ? String(params.sellQtys).split(',').map(s => s.trim()).filter(Boolean) : []
      params.goodsSkuList = codes.map((code, i) => ({
        goodsSkuCode: code,
        sellPrice: Number(prices[i] || 0),
        sellQty: Number(qtys[i] || 1)
      }))
      delete params.goodsSkuCodes
      delete params.sellPrices
      delete params.sellQtys
    }
    // Build orderInvoice object from sub-fields
    if (params.invoiceTitle || params.invoiceContent || params.invoiceSubjectType) {
      const inv = {}
      if (params.invoiceTitle) inv.invoiceTitle = params.invoiceTitle
      if (params.invoiceContent) inv.invoiceContent = params.invoiceContent
      if (params.invoiceSubjectType) inv.invoiceSubjectType = Number(params.invoiceSubjectType)
      if (params.invoiceTaxNo) inv.invoiceTaxNo = params.invoiceTaxNo
      if (Object.keys(inv).length > 0) params.orderInvoice = inv
    }
    delete params.invoiceTitle
    delete params.invoiceContent
    delete params.invoiceSubjectType
    delete params.invoiceTaxNo
    // Remove empty/undefined values so optional fields aren't sent as empty strings
    for (const key of Object.keys(params)) {
      if (params[key] === '' || params[key] === undefined || params[key] === null) {
        delete params[key]
      }
    }
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

      fetch('/api/history', {
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
      setResponse({ httpStatus: 0, duration: 0, data: { success: false, code: 'ERROR', desc: err.message } })
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [api, values, credentials, env])

  if (!api) {
    return <div className="flex items-center justify-center h-full text-gray-400">请从左侧选择一个接口</div>
  }

  return (
    <div className="grid grid-cols-3 gap-4 p-4 h-full">
      {/* Left: Parameter Form */}
      <div className="overflow-auto bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-base font-semibold text-gray-800 mb-1">{api.name}</h2>
        <p className="text-xs text-gray-400 mb-3 font-mono">POST {api.path}</p>
        <ParamForm
          params={api.params}
          values={values}
          onChange={handleParamChange}
          onSubmit={handleSubmit}
          loading={loading}
        />
      </div>

      {/* Middle: Response */}
      <div className="overflow-hidden flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-2 flex-shrink-0">响应结果</h3>
        {loading && (
          <div className="text-sm text-blue-500 py-2 flex-shrink-0">请求中...</div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ResponseViewer response={response} />
        </div>
      </div>

      {/* Right: API Documentation */}
      <div className="overflow-auto bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <ApiDocPanel api={api} />
      </div>
    </div>
  )
}
