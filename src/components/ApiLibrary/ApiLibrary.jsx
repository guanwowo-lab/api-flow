import { useState, useEffect } from 'react'
import { useProject } from '../../store/ProjectContext'
import ApiEditor from '../ApiExtractor/ApiEditor'

export default function ApiLibrary() {
  const { state, loadApiFolders, saveApiFolder, deleteApiFolder, dispatch } = useProject()
  const folders = state.apiFolders || []
  const [selectedId, setSelectedId] = useState(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    loadApiFolders()
  }, [loadApiFolders])

  const selected = folders.find((f) => f.id === selectedId)

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

  const updateFolderApis = (apis) => {
    if (!selected) return
    saveApiFolder({ ...selected, apis })
  }

  const addApi = () => {
    if (!selected) return
    const newApi = { name: '', url: '', method: 'POST', inputParams: [], outputParams: [] }
    updateFolderApis([...(selected.apis || []), newApi])
  }

  const updateApi = (idx, updated) => {
    const newApis = (selected.apis || []).map((a, i) => (i === idx ? updated : a))
    updateFolderApis(newApis)
  }

  const deleteApi = (idx) => {
    const newApis = (selected.apis || []).filter((_, i) => i !== idx)
    updateFolderApis(newApis)
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
        {/* 左侧：文件夹列表 */}
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
                  className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer text-sm ${selectedId === f.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}
                >
                  <div
                    className="flex-1 truncate"
                    onClick={() => setSelectedId(f.id)}
                  >
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

        {/* 右侧：接口列表 */}
        <div className="flex-1">
          {!selected ? (
            <div className="text-center py-20 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
              <p>选择一个文件夹查看其接口</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium">{selected.name} — 接口列表</h2>
                <button onClick={addApi} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                  + 添加接口
                </button>
              </div>

              {(selected.apis || []).length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                  <p>该文件夹下暂无接口</p>
                  <p className="text-xs mt-1">点击"+ 添加接口"开始录入</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-[65vh] overflow-y-auto">
                  {(selected.apis || []).map((api, i) => (
                    <ApiEditor
                      key={i}
                      api={api}
                      onChange={(updated) => updateApi(i, updated)}
                      onDelete={() => deleteApi(i)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
