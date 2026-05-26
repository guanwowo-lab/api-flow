import { useCallback, useState, useEffect } from 'react'
import ReactFlow, {
  Controls, Background, MiniMap,
  addEdge, useNodesState, useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useProject } from '../../store/ProjectContext'
import { getAiConfig } from '../../engines/aiParser'
import ApiNode from './nodes/ApiNode'
import SwimlaneNode from './nodes/SwimlaneNode'
import ShapeNode from './nodes/ShapeNode'

const nodeTypes = { apiNode: ApiNode, swimlane: SwimlaneNode, shapeNode: ShapeNode }
const defaultActors = [
  { id: 'user', name: '用户', color: '#8b5cf6' },
  { id: 'client', name: '客户系统', color: '#22c55e' },
  { id: 'our', name: '我方系统', color: '#3b82f6' },
]

export default function SequenceEditor() {
  const { state, saveDiagram, dispatch } = useProject()
  const folders = state.apiFolders || []
  const apisA = folders.flatMap((f) => (f.apis || []).map((a) => ({ ...a })))
  const apisB = state.extractB?.apis || []
  const mappings = state.matches?.mappings || {}
  const savedData = state.sequenceDiagram?.data

  // 多画布管理
  const [diagrams, setDiagrams] = useState(() => {
    if (savedData?.diagrams) return savedData.diagrams
    if (savedData?.nodes) return [{ id: 'd1', name: '默认流程', nodes: savedData.nodes || [], edges: savedData.edges || [], actors: savedData.actors || defaultActors, swimlaneHeight: savedData.swimlaneHeight || 1200 }]
    return [{ id: 'd1', name: '默认流程', nodes: [], edges: [], actors: defaultActors, swimlaneHeight: 1200 }]
  })
  const [currentId, setCurrentId] = useState(diagrams[0]?.id || 'd1')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(true)

  const current = diagrams.find((d) => d.id === currentId) || diagrams[0]

  const [nodes, setNodes, onNodesChange] = useNodesState(current?.nodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(current?.edges || [])
  const [actors, setActors] = useState(current?.actors || defaultActors)
  const [swimlaneHeight, setSwimlaneHeight] = useState(current?.swimlaneHeight || 1200)

  // 同步当前画布数据到 diagrams
  const syncCurrent = useCallback(() => {
    setDiagrams((prev) => prev.map((d) =>
      d.id === currentId ? { ...d, nodes, edges, actors, swimlaneHeight } : d
    ))
  }, [currentId, nodes, edges, actors, swimlaneHeight])

  useEffect(() => { syncCurrent() }, [syncCurrent])

  // 切换画布
  const switchDiagram = (id) => {
    syncCurrent()
    const d = diagrams.find((x) => x.id === id)
    if (d) {
      setCurrentId(id)
      setNodes(d.nodes || [])
      setEdges(d.edges || [])
      setActors(d.actors || defaultActors)
      setSwimlaneHeight(d.swimlaneHeight || 1200)
    }
  }

  const createDiagram = () => {
    const name = prompt('流程名称：')
    if (!name?.trim()) return
    const id = 'd' + Date.now()
    setDiagrams((prev) => [...prev, { id, name: name.trim(), nodes: [], edges: [], actors: defaultActors, swimlaneHeight: 1200 }])
    setCurrentId(id)
    setNodes([]); setEdges([]); setActors(defaultActors); setSwimlaneHeight(1200)
  }

  const renameDiagram = (id) => {
    const d = diagrams.find((x) => x.id === id)
    if (!d) return
    const name = prompt('新名称：', d.name)
    if (name?.trim()) setDiagrams((prev) => prev.map((x) => x.id === id ? { ...x, name: name.trim() } : x))
  }

  const deleteDiagram = (id) => {
    if (diagrams.length <= 1) { alert('至少保留一个画布'); return }
    if (!confirm('确定删除该画布？')) return
    setDiagrams((prev) => prev.filter((x) => x.id !== id))
    if (currentId === id) {
      const remaining = diagrams.filter((x) => x.id !== id)
      switchDiagram(remaining[0]?.id)
    }
  }

  const handleSave = async () => {
    syncCurrent()
    const data = { diagrams }
    await saveDiagram(state.project.id, state.folder?.id, 'sequence', data)
  }

  const [aiGenOpen, setAiGenOpen] = useState(false)
  const [aiGenLoading, setAiGenLoading] = useState(false)
  const [aiGenError, setAiGenError] = useState('')
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
    (params) => setEdges((eds) => addEdge({ ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds)),
    [setEdges]
  )

  const addApiNode = (side, api, index, actorId) => {
    const label = side === 'A' ? (api.name || `我方接口 ${index + 1}`) : (api.name || `客户接口 ${index + 1}`)
    const actorIdx = actors.findIndex((a) => a.id === actorId)
    const x = actorIdx >= 0 ? actorX(actorIdx) + 40 : 300
    const y = 80 + index * 110
    setNodes((nds) => [...nds, { id: `api-${Date.now()}`, type: 'apiNode', position: { x, y }, data: { label, side, method: api.method, url: api.url, actorId, actorName: actors[actorIdx]?.name || '' } }])
  }

  const addShapeNode = (shape, defaultLabel) => {
    setNodes((nds) => [...nds, { id: `shape-${Date.now()}`, type: 'shapeNode', position: { x: 350, y: 200 + Math.random() * 100 }, data: { label: defaultLabel, shape } }])
  }

  const addStartEndNode = (type) => {
    setNodes((nds) => [...nds, { id: `${type}-${Date.now()}`, position: { x: 350, y: type === 'start' ? 10 : 500 }, data: { label: type === 'start' ? '开始' : '结束' }, style: { background: '#f1f5f9', border: '2px solid #64748b', borderRadius: type === 'start' ? '50%' : '8px', padding: '10px 20px', fontWeight: 'bold' } }])
  }

  const handleAiGenerate = async () => {
    setAiGenLoading(true); setAiGenError('')
    try {
      const pairs = []
      for (let ci = 0; ci < apisB.length; ci++) {
        const list = mappings[ci] || []
        const matched = list.filter((m) => m.status === 'matched' && m.ourParam)
        if (matched.length > 0) {
          const ourApiSet = new Set(matched.map((m) => m.ourApiIdx).filter((i) => i >= 0))
          for (const apiIdx of ourApiSet) {
            const ourApi = apisA[apiIdx]; const clientApi = apisB[ci]
            if (ourApi && clientApi) pairs.push({ client: { name: clientApi.name, url: clientApi.url, method: clientApi.method }, our: { name: ourApi.name, url: ourApi.url, method: ourApi.method } })
          }
        }
      }
      if (pairs.length === 0) { setAiGenError('未找到匹配的接口对'); setAiGenLoading(false); return }

      const config = getAiConfig()
      const pairDesc = pairs.map((p, i) => `${i + 1}. 客户: ${p.client.method} ${p.client.name} (${p.client.url})\n   我方: ${p.our.method} ${p.our.name} (${p.our.url})`).join('\n')
      const prompt = `你是一个API时序流程图生成器。根据以下匹配的接口对，生成一个对接流程图。\n\n接口对：\n${pairDesc}\n\n请返回 React Flow 格式的 JSON（只返回JSON）：\n{\n  "nodes": [\n    { "id": "start", "type": "default", "position": {"x": 400, "y": 0}, "data": {"label": "开始"}, "style": {"background": "#f1f5f9", "border": "2px solid #64748b", "borderRadius": "50%", "padding": "10px 20px", "fontWeight": "bold"} },\n    { "id": "c1", "position": {"x": 100, "y": 80}, "data": {"label": "客户\\\\n接口名", "method": "POST", "url": "/api/xxx"}, "style": {"background": "#f0fdf4", "border": "1px solid #22c55e", "borderRadius": 8, "padding": 12, "width": 180} },\n    { "id": "end", "type": "default", "position": {"x": 400, "y": 500}, "data": {"label": "结束"}, "style": {"background": "#f1f5f9", "border": "2px solid #64748b", "borderRadius": 8, "padding": "10px 20px", "fontWeight": "bold"} }\n  ],\n  "edges": [\n    { "id": "e1", "source": "c1", "target": "o1", "animated": true, "markerEnd": {"type": "arrowclosed"}, "style": {"stroke": "#3b82f6", "strokeWidth": 2}, "label": "1. 请求"}\n  ]\n}\n规则：客户节点x=100（绿色背景#f0fdf4），我方节点x=500（蓝色背景#eff6ff），y间隔120px，添加开始结束节点`

      const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, max_tokens: 16384, temperature: 0.1, messages: [{ role: 'user', content: prompt }] }) })
      if (!resp.ok) throw new Error(`AI请求失败 (${resp.status})`)
      const data = await resp.json(); const reply = data?.choices?.[0]?.message?.content || ''
      let jsonStr = reply; const codeBlock = reply.match(/```(?:json)?\s*([\s\S]*?)```/); if (codeBlock) jsonStr = codeBlock[1]
      const parsed = JSON.parse(jsonStr)
      if (parsed.nodes) setNodes(parsed.nodes)
      if (parsed.edges) setEdges(parsed.edges)
      setAiGenOpen(false)
    } catch (e) { setAiGenError(e.message) } finally { setAiGenLoading(false) }
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center gap-3 p-3 bg-white border-b">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-gray-700 text-sm">{sidebarOpen ? '◀' : '▶'}</button>
        <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'match' })} className="text-gray-500 hover:text-gray-700 text-sm">&larr; 返回</button>
        <h1 className="text-lg font-bold">{current?.name || '时序流程图'}</h1>
        <div className="flex-1" />
        <button onClick={() => setActorEditOpen(!actorEditOpen)} className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">👥 主体 ({actors.length})</button>
        <button onClick={() => setAiGenOpen(!aiGenOpen)} className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">🤖 AI 生成</button>
        <button onClick={() => setPaletteOpen(!paletteOpen)} className={`px-2 py-1 rounded text-sm ${paletteOpen ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>☰ 节点库</button>
        <button onClick={handleSave} className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">保存</button>
      </div>

      {actorEditOpen && (
        <div className="mx-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
          <div className="flex items-center justify-between mb-2"><span className="font-medium text-amber-700">👥 流程主体配置</span><button onClick={() => setActorEditOpen(false)} className="text-gray-400 hover:text-gray-600">关闭</button></div>
          <div className="flex flex-wrap gap-2 mb-3">{actors.map((a) => (<span key={a.id} className="px-2 py-1 rounded text-white text-xs" style={{ background: a.color }}>{a.name}{actors.length > 1 && <button onClick={() => setActors(actors.filter((x) => x.id !== a.id))} className="ml-1 opacity-60 hover:opacity-100">&times;</button>}</span>))}</div>
          <div className="flex gap-2 mb-3 items-center"><span className="text-gray-500 text-xs">泳道高度:</span><input type="range" min={400} max={3000} step={100} value={swimlaneHeight} onChange={(e) => setSwimlaneHeight(Number(e.target.value))} className="flex-1" /><span className="text-gray-500 text-xs w-10">{swimlaneHeight}</span></div>
          <div className="flex gap-2"><input value={newActorName} onChange={(e) => setNewActorName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addActor()} className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs outline-none" placeholder="新主体名称" /><button onClick={addActor} disabled={!newActorName.trim()} className="px-3 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 disabled:opacity-50">添加</button></div>
        </div>
      )}

      {aiGenOpen && (
        <div className="mx-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs">
          <div className="flex items-center justify-between mb-2"><span className="font-medium text-purple-700">🤖 AI 自动生成时序流程图</span><button onClick={() => { setAiGenOpen(false); setAiGenError('') }} className="text-gray-400 hover:text-gray-600">关闭</button></div>
          <p className="text-gray-500 mb-2">基于匹配页面已确认的接口对，AI 自动生成时序流程图。</p>
          {aiGenError && <p className="text-red-500 mb-2">{aiGenError}</p>}
          <button onClick={handleAiGenerate} disabled={aiGenLoading} className="px-4 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50">{aiGenLoading ? 'AI 生成中...' : '开始生成'}</button>
        </div>
      )}

      <div className="flex-1 flex">
        {sidebarOpen && (
          <div className="w-48 bg-white border-r border-gray-200 p-3 overflow-y-auto shrink-0"
            onWheel={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500">流程图列表</span>
              <button onClick={createDiagram} className="text-blue-600 hover:underline text-xs">+ 新建</button>
            </div>
            <div className="space-y-1">
              {diagrams.map((d) => (
                <div key={d.id} onClick={() => switchDiagram(d.id)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs ${d.id === currentId ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}>
                  <span className="truncate flex-1">{d.name}</span>
                  <div className="flex gap-0.5 shrink-0 ml-1">
                    <button onClick={(e) => { e.stopPropagation(); renameDiagram(d.id) }} className="text-gray-400 hover:text-blue-500 text-[10px]">✎</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteDiagram(d.id) }} className="text-gray-400 hover:text-red-500 text-[10px]">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1">
          <ReactFlow
            nodes={[
              ...actors.map((a, i) => ({ id: `swimlane-${a.id}`, type: 'swimlane', position: { x: actorX(i), y: 50 }, width: 240, height: swimlaneHeight, draggable: false, selectable: false, focusable: false, zIndex: -1, data: { bgColor: `${a.color}15`, borderColor: a.color, label: a.name } })),
              ...actors.map((a, i) => ({ id: `actor-${a.id}`, type: 'default', position: { x: actorX(i) + 60, y: 0 }, draggable: false, selectable: false, focusable: false, data: { label: a.name }, style: { background: a.color, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', fontWeight: 'bold', fontSize: 13, zIndex: 10 } })),
              ...nodes,
            ]}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView fitViewOptions={{ padding: 0.3 }}
            zoomOnScroll={false} panOnScroll={false}
            deleteKeyCode={['Backspace', 'Delete']}
            multiSelectionKeyCode="Shift"
          ><Controls /><Background /><MiniMap /></ReactFlow>
        </div>

        {paletteOpen && (
          <div className="w-44 bg-white border-l border-gray-200 p-2 overflow-y-auto shrink-0 text-xs"
            onWheel={(e) => e.stopPropagation()}>
            <div className="text-gray-400 font-medium mb-2 px-1">图形节点</div>
            <button onClick={() => addShapeNode('rect', '处理步骤')} className="block w-full text-left px-2 py-1 rounded hover:bg-gray-100 mb-0.5">📦 矩形框</button>
            <button onClick={() => addShapeNode('diamond', '判断条件')} className="block w-full text-left px-2 py-1 rounded hover:bg-gray-100 mb-0.5">🔷 菱形</button>
            <button onClick={() => addShapeNode('circle', '标记')} className="block w-full text-left px-2 py-1 rounded hover:bg-gray-100 mb-0.5">⭕ 圆形</button>
            <button onClick={() => addShapeNode('note', '备注')} className="block w-full text-left px-2 py-1 rounded hover:bg-gray-100 mb-0.5">📝 备注</button>
            <button onClick={() => addStartEndNode('start')} className="block w-full text-left px-2 py-1 rounded hover:bg-gray-100 mb-0.5">▶ 开始</button>
            <button onClick={() => addStartEndNode('end')} className="block w-full text-left px-2 py-1 rounded hover:bg-gray-100 mb-0.5">⏹ 结束</button>
          </div>
        )}
      </div>
    </div>
  )
}
