import { useState, useMemo, useCallback, useEffect } from 'react'
import ParamForm from '../../components/ParamForm/ParamForm'
import ResponseViewer from '../../components/ResponseViewer/ResponseViewer'

const LOCAL_PROXY = '/api/proxy'

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
