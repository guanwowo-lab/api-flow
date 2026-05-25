import { useState, useEffect, useRef } from 'react'
import { useProject } from '../../store/ProjectContext'
import ApiEditor from '../ApiExtractor/ApiEditor'
import db from '../../store/db'
import { aiParseDocument } from '../../engines/aiParser'
import { parseDocument } from '../../engines/docParser'

export default function ApiLibrary() {
  const { state, loadApiFolders, saveApiFolder, deleteApiFolder, dispatch } = useProject()
  const folders = state.apiFolders || []
  const [selectedId, setSelectedId] = useState(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    db.apiFolders.toArray().then((all) => {
      const junk = all.filter((f) => f.name.startsWith('垃圾数据'))
      if (junk.length > 0) {
        Promise.all(junk.map((f) => db.apiFolders.delete(f.id))).then(() => loadApiFolders())
      } else {
        loadApiFolders()
      }
    })
  }, [])

  const handleCreateFolder = async () => {
    const name = newName.trim()
    if (!name) return
    const folder = await saveApiFolder({ name, apis: [] })
    setSelectedId(folder.id)
    setNewName('')
  }

  const handleDeleteFolder = async (id) => {
    await deleteApiFolder(id)
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 首页
        </button>
        <h1 className="text-xl font-bold">我方 API 库</h1>
      </div>

      <div className="flex gap-6">
        <div className="w-64 shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-3">接口文件夹</h2>

            <div className="flex gap-2 mb-4">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="新建文件夹..."
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newName.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                +
              </button>
            </div>

            <div className="space-y-1">
              {folders.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setSelectedId(f.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer text-sm ${selectedId === f.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex-1 truncate">
                    📁 {f.name}
                    <span className="text-xs text-gray-400 ml-1">({(f.apis || []).length})</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id) }}
                    className="text-red-400 hover:text-red-600 text-xs ml-2 shrink-0"
                  >
                    删除
                  </button>
                </div>
              ))}
              {folders.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">暂无文件夹，请新建</p>
              )}
            </div>
          </div>
        </div>

        <FolderDetail key={selectedId || '_empty'} folderId={selectedId} />
      </div>
    </div>
  )
}

function FolderDetail({ folderId }) {
  const { saveApiFolder } = useProject()
  const [draftApis, setDraftApis] = useState([])
  const [folderName, setFolderName] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!folderId) {
      setDraftApis([])
      setFolderName('')
      return
    }
    setLoading(true)
    db.apiFolders.get(folderId).then((folder) => {
      if (folder) {
        setDraftApis((folder.apis || []).map((a) => ({ ...a, children: a.children || [] })))
        setFolderName(folder.name)
      } else {
        setDraftApis([])
        setFolderName('')
      }
      setLoading(false)
      setDirty(false)
    })
  }, [folderId])

  const updateApi = (idx, updated) => {
    setDraftApis((prev) => prev.map((a, i) => (i === idx ? updated : a)))
    setDirty(true)
  }

  const deleteApi = (idx) => {
    setDraftApis((prev) => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const addApi = () => {
    const newApi = { name: '', url: '', method: 'POST', inputParams: [], outputParams: [] }
    setDraftApis((prev) => [...prev, newApi])
    setDirty(true)
  }

  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiFile, setAiFile] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const aiFileRef = useRef(null)

  const handleAiParse = async () => {
    if (!aiText.trim() && !aiFile) return
    setAiLoading(true)
    setAiError('')
    try {
      let docText = aiText.trim()
      if (aiFile) {
        const result = await parseDocument(aiFile)
        docText = result.text
      }
      if (!docText) { setAiError('未能提取到文本'); setAiLoading(false); return }

      const apis = await aiParseDocument(docText)
      if (apis.length === 0) {
        setAiError('未识别到接口')
      } else {
        setDraftApis((prev) => [...prev, ...apis.map((a) => ({ ...a, children: a.children || [] }))])
        setDirty(true)
        setAiOpen(false)
        setAiText('')
        setAiFile(null)
      }
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    if (!folderId) return
    const folder = await db.apiFolders.get(folderId)
    if (!folder) return
    await saveApiFolder({ ...folder, apis: draftApis })
    setDirty(false)
  }

  if (!folderId) {
    return (
      <div className="flex-1">
        <div className="text-center py-20 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
          <p>选择一个文件夹查看其接口</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1">
        <div className="text-center py-20 text-gray-400 bg-white rounded-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium">{folderName} — 接口列表</h2>
        <div className="flex gap-2">
          <button onClick={() => setAiOpen(!aiOpen)} className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
            🤖 AI智能解析
          </button>
          <button onClick={addApi} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            + 添加接口
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            className={`px-3 py-1.5 rounded text-sm ${dirty ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-400'}`}
          >
            {dirty ? '● 保存文件夹' : '已保存 ✓'}
          </button>
        </div>
      </div>

      {aiOpen && (
        <div className="mb-4 border border-purple-300 rounded-lg bg-purple-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-700">🤖 AI 智能解析接口</span>
            <button onClick={() => setAiOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">关闭</button>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            上传文件或粘贴文档内容，AI 自动识别接口名称、地址、参数并填充
          </p>
          <div className="flex gap-2 mb-2">
            <button onClick={() => aiFileRef.current?.click()} className="px-3 py-1.5 border border-purple-300 rounded text-xs hover:bg-purple-100">
              📎 上传文件
            </button>
            <input ref={aiFileRef} type="file" accept=".docx,.pdf" className="hidden"
              onChange={(e) => setAiFile(e.target.files[0])} />
            {aiFile && (
              <span className="text-xs text-green-600 self-center">{aiFile.name}</span>
            )}
          </div>
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            placeholder="或粘贴文档内容..."
          />
          {aiError && <p className="text-red-500 text-xs mt-1">{aiError}</p>}
          <button
            onClick={handleAiParse}
            disabled={aiLoading || (!aiText.trim() && !aiFile)}
            className="mt-2 px-4 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50 w-full"
          >
            {aiLoading ? 'AI 解析中...' : '开始 AI 解析'}
          </button>
        </div>
      )}

      {draftApis.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
          <p>该文件夹下暂无接口</p>
          <p className="text-xs mt-1">点击"+ 添加接口"开始录入</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[65vh] overflow-y-auto">
          {draftApis.map((api, i) => (
            <ApiEditor
              key={i}
              api={api}
              onSave={(updated) => updateApi(i, updated)}
              onDelete={() => deleteApi(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
