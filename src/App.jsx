import { useProject } from './store/ProjectContext'
import Home from './components/Home/Home'
import ProjectList from './components/ProjectManager/ProjectList'
import ApiLibrary from './components/ApiLibrary/ApiLibrary'
import DocumentUploader from './components/DocumentUploader/DocumentUploader'
import ExtractionResult from './components/ApiExtractor/ExtractionResult'
import MatchPanel from './components/ApiMatcher/MatchPanel'
import SequenceEditor from './components/FlowEditor/SequenceEditor'
import ProjectFolderList from './components/ProjectManager/ProjectFolderList'
import FolderChoice from './components/ProjectManager/FolderChoice'
import Layout from './components/Layout/Layout'
import WorkflowResultSummary from './components/AiWorkflow/WorkflowResultSummary'

function BackToHome({ dispatch }) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
        className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-full shadow-lg hover:bg-blue-700 transition-colors opacity-80 hover:opacity-100"
      >
        ← 返回首页
      </button>
    </div>
  )
}

export default function App() {
  const { state, dispatch, saveExtract } = useProject()

  // Home page with 3 cards
  if (state.activeView === 'home') return <Home />

  // API tester
  if (state.activeView === 'tester') return <Layout />

  // Original views with back-to-home button
  const backBtn = <BackToHome dispatch={dispatch} />
  if (state.activeView === 'projects') return <>{backBtn}<ProjectList /></>
  if (state.activeView === 'projectFolders') return <>{backBtn}<div className="min-h-screen bg-gray-100"><ProjectFolderList /></div></>
  if (state.activeView === 'folderChoice') return <>{backBtn}<div className="min-h-screen bg-gray-100"><FolderChoice /></div></>
  if (state.activeView === 'apiLibrary') return <>{backBtn}<div className="min-h-screen bg-gray-100"><ApiLibrary /></div></>
  if (state.activeView === 'upload') return <>{backBtn}<div className="min-h-screen bg-gray-100"><DocumentUploader /></div></>
  if (state.activeView === 'extract') return <>{backBtn}<div className="min-h-screen bg-gray-100"><ExtractionResult /></div></>
  if (state.activeView === 'match') return <>{backBtn}<div className="min-h-screen bg-gray-100"><MatchPanel /></div></>
  if (state.activeView === 'sequence') return <>{backBtn}<SequenceEditor /></>
  if (state.activeView === 'workflowConfirm') return (
    <>
      {backBtn}
      <div className="min-h-screen bg-gray-100">
        <WorkflowResultSummary
          steps={state.workflowResult?.steps || []}
          summary={state.workflowResult?.summary || {}}
          apis={state.workflowResult?.apis || []}
          onConfirm={async () => {
            // 确认后保存 API 并跳转到解析结果页面
            const apis = state.workflowResult?.apis || []
            await saveExtract(state.folder?.id, 'B', apis)
            dispatch({ type: 'SET_VIEW', payload: 'extract' })
          }}
          onRetry={() => {
            // 重新解析，返回上传页面
            dispatch({ type: 'SET_VIEW', payload: 'upload' })
          }}
        />
      </div>
    </>
  )

  return <Home />
}
