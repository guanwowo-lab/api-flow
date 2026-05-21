import { useState, useRef } from 'react'
import { useProject } from '../../store/ProjectContext'
import { parseDocument } from '../../engines/docParser'
import { extractApis } from '../../engines/apiExtractor'

export default function DocumentUploader() {
  const { state, dispatch, saveExtract } = useProject()
  const [fileA, setFileA] = useState(null)
  const [fileB, setFileB] = useState(null)
  const [textA, setTextA] = useState('')
  const [textB, setTextB] = useState('')
  const [urlA, setUrlA] = useState('')
  const [urlB, setUrlB] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modeA, setModeA] = useState('file')
  const [modeB, setModeB] = useState('file')
  const fileARef = useRef(null)
  const fileBRef = useRef(null)

  const handleParse = async () => {
    setError('')
    setLoading(true)

    try {
      const results = await Promise.all([
        parseSide('A', fileA, urlA, textA, modeA),
        parseSide('B', fileB, urlB, textB, modeB),
      ])

      for (const { side, apis } of results) {
        await saveExtract(state.project.id, side, apis)
      }

      dispatch({ type: 'SET_VIEW', payload: 'extract' })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function parseSide(side, file, url, rawText, mode) {
    if (mode === 'text' && rawText.trim()) {
      return { side, apis: extractApis(rawText) }
    }

    let input = mode === 'url' ? url : file
    if (!input) return { side, apis: [] }

    const { text } = await parseDocument(input)
    return { side, apis: extractApis(text) }
  }

  const renderSide = (label, side, file, setFile, url, setUrl, text, setText, mode, setMode, fileRef) => (
    <div className="flex-1 p-6 bg-white rounded-lg shadow border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">{label}</h2>

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
          placeholder="粘贴文档内容..."
        />
      )}
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'manage' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 返回
        </button>
        <h1 className="text-xl font-bold">上传文档 — {state.project?.name}</h1>
      </div>

      <div className="flex gap-6 mb-6">
        {renderSide('我方 API 文档', 'A', fileA, setFileA, urlA, setUrlA, textA, setTextA, modeA, setModeA, fileARef)}
        {renderSide('客户 API 文档', 'B', fileB, setFileB, urlB, setUrlB, textB, setTextB, modeB, setModeB, fileBRef)}
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <button
        onClick={handleParse}
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-lg"
      >
        {loading ? '正在解析...' : '开始解析'}
      </button>
    </div>
  )
}
