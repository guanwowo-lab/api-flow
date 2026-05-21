import { useState } from 'react'
import { useProject } from '../../store/ProjectContext'
import ApiEditor from './ApiEditor'

export default function ExtractionResult() {
  const { state, saveExtract, dispatch } = useProject()
  const [tab, setTab] = useState('A')
  const extract = tab === 'A' ? state.extractA : state.extractB
  const apis = extract?.apis || []

  const updateApi = (idx, updated) => {
    const newApis = apis.map((a, i) => (i === idx ? updated : a))
    saveExtract(state.project.id, tab, newApis)
  }

  const deleteApi = (idx) => {
    const newApis = apis.filter((_, i) => i !== idx)
    saveExtract(state.project.id, tab, newApis)
  }

  const addApi = () => {
    const newApi = { name: '', url: '', method: 'GET', inputParams: [], outputParams: [] }
    saveExtract(state.project.id, tab, [...apis, newApi])
  }

  const handleContinue = () => {
    dispatch({ type: 'SET_VIEW', payload: 'match' })
  }

  const hasBothSides = state.extractA?.apis?.length > 0 && state.extractB?.apis?.length > 0

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
          我方 API ({state.extractA?.apis?.length || 0})
        </button>
        <button
          onClick={() => setTab('B')}
          className={`px-4 py-2 rounded-lg ${tab === 'B' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
        >
          客户 API ({state.extractB?.apis?.length || 0})
        </button>
      </div>

      <div className="mb-4">
        <button onClick={addApi} className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
          + 手动添加接口
        </button>
      </div>

      <div className="mb-6 max-h-[60vh] overflow-y-auto">
        {apis.map((api, i) => (
          <ApiEditor
            key={i}
            api={api}
            onChange={(updated) => updateApi(i, updated)}
            onDelete={() => deleteApi(i)}
          />
        ))}
        {apis.length === 0 && (
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
