import { useState, useMemo } from 'react'

const MAX_CHARS = 50000

export default function ResponseViewer({ response }) {
  const [showFull, setShowFull] = useState(false)

  const httpStatus = response?.httpStatus
  const duration = response?.duration
  const data = response?.data
  const isHttpOk = httpStatus >= 200 && httpStatus < 300
  const isSuccess = data?.success === true
  const codeOk = data?.code === '00000'

  const { displayJson, totalChars, isTruncated } = useMemo(() => {
    if (!data) return { displayJson: '', totalChars: 0, isTruncated: false }
    const full = JSON.stringify(data, null, 2)
    if (full.length <= MAX_CHARS || showFull) {
      return { displayJson: full, totalChars: full.length, isTruncated: full.length > MAX_CHARS }
    }
    return { displayJson: full.slice(0, MAX_CHARS) + '\n...', totalChars: full.length, isTruncated: true }
  }, [data, showFull])

  if (!response) {
    return (
      <div className="text-sm text-gray-400 py-8 text-center">
        发送请求后，响应结果将显示在此处
      </div>
    )
  }

  const sizeLabel = totalChars > 1000000
    ? `${(totalChars / 1000000).toFixed(1)} MB`
    : totalChars > 1000
      ? `${(totalChars / 1000).toFixed(1)} KB`
      : `${totalChars} 字符`

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `api-response-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = () => {
    if (isTruncated && !showFull) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    } else {
      navigator.clipboard.writeText(displayJson)
    }
  }

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Status bar */}
      <div className="flex items-center gap-3 text-sm flex-wrap">
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

        <span className="text-xs text-gray-400">{sizeLabel}</span>
        <span className="ml-auto text-xs text-gray-400">{duration != null ? `${duration}ms` : ''}</span>
      </div>

      {/* Error display */}
      {!isSuccess && (data?.desc || response.desc) && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {data?.desc || response.desc}
        </div>
      )}

      {/* Large response warning */}
      {isTruncated && !showFull && (
        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 flex items-center gap-2">
          响应数据较大（{sizeLabel}），已截断显示前{MAX_CHARS.toLocaleString()}字符以保持页面流畅。
          <button onClick={() => setShowFull(true)} className="underline font-medium hover:text-yellow-800">显示全部</button>
        </div>
      )}

      {/* JSON display */}
      <div className="relative">
        <pre className="p-3 bg-gray-900 text-gray-100 text-xs rounded overflow-auto flex-1 min-h-0 whitespace-pre-wrap break-all">
          {displayJson}
        </pre>
        <div className="absolute top-2 right-2 flex gap-1">
          <button onClick={handleDownload} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600">
            下载
          </button>
          <button onClick={handleCopy} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600">
            复制
          </button>
        </div>
      </div>
    </div>
  )
}
