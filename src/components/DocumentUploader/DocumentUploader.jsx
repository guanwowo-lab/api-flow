import { useState, useRef } from 'react'
import { useProject } from '../../store/ProjectContext'
import { parseDocument } from '../../engines/docParser'
import { extractApis } from '../../engines/apiExtractor'

export default function DocumentUploader() {
  const { state, dispatch, saveExtract } = useProject()
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('file')
  const fileRef = useRef(null)

  const apisA = state.extractA?.apis || []

  const handleParse = async () => {
    setError('')
    setLoading(true)

    try {
      let apisB = []

      if (mode === 'text' && text.trim()) {
        apisB = extractApis(text)
      } else {
        const input = mode === 'url' ? url : file
        if (input) {
          const { text: docText } = await parseDocument(input)
          apisB = extractApis(docText)
        }
      }

      await saveExtract(state.project.id, 'B', apisB)
      dispatch({ type: 'SET_VIEW', payload: 'extract' })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projects' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 项目列表
        </button>
        <h1 className="text-xl font-bold">上传客户文档 — {state.project?.name}</h1>
      </div>

      {apisA.length > 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 text-sm text-green-700 flex items-center justify-between">
          <span>我方接口已就绪（{apisA.length} 个），将直接用于匹配。</span>
          <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'manage' })}
            className="text-blue-600 underline text-xs">
            管理我方接口 &rarr;
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-700">
          尚未配置我方接口，请先
          <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'manage' })}
            className="text-blue-600 underline">
            进入 API 管理
          </button> 从库中导入。
        </div>
      )}

      <div className="p-6 bg-white rounded-lg shadow border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold mb-4">客户 API 文档</h2>

        <div className="flex gap-2 mb-4">
          {['file', 'url', 'text'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded text-sm ${mode === m ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
            >
              {m === 'file' ? '文件' : m === 'url' ? '链接' : '粘贴'}
            </button>
          ))}
        </div>

        {mode === 'file' && (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }}
          >
            {file ? (
              <p className="text-green-600">{file.name}</p>
            ) : (
              <p className="text-gray-400">拖拽文件到此处，或点击选择<br /><span className="text-xs">支持 .docx / .pdf</span></p>
            )}
            <input ref={fileRef} type="file" accept=".docx,.pdf" className="hidden"
              onChange={(e) => setFile(e.target.files[0])} />
          </div>
        )}

        {mode === 'url' && (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://..."
          />
        )}

        {mode === 'text' && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="粘贴客户文档内容..."
          />
        )}
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <button
        onClick={handleParse}
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-lg"
      >
        {loading ? '正在解析...' : '开始解析客户文档'}
      </button>
    </div>
  )
}
