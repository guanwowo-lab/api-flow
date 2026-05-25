import { useState, useEffect, useRef } from 'react'
import { useProject } from '../../store/ProjectContext'

export default function MatchPanel() {
  const { state, saveMatches, loadApiFolders, dispatch } = useProject()

  useEffect(() => { loadApiFolders() }, [])
  const apisB = state.extractB?.apis || []
  // 我方 API 直接从库中读取，保证参数是最新最全的
  const folders = state.apiFolders || []
  const apisA = folders.flatMap((f) => (f.apis || []).map((a) => ({ ...a })))

  // mappings: { [clientApiIdx]: [{ clientParam, ourApiIdx, ourParam, status }] }
  const [mappings, setMappings] = useState(() => {
    if (state.matches?.mappings) return state.matches.mappings
    return {}
  })
  const [expandedClient, setExpandedClient] = useState(null)

  const getMapping = (clientIdx, paramKey, paramType) => {
    return (mappings[clientIdx] || []).find((m) => m.clientParam === paramKey && m.paramType === paramType)
  }

  const [dirtyClients, setDirtyClients] = useState(new Set())
  const remarkCache = useRef({})

  const setMapping = (clientIdx, paramKey, paramType, ourApiIdx, ourParam, status) => {
    const existing = (mappings[clientIdx] || []).find((m) => m.clientParam === paramKey && m.paramType === paramType)
    const list = (mappings[clientIdx] || []).filter((m) => !(m.clientParam === paramKey && m.paramType === paramType))
    if (status !== 'unset') {
      list.push({ clientParam: paramKey, paramType, ourApiIdx, ourParam, status, remark: existing?.remark || '' })
    }
    setMappings((prev) => ({ ...prev, [clientIdx]: list }))
    setDirtyClients((prev) => new Set(prev).add(clientIdx))
  }

  const clearMappings = (clientIdx) => {
    setMappings((prev) => {
      const updated = { ...prev }
      delete updated[clientIdx]
      return updated
    })
    setDirtyClients((prev) => new Set(prev).add(clientIdx))
  }

  const saveMapping = async (clientIdx) => {
    // 合并备注缓存到映射数据
    const cache = remarkCache.current
    const list = (mappings[clientIdx] || []).map((m) => {
      const key = `${clientIdx}:${m.clientParam}:${m.paramType}`
      if (cache[key] !== undefined) return { ...m, remark: cache[key] }
      return m
    })
    const updated = { ...mappings, [clientIdx]: list }
    setMappings(updated)
    await saveMatches(state.project.id, { mappings: updated })
    setDirtyClients((prev) => {
      const next = new Set(prev)
      next.delete(clientIdx)
      return next
    })
  }

  const validKeys = (clientIdx) => {
    const api = apisB[clientIdx]
    if (!api) return new Set()
    return new Set([
      ...flattenParams(api.inputParams || []).map((p) => p._key),
      ...flattenParams(api.outputParams || []).map((p) => p._key),
    ])
  }

  const getMatchStats = (clientIdx) => {
    const list = (mappings[clientIdx] || []).filter((m) => validKeys(clientIdx).has(m.clientParam))
    const api = apisB[clientIdx]
    const flatIn = flattenParams(api?.inputParams || [])
    const flatOut = flattenParams(api?.outputParams || [])
    const total = flatIn.length + flatOut.length
    const matched = list.filter((m) => m.status === 'matched' && m.ourParam).length
    const missing = list.filter((m) => m.status === 'missing').length
    return { total, matched, missing, unmapped: total - matched - missing }
  }

  const totalMatched = apisB.reduce((sum, _, i) => {
    const valid = validKeys(i)
    return sum + (mappings[i] || []).filter((m) => m.status === 'matched' && m.ourParam && valid.has(m.clientParam)).length
  }, 0)
  const totalParams = apisB.reduce((sum, api) => {
    return sum + flattenParams(api.inputParams || []).length + flattenParams(api.outputParams || []).length
  }, 0)

  const handleContinue = () => {
    dispatch({ type: 'SET_VIEW', payload: 'sequence' })
  }

  return (
    <div className="mx-auto p-6" style={{ maxWidth: '95vw' }}>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'extract' })}
          className="text-gray-500 hover:text-gray-700">&larr; 返回</button>
        <h1 className="text-xl font-bold">API 匹配</h1>
        <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'upload' })}
          className="text-xs text-orange-600 hover:underline ml-auto">🔄 重新解析客户文档</button>
        <span className="text-sm text-gray-400">
          {totalMatched}/{totalParams} 参数已匹配
        </span>
      </div>

      <div className="flex gap-6">
        {/* 左侧：客户 API 列表 */}
        <div className="flex-[7] bg-white rounded-lg border border-gray-200 p-4 max-h-[80vh] overflow-y-auto">
          <h2 className="font-medium mb-3 text-green-600">客户 API ({apisB.length})</h2>
          {apisB.map((api, i) => {
            const isOpen = expandedClient === i
            const stats = getMatchStats(i)
            return (
              <div key={i} className="mb-1">
                <button
                  onClick={() => setExpandedClient(isOpen ? null : i)}
                  className={`w-full text-left text-sm py-1.5 px-2 rounded hover:bg-green-50 ${isOpen ? 'bg-green-50 font-medium' : ''}`}
                >
                  <span className="font-mono text-xs bg-gray-100 px-1 rounded mr-1">{api.method}</span>
                  {api.name || api.url || `接口 #${i + 1}`}
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
                        onClick={() => { if (confirm('确定清除该接口的所有匹配记录？')) clearMappings(i) }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        清除该接口匹配
                      </button>
                      <button
                        onClick={() => saveMapping(i)}
                        className={`text-xs px-2 py-0.5 rounded ${dirtyClients.has(i) ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-400'}`}
                      >
                        {dirtyClients.has(i) ? '● 保存匹配' : '已保存 ✓'}
                      </button>
                      <BulkMapApi
                        clientIdx={i}
                        apisA={apisA}
                        inputParams={api.inputParams || []}
                        outputParams={api.outputParams || []}
                        onBulkMap={(apiIdx) => {
                          const flatIn = flattenParams(api.inputParams || [])
                          const flatOut = flattenParams(api.outputParams || [])
                          const allP = [...flatIn.map(p => ({...p, paramType: 'input'})), ...flatOut.map(p => ({...p, paramType: 'output'}))]
                          const existing = mappings[i] || []
                          const other = existing.filter(m => !allP.some(p => p._key === m.clientParam && p.paramType === m.paramType))
                          const added = allP.map(p => ({ clientParam: p._key, paramType: p.paramType, ourApiIdx: apiIdx, ourParam: '', status: 'matched' }))
                          setMappings(prev => ({ ...prev, [i]: [...other, ...added] }))
                          setDirtyClients(prev => new Set(prev).add(i))
                        }}
                      />
                    </div>
                    <ClientParamMapping
                      clientApi={api}
                      clientIdx={i}
                      apisA={apisA}
                      getMapping={(key, type) => getMapping(i, key, type)}
                      setMapping={(key, type, ourApiIdx, ourParam, status) => setMapping(i, key, type, ourApiIdx, ourParam, status)}
                      remarkCache={remarkCache}
                      onRemarkDirty={() => setDirtyClients((prev) => new Set(prev).add(i))}
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

function ClientParamMapping({ clientApi, clientIdx, apisA, getMapping, setMapping, remarkCache, onRemarkDirty }) {
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
          <th className="text-left py-1 pr-2" style={{ width: '150px' }}>映射到我方接口</th>
          <th className="text-left py-1 pr-2" style={{ width: '130px' }}>映射到字段</th>
          <th className="text-left py-1" style={{ width: '44px' }}>状态</th>
          <th className="text-left py-1 px-1" style={{ width: '300px' }}>备注</th>
        </tr>
      </thead>
      <tbody>
        {params.map((pb, i) => {
          const m = getMapping(pb._key, paramType)
          const selectedApiIdx = m?.ourApiIdx ?? -1
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
                  list={`fields-${clientIdx}-${paramType}-${pb.name}`}
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
                <datalist id={`fields-${clientIdx}-${paramType}-${pb.name}`}>
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
                  cacheKey={`${clientIdx}:${pb._key}:${paramType}`}
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

function BulkMapApi({ clientIdx, apisA, onBulkMap }) {
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
