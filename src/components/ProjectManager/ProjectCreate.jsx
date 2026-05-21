import { useState } from 'react'
import { useProject } from '../../store/ProjectContext'

export default function ProjectCreate() {
  const [name, setName] = useState('')
  const { createProject, dispatch } = useProject()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    await createProject(name.trim())
    dispatch({ type: 'SET_VIEW', payload: 'upload' })
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6">
      <h1 className="text-2xl font-bold mb-6">新建项目</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">项目名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="例如：XX客户对接"
            autoFocus
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projects' })}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            创建
          </button>
        </div>
      </form>
    </div>
  )
}
