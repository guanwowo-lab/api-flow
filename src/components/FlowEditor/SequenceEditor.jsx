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
import SwimlaneNode from './nodes/SwimlaneNode'
import ShapeNode from './nodes/ShapeNode'

const nodeTypes = { apiNode: ApiNode, swimlane: SwimlaneNode, shapeNode: ShapeNode }

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

  const [actors, setActors] = useState(() => savedData?.actors || [
    { id: 'user', name: '用户', color: '#8b5cf6' },
    { id: 'client', name: '客户系统', color: '#22c55e' },
    { id: 'our', name: '我方系统', color: '#3b82f6' },
  ])
  const [swimlaneHeight, setSwimlaneHeight] = useState(savedData?.swimlaneHeight || 1200)
  const [actorEditOpen, setActorEditOpen] = useState(false)
  const [newActorName, setNewActorName] = useState('')

  const addActor = () => {
    const name = newActorName.trim()
    if (!name) return
    const colors = ['#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
    setActors([...actors, { id: 'a' + Date.now(), name, color: colors[actors.length % colors.length] }])
    setNewActorName('')
  }

  const actorX = (index) => 60 + index * 260

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#3b82f6', strokeWidth: 2 },
    }, eds)),
    [setEdges]
  )

  const addApiNode = (side, api, index, actorId) => {
    const label = side === 'A' ? (api.name || `我方接口 ${index + 1}`) : (api.name || `客户接口 ${index + 1}`)
    const actorIdx = actors.findIndex((a) => a.id === actorId)
    const x = actorIdx >= 0 ? actorX(actorIdx) + 40 : 300
    const y = 80 + index * 110
    const id = `api-${Date.now()}`
    setNodes((nds) => [
      ...nds,
      { id, type: 'apiNode', position: { x, y }, data: { label, side, method: api.method, url: api.url, actorId, actorName: actors[actorIdx]?.name || '' } },
    ])
  }

  const addShapeNode = (shape, defaultLabel) => {
    const id = `shape-${Date.now()}`
    setNodes((nds) => [
      ...nds,
      { id, type: 'shapeNode', position: { x: 350, y: 200 + Math.random() * 100 }, data: { label: defaultLabel, shape } },
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
    const data = { nodes: nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e })), actors, swimlaneHeight }
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
          <button onClick={() => setActorEditOpen(!actorEditOpen)} className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">
            👥 流程主体 ({actors.length})
          </button>
          <button onClick={() => setAiGenOpen(!aiGenOpen)} className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
            🤖 AI 生成
          </button>
          <div className="relative group">
            <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
              + 添加节点
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border rounded shadow-lg hidden group-hover:block z-10 min-w-[220px] max-h-[60vh] overflow-y-auto">
              <div className="px-3 py-2 text-xs text-gray-500 font-medium sticky top-0 bg-white border-b">图形节点</div>
              <button onClick={() => addShapeNode('rect', '处理步骤')} className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50">📦 矩形框</button>
              <button onClick={() => addShapeNode('diamond', '判断条件')} className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50">🔷 菱形</button>
              <button onClick={() => addShapeNode('circle', '开始/结束')} className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50">⭕ 圆形</button>
              <button onClick={() => addShapeNode('note', '备注说明')} className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50">📝 备注</button>
              <button onClick={() => addStartEndNode('start')} className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50">▶ 开始节点</button>
              <button onClick={() => addStartEndNode('end')} className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-50">⏹ 结束节点</button>
              <div className="border-t" />
              <div className="px-3 py-2 text-xs text-gray-500 font-medium">我方接口 → {actors.find(a => a.id === 'our')?.name || '我方系统'}</div>
              {apisA.map((api, i) => (
                <button key={`a-${i}`} onClick={() => addApiNode('A', api, i, 'our')}
                  className="block w-full text-left px-3 py-1 text-sm hover:bg-blue-50">
                  {api.name || `接口 ${i + 1}`}
                </button>
              ))}
              <div className="border-t" />
              <div className="px-3 py-2 text-xs text-gray-500 font-medium">客户接口 → {actors.find(a => a.id === 'client')?.name || '客户系统'}</div>
              {apisB.map((api, i) => (
                <button key={`b-${i}`} onClick={() => addApiNode('B', api, i, 'client')}
                  className="block w-full text-left px-3 py-1 text-sm hover:bg-green-50">
                  {api.name || `接口 ${i + 1}`}
                </button>
              ))}
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

      {actorEditOpen && (
        <div className="mx-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-amber-700">👥 流程主体配置</span>
            <button onClick={() => setActorEditOpen(false)} className="text-gray-400 hover:text-gray-600">关闭</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {actors.map((a) => (
              <span key={a.id} className="px-2 py-1 rounded text-white text-xs" style={{ background: a.color }}>
                {a.name}
                {actors.length > 1 && (
                  <button onClick={() => setActors(actors.filter((x) => x.id !== a.id))} className="ml-1 opacity-60 hover:opacity-100">&times;</button>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-2 mb-3 items-center">
            <span className="text-gray-500 text-xs">泳道高度:</span>
            <input type="range" min={400} max={3000} step={100} value={swimlaneHeight}
              onChange={(e) => setSwimlaneHeight(Number(e.target.value))} className="flex-1" />
            <span className="text-gray-500 text-xs w-10">{swimlaneHeight}</span>
          </div>
          <div className="flex gap-2">
            <input value={newActorName} onChange={(e) => setNewActorName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addActor()}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs outline-none"
              placeholder="新主体名称" />
            <button onClick={addActor} disabled={!newActorName.trim()}
              className="px-3 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 disabled:opacity-50">添加</button>
          </div>
        </div>
      )}

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
          nodes={[
            ...actors.map((a, i) => ({
              id: `swimlane-${a.id}`,
              type: 'swimlane',
              position: { x: actorX(i), y: 50 },
              width: 240,
              height: swimlaneHeight,
              draggable: false,
              selectable: false,
              focusable: false,
              zIndex: -1,
              data: { bgColor: `${a.color}15`, borderColor: a.color, label: a.name },
            })),
            ...actors.map((a, i) => ({
              id: `actor-${a.id}`,
              type: 'default',
              position: { x: actorX(i) + 60, y: 0 },
              draggable: false,
              selectable: false,
              focusable: false,
              data: { label: a.name },
              style: { background: a.color, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', fontWeight: 'bold', fontSize: 13, zIndex: 10 },
            })),
            ...nodes,
          ]}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode="Shift"
        >
          <Controls />
          <Background />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  )
}
