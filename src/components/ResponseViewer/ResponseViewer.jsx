export default function ResponseViewer({ response }) {
  if (!response) {
    return (
      <div className="text-sm text-gray-400 py-8 text-center">
        发送请求后，响应结果将显示在此处
      </div>
    )
  }

  const { httpStatus, duration, data } = response
  const isHttpOk = httpStatus >= 200 && httpStatus < 300
  const isSuccess = data?.success === true
  const codeOk = data?.code === '00000'

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center gap-3 text-sm">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          isHttpOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          HTTP {httpStatus}
        </span>

        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {isSuccess ? '✅ 成功' : '❌ 失败'}
        </span>

        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          codeOk ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>
          code: {data?.code || 'N/A'}
        </span>

        {data?.desc && (
          <span className="text-gray-500 text-xs">{data.desc}</span>
        )}

        <span className="ml-auto text-xs text-gray-400">{duration}ms</span>
      </div>

      {/* Error display */}
      {!isSuccess && data?.desc && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {data.desc}
        </div>
      )}

      {/* JSON display */}
      <div className="relative">
        <pre className="p-3 bg-gray-900 text-gray-100 text-xs rounded overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
        <button
          onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}
          className="absolute top-2 right-2 px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600"
        >
          复制
        </button>
      </div>
    </div>
  )
}
