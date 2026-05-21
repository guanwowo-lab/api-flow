import { useState, useEffect } from 'react'
import { useProject } from '../../store/ProjectContext'
import ApiEditor from '../ApiExtractor/ApiEditor'

export default function ApiManager() {
  const { state, saveExtract, loadApiFolders, dispatch } = useProject()
  const apis = state.extractA?.apis || []
  const folders = state.apiFolders || []
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    loadApiFolders()
  }, [loadApiFolders])

  const updateApi = (idx, updated) => {
    const newApis = apis.map((a, i) => (i === idx ? updated : a))
    saveExtract(state.project.id, 'A', newApis)
  }

  const deleteApi = (idx) => {
    const newApis = apis.filter((_, i) => i !== idx)
    saveExtract(state.project.id, 'A', newApis)
  }

  const addApi = () => {
    const newApi = { name: '', url: '', method: 'POST', inputParams: [], outputParams: [] }
    saveExtract(state.project.id, 'A', [...apis, newApi])
  }

  const importFromFolder = (folder) => {
    const folderApis = (folder.apis || []).map((a) => ({ ...a }))
    saveExtract(state.project.id, 'A', [...apis, ...folderApis])
    setShowImport(false)
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
        在这里维护本项目的<strong>我方系统</strong> API 接口。可以手动添加，也可以从右侧"我方 API 库"导入预置的接口文件夹。
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={addApi} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          + 添加接口
        </button>
        <button
          onClick={() => setShowImport(!showImport)}
          className={`px-4 py-2 rounded-lg text-sm border ${showImport ? 'bg-gray-200 border-gray-400' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
        >
          📂 从 API 库导入
        </button>
        <button
          onClick={handleContinue}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm ml-auto"
        >
          上传客户文档 &rarr;
        </button>
      </div>

      {showImport && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium mb-3">选择要导入的文件夹：</h3>
          {folders.length === 0 ? (
            <p className="text-sm text-gray-400">
              暂无预置接口，请先到<a className="text-blue-600 underline cursor-pointer"
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'apiLibrary' })}>API 库</a>创建文件夹和接口。
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => importFromFolder(f)}
                  className="text-left px-3 py-2 rounded border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-sm"
                >
                  📁 {f.name}
                  <span className="text-xs text-gray-400 ml-1">({(f.apis || []).length} 个接口)</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {apis.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-lg mb-2">暂无接口</p>
          <p>点击"+ 添加接口"手动录入，或"从 API 库导入"已有接口</p>
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
