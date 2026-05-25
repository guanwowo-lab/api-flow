import { useState, useEffect } from 'react'
import { useProject } from '../../store/ProjectContext'
import ApiEditor from './ApiEditor'

export default function ExtractionResult() {
  const { state, saveExtract, dispatch } = useProject()
  const [draft, setDraft] = useState([])
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft((state.extractB?.apis || []).map((a) => ({ ...a, children: a.children || [] })))
  }, [state.extractB])

  const updateApi = (idx, updated) => {
    setDraft((prev) => prev.map((a, i) => (i === idx ? updated : a)))
    setDirty(true)
  }

  const deleteApi = (idx) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const addApi = () => {
    const newApi = { name: '', url: '', method: 'GET', inputParams: [], outputParams: [] }
    setDraft((prev) => [...prev, newApi])
    setDirty(true)
  }

  const handleSave = async () => {
    await saveExtract(state.project.id, state.folder?.id, 'B', draft)
    setDirty(false)
  }

  const handleContinue = async () => {
    if (dirty) await saveExtract(state.project.id, state.folder?.id, 'B', draft)
    dispatch({ type: 'SET_VIEW', payload: 'match' })
  }

  const folders = state.apiFolders || []
  const apisA = folders.flatMap((f) => (f.apis || []).map((a) => ({ ...a })))
  const canMatch = apisA.length > 0 && draft.length > 0

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'upload' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 返回上传
        </button>
        <h1 className="text-xl font-bold">确认客户 API 提取结果</h1>
        <span className="text-sm text-gray-400">{draft.length} 个接口</span>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
        我方已预置 {apisA.length} 个接口，此处只需确认客户侧的提取结果。修改后点击保存。
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={addApi} className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
          + 手动添加接口
        </button>
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={`px-3 py-1 rounded text-sm ${dirty ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-400'}`}
        >
          {dirty ? '● 保存' : '已保存 ✓'}
        </button>
      </div>

      <div className="mb-6 max-h-[60vh] overflow-y-auto">
        {draft.map((api, i) => (
          <ApiEditor
            key={i}
            api={api}
            onSave={(updated) => updateApi(i, updated)}
            onDelete={() => deleteApi(i)}
          />
        ))}
        {draft.length === 0 && (
          <p className="text-gray-400 text-center py-8">未提取到接口，请返回上传文档重试，或手动添加</p>
        )}
      </div>

      <button
        onClick={handleContinue}
        disabled={!canMatch}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-lg"
      >
        {canMatch ? '确认并开始匹配' : `需要我方和客户都有接口才能开始匹配（我方${apisA.length} / 客户${draft.length}）`}
      </button>
    </div>
  )
}
