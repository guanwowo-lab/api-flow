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

  const getMapping = (clientIdx, paramName) => {
    return (mappings[clientIdx] || []).find((m) => m.clientParam === paramName)
  }

  const setMapping = async (clientIdx, paramName, ourApiIdx, ourParam, status) => {
    const list = (mappings[clientIdx] || []).filter((m) => m.clientParam !== paramName)
    if (status !== 'unset') {
      list.push({ clientParam: paramName, ourApiIdx, ourParam, status })
    }
    const updated = { ...mappings, [clientIdx]: list }
    setMappings(updated)
    await saveMatches(state.project.id, { mappings: updated })
  }

  const getMatchStats = (clientIdx) => {
    const list = mappings[clientIdx] || []
    const total = (apisB[clientIdx]?.inputParams || []).length
    const matched = list.filter((m) => m.status === 'matched').length
    const missing = list.filter((m) => m.status === 'missing').length
    return { total, matched, missing, unmapped: total - matched - missing }
  }

  // 统计所有客户API的匹配情况
  const totalMatched = apisB.reduce((sum, _, i) => sum + (mappings[i] || []).filter((m) => m.status === 'matched').length, 0)
  const totalParams = apisB.reduce((sum, api) => sum + (api.inputParams || []).length, 0)

  const handleContinue = () => {
    dispatch({ type: 'SET_VIEW', payload: 'sequence' })
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
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
        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 max-h-[80vh] overflow-y-auto">
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
                    mappings={mappings[i] || []}
                    getMapping={(name) => getMapping(i, name)}
                    setMapping={(name, ourApiIdx, ourParam, status) => setMapping(i, name, ourApiIdx, ourParam, status)}
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
        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 max-h-[80vh] overflow-y-auto">
          <h2 className="font-medium mb-3 text-blue-600">我方 API ({apisA.length})</h2>
          <p className="text-xs text-gray-400 mb-3">在左侧展开客户API后，为每个参数选择映射到我方哪个接口和字段</p>
          {apisA.map((api, i) => (
            <details key={i} className="mb-2 text-sm">
              <summary className="cursor-pointer hover:text-blue-600 py-0.5">
                <span className="font-mono text-xs bg-gray-100 px-1 rounded mr-1">{api.method}</span>
                {api.name || api.url || `接口 #${i + 1}`}
                <span className="text-xs text-gray-400 ml-1">({(api.inputParams || []).length} 参数)</span>
              </summary>
              <div className="ml-4 mt-1 text-xs text-gray-500">
                {api.url && <div className="font-mono mb-1">{api.url}</div>}
                {(api.inputParams || []).map((p) => (
                  <div key={p.name} className="flex gap-2 py-0.5">
                    <span className="font-mono text-blue-600 w-28 shrink-0">{p.name}</span>
                    <span className="text-gray-400 w-16 shrink-0">{p.type}</span>
                    <span className="text-gray-500 truncate">{p.description}</span>
                  </div>
                ))}
                {(api.inputParams || []).length === 0 && <span className="text-gray-300">无参数</span>}
              </div>
            </details>
          ))}
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

function ClientParamMapping({ clientApi, clientIdx, apisA, mappings, getMapping, setMapping }) {
  const inputParams = clientApi.inputParams || []

  if (inputParams.length === 0) {
    return <div className="ml-4 mt-2 mb-2 text-xs text-gray-400">该接口无输入参数</div>
  }

  return (
    <div className="ml-2 mt-2 mb-3 p-3 bg-green-50 rounded border border-green-200 text-xs">
      <div className="text-gray-500 mb-2 font-mono">{clientApi.method} {clientApi.url}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-green-200">
            <th className="text-left py-1 pr-2 w-[90px]">客户字段</th>
            <th className="text-left py-1 pr-2 w-[60px]">类型</th>
            <th className="text-center py-1 pr-2 w-[36px]">必传</th>
            <th className="text-left py-1 pr-2 w-[160px]">映射到我方接口</th>
            <th className="text-left py-1 pr-2 w-[130px]">映射到字段</th>
            <th className="text-left py-1 w-[50px]">状态</th>
          </tr>
        </thead>
        <tbody>
          {inputParams.map((pb) => {
            const m = getMapping(pb.name)
            const selectedApiIdx = m?.ourApiIdx ?? -1
            const selectedApi = apisA[selectedApiIdx]
            const fields = selectedApi?.inputParams || []

            return (
              <tr key={pb.name} className="border-b border-green-100">
                <td className="py-1 pr-2 font-mono text-green-700 align-top">{pb.name}</td>
                <td className="py-1 pr-2 text-gray-500 align-top">{pb.type}</td>
                <td className="py-1 pr-2 text-center align-top">
                  {pb.required ? <span className="text-red-500">是</span> : <span className="text-gray-300">否</span>}
                </td>
                <td className="py-1 pr-2 align-top">
                  <select
                    value={selectedApiIdx}
                    onChange={(e) => {
                      const apiIdx = parseInt(e.target.value)
                      if (apiIdx >= 0) {
                        setMapping(pb.name, apiIdx, '', 'matched')
                      } else if (e.target.value === '__missing') {
                        setMapping(pb.name, -1, '', 'missing')
                      } else {
                        setMapping(pb.name, -1, '', 'unset')
                      }
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
                      if (val && selectedApiIdx >= 0) {
                        setMapping(pb.name, selectedApiIdx, val, 'matched')
                      }
                    }}
                    disabled={selectedApiIdx < 0}
                    className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100 disabled:text-gray-300"
                  >
                    <option value="">-- 选择字段 --</option>
                    {fields.map((f) => (
                      <option key={f.name} value={f.name}>{f.name} ({f.type})</option>
                    ))}
                  </select>
                </td>
                <td className="py-1 align-top">
                  {m?.status === 'matched' && m.ourParam && (
                    <span className="text-green-600 text-[10px]">✓</span>
                  )}
                  {m?.status === 'missing' && (
                    <span className="text-red-500 text-[10px] cursor-pointer"
                      onClick={() => setMapping(pb.name, -1, '', 'unset')}>✗</span>
                  )}
                  {(!m || m.status === 'unset') && <span className="text-gray-300 text-[10px]">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
