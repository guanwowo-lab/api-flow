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

  const [expandedApi, setExpandedApi] = useState(null) // { side: 'A'|'B', index: number }

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
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg border ${pair.confirmed ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}
            >
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

              <span className="text-gray-300">&harr;</span>

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
    <div className="ml-4 mt-1 mb-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs">
      {api.url && (
        <div className="text-gray-500 font-mono mb-1">{api.method} {api.url}</div>
      )}
      {inputParams.length > 0 && (
        <div className="mb-1">
          <div className="text-gray-400 mb-0.5">输入参数 ({inputParams.length})：</div>
          {inputParams.map((p, i) => (
            <div key={i} className="ml-3 py-0.5 flex gap-2">
              <span className="font-mono text-blue-600">{p.name}</span>
              <span className="text-gray-400">{p.type}</span>
              {p.required && <span className="text-red-400 text-[10px]">必填</span>}
              <span className="text-gray-500">{p.description}</span>
              {p.remark && <span className="text-gray-300 text-[10px]">{p.remark}</span>}
            </div>
          ))}
        </div>
      )}
      {outputParams.length > 0 && (
        <div>
          <div className="text-gray-400 mb-0.5">输出参数 ({outputParams.length})：</div>
          {outputParams.map((p, i) => (
            <div key={i} className="ml-3 py-0.5 flex gap-2">
              <span className="font-mono text-green-600">{p.name}</span>
              <span className="text-gray-400">{p.type}</span>
              <span className="text-gray-500">{p.description}</span>
              {p.remark && <span className="text-gray-300 text-[10px]">{p.remark}</span>}
            </div>
          ))}
        </div>
      )}
      {inputParams.length === 0 && outputParams.length === 0 && (
        <div className="text-gray-400">暂无参数信息</div>
      )}
    </div>
  )
}
