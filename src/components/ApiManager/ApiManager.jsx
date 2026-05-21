import { useState } from 'react'
import { useProject } from '../../store/ProjectContext'
import ApiEditor from '../ApiExtractor/ApiEditor'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

export default function ApiManager() {
  const { state, saveExtract, dispatch } = useProject()
  const apis = state.extractA?.apis || []
  const [editingId, setEditingId] = useState(null)

  const updateApi = (idx, updated) => {
    const newApis = apis.map((a, i) => (i === idx ? updated : a))
    saveExtract(state.project.id, 'A', newApis)
  }

  const deleteApi = (idx) => {
    const newApis = apis.filter((_, i) => i !== idx)
    saveExtract(state.project.id, 'A', newApis)
    if (editingId === idx) setEditingId(null)
  }

  const addApi = () => {
    const newApi = {
      name: '',
      url: '',
      method: 'POST',
      inputParams: [],
      outputParams: [],
    }
    const newApis = [...apis, newApi]
    saveExtract(state.project.id, 'A', newApis)
    setEditingId(newApis.length - 1)
  }

  const handleContinue = () => {
    dispatch({ type: 'SET_VIEW', payload: 'upload' })
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projects' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 项目列表
        </button>
        <h1 className="text-xl font-bold">我方 API 管理 — {state.project?.name}</h1>
        <span className="text-sm text-gray-400 ml-auto">{apis.length} 个接口</span>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
        在这里手动维护<strong>我方系统</strong>的 API 接口信息。后续匹配客户文档时，将以这里的接口为准。
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={addApi} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          + 添加接口
        </button>
        <button
          onClick={handleContinue}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
        >
          上传客户文档 &rarr;
        </button>
      </div>

      {apis.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-lg mb-2">暂无接口</p>
          <p>点击"+ 添加接口"手动录入我方系统的 API</p>
          <p className="text-xs mt-2">或者点击"上传客户文档"先处理客户侧</p>
        </div>
      ) : (
        <div className="space-y-1">
          {apis.map((api, i) => (
            <ApiEditor
              key={i}
              api={api}
              onChange={(updated) => updateApi(i, updated)}
              onDelete={() => deleteApi(i)}
            />
          ))}
        </div>
      )}

      {apis.length > 0 && (
        <button
          onClick={handleContinue}
          className="w-full mt-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg"
        >
          保存并上传客户文档
        </button>
      )}
    </div>
  )
}
