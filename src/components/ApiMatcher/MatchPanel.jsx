import { useState, useEffect, useRef } from 'react'
import { useProject } from '../../store/ProjectContext'
import { getAiConfig } from '../../engines/aiParser'

export default function MatchPanel() {
  const { state, saveMatches, loadApiFolders, dispatch } = useProject()

  // ====== 所有变量声明放在最前面 ======
  const apisB = state.extractB?.apis || []
  const folders = state.apiFolders || []
  const apisA = folders.flatMap((f) => (f.apis || []).map((a) => ({ ...a })))
  const apiKey = (api) => (api?.name || '') + '|||' + (api?.url || '')
  const apiKeyMap = Object.fromEntries(apisA.map((a, i) => [apiKey(a), i]))
  const clientApiKey = (api) => (api?.name || '') + '|||' + (api?.url || '')
  const clientApiMap = Object.fromEntries(apisB.map((a) => [clientApiKey(a), a]))

  const [mappings, setMappings] = useState({})
  const mappingsRef = useRef(mappings)
  mappingsRef.current = mappings
  const [expandedClient, setExpandedClient] = useState(null)

  // 去重：同一 clientParam+paramType 只保留最后一条
  const dedupMappings = (list) => {
    const map = new Map()
    for (const m of list) {
      map.set(m.clientParam + '||' + m.paramType, m)
    }
    return [...map.values()]
  }

  // 当 matches 数据加载完成时同步到本地 state
  useEffect(() => {
    if (state.folder?.id && state.matches) {
      const raw = state.matches
      const loaded = {}
      for (const [ck, list] of Object.entries(raw)) {
        loaded[ck] = dedupMappings(list || [])
        if (loaded[ck].length !== (list || []).length) {
          console.log('[sync] deduped clientKey', ck, 'from', (list || []).length, 'to', loaded[ck].length)
        }
      }
      console.log('[sync] loading mappings, clientApiKeys:', Object.keys(loaded).length)
      setMappings(loaded)
      mappingsRef.current = loaded
      setDirtyClients(new Set())
    }
  }, [state.folder?.id, state.matches])

  const getMapping = (clientKey, paramKey, paramType) => {
    return (mappings[clientKey] || []).find((m) => m.clientParam === paramKey && m.paramType === paramType)
  }

  const [dirtyClients, setDirtyClients] = useState(new Set())
  const remarkCache = useRef({})

  useEffect(() => { loadApiFolders() }, [])

  const setMapping = (clientKey, paramKey, paramType, ourApiIdx, ourParam, status) => {
    const ourApi = apisA[ourApiIdx]
    const ourApiKey = ourApi ? apiKey(ourApi) : ''
    setMappings((prev) => {
      const prevList = prev[clientKey] || []
      const existing = prevList.find((m) => m.clientParam === paramKey && m.paramType === paramType)
      const list = prevList.filter((m) => !(m.clientParam === paramKey && m.paramType === paramType))
      if (status !== 'unset') {
        list.push({ clientParam: paramKey, paramType, ourApiIdx, ourApiKey, ourParam, status, remark: existing?.remark || '' })
      }
      return { ...prev, [clientKey]: list }
    })
    setDirtyClients((prev) => new Set(prev).add(clientKey))
  }

  const clearMappings = (clientKey) => {
    setMappings((prev) => {
      const updated = { ...prev }
      delete updated[clientKey]
      return updated
    })
    setDirtyClients((prev) => new Set(prev).add(clientKey))
  }

  const saveMapping = async (clientKey) => {
    const cache = remarkCache.current
    const currentMappings = mappingsRef.current
    const rawList = (currentMappings[clientKey] || []).map((m) => {
      const cacheKey = `${clientKey}:${m.clientParam}:${m.paramType}`
      if (cache[cacheKey] !== undefined) return { ...m, remark: cache[cacheKey] }
      return m
    })
    const list = dedupMappings(rawList)
    setMappings((prev) => ({ ...prev, [clientKey]: list }))

    console.log('[saveMapping] clientKey:', clientKey, 'list length:', list.length)

    try {
      await saveMatches(state.folder?.id, clientKey, list)
      console.log('[saveMapping] saveMatches succeeded')
    } catch (e) {
      console.error('[saveMapping] saveMatches failed:', e)
      alert('保存失败: ' + (e.message || '未知错误'))
      return
    }
    setDirtyClients((prev) => {
      const next = new Set(prev)
      next.delete(clientKey)
      return next
    })
  }

  const validKeys = (clientKey) => {
    const api = clientApiMap[clientKey]
    if (!api) return new Set()
    return new Set([
      ...flattenParams(api.inputParams || []).map((p) => p._key),
      ...flattenParams(api.outputParams || []).map((p) => p._key),
    ])
  }

  const getMatchStats = (clientKey) => {
    const api = clientApiMap[clientKey]
    const flatIn = flattenParams(api?.inputParams || [])
    const flatOut = flattenParams(api?.outputParams || [])
    const total = flatIn.length + flatOut.length
    const keys = validKeys(clientKey)
    const list = dedupMappings((mappings[clientKey] || []).filter((m) => keys.has(m.clientParam)))
    const matched = list.filter((m) => m.status === 'matched').length
    const missing = list.filter((m) => m.status === 'missing').length
    return { total, matched, missing, unmapped: total - matched - missing }
  }

  const totalMatched = apisB.reduce((sum, api) => {
    const ck = clientApiKey(api)
    const valid = validKeys(ck)
    const deduped = dedupMappings((mappings[ck] || []).filter((m) => valid.has(m.clientParam)))
    return sum + deduped.filter((m) => m.status === 'matched').length
  }, 0)
  const totalParams = apisB.reduce((sum, api) => {
    return sum + flattenParams(api.inputParams || []).length + flattenParams(api.outputParams || []).length
  }, 0)

  const handleContinue = () => {
    dispatch({ type: 'SET_VIEW', payload: 'sequence' })
  }

  const [aiMatchOpen, setAiMatchOpen] = useState(false)
  const [aiMatchLoading, setAiMatchLoading] = useState(false)
  const [aiMatchError, setAiMatchError] = useState('')
  const [aiMatchHint, setAiMatchHint] = useState('')

  const handleAiMatch = async () => {
    setAiMatchLoading(true)
    setAiMatchError('')
    try {
      // 构建我方和客户接口信息
      const ourApis = apisA.map((a, i) => ({
        idx: i, name: a.name, url: a.url, method: a.method,
        inputParams: flattenParams(a.inputParams || []).map((p) => ({ key: p._key, name: p.name, type: p.type, required: p.required, desc: p.description })),
        outputParams: flattenParams(a.outputParams || []).map((p) => ({ key: p._key, name: p.name, type: p.type, desc: p.description })),
      }))
      const clientApis = apisB.map((a) => ({
        key: clientApiKey(a), name: a.name, url: a.url, method: a.method,
        inputParams: flattenParams(a.inputParams || []).map((p) => ({ key: p._key, name: p.name, type: p.type, required: p.required, desc: p.description })),
        outputParams: flattenParams(a.outputParams || []).map((p) => ({ key: p._key, name: p.name, type: p.type, desc: p.description })),
      }))

      const config = getAiConfig()
      const prompt = `你是一个API参数匹配专家。请将客户API的参数映射到我方API的参数。

我方API（可用的接口和字段）：
${JSON.stringify(ourApis, null, 2)}

客户API（需要匹配的接口和字段）：
${JSON.stringify(clientApis, null, 2)}

请为每个客户API的每个参数寻找最佳匹配。返回JSON数组（只返回JSON，不要解释）：
[{
  "clientKey": "客户API的key",
  "paramKey": "参数的key",
  "paramType": "input或output",
  "ourApiIdx": 我方API的idx（找不到填-1）,
  "ourParam": "我方字段名（用key的最后一段，如userInfo.address.city则填city）",
  "status": "matched或missing",
  "remark": "匹配说明"
}]

匹配规则：
1. 根据参数名称、类型、描述的语义相似度来匹配
2. 能匹配到的status填"matched"，找不到的填"missing"
3. ourApiIdx用我方API的idx值
4. 为我方参数列表中确实存在的字段
5. 完整覆盖每个客户参数，不要遗漏
${aiMatchHint ? `\n补充要求：\n${aiMatchHint}` : ''}`

      const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model, max_tokens: 16384, temperature: 0.1, messages: [{ role: 'user', content: prompt }] }),
      })
      if (!resp.ok) throw new Error(`AI请求失败 (${resp.status})`)
      const data = await resp.json()
      const reply = data?.choices?.[0]?.message?.content || ''
      let jsonStr = reply
      const codeBlock = reply.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlock) jsonStr = codeBlock[1]
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
      if (!arrayMatch) throw new Error('AI返回格式异常')
      const suggestions = JSON.parse(arrayMatch[0])

      // 填充映射 — 使用函数更新器合并到最新状态，避免覆盖并发编辑
      let toSave
      setMappings((prev) => {
        const merged = { ...prev }
        for (const s of suggestions) {
          const ck = s.clientKey || `${s.clientIdx}` // 兼容 AI 返回旧格式
          const validIdx = Number.isInteger(s.ourApiIdx) && s.ourApiIdx >= 0 && s.ourApiIdx < apisA.length ? s.ourApiIdx : -1
          const ourA = validIdx >= 0 ? apisA[validIdx] : null
          const list = (merged[ck] || []).filter((m) => !(m.clientParam === s.paramKey && m.paramType === s.paramType))
          list.push({ clientParam: s.paramKey, paramType: s.paramType, ourApiIdx: validIdx, ourApiKey: ourA ? apiKey(ourA) : '', ourParam: s.ourParam || '', status: s.status || 'matched', remark: s.remark || '' })
          merged[ck] = list
        }
        toSave = merged
        return merged
      })
      if (toSave) {
        for (const [ck, list] of Object.entries(toSave)) {
          await saveMatches(state.folder?.id, ck, list)
        }
      }
      setAiMatchOpen(false)
    } catch (e) {
      setAiMatchError(e.message)
    } finally {
      setAiMatchLoading(false)
    }
  }

  const handleExport = () => {
    const rows = [['客户接口名称', '字段名称', '类型', '必传', '字段描述', '映射到我方接口', '映射到字段', '状态', '备注']]

    for (const api of apisB) {
      const ck = clientApiKey(api)
      const list = mappings[ck] || []
      const flatIn = flattenParams(api.inputParams || []).map((p) => ({ ...p, paramType: 'input' }))
      const flatOut = flattenParams(api.outputParams || []).map((p) => ({ ...p, paramType: 'output' }))
      const allParams = [...flatIn, ...flatOut]

      if (allParams.length === 0) {
        rows.push([api.name || '', '', '', '', '', '', '', '', ''])
      } else {
        for (const p of allParams) {
          const m = list.find((x) => x.clientParam === p._key && x.paramType === p.paramType)
          const idx = m?.ourApiKey && apiKeyMap[m.ourApiKey] !== undefined ? apiKeyMap[m.ourApiKey] : (m?.ourApiIdx ?? -1)
          const ourApi = apisA[idx]
          let status = '未匹配'
          if (m?.status === 'matched' && m.ourParam === '__skip') status = '无需匹配'
          else if (m?.status === 'matched' && m.ourParam) status = '已匹配'
          else if (m?.status === 'missing') status = '未匹配'

          const displayName = (p._depth || 0) > 0 ? '  '.repeat(p._depth) + '└ ' + p.name : p.name
          rows.push([
            api.name || '', displayName, p.type || '',
            p.paramType === 'input' ? (p.required ? '是' : '否') : '',
            p.description || '', ourApi?.name || '',
            m?.ourParam === '__skip' ? '无需匹配' : (m?.ourParam || ''), status, m?.remark || '',
          ])
        }
      }
    }

    // 生成 UTF-8 BOM CSV（Excel 可直接打开，无乱码）
    const csvRows = rows.map((r) => r.map((c) => {
      const v = String(c ?? '')
      return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v
    }).join(','))
    const csv = '﻿' + csvRows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${state.project?.name || '匹配结果'}_${state.folder?.name || ''}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto p-6" style={{ maxWidth: '95vw' }}>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'extract' })}
          className="text-gray-500 hover:text-gray-700">&larr; 返回</button>
        <h1 className="text-xl font-bold">API 匹配</h1>
        <button onClick={() => setAiMatchOpen(!aiMatchOpen)} className="text-xs text-purple-600 hover:underline">
          🤖 AI 匹配
        </button>
        <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })} className="text-xs text-gray-500 hover:underline">
          🏠 首页
        </button>
        <button onClick={handleExport} className="text-xs text-green-600 hover:underline ml-auto">
          📥 下载匹配结果
        </button>
        <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'upload' })}
          className="text-xs text-orange-600 hover:underline">🔄 重新解析客户文档</button>
        <span className="text-sm text-gray-400">
          {totalMatched}/{totalParams} 参数已匹配
        </span>
      </div>

      {aiMatchOpen && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-purple-700">🤖 AI 智能匹配</span>
            <button onClick={() => { setAiMatchOpen(false); setAiMatchError('') }} className="text-gray-400 hover:text-gray-600">关闭</button>
          </div>
          <p className="text-gray-500 mb-2">
            AI 会自动分析双方接口参数，将我方API的接口和字段映射到客户API。完成后可在下方查看和调整。
          </p>
          <textarea
            value={aiMatchHint}
            onChange={(e) => setAiMatchHint(e.target.value)}
            className="w-full h-16 px-3 py-2 border border-purple-200 rounded outline-none resize-none text-xs mb-2"
            placeholder="补充提示词（可选），例如：优先匹配字段名完全一致的参数、忽略测试类参数..."
          />
          {aiMatchError && <p className="text-red-500 mb-2">{aiMatchError}</p>}
          <button
            onClick={handleAiMatch}
            disabled={aiMatchLoading}
            className="px-4 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50"
          >
            {aiMatchLoading ? 'AI 匹配中...' : `开始 AI 匹配（${apisB.length}个客户接口 ↔ ${apisA.length}个我方接口）`}
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* 左侧：客户 API 列表 */}
        <div className="flex-[7] bg-white rounded-lg border border-gray-200 p-4 max-h-[80vh] overflow-y-auto">
          <h2 className="font-medium mb-3 text-green-600">客户 API ({apisB.length})</h2>
          {apisB.map((api) => {
            const ck = clientApiKey(api)
            const isOpen = expandedClient === ck
            const stats = getMatchStats(ck)
            return (
              <div key={ck} className="mb-1">
                <button
                  onClick={() => setExpandedClient(isOpen ? null : ck)}
                  className={`w-full text-left text-sm py-1.5 px-2 rounded hover:bg-green-50 ${isOpen ? 'bg-green-50 font-medium' : ''}`}
                >
                  <span className="font-mono text-xs bg-gray-100 px-1 rounded mr-1">{api.method}</span>
                  {api.name || api.url || `接口 (${ck})` }
                  <span className="text-xs ml-2">
                    {stats.total > 0 && (
                      stats.matched === stats.total ? (
                        <span className="text-green-600">{stats.matched}/{stats.total}</span>
                      ) : (
                        <span className="text-red-500 font-medium">{stats.matched}/{stats.total}</span>
                      )
                    )}
                    {stats.missing > 0 && <span className="text-red-400 ml-1">{stats.missing}缺失</span>}
                  </span>
                </button>
                {isOpen && (
                  <>
                    <div className="ml-2 mt-1 mb-1 flex items-center gap-3">
                      <button
                        onClick={() => { if (confirm('确定清除该接口的所有匹配记录？')) clearMappings(ck) }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        清除该接口匹配
                      </button>
                      <button
                        onClick={() => saveMapping(ck)}
                        className={`text-xs px-2 py-0.5 rounded ${dirtyClients.has(ck) ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-400'}`}
                      >
                        {dirtyClients.has(ck) ? '● 保存匹配' : '已保存 ✓'}
                      </button>
                      <BulkMapApi
                        clientKey={ck}
                        apisA={apisA}
                        inputParams={api.inputParams || []}
                        outputParams={api.outputParams || []}
                        onBulkMap={(apiIdx) => {
                          const flatIn = flattenParams(api.inputParams || [])
                          const flatOut = flattenParams(api.outputParams || [])
                          const allP = [...flatIn.map(p => ({...p, paramType: 'input'})), ...flatOut.map(p => ({...p, paramType: 'output'}))]
                          const ourKey = apiKey(apisA[apiIdx])
                          setMappings(prev => {
                            const existing = prev[ck] || []
                            const updated = existing.map(m => {
                              if (allP.some(p => p._key === m.clientParam && p.paramType === m.paramType))
                                return { ...m, ourApiIdx: apiIdx, ourApiKey: ourKey, ourParam: '', remark: m.remark || '' }
                              return m
                            })
                            const missing = allP.filter(p => !existing.some(m => m.clientParam === p._key && m.paramType === p.paramType))
                            const added = missing.map(p => ({ clientParam: p._key, paramType: p.paramType, ourApiIdx: apiIdx, ourApiKey: ourKey, ourParam: '', status: 'unset' }))
                            return { ...prev, [ck]: [...updated, ...added] }
                          })
                          setDirtyClients(prev => new Set(prev).add(ck))
                        }}
                      />
                    </div>
                    <ClientParamMapping
                      clientApi={api}
                      clientKey={ck}
                      apisA={apisA}
                      apiKeyMap={apiKeyMap}
                      getMapping={(key, type) => getMapping(ck, key, type)}
                      setMapping={(key, type, ourApiIdx, ourParam, status) => setMapping(ck, key, type, ourApiIdx, ourParam, status)}
                      remarkCache={remarkCache}
                      onRemarkDirty={() => setDirtyClients((prev) => new Set(prev).add(ck))}
                    />
                  </>
                )}
              </div>
            )
          })}
          {apisB.length === 0 && (
            <p className="text-gray-400 text-sm py-4">暂无客户API，请先上传客户文档</p>
          )}
        </div>

        {/* 右侧：我方 API 参考列表 */}
        <div className="flex-[3] bg-white rounded-lg border border-gray-200 p-4 max-h-[80vh] overflow-y-auto">
          <h2 className="font-medium mb-3 text-blue-600">我方 API ({apisA.length})</h2>
          <p className="text-xs text-gray-400 mb-3">在左侧展开客户API后，为每个参数选择映射到我方哪个接口和字段</p>
          {apisA.map((api, i) => {
            const flatIn = flattenParams(api.inputParams || [])
            const flatOut = flattenParams(api.outputParams || [])
            const total = flatIn.length + flatOut.length
            return (
            <details key={i} className="mb-2 text-sm">
              <summary className="cursor-pointer hover:text-blue-600 py-0.5">
                <span className="font-mono text-xs bg-gray-100 px-1 rounded mr-1">{api.method}</span>
                {api.name || api.url || `接口 #${i + 1}`}
                <span className="text-xs text-gray-400 ml-1">({total} 参数)</span>
              </summary>
              <div className="ml-4 mt-1 text-xs text-gray-500">
                {api.url && <div className="font-mono mb-1">{api.url}</div>}
                {flatIn.length > 0 && (
                  <>
                    <div className="text-gray-400 text-[10px] mb-0.5">输入参数 ({flatIn.length})</div>
                    {flatIn.map((p, j) => (
                      <div key={`in-${j}`} className="flex gap-2 py-0.5" style={{ paddingLeft: (p._depth || 0) * 12 }}>
                        {(p._depth || 0) > 0 && <span className="text-purple-300 shrink-0">{'└ '.repeat(p._depth)}</span>}
                        <span className="font-mono text-blue-600 w-24 shrink-0">{p.name}</span>
                        <span className="text-gray-400 w-14 shrink-0">{p.type}</span>
                        {p.required && <span className="text-red-400 text-[10px] shrink-0">必填</span>}
                        <span className="text-gray-500 truncate">{p.description}</span>
                      </div>
                    ))}
                  </>
                )}
                {flatOut.length > 0 && (
                  <>
                    <div className="text-gray-400 text-[10px] mb-0.5 mt-1">输出参数 ({flatOut.length})</div>
                    {flatOut.map((p, j) => (
                      <div key={`out-${j}`} className="flex gap-2 py-0.5" style={{ paddingLeft: (p._depth || 0) * 12 }}>
                        {(p._depth || 0) > 0 && <span className="text-purple-300 shrink-0">{'└ '.repeat(p._depth)}</span>}
                        <span className="font-mono text-green-600 w-24 shrink-0">{p.name}</span>
                        <span className="text-gray-400 w-14 shrink-0">{p.type}</span>
                        <span className="text-gray-500 truncate">{p.description}</span>
                      </div>
                    ))}
                  </>
                )}
                {total === 0 && <span className="text-gray-300">无参数</span>}
              </div>
            </details>
          )})}
        </div>
      </div>

      <button onClick={handleContinue}
        className="w-full mt-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg">
        继续设计流程图
      </button>
    </div>
  )
}

// ---- 客户参数映射表 ----

function flattenParams(params, depth = 0, parentKey = '') {
  const result = []
  for (let i = 0; i < params.length; i++) {
    const p = params[i]
    const key = parentKey ? `${parentKey}.${p.name}` : p.name
    result.push({ ...p, _depth: depth, _key: key })
    if (p.children && p.children.length > 0) {
      result.push(...flattenParams(p.children, depth + 1, key))
    }
  }
  return result
}

function ClientParamMapping({ clientApi, clientKey, apisA, apiKeyMap, getMapping, setMapping, remarkCache, onRemarkDirty }) {
  const inputParams = clientApi.inputParams || []
  const outputParams = clientApi.outputParams || []
  const flatInput = flattenParams(inputParams)
  const flatOutput = flattenParams(outputParams)

  if (flatInput.length === 0 && flatOutput.length === 0) {
    return <div className="ml-4 mt-2 mb-2 text-xs text-gray-400">该接口无参数</div>
  }

  const renderTable = (params, paramType, fieldsFromApi) => (
    <table className="w-full text-xs mb-3">
      <thead>
        <tr className="text-gray-400 border-b border-green-200">
          <th className="text-left py-1 pr-2" style={{ width: '130px' }}>字段名称</th>
          <th className="text-left py-1 pr-2" style={{ width: '55px' }}>类型</th>
          {paramType === 'input' && <th className="text-center py-1 pr-2" style={{ width: '36px' }}>必传</th>}
          <th className="text-left py-1 pr-2" style={{ minWidth: '100px' }}>字段描述</th>
          <th className="text-left py-1 pr-2" style={{ minWidth: '80px' }}>参数备注</th>
          <th className="text-left py-1 pr-2" style={{ width: '150px' }}>映射到我方接口</th>
          <th className="text-left py-1 pr-2" style={{ width: '130px' }}>映射到字段</th>
          <th className="text-left py-1" style={{ width: '44px' }}>状态</th>
          <th className="text-left py-1 px-1" style={{ width: '300px' }}>匹配备注</th>
        </tr>
      </thead>
      <tbody>
        {params.map((pb, i) => {
          const m = getMapping(pb._key, paramType)
          // 优先用 key 查找正确的 API，防止索引漂移
          let selectedApiIdx = m?.ourApiIdx ?? -1
          if (m?.ourApiKey && apiKeyMap[m.ourApiKey] !== undefined) {
            selectedApiIdx = apiKeyMap[m.ourApiKey]
          }
          const selectedApi = apisA[selectedApiIdx]
          const fields = fieldsFromApi(selectedApi)
          const indent = pb._depth || 0

          return (
            <tr key={`${pb.name}-${i}`} className="border-b border-green-100">
              <td className="py-1 pr-2 font-mono text-green-700 align-top" style={{ paddingLeft: 4 + indent * 14 }}>
                {indent > 0 && <span className="text-purple-300 mr-1">{'└ '.repeat(indent)}</span>}
                {pb.name}
              </td>
              <td className="py-1 pr-2 text-gray-500 align-top">{pb.type}</td>
              {paramType === 'input' && (
                <td className="py-1 pr-2 text-center align-top">
                  {pb.required ? <span className="text-red-500">是</span> : <span className="text-gray-300">否</span>}
                </td>
              )}
              <td className="py-1 pr-2 text-gray-500 align-top break-words" style={{ maxWidth: '150px' }}>{pb.description || '—'}</td>
              <td className="py-1 pr-2 text-gray-500 align-top break-words" style={{ maxWidth: '120px' }}>{pb.remark || '—'}</td>
              <td className="py-1 pr-2 align-top">
                <select
                  value={selectedApiIdx}
                  onChange={(e) => {
                    const val = e.target.value
                    const apiIdx = parseInt(val)
                    if (apiIdx >= 0) setMapping(pb._key, paramType, apiIdx, '', 'matched')
                    else if (val === '__missing') setMapping(pb._key, paramType, -1, '', 'missing')
                    else setMapping(pb._key, paramType, -1, '', 'unset')
                  }}
                  className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value={-1}>-- 选择接口 --</option>
                  {apisA.map((a, ai) => (
                    <option key={ai} value={ai}>{a.name || `接口${ai + 1}`}</option>
                  ))}
                  <option value="__missing" className="text-red-500">标记为缺失</option>
                </select>
              </td>
              <td className="py-1 pr-2 align-top">
                <input
                  type="text"
                  list={`fields-${clientKey}-${paramType}-${pb.name}`}
                  value={m?.ourParam === '__skip' ? '不匹配（跳过）' : (m?.ourParam || '')}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || val === '-- 选择字段 --') setMapping(pb._key, paramType, -1, '', 'unset')
                    else if (val === '不匹配（跳过）') setMapping(pb._key, paramType, selectedApiIdx, '__skip', 'matched')
                    else if (val && selectedApiIdx >= 0) {
                      const match = fields.find((f) => {
                        const label = ((f._depth || 0) > 0 ? '└ '.repeat(f._depth) : '') + f.name + ' (' + f.type + ')'
                        return label === val || f.name === val
                      })
                      if (match) setMapping(pb._key, paramType, selectedApiIdx, match.name, 'matched')
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  disabled={selectedApiIdx < 0}
                  placeholder="搜索字段..."
                  className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100 disabled:text-gray-300"
                />
                <datalist id={`fields-${clientKey}-${paramType}-${pb.name}`}>
                  {fields.map((f) => (
                    <option key={f.name} value={((f._depth || 0) > 0 ? '└ '.repeat(f._depth) : '') + f.name + ' (' + f.type + ')'} />
                  ))}
                  <option value="不匹配（跳过）" />
                </datalist>
              </td>
              <td className="py-1 align-top">
                {m?.status === 'matched' && m.ourParam === '__skip' && <span className="text-gray-400 text-[10px]">—</span>}
                {m?.status === 'matched' && m.ourParam && m.ourParam !== '__skip' && <span className="text-green-600 text-[10px]">✓</span>}
                {m?.status === 'missing' && (
                  <span className="text-red-500 text-[10px] cursor-pointer"
                    onClick={() => setMapping(pb._key, paramType, -1, '', 'unset')}>✗</span>
                )}
                {(!m || m.status === 'unset') && <span className="text-gray-300 text-[10px]">—</span>}
              </td>
              <td className="py-1 px-1 align-top">
                <RemarkInput
                  cacheKey={`${clientKey}:${pb._key}:${paramType}`}
                  initialValue={m?.remark || ''}
                  onCache={(key, val) => {
                    remarkCache.current[key] = val
                    onRemarkDirty()
                  }}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <div className="ml-2 mt-2 mb-3 p-3 bg-green-50 rounded border border-green-200 text-xs">
      <div className="text-gray-500 mb-2 font-mono">{clientApi.method} {clientApi.url}</div>
      {flatInput.length > 0 && (
        <>
          <div className="text-gray-500 font-medium mb-1">输入参数 ({flatInput.length})</div>
          {renderTable(flatInput, 'input', (api) => flattenParams(api?.inputParams || []))}
        </>
      )}
      {flatOutput.length > 0 && (
        <>
          <div className="text-gray-500 font-medium mb-1 mt-2">输出参数 ({flatOutput.length})</div>
          {renderTable(flatOutput, 'output', (api) => flattenParams(api?.outputParams || []))}
        </>
      )}
    </div>
  )
}

function RemarkInput({ cacheKey, initialValue, onCache }) {
  const inputRef = useRef(null)

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={initialValue || ''}
      onChange={() => {
        if (inputRef.current) onCache(cacheKey, inputRef.current.value)
      }}
      className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400"
      placeholder="备注"
    />
  )
}

function BulkMapApi({ clientKey, apisA, onBulkMap }) {
  const [selectedApi, setSelectedApi] = useState(-1)

  const handleBulkMap = () => {
    if (selectedApi < 0) return
    onBulkMap(selectedApi)
  }

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-gray-400">统一映射到：</span>
      <select
        value={selectedApi}
        onChange={(e) => setSelectedApi(parseInt(e.target.value))}
        className="px-1.5 py-0.5 border border-gray-200 rounded text-xs outline-none"
      >
        <option value={-1}>-- 选择接口 --</option>
        {apisA.map((a, ai) => (
          <option key={ai} value={ai}>{a.name || `接口${ai + 1}`}</option>
        ))}
      </select>
      <button
        onClick={handleBulkMap}
        disabled={selectedApi < 0}
        className="px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        应用
      </button>
    </div>
  )
}
