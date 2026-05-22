import { useState, useMemo } from 'react'
import { useProject } from '../../store/ProjectContext'
import { computeMatches } from '../../engines/matchEngine'

export default function MatchPanel() {
  const { state, saveMatches, dispatch } = useProject()
  const apisA = state.extractA?.apis || []
  const apisB = state.extractB?.apis || []

  const recommendations = useMemo(
    () => computeMatches(apisA, apisB, 0.35),
    [apisA, apisB]
  )

  const [expandedApi, setExpandedApi] = useState(null)
  const [expandedMapping, setExpandedMapping] = useState(null) // pair index

  const [pairs, setPairs] = useState(() => {
    if (state.matches?.pairs) return state.matches.pairs
    return recommendations.map((r) => ({
      apiAIndex: apisA.indexOf(r.apiA),
      apiBIndex: apisB.indexOf(r.apiB),
      score: r.score,
      confirmed: false,
      paramMappings: [],
    }))
  })

  const toggleConfirm = (idx) => {
    const updated = pairs.map((p, i) =>
      i === idx ? { ...p, confirmed: !p.confirmed } : p
    )
    setPairs(updated)
  }

  const addPair = () => {
    setPairs([...pairs, { apiAIndex: -1, apiBIndex: -1, score: 0, confirmed: false, paramMappings: [] }])
  }

  const updatePair = (idx, field, value) => {
    const updated = pairs.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    setPairs(updated)
  }

  const deletePair = (idx) => {
    setPairs(pairs.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    await saveMatches(state.project.id, pairs)
  }

  const handleContinue = async () => {
    await saveMatches(state.project.id, pairs)
    dispatch({ type: 'SET_VIEW', payload: 'sequence' })
  }

  const getScoreColor = (score) => {
    if (score >= 0.7) return 'text-green-600'
    if (score >= 0.5) return 'text-yellow-600'
    return 'text-gray-400'
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'extract' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 返回
        </button>
        <h1 className="text-xl font-bold">API 匹配</h1>
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'upload' })}
          className="text-xs text-orange-600 hover:underline ml-auto"
        >
          🔄 重新解析客户文档
        </button>
        <span className="text-sm text-gray-400">
          推荐 {recommendations.length} 对匹配 | 已确认 {pairs.filter((p) => p.confirmed).length}
        </span>
      </div>

      <div className="flex gap-6 mb-6">
        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 max-h-[70vh] overflow-y-auto">
          <h2 className="font-medium mb-3 text-green-600">客户 API</h2>
          {apisB.map((api, i) => {
            const isOpen = expandedApi?.side === 'B' && expandedApi?.index === i
            return (
              <div key={i}>
                <button
                  onClick={() => setExpandedApi(isOpen ? null : { side: 'B', index: i })}
                  className={`w-full text-left text-sm py-1 px-2 rounded hover:bg-green-50 ${isOpen ? 'bg-green-50 font-medium' : ''}`}
                >
                  <span className="font-mono text-xs bg-gray-100 px-1 rounded mr-1">{api.method}</span>
                  {api.name || api.url || `接口 #${i + 1}`}
                </button>
                {isOpen && <ApiDetail api={api} />}
              </div>
            )
          })}
        </div>

        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 max-h-[70vh] overflow-y-auto">
          <h2 className="font-medium mb-3 text-blue-600">我方 API</h2>
          {apisA.map((api, i) => {
            const isOpen = expandedApi?.side === 'A' && expandedApi?.index === i
            return (
              <div key={i}>
                <button
                  onClick={() => setExpandedApi(isOpen ? null : { side: 'A', index: i })}
                  className={`w-full text-left text-sm py-1 px-2 rounded hover:bg-blue-50 ${isOpen ? 'bg-blue-50 font-medium' : ''}`}
                >
                  <span className="font-mono text-xs bg-gray-100 px-1 rounded mr-1">{api.method}</span>
                  {api.name || api.url || `接口 #${i + 1}`}
                </button>
                {isOpen && <ApiDetail api={api} />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium">匹配关系</h2>
        <button onClick={addPair} className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
          + 手动添加匹配
        </button>
      </div>

      <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto">
        {pairs.map((pair, i) => {
          const apiA = apisA[pair.apiAIndex]
          const apiB = apisB[pair.apiBIndex]
          return (
            <div key={i}>
              <div
                className={`flex items-center gap-3 p-3 rounded-lg border ${pair.confirmed ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}
              >
              <select
                value={pair.apiBIndex}
                onChange={(e) => updatePair(i, 'apiBIndex', parseInt(e.target.value))}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm outline-none"
              >
                <option value={-1}>-- 选择客户接口 --</option>
                {apisB.map((b, bi) => (
                  <option key={bi} value={bi}>{b.name || b.url || `#${bi + 1}`}</option>
                ))}
              </select>

              <span className="text-gray-300">&harr;</span>

              <select
                value={pair.apiAIndex}
                onChange={(e) => updatePair(i, 'apiAIndex', parseInt(e.target.value))}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm outline-none"
              >
                <option value={-1}>-- 选择我方接口 --</option>
                {apisA.map((a, ai) => (
                  <option key={ai} value={ai}>{a.name || a.url || `#${ai + 1}`}</option>
                ))}
              </select>

              {pair.score > 0 && (
                <span className={`text-xs font-mono ${getScoreColor(pair.score)}`}>
                  {(pair.score * 100).toFixed(0)}%
                </span>
              )}

              <button
                onClick={() => toggleConfirm(i)}
                className={`px-2 py-1 rounded text-xs ${pair.confirmed ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
              >
                {pair.confirmed ? '已确认' : '确认'}
              </button>

              <button onClick={() => deletePair(i)} className="text-red-400 hover:text-red-600 text-sm">&times;</button>
            </div>
            {pair.confirmed && (
              <div className="mt-2 pl-2 border-l-2 border-green-300">
                <button
                  onClick={() => setExpandedMapping(expandedMapping === i ? null : i)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {expandedMapping === i ? '收起参数映射' : '展开参数映射'}
                </button>
                {(() => {
                  const mappings = pair.paramMappings || []
                  const matched = mappings.filter((m) => m.status === 'matched').length
                  const markedMissing = mappings.filter((m) => m.status === 'missing').length
                  const total = (apisB[pair.apiBIndex]?.inputParams || []).length
                  const missing = total - matched
                  return (
                    <span className="text-xs text-gray-400 ml-2">
                      <span className="text-green-600">{matched} 已匹配</span>
                      <span className="text-gray-300"> | </span>
                      {missing > 0 ? (
                        <span className="text-red-500">{missing} 未匹配</span>
                      ) : (
                        <span className="text-green-600">全部匹配</span>
                      )}
                      <span className="text-gray-300"> | </span>
                      <span>共 {total} 参数</span>
                    </span>
                  )
                })()}
                {expandedMapping === i && (
                  <ParamMapping
                    pair={pair}
                    pairIndex={i}
                    apisA={apisA}
                    apisB={apisB}
                    onChange={(mappings) => updatePair(i, 'paramMappings', mappings)}
                  />
                )}
              </div>
            )}
          </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={handleSave} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          保存
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg"
        >
          继续设计流程图
        </button>
      </div>
    </div>
  )
}

function ApiDetail({ api }) {
  const inputParams = api.inputParams || []
  const outputParams = api.outputParams || []

  return (
    <div className="ml-2 mt-1 mb-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs overflow-x-auto">
      {api.url && (
        <div className="text-gray-500 font-mono mb-2">{api.method} {api.url}</div>
      )}
      {inputParams.length > 0 && (
        <div className="mb-2">
          <div className="text-gray-400 mb-1 font-medium">输入参数 ({inputParams.length})</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-200">
                <th className="text-left py-1 pr-2 w-[100px]">字段名称</th>
                <th className="text-left py-1 pr-2 w-[80px]">数据类型</th>
                <th className="text-center py-1 pr-2 w-[44px]">必传</th>
                <th className="text-left py-1 pr-2 min-w-[120px]">字段描述</th>
                <th className="text-left py-1">备注</th>
              </tr>
            </thead>
            <tbody>
              {inputParams.map((p, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 pr-2 font-mono text-blue-700 align-top">{p.name || '—'}</td>
                  <td className="py-1 pr-2 text-gray-500 align-top">{p.type || '—'}</td>
                  <td className="py-1 pr-2 text-center align-top">
                    {p.required ? <span className="text-red-500">是</span> : <span className="text-gray-300">否</span>}
                  </td>
                  <td className="py-1 pr-2 text-gray-600 align-top break-words">{p.description || '—'}</td>
                  <td className="py-1 text-gray-400 align-top break-words max-w-[200px]">{p.remark || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {outputParams.length > 0 && (
        <div>
          <div className="text-gray-400 mb-1 font-medium">输出参数 ({outputParams.length})</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-200">
                <th className="text-left py-1 pr-2 w-[100px]">字段名称</th>
                <th className="text-left py-1 pr-2 w-[80px]">数据类型</th>
                <th className="text-left py-1 pr-2 min-w-[120px]">字段描述</th>
                <th className="text-left py-1">备注</th>
              </tr>
            </thead>
            <tbody>
              {outputParams.map((p, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 pr-2 font-mono text-green-700 align-top">{p.name || '—'}</td>
                  <td className="py-1 pr-2 text-gray-500 align-top">{p.type || '—'}</td>
                  <td className="py-1 pr-2 text-gray-600 align-top break-words">{p.description || '—'}</td>
                  <td className="py-1 text-gray-400 align-top break-words max-w-[200px]">{p.remark || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {inputParams.length === 0 && outputParams.length === 0 && (
        <div className="text-gray-400">暂无参数信息</div>
      )}
    </div>
  )
}

// ---- 参数级映射 ----

function ParamMapping({ pair, pairIndex, apisA, apisB, onChange }) {
  const apiA = apisA[pair.apiAIndex]
  const apiB = apisB[pair.apiBIndex]
  const inputB = apiB?.inputParams || []
  const inputA = apiA?.inputParams || []
  const mappings = pair.paramMappings || []

  const getMapping = (paramBName) => mappings.find((m) => m.paramB === paramBName)

  const setMapping = (paramBName, paramAName, status) => {
    const updated = mappings.filter((m) => m.paramB !== paramBName)
    if (status !== 'unset') {
      updated.push({ paramB: paramBName, paramA: paramAName, status })
    }
    onChange(updated)
  }

  const autoSuggest = (paramBName) => {
    const bLower = paramBName.toLowerCase()
    return inputA
      .map((a) => ({ name: a.name, score: similarity(bLower, (a.name || '').toLowerCase()) }))
      .filter((c) => c.score > 0.4)
      .sort((a, b) => b.score - a.score)
  }

  if (!apiA || !apiB) return <div className="text-xs text-gray-400 mt-2">请先选择双方接口</div>
  if (inputB.length === 0) return <div className="text-xs text-gray-400 mt-2">客户接口无输入参数</div>

  const matchedCount = mappings.filter((m) => m.status === 'matched').length
  const missingCount = mappings.filter((m) => m.status === 'missing').length

  return (
    <div className="mt-2 p-3 bg-white rounded border border-gray-200 text-xs">
      <div className="flex items-center gap-4 mb-2">
        <span className="font-medium text-gray-600">参数映射</span>
        <span className="text-green-600">已匹配 {matchedCount}</span>
        {missingCount > 0 && <span className="text-red-500">缺失 {missingCount}</span>}
        <span className="text-gray-300">|</span>
        <span className="text-gray-400">{apiB.name || '未命名'} → {apiA.name || '未命名'}</span>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-gray-200">
            <th className="text-left py-1 pr-2 w-[100px]">客户字段</th>
            <th className="text-left py-1 pr-2 w-[80px]">类型</th>
            <th className="text-left py-1 pr-2 w-[44px]">必传</th>
            <th className="text-left py-1 pr-2 min-w-[120px]">映射到我方字段</th>
            <th className="text-left py-1 w-[60px]">状态</th>
          </tr>
        </thead>
        <tbody>
          {inputB.map((pb) => {
            const mapping = getMapping(pb.name)
            const suggestions = autoSuggest(pb.name)
            const status = mapping?.status || 'unset'

            return (
              <tr key={pb.name} className="border-b border-gray-100">
                <td className="py-1 pr-2 font-mono text-blue-700 align-top">{pb.name}</td>
                <td className="py-1 pr-2 text-gray-500 align-top">{pb.type}</td>
                <td className="py-1 pr-2 text-center align-top">
                  {pb.required ? <span className="text-red-500">是</span> : <span className="text-gray-300">否</span>}
                </td>
                <td className="py-1 pr-2 align-top">
                  <select
                    value={mapping?.paramA || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '__missing') setMapping(pb.name, '', 'missing')
                      else if (val === '') setMapping(pb.name, '', 'unset')
                      else setMapping(pb.name, val, 'matched')
                    }}
                    className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">-- 选择 --</option>
                    {inputA.map((pa) => (
                      <option key={pa.name} value={pa.name}>
                        {pa.name} ({pa.type})
                      </option>
                    ))}
                    <option value="__missing" className="text-red-500">标记为缺失</option>
                  </select>
                  {suggestions.length > 0 && !mapping && (
                    <div className="text-[10px] text-purple-400 mt-0.5">
                      建议：{suggestions.slice(0, 2).map((s) => s.name).join(', ')}
                    </div>
                  )}
                </td>
                <td className="py-1 align-top">
                  {status === 'matched' && <span className="text-green-600 text-[10px]">✓ 已匹配</span>}
                  {status === 'missing' && (
                    <span className="text-red-500 text-[10px] cursor-pointer"
                      onClick={() => setMapping(pb.name, '', 'unset')}>✗ 缺失</span>
                  )}
                  {status === 'unset' && <span className="text-gray-300 text-[10px]">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function similarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.8
  const wordsA = new Set(a.split(/[\s_\-]+/))
  const wordsB = new Set(b.split(/[\s_\-]+/))
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return union > 0 ? intersection / union : 0
}
