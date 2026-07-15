import { useProject } from '../../store/ProjectContext'

export default function Home() {
  const { dispatch } = useProject()

  return (
    <div className="max-w-3xl mx-auto mt-20 p-6">
      <h1 className="text-3xl font-bold text-center mb-2">API Flow</h1>
      <p className="text-center text-gray-400 mb-12">API 对接匹配工具</p>

      <div className="grid grid-cols-3 gap-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'tester' })}
          className="p-8 bg-white rounded-xl shadow border border-gray-200 hover:shadow-md hover:border-green-300 transition-all text-left group"
        >
          <div className="text-3xl mb-3">🧪</div>
          <div className="text-lg font-semibold mb-1 group-hover:text-green-600">接口测试工具</div>
          <div className="text-sm text-gray-400">根据接口文档快速测试 API，支持批量场景串联</div>
        </button>

        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projects' })}
          className="p-8 bg-white rounded-xl shadow border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all text-left group"
        >
          <div className="text-3xl mb-3">📋</div>
          <div className="text-lg font-semibold mb-1 group-hover:text-blue-600">API 匹配</div>
          <div className="text-sm text-gray-400">创建对接项目，匹配双方接口，设计流程图</div>
        </button>

        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'apiLibrary' })}
          className="p-8 bg-white rounded-xl shadow border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all text-left group"
        >
          <div className="text-3xl mb-3">📚</div>
          <div className="text-lg font-semibold mb-1 group-hover:text-blue-600">我方 API 库</div>
          <div className="text-sm text-gray-400">管理公司接口定义，按文件夹分组，项目中可直接调用</div>
        </button>
      </div>
    </div>
  )
}
