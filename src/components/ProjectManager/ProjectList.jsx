import { useEffect } from 'react'
import { useProject } from '../../store/ProjectContext'

export default function ProjectList() {
  const { state, loadProjects, openProject, dispatch } = useProject()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleOpen = (id) => {
    openProject(id)
  }

  const handleNew = () => {
    dispatch({ type: 'SET_VIEW', payload: 'create' })
  }

  return (
    <div className="max-w-2xl mx-auto mt-20 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">API Flow</h1>
        <button
          onClick={handleNew}
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
            <button
              key={p.id}
              onClick={() => handleOpen(p.id)}
              className="w-full text-left p-4 bg-white rounded-lg shadow hover:shadow-md border border-gray-200"
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-gray-400 mt-1">
                最后修改: {new Date(p.updatedAt).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
