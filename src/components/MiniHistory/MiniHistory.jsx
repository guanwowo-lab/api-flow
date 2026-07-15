import { useState, useEffect, useCallback } from 'react'

export default function MiniHistory() {
  const [records, setRecords] = useState([])
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/history')
      const data = await res.json()
      setRecords(data.slice(0, 30))
    } catch { setRecords([]) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [load])

  if (records.length === 0) {
    return <div className="text-xs text-gray-400 py-4 text-center">暂无调用记录</div>
  }

  return (
    <>
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-gray-50">
          <tr>
            <th className="text-left p-1.5 border border-gray-200 font-medium text-gray-600 w-8">#</th>
            <th className="text-left p-1.5 border border-gray-200 font-medium text-gray-600 w-10">结果</th>
            <th className="text-left p-1.5 border border-gray-200 font-medium text-gray-600">响应码</th>
            <th className="text-left p-1.5 border border-gray-200 font-medium text-gray-600 w-12">耗时</th>
            <th className="text-left p-1.5 border border-gray-200 font-medium text-gray-600">时间</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={r.id} className="hover:bg-blue-50 cursor-pointer"
              onClick={() => setDetail(r)}>
              <td className="p-1.5 border border-gray-200 text-gray-400">{i + 1}</td>
              <td className="p-1.5 border border-gray-200">
                <span className={r.pass ? 'text-green-600' : 'text-red-500'}>{r.pass ? '✅' : '❌'}</span>
              </td>
              <td className="p-1.5 border border-gray-200 font-mono text-gray-600">{r.response?.data?.code || '-'}</td>
              <td className="p-1.5 border border-gray-200 text-gray-500">{r.response?.duration || '-'}ms</td>
              <td className="p-1.5 border border-gray-200 text-gray-400">{new Date(r.time).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[800px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-800">
                调用详情 - {detail.apiName || detail.apiId}
              </h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-auto p-4 grid grid-cols-2 gap-4">
              {/* Request */}
              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2">📤 请求参数</h4>
                <pre className="p-2 bg-gray-100 text-gray-800 text-xs rounded overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">
                  {JSON.stringify(detail.requestParams, null, 2)}
                </pre>
              </div>
              {/* Response */}
              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2">
                  📥 响应数据
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${detail.pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {detail.pass ? '通过' : '失败'}
                  </span>
                  <span className="ml-2 text-gray-400">{detail.response?.duration || '-'}ms</span>
                </h4>
                <pre className="p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">
                  {JSON.stringify(detail.response?.data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
