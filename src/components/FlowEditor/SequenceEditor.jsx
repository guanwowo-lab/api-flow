import { useCallback, useState, useEffect, useRef } from 'react'
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
  { id: 'user', name: '用户', color: '#8b5cf6', width: 240 },
  { id: 'client', name: '客户系统', color: '#22c55e', width: 240 },
  { id: 'our', name: '我方系统', color: '#3b82f6', width: 240 },
]

export default function SequenceEditor() {
  const { state, saveDiagram, dispatch } = useProject()
  const folders = Array.isArray(state.apiFolders) ? state.apiFolders : []
  const apisA = folders.flatMap((f) => (Array.isArray(f.apis) ? f.apis : []).map((a) => ({ ...a })))
  const apisB = state.extractB?.apis || []
  const mappings = state.matches?.mappings || {}
  const savedData = state.sequenceDiagram?.data

  // 多画布管理 — 清理不可序列化的数据
  const cleanData = (data) => {
    if (!data) return null
    if (data.diagrams) {
      return {
        ...data,
        diagrams: data.diagrams.map((d) => ({
          ...d,
          nodes: (d.nodes || []).map((n) => {
            const { setNodes, connectMode, ...rest } = n.data || {}
            return { ...n, data: rest }
          }),
        })),
      }
    }
    return data
  }

  const [diagrams, setDiagrams] = useState(() => {
    const cleaned = cleanData(savedData)
    if (cleaned?.diagrams?.length) return cleaned.diagrams
    if (cleaned?.nodes) return [{ id: 'd1', name: '默认流程', nodes: (cleaned.nodes || []).map((n) => { const { setNodes: _, connectMode: __, ...rest } = n.data || {}; return { ...n, data: rest } }), edges: cleaned.edges || [], actors: cleaned.actors || defaultActors, swimlaneHeight: cleaned.swimlaneHeight || 1200 }]
    return [{ id: 'd1', name: '默认流程', nodes: [], edges: [], actors: defaultActors, swimlaneHeight: 1200 }]
  })
  const [currentId, setCurrentId] = useState(diagrams[0]?.id || 'd1')
  const current = diagrams.find((d) => d.id === currentId) || diagrams[0] || { nodes: [], edges: [], actors: defaultActors, swimlaneHeight: 1200 }
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(true)
  const rfRef = useRef(null)

  const [nodes, setNodes, onNodesChange] = useNodesState(current.nodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(current.edges || [])
  const [actors, setActors] = useState(current.actors || defaultActors)
  const [swimlaneHeight, setSwimlaneHeight] = useState(current.swimlaneHeight || 1200)

  const viewportCenter = () => {
    const rf = rfRef.current
    if (!rf) return { x: 400, y: 200 }
    try {
      const vp = rf.getViewport()
      const el = document.querySelector('.react-flow__viewport')
      const w = el?.clientWidth || 800
      const h = el?.clientHeight || 600
      return { x: (-vp.x + w / 2) / vp.zoom, y: (-vp.y + h / 2) / vp.zoom }
    } catch { return { x: 400, y: 200 } }
  }

  // 拖放节点到画布
  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }, [])
  const onDrop = useCallback((e) => {
    e.preventDefault()
    const rf = rfRef.current
    if (!rf) return
    try {
      const type = e.dataTransfer.getData('application/reactflow-type')
      const shape = e.dataTransfer.getData('application/reactflow-shape')
      const side = e.dataTransfer.getData('application/reactflow-side')
      const indexStr = e.dataTransfer.getData('application/reactflow-index')
      const label = e.dataTransfer.getData('application/reactflow-label')
      const method = e.dataTransfer.getData('application/reactflow-method')
      const url = e.dataTransfer.getData('application/reactflow-url')

      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })

      if (type === 'shape') {
        const sizes = { rect: { w: 140, h: 50 }, diamond: { w: 120, h: 80 }, circle: { w: 90, h: 90 }, note: { w: 140, h: 70 }, end: { w: 140, h: 50 }, ellipse: { w: 140, h: 60 } }
        const s = sizes[shape] || { w: 140, h: 50 }
        setNodes((nds) => [...nds, { id: `${shape}-${Date.now()}`, type: 'shapeNode', position: { x: pos.x - s.w/2, y: pos.y - s.h/2 }, width: s.w, height: s.h, data: { label, shape, setNodes } }])
      } else if (type === 'startend') {
        const isStart = shape === 'start'
        setNodes((nds) => [...nds, { id: `${shape}-${Date.now()}`, type: 'shapeNode', position: { x: pos.x - 70, y: pos.y - (isStart?30:25) }, width: 140, height: isStart?60:50, data: { label: isStart?'开始':'结束', shape: isStart?'ellipse':'end' } }])
      } else if (type === 'api') {
        const apiSide = side === 'our' ? 'A' : 'B'
        const actorIdx = actors.findIndex((a) => a.id === side)
        setNodes((nds) => [...nds, { id: `api-${Date.now()}`, type: 'apiNode', position: { x: pos.x - 15, y: pos.y - 15 }, width: 30, height: 30, data: { label, side: apiSide, method, url, actorId: side, actorName: actors[actorIdx]?.name || '', collapsed: true } }])
      }
    } catch (err) {
      console.error('Drop failed:', err)
    }
  }, [setNodes, actors])

  // 挂载时禁止页面滚动，卸载时恢复
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // 键盘方向键 1px 微调
  useEffect(() => {
    const handler = (e) => {
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      e.preventDefault()
      setNodes((nds) => nds.map((n) => n.selected ? { ...n, position: { x: n.position.x + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0), y: n.position.y + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0) } } : n))
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // 切换画布
  const doSwitch = (id) => {
    // 保存当前画布状态
    setDiagrams((prev) => prev.map((d) => d.id === currentId ? { ...d, nodes, edges, actors, swimlaneHeight } : d))
    const d = diagrams.find((x) => x.id === id)
    if (d) {
      setCurrentId(id)
      setNodes(d.nodes || [])
      setEdges(d.edges || [])
      setActors(d.actors || defaultActors)
      setSwimlaneHeight(d.swimlaneHeight || 1200)
    }
  }

  const switchDiagram = (id) => {
    justLoaded.current = true
    doSwitch(id)
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

  const [saved, setSaved] = useState(true)
  const justLoaded = useRef(true)

  const handleSave = async () => {
    try {
      const stripNodeData = (ns) => ns.map((n) => {
        const { setNodes, connectMode, ...rest } = n.data || {}
        return { ...n, data: rest }
      })
      const updatedDiagrams = diagrams.map((d) =>
        d.id === currentId ? { ...d, nodes: stripNodeData(nodes), edges, actors, swimlaneHeight } : d
      )
      setDiagrams(updatedDiagrams)
      await saveDiagram(state.project.id, state.folder?.id, 'sequence', { diagrams: updatedDiagrams })
      setSaved(true)
    } catch (e) {
      alert('保存失败: ' + (e.message || '未知错误'))
    }
  }

  // 节点、连线、主体变更时标记未保存（跳过画布切换）
  useEffect(() => {
    if (justLoaded.current) { justLoaded.current = false; return }
    setSaved(false)
  }, [nodes, edges, actors, swimlaneHeight])

  const [aiGenOpen, setAiGenOpen] = useState(false)
  const [aiGenLoading, setAiGenLoading] = useState(false)
  const [aiGenError, setAiGenError] = useState('')
  const [aiFlowDesc, setAiFlowDesc] = useState('')
  const [aiOutputFormat, setAiOutputFormat] = useState('')

  const buildAiPrompt = () => {
    const actorDesc = actors.map((a) => a.name).join('、')
    return `你是一个API时序流程图生成器。请根据以下信息生成对接流程图。

**参与主体：**
${actorDesc}

**流程说明：**
${aiFlowDesc || '根据匹配的接口对自动推断流程'}

**输出格式要求：**
${aiOutputFormat || '客户节点放左边（x=100，绿色背景），我方节点放右边（x=500，蓝色背景），y坐标间隔120px，添加开始和结束节点'}

**已匹配的接口对：**
{pairs_placeholder}

请返回 React Flow 格式的 JSON（只返回JSON）：
{
  "nodes": [
    { "id": "start", "type": "default", "position": {"x": 400, "y": 0}, "data": {"label": "开始"}, "style": {"background": "#f1f5f9", "border": "2px solid #64748b", "borderRadius": "50%", "padding": "10px 20px", "fontWeight": "bold"} },
    { "id": "c1", "position": {"x": 100, "y": 80}, "data": {"label": "客户\\\\n接口名", "method": "POST", "url": "/api/xxx"}, "style": {"background": "#f0fdf4", "border": "1px solid #22c55e", "borderRadius": 8, "padding": 12, "width": 180} },
    { "id": "end", "type": "default", "position": {"x": 400, "y": 500}, "data": {"label": "结束"}, "style": {"background": "#f1f5f9", "border": "2px solid #64748b", "borderRadius": 8, "padding": "10px 20px", "fontWeight": "bold"} }
  ],
  "edges": [
    { "id": "e1", "source": "c1", "target": "o1", "animated": true, "markerEnd": {"type": "arrowclosed"}, "style": {"stroke": "#3b82f6", "strokeWidth": 2}, "label": "1. 请求"}
  ]
}
只返回JSON，不要解释。`
  }
  const [connectMode, setConnectMode] = useState(false)
  // 撤销历史：最多存50步
  const historyRef = useRef([])
  const historyIdxRef = useRef(-1)
  const skipHistoryRef = useRef(false)

  const pushHistory = (nds, eds) => {
    if (skipHistoryRef.current) return
    const snapshot = { nodes: nds.map((n) => ({ ...n })), edges: eds.map((e) => ({ ...e })) }
    const hist = historyRef.current
    hist.splice(historyIdxRef.current + 1)
    hist.push(snapshot)
    if (hist.length > 50) hist.shift()
    historyIdxRef.current = hist.length - 1
  }

  const undo = () => {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current--
    const snap = historyRef.current[historyIdxRef.current]
    if (snap) {
      skipHistoryRef.current = true
      setNodes(snap.nodes); setEdges(snap.edges)
      setTimeout(() => { skipHistoryRef.current = false })
    }
  }

  const redo = () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return
    historyIdxRef.current++
    const snap = historyRef.current[historyIdxRef.current]
    if (snap) {
      skipHistoryRef.current = true
      setNodes(snap.nodes); setEdges(snap.edges)
      setTimeout(() => { skipHistoryRef.current = false })
    }
  }

  // 键盘快捷键
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  })

  // 每次 nodes/edges 变化时推入历史
  useEffect(() => {
    if (!skipHistoryRef.current) pushHistory(nodes, edges)
  }, [nodes, edges])
  const [actorEditOpen, setActorEditOpen] = useState(false)
  const [newActorName, setNewActorName] = useState('')

  const addActor = () => {
    const name = newActorName.trim()
    if (!name) return
    const colors = ['#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
    setActors([...actors, { id: 'a' + Date.now(), name, color: colors[actors.length % colors.length] }])
    setNewActorName('')
  }

  const actorX = (index) => {
    let x = 60
    for (let j = 0; j < index; j++) x += (actors[j]?.width || 240) + 20
    return x
  }

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds)),
    [setEdges]
  )

  const addApiNode = (side, api, index, actorId) => {
    const label = side === 'A' ? (api.name || `我方接口 ${index + 1}`) : (api.name || `客户接口 ${index + 1}`)
    const actorIdx = actors.findIndex((a) => a.id === actorId)
    const center = viewportCenter()
    const x = actorIdx >= 0 ? actorX(actorIdx) + 40 : center.x
    const y = actorIdx >= 0 ? 80 + index * 110 : center.y + index * 40
    setNodes((nds) => [...nds, { id: `api-${Date.now()}`, type: 'apiNode', position: { x, y }, width: 30, height: 30, data: { label, side, method: api.method, url: api.url, actorId, actorName: actors[actorIdx]?.name || '', collapsed: true } }])
  }

  const addShapeNode = (shape, defaultLabel) => {
    const sizes = { rect: { w: 140, h: 50 }, diamond: { w: 120, h: 80 }, circle: { w: 90, h: 90 }, note: { w: 140, h: 70 }, end: { w: 140, h: 50 }, ellipse: { w: 140, h: 60 } }
    const s = sizes[shape] || { w: 140, h: 50 }
    const center = viewportCenter()
    setNodes((nds) => [...nds, { id: `shape-${Date.now()}`, type: 'shapeNode', position: { x: center.x - s.w / 2 + (Math.random() - 0.5) * 100, y: center.y - s.h / 2 + (Math.random() - 0.5) * 60 }, width: s.w, height: s.h, data: { label: defaultLabel, shape, setNodes } }])
  }

  const addStartEndNode = (type) => {
    const center = viewportCenter()
    const isStart = type === 'start'
    setNodes((nds) => [...nds, { id: `${type}-${Date.now()}`, type: 'shapeNode', position: { x: center.x - 70, y: center.y + (isStart ? -100 : 80) }, width: 140, height: isStart ? 60 : 50, data: { label: isStart ? '开始' : '结束', shape: isStart ? 'ellipse' : 'end' } }])
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
      const prompt = buildAiPrompt().replace('{pairs_placeholder}', pairDesc)

      const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, max_tokens: 16384, temperature: 0.1, messages: [{ role: 'user', content: prompt }] }) })
      if (!resp.ok) throw new Error(`AI请求失败 (${resp.status})`)
      const data = await resp.json(); const reply = data?.choices?.[0]?.message?.content || ''
      let jsonStr = reply; const codeBlock = reply.match(/```(?:json)?\s*([\s\S]*?)```/); if (codeBlock) jsonStr = codeBlock[1]
      const parsed = JSON.parse(jsonStr)
      if (parsed.nodes) {
        const sizes = { rect: { w: 140, h: 50 }, diamond: { w: 120, h: 80 }, circle: { w: 90, h: 90 }, note: { w: 140, h: 70 }, end: { w: 140, h: 50 }, ellipse: { w: 140, h: 60 } }
        const converted = parsed.nodes.map((n) => {
          const x = n.position?.x || 350
          const label = n.data?.label || ''
          const np = { position: n.position || { x: 350, y: 100 }, data: { label, setNodes, connectMode: false } }

          // 判断节点类型并设置对应的 shape 和尺寸
          if (label === '开始') {
            return { ...np, id: n.id, type: 'shapeNode', width: sizes.ellipse.w, height: sizes.ellipse.h, data: { ...np.data, shape: 'ellipse', actorId: 'user' } }
          }
          if (label === '结束') {
            return { ...np, id: n.id, type: 'shapeNode', width: sizes.end.w, height: sizes.end.h, data: { ...np.data, shape: 'end', actorId: 'user' } }
          }
          // API 节点（带 method 和 url）
          if (n.data?.method && n.data?.url) {
            const side = x < 250 ? 'B' : 'A'
            return { ...np, id: n.id, type: 'apiNode', width: 30, height: 30, data: { ...np.data, label, side, method: n.data.method, url: n.data.url, collapsed: true, actorId: side === 'A' ? 'our' : 'client' } }
          }
          // 根据标签关键词推断形状
          const isDiamond = /判断|条件|是否|验证|校验|检查|确认/.test(label)
          const shape = isDiamond ? 'diamond' : 'rect'
          const s = sizes[shape] || sizes.rect
          // 分配主体
          let actorId = 'user'
          if (x < 250) actorId = 'client'
          else if (x > 350) actorId = 'our'
          return { ...np, id: n.id, type: 'shapeNode', width: s.w, height: s.h, data: { ...np.data, shape, actorId } }
        })
        setNodes(converted)
      }
      if (parsed.edges) {
        const stepped = parsed.edges.map((e) => ({
          ...e, type: 'smoothstep', animated: true,
          markerEnd: e.markerEnd || { type: 'arrowclosed' },
          style: { stroke: '#3b82f6', strokeWidth: 2, ...(e.style || {}) },
        }))
        setEdges(stepped)
      }
      setAiGenOpen(false)
    } catch (e) { setAiGenError(e.message) } finally { setAiGenLoading(false) }
  }

  if (!current) return <div className="p-8 text-center text-gray-400">加载中...</div>

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center gap-3 p-3 bg-white border-b">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-gray-700 text-sm">{sidebarOpen ? '◀' : '▶'}</button>
        <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'match' })} className="text-gray-500 hover:text-gray-700 text-sm">&larr; 返回</button>
        <h1 className="text-lg font-bold">{current?.name || '时序流程图'}</h1>
        <div className="flex-1" />
        <button onClick={() => setActorEditOpen(!actorEditOpen)} className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">👥 主体 ({actors.length})</button>
        <button onClick={() => setAiGenOpen(!aiGenOpen)} className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">🤖 AI 生成</button>
        <button onClick={() => setConnectMode(!connectMode)} className={`px-2 py-1 rounded text-sm ${connectMode ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>🔗 连线</button>
        <button onClick={() => setPaletteOpen(!paletteOpen)} className={`px-2 py-1 rounded text-sm ${paletteOpen ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>☰ 节点库</button>
        <button onClick={handleSave} className={`px-3 py-1 rounded text-sm text-white ${saved ? 'bg-green-600' : 'bg-orange-500 hover:bg-orange-600 animate-pulse'}`}>{saved ? '已保存 ✓' : '● 点击保存'}</button>
      </div>

      {actorEditOpen && (
        <div className="mx-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
          <div className="flex items-center justify-between mb-2"><span className="font-medium text-amber-700">👥 流程主体配置</span><button onClick={() => setActorEditOpen(false)} className="text-gray-400 hover:text-gray-600">关闭</button></div>
          <div className="flex flex-wrap gap-2 mb-3">{actors.map((a) => (<span key={a.id} className="inline-flex items-center gap-1 px-2 py-1 rounded text-white text-xs" style={{ background: a.color }}><input value={a.name} onChange={(e) => setActors(actors.map((x) => x.id === a.id ? { ...x, name: e.target.value } : x))} className="bg-transparent border-b border-white/30 outline-none w-20 text-white text-xs" /><ColorPicker color={a.color} onChange={(c) => setActors(actors.map((x) => x.id === a.id ? { ...x, color: c } : x))} /><input type="number" value={a.width||240} onChange={(e) => setActors(actors.map((x) => x.id === a.id ? { ...x, width: Number(e.target.value)||240 } : x))} className="bg-white/20 rounded px-1 w-12 text-white text-xs outline-none" min={100} max={500} step={10} /><button onClick={() => setActors(actors.filter((x) => x.id !== a.id))} className="opacity-60 hover:opacity-100">&times;</button></span>))}</div>
          <div className="flex gap-2 mb-3 items-center"><span className="text-gray-500 text-xs">泳道高度:</span><input type="range" min={400} max={3000} step={100} value={swimlaneHeight} onChange={(e) => setSwimlaneHeight(Number(e.target.value))} className="flex-1" /><span className="text-gray-500 text-xs w-10">{swimlaneHeight}</span></div>
          <div className="flex gap-2"><input value={newActorName} onChange={(e) => setNewActorName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addActor()} className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs outline-none" placeholder="新主体名称" /><button onClick={addActor} disabled={!newActorName.trim()} className="px-3 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 disabled:opacity-50">添加</button></div>
        </div>
      )}

      {aiGenOpen && (
        <div className="mx-4 p-4 bg-purple-50 border border-purple-200 rounded-lg text-xs">
          <div className="flex items-center justify-between mb-3"><span className="font-medium text-purple-700">🤖 AI 生成流程图</span><button onClick={() => { setAiGenOpen(false); setAiGenError('') }} className="text-gray-400 hover:text-gray-600">关闭</button></div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="flex flex-col gap-1">
              <span className="text-purple-700 font-medium">参与主体</span>
              <span className="text-gray-400 text-[10px]">当前画布主体：{actors.map(a=>a.name).join('、')}</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-purple-700 font-medium">输出方式</span>
              <input value={aiOutputFormat} onChange={(e) => setAiOutputFormat(e.target.value)}
                className="px-2 py-1 border border-purple-200 rounded outline-none text-xs"
                placeholder="如：客户左我方右，竖向排列，标注序号" />
            </label>
          </div>
          <label className="flex flex-col gap-1 mb-3">
            <span className="text-purple-700 font-medium">流程说明</span>
            <textarea value={aiFlowDesc} onChange={(e) => setAiFlowDesc(e.target.value)}
              className="w-full h-20 px-3 py-2 border border-purple-200 rounded outline-none resize-none text-xs"
              placeholder="描述业务流程，AI 据此推断节点和顺序。例如：用户发起下单请求→我方验证库存→调用第三方支付→返回结果" />
          </label>
          {aiGenError && <p className="text-red-500 mb-2">{aiGenError}</p>}
          <button onClick={handleAiGenerate} disabled={aiGenLoading}
            className="px-4 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50 w-full">
            {aiGenLoading ? 'AI 生成中...' : `开始生成（${apisB.length} 个客户接口已匹配）`}
          </button>
        </div>
      )}

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {sidebarOpen && (
          <div className="w-48 bg-white border-r border-gray-200 p-3 overscroll-contain" style={{ overflowY: 'auto', height: '100%' }}>
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

        <div className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            onInit={(instance) => { rfRef.current = instance }}
            nodes={[
              ...actors.map((a, i) => ({ id: `swimlane-${a.id}`, type: 'swimlane', position: { x: actorX(i), y: 50 }, width: a.width || 240, height: swimlaneHeight, draggable: false, selectable: false, focusable: false, zIndex: -1, data: { bgColor: `${a.color}15`, borderColor: a.color, label: a.name, height: swimlaneHeight, width: a.width || 240 } })),
              ...actors.map((a, i) => ({ id: `actor-${a.id}`, type: 'default', position: { x: actorX(i) + 60, y: 0 }, draggable: false, selectable: false, focusable: false, data: { label: a.name }, style: { background: a.color, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', fontWeight: 'bold', fontSize: 13, zIndex: 10 } })),
              ...nodes.map((n) => ({ ...n, data: { ...n.data, setNodes, connectMode } })),
            ]}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            connectionMode="loose"
            nodeTypes={nodeTypes}
            fitView fitViewOptions={{ padding: 0.3 }}
            zoomOnScroll={false} panOnScroll={false}
            snapToGrid={true} snapGrid={[1, 1]}
            deleteKeyCode={['Backspace', 'Delete']}
            multiSelectionKeyCode="Shift"
          ><Controls /><Background /><MiniMap /></ReactFlow>
        </div>

        {paletteOpen && (
          <div className="w-44 bg-white border-l border-gray-200 p-2 text-xs overscroll-contain" style={{ overflowY: 'auto', height: '100%' }}>
            <div className="text-gray-400 font-medium mb-2 px-1">图形节点（可拖放）</div>
            {[{shape:'rect',label:'处理步骤',icon:'📦'},{shape:'diamond',label:'判断条件',icon:'🔷'},{shape:'circle',label:'标记',icon:'⭕'},{shape:'note',label:'备注',icon:'📝'}].map(({shape,label,icon}) => (
              <button key={shape} draggable onDragStart={(e) => { e.dataTransfer.setData('application/reactflow-type','shape'); e.dataTransfer.setData('application/reactflow-shape',shape); e.dataTransfer.setData('application/reactflow-label',label); e.dataTransfer.effectAllowed='move' }} onClick={() => addShapeNode(shape, label)} className="block w-full text-left px-2 py-1 rounded hover:bg-gray-100 mb-0.5">{icon} {label}</button>
            ))}
            {[{type:'start',label:'开始',icon:'▶'},{type:'end',label:'结束',icon:'⏹'}].map(({type,label,icon}) => (
              <button key={type} draggable onDragStart={(e) => { e.dataTransfer.setData('application/reactflow-type','startend'); e.dataTransfer.setData('application/reactflow-shape',type); e.dataTransfer.setData('application/reactflow-label',label); e.dataTransfer.effectAllowed='move' }} onClick={() => addStartEndNode(type)} className="block w-full text-left px-2 py-1 rounded hover:bg-gray-100 mb-0.5">{icon} {label}</button>
            ))}
            <div className="border-t my-2" />
            <div className="text-gray-400 font-medium mb-1 px-1">我方接口（可拖放）</div>
            {apisA.map((api, i) => (
              <button key={`a-${i}`} draggable onDragStart={(e) => { e.dataTransfer.setData('application/reactflow-type','api'); e.dataTransfer.setData('application/reactflow-side','our'); e.dataTransfer.setData('application/reactflow-index',String(i)); e.dataTransfer.setData('application/reactflow-label',api.name||`接口${i+1}`); e.dataTransfer.setData('application/reactflow-method',api.method||'GET'); e.dataTransfer.setData('application/reactflow-url',api.url||''); e.dataTransfer.effectAllowed='move' }} onClick={() => addApiNode('A', api, i, 'our')} className="block w-full text-left px-2 py-0.5 rounded hover:bg-blue-50 truncate">{api.name || `接口${i + 1}`}</button>
            ))}
            <div className="border-t my-2" />
            <div className="text-gray-400 font-medium mb-1 px-1">客户接口（可拖放）</div>
            {apisB.map((api, i) => (
              <button key={`b-${i}`} draggable onDragStart={(e) => { e.dataTransfer.setData('application/reactflow-type','api'); e.dataTransfer.setData('application/reactflow-side','client'); e.dataTransfer.setData('application/reactflow-index',String(i)); e.dataTransfer.setData('application/reactflow-label',api.name||`接口${i+1}`); e.dataTransfer.setData('application/reactflow-method',api.method||'GET'); e.dataTransfer.setData('application/reactflow-url',api.url||''); e.dataTransfer.effectAllowed='move' }} onClick={() => addApiNode('B', api, i, 'client')} className="block w-full text-left px-2 py-0.5 rounded hover:bg-green-50 truncate">{api.name || `接口${i + 1}`}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ColorPicker({ color, onChange }) {
  const [open, setOpen] = useState(false)
  const colors = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b','#06b6d4']
  return (
    <span className="relative inline-flex">
      <button onClick={() => setOpen(!open)} className="w-4 h-4 rounded-full border border-white/40" style={{ background: color }} />
      {open && (
        <span className="absolute top-full left-0 mt-1 bg-white rounded shadow-lg p-1.5 flex gap-1 z-20" onMouseLeave={() => setOpen(false)}>
          {colors.map((c) => (
            <button key={c} onClick={() => { onChange(c); setOpen(false) }}
              className="w-4 h-4 rounded-full border border-gray-300 hover:scale-125 transition-transform"
              style={{ background: c, outline: color===c?'2px solid #3b82f6':'none', outlineOffset: 1 }} />
          ))}
        </span>
      )}
    </span>
  )
}
