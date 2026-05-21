import { useProject } from './store/ProjectContext'
import ProjectList from './components/ProjectManager/ProjectList'
import ProjectCreate from './components/ProjectManager/ProjectCreate'
import DocumentUploader from './components/DocumentUploader/DocumentUploader'
import ExtractionResult from './components/ApiExtractor/ExtractionResult'
import MatchPanel from './components/ApiMatcher/MatchPanel'
import SequenceEditor from './components/FlowEditor/SequenceEditor'
import MappingEditor from './components/FlowEditor/MappingEditor'

export default function App() {
  const { state } = useProject()

  if (state.activeView === 'projects') return <ProjectList />
  if (state.activeView === 'create') return <ProjectCreate />
  if (state.activeView === 'upload') return (
    <div className="min-h-screen bg-gray-100"><DocumentUploader /></div>
  )
  if (state.activeView === 'extract') return (
    <div className="min-h-screen bg-gray-100"><ExtractionResult /></div>
  )
  if (state.activeView === 'match') return (
    <div className="min-h-screen bg-gray-100"><MatchPanel /></div>
  )
  if (state.activeView === 'sequence') return <SequenceEditor />
  if (state.activeView === 'mapping') return <MappingEditor />

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <h1 className="text-2xl font-bold p-4">API Flow — {state.project?.name}</h1>
    </div>
  )
}
