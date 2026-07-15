import { useEffect, useState } from 'react'
import { useProject } from '../../store/ProjectContext'

export default function ProjectList() {
  const { state, loadProjects, createProject, renameProject, deleteProject, openProject, dispatch } = useProject()
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  // 新建弹窗
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleOpen = (id) => {
    if (editingId !== id) openProject(id)
  }

  const openCreateModal = () => {
    setNewName('')
    setCreateError('')
    setShowCreate(true)
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    if (state.projectList.some((p) => p.name === name)) {
      setCreateError('项目名称已存在，请使用其他名称')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      await createProject(name)
      setShowCreate(false)
    } catch (e) {
      if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
        setCreateError('项目名称已存在，请使用其他名称')
      } else {
        setCreateError(e.message || '创建失败')
      }
    } finally {
      setCreating(false)
    }
  }

  const startRename = (p) => {
    setEditingId(p.id)
    setEditName(p.name)
  }

  const finishRename = async () => {
    if (editName.trim() && editingId) {
      await renameProject(editingId, editName.trim())
    }
    setEditingId(null)
    setEditName('')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteProject(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="max-w-2xl mx-auto mt-20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })} className="text-gray-400 hover:text-gray-600">&larr;</button>
          <h1 className="text-2xl font-bold">项目管理</h1>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 新建项目
        </button>
      </div>

      {state.projectList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">暂无项目</p>
          <p>点击"新建项目"开始</p>
        </div>
      ) : (
        <div className="space-y-3">
          {state.projectList.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-4 bg-white rounded-lg shadow hover:shadow-md border border-gray-200"
            >
              <div
                className="flex-1 cursor-pointer min-w-0"
                onClick={() => handleOpen(p.id)}
              >
                {editingId === p.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={finishRename}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') finishRename()
                      if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium px-2 py-1 border border-blue-400 rounded outline-none w-full max-w-[200px]"
                  />
                ) : (
                  <>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-gray-400 mt-1">
                      最后修改: {new Date(p.updatedAt).toLocaleString()}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={(e) => { e.stopPropagation(); startRename(p) }}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  重命名
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(p) }}
                  className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新建项目弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => !creating && setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">新建项目</h3>
            <input
              autoFocus
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setCreateError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="输入项目名称"
            />
            {createError && <p className="text-red-500 text-xs mt-2">{createError}</p>}
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">确认删除</h3>
            <p className="text-sm text-gray-600 mb-4">
              确定要删除项目 <strong>"{deleteTarget.name}"</strong> 吗？<br />
              该项目下的<strong className="text-red-500">所有文件夹和数据将被永久清除</strong>，不可恢复。
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
