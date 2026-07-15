import { useState, useEffect } from 'react'
import { useProject } from '../../store/ProjectContext'
import { projectFolderApi } from '../../store/api'

export default function ProjectFolderList() {
  const { state, loadProjectFolders, createProjectFolder, deleteProjectFolder, openFolder, dispatch } = useProject()
  const folders = state.projectFolders || []
  const [newName, setNewName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    if (state.project?.id) {
      loadProjectFolders(state.project.id)
    } else {
      dispatch({ type: 'SET_VIEW', payload: 'projects' })
    }
  }, [])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name || !state.project) return
    await createProjectFolder(state.project.id, name)
    setNewName('')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteProjectFolder(state.project.id, deleteTarget.id)
    setDeleteTarget(null)
  }

  const startRename = (f) => {
    setEditingId(f.id)
    setEditName(f.name)
  }

  const finishRename = async () => {
    if (editName.trim() && editingId) {
      await projectFolderApi.rename(editingId, editName.trim())
      await loadProjectFolders(state.project.id)
    }
    setEditingId(null)
    setEditName('')
  }

  return (
    <div className="max-w-2xl mx-auto mt-20 p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projects' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 项目列表
        </button>
        <h1 className="text-xl font-bold">{state.project?.name} — 对接文件夹</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex gap-2 mb-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="新建对接文件夹"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            + 新建
          </button>
        </div>

        <div className="space-y-2">
          {folders.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300"
            >
              <div className="flex-1 cursor-pointer" onClick={() => editingId !== f.id && openFolder(f)}>
                {editingId === f.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={finishRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') finishRename()
                      if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-sm px-2 py-1 border border-blue-400 rounded outline-none w-full max-w-[200px]"
                  />
                ) : (
                  <>
                    <div className="font-medium text-sm">📁 {f.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      最后修改: {new Date(f.updatedAt).toLocaleString()}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button
                  onClick={(e) => { e.stopPropagation(); startRename(f) }}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  重命名
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(f) }}
                  className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
          {folders.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>暂无对接文件夹</p>
              <p className="text-xs mt-1">新建文件夹来管理不同的对接场景</p>
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">确认删除</h3>
            <p className="text-sm text-gray-600 mb-4">
              确定要删除文件夹 <strong>"{deleteTarget.name}"</strong> 吗？<br />
              该文件夹下的所有匹配数据将被<strong className="text-red-500">永久清除</strong>，不可恢复。
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                取消
              </button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
