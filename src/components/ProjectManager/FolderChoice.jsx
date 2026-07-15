import { useProject } from '../../store/ProjectContext'

export default function FolderChoice() {
  const { state, dispatch } = useProject()
  const folder = state.folder

  const goToDocMatch = () => {
    if (state.extractB?.apis?.length > 0) {
      dispatch({ type: 'SET_VIEW', payload: 'match' })
    } else {
      dispatch({ type: 'SET_VIEW', payload: 'upload' })
    }
  }

  const goToDiagram = () => {
    dispatch({ type: 'SET_VIEW', payload: 'sequence' })
  }

  return (
    <div className="max-w-2xl mx-auto mt-20 p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projectFolders' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 对接文件夹
        </button>
        <h1 className="text-xl font-bold">{folder?.name}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-8">请选择要进行的操作</p>

      <div className="grid grid-cols-2 gap-6">
        <button
          onClick={goToDocMatch}
          className="p-8 bg-white rounded-xl shadow border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all text-left group"
        >
          <div className="text-3xl mb-3">📄</div>
          <div className="text-lg font-semibold mb-1 group-hover:text-blue-600">上传客户文档</div>
          <div className="text-sm text-gray-400">上传客户方 API 文档，进行接口提取和匹配分析</div>
          {state.extractB?.apis?.length > 0 && (
            <div className="mt-2 text-xs text-blue-500">已有 {state.extractB.apis.length} 个接口</div>
          )}
        </button>

        <button
          onClick={goToDiagram}
          className="p-8 bg-white rounded-xl shadow border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all text-left group"
        >
          <div className="text-3xl mb-3">🔀</div>
          <div className="text-lg font-semibold mb-1 group-hover:text-blue-600">画流程图</div>
          <div className="text-sm text-gray-400">直接进入业务流程编排，梳理对接流程图</div>
          {state.sequenceDiagram && (
            <div className="mt-2 text-xs text-blue-500">已有流程图数据</div>
          )}
        </button>
      </div>
    </div>
  )
}
