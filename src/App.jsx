import { useProject } from './store/ProjectContext'
import ProjectList from './components/ProjectManager/ProjectList'
import ProjectCreate from './components/ProjectManager/ProjectCreate'

export default function App() {
  const { state } = useProject()

  if (state.activeView === 'projects') return <ProjectList />
  if (state.activeView === 'create') return <ProjectCreate />

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <h1 className="text-2xl font-bold p-4">API Flow — {state.project?.name}</h1>
    </div>
  )
}
