import { useState, useEffect, useCallback } from 'react'

export default function History({ apis }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ apiId: '', pass: '' })
  const [expanded, setExpanded] = useState(null)
  const [selected, setSelected] = useState(new Set())

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.apiId) params.set('apiId', filters.apiId)
      if (filters.pass) params.set('pass', filters.pass)
      const res = await fetch(`http://localhost:3001/api/history?${params}`)
      const data = await res.json()
      setRecords(data)
    } catch { setRecords([]) }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { loadHistory() }, [loadHistory])

  const handleDelete = async (id) => {
    await fetch(`http://localhost:3001/api/history/${id}`, { method: 'DELETE' })
    loadHistory()
  }

  const handleExport = async () => {
    const ids = selected.size > 0 ? [...selected] : records.map(r => r.id)
    const all = records.filter(r => ids.includes(r.id))
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `api-test-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReplay = (record) => {
    // Store replay data in sessionStorage for the test page to pick up
    sessionStorage.setItem('apitester_replay', JSON.stringify({
      apiId: record.apiId,
      params: record.requestParams,
    }))
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'apiTest' } }))
  }

  const toggleSelect = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const formatTime = (ts) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filters.apiId}
          onChange={e => setFilters(f => ({ ...f, apiId: e.target.value }))}
          className="px-2 py-1 text-sm border border-gray-300 rounded"
        >
          <option value="">全部接口</option>
          {apis.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <select
          value={filters.pass}
          onChange={e => setFilters(f => ({ ...f, pass: e.target.value }))}
          className="px-2 py-1 text-sm border border-gray-300 rounded"
        >
          <option value="">全部结果</option>
          <option value="true">通过</option>
          <option value="false">失败</option>
        </select>

        <button onClick={loadHistory} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">刷新</button>

        <div className="ml-auto flex gap-2">
          <button onClick={handleExport} className="px-3 py-1 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">
            导出 {selected.size > 0 ? `选中(${selected.size})` : '全部'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center text-gray-400 py-8">加载中...</div>
        ) : records.length === 0 ? (
          <div className="text-center text-gray-400 py-8">暂无测试记录</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="p-2 w-8"><input type="checkbox" onChange={e => {
                  if (e.target.checked) setSelected(new Set(records.map(r => r.id)))
                  else setSelected(new Set())
                }} /></th>
                <th className="p-2 w-10">结果</th>
                <th className="p-2">接口</th>
                <th className="p-2 w-20">耗时</th>
                <th className="p-2 w-40">时间</th>
                <th className="p-2 w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <>
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-2">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                    </td>
                    <td className="p-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${r.pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {r.pass ? '✅' : '❌'}
                      </span>
                    </td>
                    <td className="p-2 font-medium text-gray-700">{r.apiName || r.apiId}</td>
                    <td className="p-2 text-gray-500">{r.response?.duration || '-'}ms</td>
                    <td className="p-2 text-gray-500 text-xs">{formatTime(r.time)}</td>
                    <td className="p-2">
                      <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-blue-600 hover:underline mr-2">查看</button>
                      <button onClick={() => handleReplay(r)} className="text-blue-600 hover:underline mr-2">重放</button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:underline">删除</button>
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr key={`${r.id}-detail`}>
                      <td colSpan={6} className="p-4 bg-gray-50">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <h4 className="font-semibold text-gray-600 mb-1">请求参数</h4>
                            <pre className="bg-gray-900 text-gray-100 p-2 rounded overflow-auto max-h-64">
                              {JSON.stringify(r.requestParams, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-600 mb-1">响应数据</h4>
                            <pre className="bg-gray-900 text-gray-100 p-2 rounded overflow-auto max-h-64">
                              {JSON.stringify(r.response?.data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
