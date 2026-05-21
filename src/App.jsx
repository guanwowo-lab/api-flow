import { useProject } from './store/ProjectContext'
import Home from './components/Home/Home'
import ProjectList from './components/ProjectManager/ProjectList'
import ProjectCreate from './components/ProjectManager/ProjectCreate'
import ApiManager from './components/ApiManager/ApiManager'
import ApiLibrary from './components/ApiLibrary/ApiLibrary'
import DocumentUploader from './components/DocumentUploader/DocumentUploader'
import ExtractionResult from './components/ApiExtractor/ExtractionResult'
import MatchPanel from './components/ApiMatcher/MatchPanel'
import SequenceEditor from './components/FlowEditor/SequenceEditor'
import MappingEditor from './components/FlowEditor/MappingEditor'

export default function App() {
  const { state } = useProject()

  if (state.activeView === 'projects') return <ProjectList />
  if (state.activeView === 'create') return <ProjectCreate />
  if (state.activeView === 'apiLibrary') return (
    <div className="min-h-screen bg-gray-100"><ApiLibrary /></div>
  )
  if (state.activeView === 'manage') return (
    <div className="min-h-screen bg-gray-100"><ApiManager /></div>
  )
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

  return <Home />
}
