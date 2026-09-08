import { useState, useRef, useEffect } from 'react'
import { useProject } from '../../store/ProjectContext'
import { parseDocument } from '../../engines/docParser'
import { extractApis } from '../../engines/apiExtractor'
import { aiParseDocument, getAiConfig, saveAiConfig, hasAiConfig } from '../../engines/aiParser'
import { executeSimpleWorkflow } from '../../engines/simpleWorkflow'
import SimpleWorkflowProgress from '../AiWorkflow/SimpleWorkflowProgress'

export default function DocumentUploader() {
  const { state, dispatch, saveExtract, loadApiFolders } = useProject()
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('file')
  const [useAI, setUseAI] = useState(true) // 默认勾选 AI 智能解析
  const [useWorkflow, setUseWorkflow] = useState(true) // 默认启用智能工作流
  const [workflowSteps, setWorkflowSteps] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  // 保留已保存的 hint，避免解析时用空串把用户配置的提示词覆盖掉
  const [aiConfig, setAiConfig] = useState(() => getAiConfig())
  const fileRef = useRef(null)

  useEffect(() => { loadApiFolders() }, [])

  // 我方API直接取库中所有接口
  const folders = state.apiFolders || []
  const apisA = folders.flatMap((f) => (f.apis || []).map((a) => ({ ...a })))

  const saveAiSettings = () => {
    saveAiConfig(aiConfig)
    setShowSettings(false)
    setUseAI(true)
  }

  const handleParse = async () => {
    setError('')
    setLoading(true)
    setWorkflowSteps([])

    try {
      // 如果启用 AI 解析，先检查配置是否完整
      if (useAI) {
        const config = getAiConfig()
        if (!config.baseUrl || !config.model || !config.apiKey) {
          setError('请先配置 AI 模型（Base URL、Model 和 API Key）')
          setShowSettings(true)
          setLoading(false)
          return
        }
      }

      let docText = ''

      if (mode === 'text' && text.trim()) {
        docText = text
      } else {
        const input = mode === 'url' ? url : file
        if (!input) { setError('请选择文件、输入链接或粘贴文本'); setLoading(false); return }
        const result = await parseDocument(input)
        docText = result.text
      }

      if (!docText.trim()) { setError('未能提取到文本内容'); setLoading(false); return }

      let apisB = []

      if (useAI && useWorkflow) {
        // AI 智能工作流模式（3步）
        saveAiConfig(aiConfig)
        const result = await executeSimpleWorkflow(docText, (steps) => setWorkflowSteps(steps))
        apisB = result.apis || []

        // 保存工作流结果,切换到确认页面
        dispatch({
          type: 'SET_WORKFLOW_RESULT',
          payload: {
            steps: result.steps,
            summary: result.summary,
            apis: apisB
          }
        })

        // 跳转到工作流结果确认页面,而不是直接到解析结果
        dispatch({ type: 'SET_VIEW', payload: 'workflowConfirm' })
        return // 不继续执行后续保存和跳转
      } else if (useAI) {
        // AI 单步解析模式
        saveAiConfig(aiConfig)
        apisB = await aiParseDocument(docText)
      } else {
        // 规则引擎模式
        apisB = extractApis(docText)
      }

      if (apisB.length === 0) {
        setError('未解析出任何接口，请检查文档内容或切换解析方式')
        setLoading(false)
        return
      }

      await saveExtract(state.folder?.id, 'B', apisB)
      dispatch({ type: 'SET_VIEW', payload: 'extract' })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projectFolders' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 对接文件夹
        </button>
        <h1 className="text-xl font-bold">上传客户文档 — {state.project?.name}</h1>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`ml-auto text-xs px-2 py-1 rounded border ${showSettings ? 'bg-gray-200' : 'border-gray-300 hover:bg-gray-50'}`}
        >
          ⚙ 设置
        </button>
      </div>

      {showSettings && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium mb-3">AI 解析设置</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Base URL</span>
              <input value={aiConfig.baseUrl} onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Model</span>
              <input value={aiConfig.model} onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </label>
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-xs text-gray-500">API Key</span>
              <input type="password" value={aiConfig.apiKey} onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </label>
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-xs text-gray-500">提示词（帮助 AI 识别文档字段映射）</span>
              <textarea value={aiConfig.hint || ''} onChange={(e) => setAiConfig({ ...aiConfig, hint: e.target.value })}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none h-16"
                placeholder={'例如：文档中「服务地址」对应接口URL，「入参」对应输入参数，「出参」对应输出参数'} />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={saveAiSettings} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">保存设置</button>
            <button onClick={() => setShowSettings(false)} className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50">取消</button>
          </div>
        </div>
      )}

      {apisA.length > 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 text-sm text-green-700">
          我方接口已就绪（{apisA.length} 个），将直接用于匹配。维护我方接口请前往首页"我方 API 库"。
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-700">
          尚未配置我方接口，请前往首页"我方 API 库"配置。
        </div>
      )}

      <div className="p-6 bg-white rounded-lg shadow border border-gray-200 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">客户 API 文档</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => {
                  const checked = e.target.checked
                  setUseAI(checked)
                  if (!checked) setUseWorkflow(false) // 关闭 AI 时同时关闭工作流
                  // 如果勾选但未配置，自动打开设置
                  if (checked && !hasAiConfig()) {
                    setShowSettings(true)
                  }
                }}
                className="rounded"
              />
              <span className={useAI ? 'text-purple-600 font-medium' : 'text-gray-400'}>🤖 AI 智能解析</span>
              {useAI && !hasAiConfig() && (
                <span className="text-xs text-orange-600">（需配置）</span>
              )}
            </label>
            {useAI && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={useWorkflow}
                  onChange={(e) => setUseWorkflow(e.target.checked)}
                  className="rounded"
                />
                <span className={useWorkflow ? 'text-blue-600 font-medium' : 'text-gray-600'}>⚡ 智能工作流</span>
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {['file', 'url', 'text'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded text-sm ${mode === m ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
            >
              {m === 'file' ? '文件' : m === 'url' ? '链接' : '粘贴'}
            </button>
          ))}
        </div>

        {mode === 'file' && (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }}
          >
            {file ? (
              <p className="text-green-600">{file.name}</p>
            ) : (
              <p className="text-gray-400">拖拽文件到此处，或点击选择<br /><span className="text-xs">支持 .docx / .pdf</span></p>
            )}
            <input ref={fileRef} type="file" accept=".docx,.pdf" className="hidden"
              onChange={(e) => setFile(e.target.files[0])} />
          </div>
        )}

        {mode === 'url' && (
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://..." />
        )}

        {mode === 'text' && (
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="粘贴客户文档内容..." />
        )}
      </div>

      {useAI && useWorkflow && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⚡</span>
            <h3 className="font-semibold text-blue-700">AI 智能工作流（3步增强版）</h3>
          </div>
          <p className="text-blue-600 mb-2">
            启用后将执行智能化的 3 步解析流程：
          </p>
          <ol className="list-decimal list-inside text-xs text-blue-600 space-y-1 ml-2">
            <li>快速识别接口清单 - 通读全文，先定位所有接口的名称、路径与请求方法</li>
            <li>分批提取参数详情 - 每批 3 个接口逐步深挖入参与出参，规避单次输出长度限制</li>
            <li>质量验证与增强 - 自动检查必填字段，补全缺失数据，剔除不完整接口并生成质量报告</li>
          </ol>
        </div>
      )}

      {/* 工作流进度展示（解析中实时更新；失败后保留以便查看在哪一步出错） */}
      {workflowSteps.length > 0 && (
        <div className="mb-6">
          <SimpleWorkflowProgress steps={workflowSteps} />
        </div>
      )}

      {useAI && !useWorkflow && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4 text-xs">
          <div className="text-purple-700 mb-2">
            🤖 使用 <strong>AI 智能解析</strong>（{aiConfig.model}）
          </div>
          <textarea
            value={aiConfig.hint || ''}
            onChange={(e) => { setAiConfig({ ...aiConfig, hint: e.target.value }); saveAiConfig({ hint: e.target.value }) }}
            disabled={loading}
            className="w-full px-2 py-1.5 border border-purple-200 rounded text-xs outline-none focus:ring-2 focus:ring-purple-500 resize-none h-12 disabled:bg-gray-100 disabled:text-gray-400"
            placeholder="提示词（可选）：告诉AI如何识别文档字段。例如：「服务地址」对应接口URL，「入参」对应输入参数"
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        onClick={handleParse}
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-lg"
      >
        {loading ? '正在解析...' : useAI ? '🤖 AI 智能解析客户文档' : '开始解析客户文档'}
      </button>
    </div>
  )
}
