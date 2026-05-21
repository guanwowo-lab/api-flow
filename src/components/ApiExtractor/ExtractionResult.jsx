import { useState, useEffect } from 'react'
import { useProject } from '../../store/ProjectContext'
import ApiEditor from './ApiEditor'

export default function ExtractionResult() {
  const { state, saveExtract, dispatch } = useProject()
  const [tab, setTab] = useState('A')
  const [draftA, setDraftA] = useState([])
  const [draftB, setDraftB] = useState([])
  const [dirty, setDirty] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized) {
      setDraftA((state.extractA?.apis || []).map((a) => ({ ...a })))
      setDraftB((state.extractB?.apis || []).map((a) => ({ ...a })))
      setInitialized(true)
    }
  }, [state.extractA, state.extractB, initialized])

  const draftApis = tab === 'A' ? draftA : draftB
  const setDraftApis = tab === 'A' ? setDraftA : setDraftB

  const updateApi = (idx, updated) => {
    setDraftApis((prev) => prev.map((a, i) => (i === idx ? updated : a)))
    setDirty(true)
  }

  const deleteApi = (idx) => {
    setDraftApis((prev) => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const addApi = () => {
    const newApi = { name: '', url: '', method: 'GET', inputParams: [], outputParams: [] }
    setDraftApis((prev) => [...prev, newApi])
    setDirty(true)
  }

  const handleSave = async () => {
    if (tab === 'A') {
      await saveExtract(state.project.id, 'A', draftA)
    } else {
      await saveExtract(state.project.id, 'B', draftB)
    }
    setDirty(false)
  }

  const handleContinue = async () => {
    if (dirty) {
      await saveExtract(state.project.id, 'A', draftA)
      await saveExtract(state.project.id, 'B', draftB)
    }
    dispatch({ type: 'SET_VIEW', payload: 'match' })
  }

  const hasBothSides = draftA.length > 0 && draftB.length > 0

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'upload' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 返回上传
        </button>
        <h1 className="text-xl font-bold">确认提取结果</h1>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('A')}
          className={`px-4 py-2 rounded-lg ${tab === 'A' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
        >
          我方 API ({draftA.length})
        </button>
        <button
          onClick={() => setTab('B')}
          className={`px-4 py-2 rounded-lg ${tab === 'B' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
        >
          客户 API ({draftB.length})
        </button>
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
        {draftApis.map((api, i) => (
          <ApiEditor
            key={i}
            api={api}
            onSave={(updated) => updateApi(i, updated)}
            onDelete={() => deleteApi(i)}
          />
        ))}
        {draftApis.length === 0 && (
          <p className="text-gray-400 text-center py-8">暂无提取结果，请返回上传文档或手动添加</p>
        )}
      </div>

      <button
        onClick={handleContinue}
        disabled={!hasBothSides}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-lg"
      >
        确认并开始匹配
      </button>
    </div>
  )
}
