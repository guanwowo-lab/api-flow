import { useState, useEffect } from 'react'
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

  const getMapping = (clientIdx, paramName, paramType) => {
    return (mappings[clientIdx] || []).find((m) => m.clientParam === paramName && m.paramType === paramType)
  }

  const setMapping = async (clientIdx, paramName, paramType, ourApiIdx, ourParam, status) => {
    const list = (mappings[clientIdx] || []).filter((m) => !(m.clientParam === paramName && m.paramType === paramType))
    if (status !== 'unset') {
      list.push({ clientParam: paramName, paramType, ourApiIdx, ourParam, status })
    }
    const updated = { ...mappings, [clientIdx]: list }
    setMappings(updated)
    await saveMatches(state.project.id, { mappings: updated })
  }

  const countParams = (params) => {
    let count = params.length
    for (const p of params) {
      if (p.children && p.children.length > 0) count += countParams(p.children)
    }
    return count
  }

  const getMatchStats = (clientIdx) => {
    const list = mappings[clientIdx] || []
    const api = apisB[clientIdx]
    const total = countParams(api?.inputParams || []) + countParams(api?.outputParams || [])
    const matched = list.filter((m) => m.status === 'matched').length
    const missing = list.filter((m) => m.status === 'missing').length
    return { total, matched, missing, unmapped: total - matched - missing }
  }

  const totalMatched = apisB.reduce((sum, _, i) => sum + (mappings[i] || []).filter((m) => m.status === 'matched').length, 0)
  const totalParams = apisB.reduce((sum, api) => sum + countParams(api.inputParams || []) + countParams(api.outputParams || []), 0)

  const handleContinue = () => {
    dispatch({ type: 'SET_VIEW', payload: 'sequence' })
  }

  return (
    <div className="max-w-[90vw] mx-auto p-6">
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
        <div className="flex-[3] bg-white rounded-lg border border-gray-200 p-4 max-h-[80vh] overflow-y-auto">
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
                  <ClientParamMapping
                    clientApi={api}
                    clientIdx={i}
                    apisA={apisA}
                    getMapping={(name, type) => getMapping(i, name, type)}
                    setMapping={(name, type, ourApiIdx, ourParam, status) => setMapping(i, name, type, ourApiIdx, ourParam, status)}
                  />
                )}
              </div>
            )
          })}
          {apisB.length === 0 && (
            <p className="text-gray-400 text-sm py-4">暂无客户API，请先上传客户文档</p>
          )}
        </div>

        {/* 右侧：我方 API 参考列表 */}
        <div className="flex-[2] bg-white rounded-lg border border-gray-200 p-4 max-h-[80vh] overflow-y-auto">
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

function flattenParams(params, depth = 0) {
  const result = []
  for (const p of params) {
    result.push({ ...p, _depth: depth })
    if (p.children && p.children.length > 0) {
      result.push(...flattenParams(p.children, depth + 1))
    }
  }
  return result
}

function ClientParamMapping({ clientApi, clientIdx, apisA, getMapping, setMapping }) {
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
        </tr>
      </thead>
      <tbody>
        {params.map((pb, i) => {
          const m = getMapping(pb.name, paramType)
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
                    const apiIdx = parseInt(e.target.value)
                    if (apiIdx >= 0) setMapping(pb.name, paramType, apiIdx, '', 'matched')
                    else if (e.target.value === '__missing') setMapping(pb.name, paramType, -1, '', 'missing')
                    else setMapping(pb.name, paramType, -1, '', 'unset')
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
                <select
                  value={m?.ourParam || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val && selectedApiIdx >= 0) setMapping(pb.name, paramType, selectedApiIdx, val, 'matched')
                  }}
                  disabled={selectedApiIdx < 0}
                  className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100 disabled:text-gray-300"
                >
                  <option value="">-- 选择字段 --</option>
                  {fields.map((f) => (
                    <option key={f.name} value={f.name}>{f.name} ({f.type})</option>
                  ))}
                  <option value="__skip" className="text-gray-500">不匹配（跳过）</option>
                </select>
              </td>
              <td className="py-1 align-top">
                {m?.status === 'matched' && m.ourParam === '__skip' && <span className="text-gray-400 text-[10px]">—</span>}
                {m?.status === 'matched' && m.ourParam && m.ourParam !== '__skip' && <span className="text-green-600 text-[10px]">✓</span>}
                {m?.status === 'missing' && (
                  <span className="text-red-500 text-[10px] cursor-pointer"
                    onClick={() => setMapping(pb.name, paramType, -1, '', 'unset')}>✗</span>
                )}
                {(!m || m.status === 'unset') && <span className="text-gray-300 text-[10px]">—</span>}
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
          {renderTable(flatInput, 'input', (api) => api?.inputParams || [])}
        </>
      )}
      {flatOutput.length > 0 && (
        <>
          <div className="text-gray-500 font-medium mb-1 mt-2">输出参数 ({flatOutput.length})</div>
          {renderTable(flatOutput, 'output', (api) => api?.outputParams || [])}
        </>
      )}
    </div>
  )
}
