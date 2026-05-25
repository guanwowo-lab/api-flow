import { useCallback, useState } from 'react'
import ReactFlow, {
  Controls, Background, MiniMap,
  addEdge, useNodesState, useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useProject } from '../../store/ProjectContext'
import { aiParseDocument, getAiConfig } from '../../engines/aiParser'
import ApiNode from './nodes/ApiNode'

const nodeTypes = { apiNode: ApiNode }

export default function SequenceEditor() {
  const { state, saveDiagram, dispatch, loadApiFolders } = useProject()
  const folders = state.apiFolders || []
  const apisA = folders.flatMap((f) => (f.apis || []).map((a) => ({ ...a })))
  const apisB = state.extractB?.apis || []
  const mappings = state.matches?.mappings || {}

  const savedData = state.sequenceDiagram?.data

  const [nodes, setNodes, onNodesChange] = useNodesState(
    savedData?.nodes?.length ? savedData.nodes : []
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    savedData?.edges?.length ? savedData.edges : []
  )

  const [aiGenOpen, setAiGenOpen] = useState(false)
  const [aiGenLoading, setAiGenLoading] = useState(false)
  const [aiGenError, setAiGenError] = useState('')

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#3b82f6', strokeWidth: 2 },
    }, eds)),
    [setEdges]
  )

  const addApiNode = (side, api, index) => {
    const label = side === 'A' ? (api.name || `我方接口 ${index + 1}`) : (api.name || `客户接口 ${index + 1}`)
    const x = side === 'A' ? 100 : 500
    const y = 50 + index * 100
    const id = `${side}-${index}-${Date.now()}`
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'apiNode',
        position: { x, y },
        data: { label, side, method: api.method, url: api.url },
      },
    ])
  }

  const addStartEndNode = (type) => {
    const id = `${type}-${Date.now()}`
    setNodes((nds) => [
      ...nds,
      {
        id,
        position: { x: 300, y: type === 'start' ? 10 : 500 },
        data: { label: type === 'start' ? '开始' : '结束' },
        style: {
          background: '#f1f5f9', border: '2px solid #64748b',
          borderRadius: type === 'start' ? '50%' : '8px',
          padding: '10px 20px', fontWeight: 'bold',
        },
      },
    ])
  }

  const handleSave = async () => {
    const data = { nodes: nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e })) }
    await saveDiagram(state.project.id, state.folder?.id, 'sequence', data)
  }

  const handleAiGenerate = async () => {
    setAiGenLoading(true)
    setAiGenError('')
    try {
      // 收集匹配的接口对
      const pairs = []
      for (let ci = 0; ci < apisB.length; ci++) {
        const list = mappings[ci] || []
        const matched = list.filter((m) => m.status === 'matched' && m.ourParam)
        if (matched.length > 0) {
          const ourApiSet = new Set(matched.map((m) => m.ourApiIdx).filter((i) => i >= 0))
          for (const apiIdx of ourApiSet) {
            const ourApi = apisA[apiIdx]
            const clientApi = apisB[ci]
            if (ourApi && clientApi) {
              pairs.push({
                client: { name: clientApi.name, url: clientApi.url, method: clientApi.method },
                our: { name: ourApi.name, url: ourApi.url, method: ourApi.method },
              })
            }
          }
        }
      }

      if (pairs.length === 0) { setAiGenError('未找到匹配的接口对，请先在API匹配页面完成匹配'); setAiGenLoading(false); return }

      const config = getAiConfig()
      const pairDesc = pairs.map((p, i) =>
        `${i + 1}. 客户: ${p.client.method} ${p.client.name} (${p.client.url})\n   我方: ${p.our.method} ${p.our.name} (${p.our.url})`
      ).join('\n')

      const prompt = `你是一个API时序流程图生成器。根据以下匹配的接口对，生成一个对接流程图。

接口对：
${pairDesc}

请返回 React Flow 格式的 JSON（只返回JSON，不要任何解释）：
{
  "nodes": [
    { "id": "start", "type": "default", "position": {"x": 400, "y": 0}, "data": {"label": "开始"}, "style": {"background": "#f1f5f9", "border": "2px solid #64748b", "borderRadius": "50%", "padding": "10px 20px", "fontWeight": "bold"} },
    { "id": "c1", "position": {"x": 100, "y": 80}, "data": {"label": "客户\\\\n接口名", "method": "POST", "url": "/api/xxx"}, "style": {"background": "#f0fdf4", "border": "1px solid #22c55e", "borderRadius": 8, "padding": 12, "width": 180} },
    { "id": "o1", "position": {"x": 500, "y": 80}, "data": {"label": "我方\\\\n接口名", "method": "POST", "url": "/api/yyy"}, "style": {"background": "#eff6ff", "border": "1px solid #3b82f6", "borderRadius": 8, "padding": 12, "width": 180} },
    { "id": "end", "type": "default", "position": {"x": 400, "y": 500}, "data": {"label": "结束"}, "style": {"background": "#f1f5f9", "border": "2px solid #64748b", "borderRadius": 8, "padding": "10px 20px", "fontWeight": "bold"} }
  ],
  "edges": [
    { "id": "e1", "source": "c1", "target": "o1", "animated": true, "markerEnd": {"type": "arrowclosed"}, "style": {"stroke": "#3b82f6", "strokeWidth": 2}, "label": "1. 请求"}
  ]
}

规则：
1. 客户节点放左边（x=100），我方节点放右边（x=500）
2. 客户节点用绿色背景（#f0fdf4, #22c55e），我方节点用蓝色背景（#eff6ff, #3b82f6）
3. 根据接口的自然流程顺序排列y坐标，间隔120px
4. 添加开始和结束节点
5. 边要有箭头和序号标签
6. 每个节点都要有唯一的id`

      const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model, max_tokens: 16384, temperature: 0.1, messages: [{ role: 'user', content: prompt }] }),
      })

      if (!resp.ok) throw new Error(`AI请求失败 (${resp.status})`)
      const data = await resp.json()
      const reply = data?.choices?.[0]?.message?.content || ''

      let jsonStr = reply
      const codeBlock = reply.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlock) jsonStr = codeBlock[1]

      const parsed = JSON.parse(jsonStr)
      if (parsed.nodes) setNodes(parsed.nodes)
      if (parsed.edges) setEdges(parsed.edges)
      setAiGenOpen(false)
    } catch (e) {
      setAiGenError(e.message)
    } finally {
      setAiGenLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center gap-4 p-4 bg-white border-b">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'match' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 返回
        </button>
        <h1 className="text-lg font-bold">时序流程图</h1>
        <div className="flex-1" />

        <div className="flex gap-2">
          <button onClick={() => setAiGenOpen(!aiGenOpen)} className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
            🤖 AI 生成
          </button>
          <div className="relative group">
            <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
              + 添加节点
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border rounded shadow-lg hidden group-hover:block z-10 min-w-[180px]">
              <div className="px-3 py-2 text-xs text-gray-500 font-medium">我方接口</div>
              {apisA.map((api, i) => (
                <button key={`a-${i}`} onClick={() => addApiNode('A', api, i)}
                  className="block w-full text-left px-3 py-1 text-sm hover:bg-blue-50">
                  {api.name || `接口 ${i + 1}`}
                </button>
              ))}
              <div className="border-t" />
              <div className="px-3 py-2 text-xs text-gray-500 font-medium">客户接口</div>
              {apisB.map((api, i) => (
                <button key={`b-${i}`} onClick={() => addApiNode('B', api, i)}
                  className="block w-full text-left px-3 py-1 text-sm hover:bg-green-50">
                  {api.name || `接口 ${i + 1}`}
                </button>
              ))}
              <div className="border-t" />
              <button onClick={() => addStartEndNode('start')}
                className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50">开始节点</button>
              <button onClick={() => addStartEndNode('end')}
                className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50">结束节点</button>
            </div>
          </div>

          <button onClick={handleSave} className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
            保存
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'mapping' })}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            参数映射图 &rarr;
          </button>
        </div>
      </div>

      {aiGenOpen && (
        <div className="mx-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-purple-700">🤖 AI 自动生成时序流程图</span>
            <button onClick={() => { setAiGenOpen(false); setAiGenError('') }} className="text-gray-400 hover:text-gray-600">关闭</button>
          </div>
          <p className="text-gray-500 mb-2">
            基于匹配页面已确认的接口对，AI 自动生成时序流程图。生成后可手动拖拽调整。
          </p>
          {aiGenError && <p className="text-red-500 mb-2">{aiGenError}</p>}
          <button
            onClick={handleAiGenerate}
            disabled={aiGenLoading}
            className="px-4 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50"
          >
            {aiGenLoading ? 'AI 生成中...' : '开始生成'}
          </button>
        </div>
      )}

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <Background />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  )
}
