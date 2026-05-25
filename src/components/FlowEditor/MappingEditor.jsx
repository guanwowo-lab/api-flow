import { useCallback } from 'react'
import ReactFlow, {
  Controls, Background, MiniMap,
  addEdge, useNodesState, useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useProject } from '../../store/ProjectContext'

export default function MappingEditor() {
  const { state, saveDiagram, dispatch } = useProject()
  const pairs = state.matches?.pairs?.filter((p) => p.confirmed) || []
  const apisA = state.extractA?.apis || []
  const apisB = state.extractB?.apis || []

  const buildInitialNodes = () => {
    const nodes = []
    let y = 0
    for (const pair of pairs) {
      const apiA = apisA[pair.apiAIndex]
      const apiB = apisB[pair.apiBIndex]
      if (!apiA && !apiB) continue

      const labelA = apiA ? (apiA.name || '未命名') : '无'
      const labelB = apiB ? (apiB.name || '未命名') : '无'

      const inputParamsA = (apiA?.inputParams || []).map((p) => p.name).join(', ') || '(无)'
      const inputParamsB = (apiB?.inputParams || []).map((p) => p.name).join(', ') || '(无)'

      nodes.push({
        id: `A-${y}`,
        position: { x: 50, y: y * 200 + 50 },
        data: {
          label: (
            <div className="text-xs">
              <div className="font-bold text-blue-600 mb-1">{labelA}</div>
              <div className="text-gray-500">输入: {inputParamsA}</div>
            </div>
          ),
        },
        style: { background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: 8, padding: 12, width: 280 },
      })

      nodes.push({
        id: `B-${y}`,
        position: { x: 450, y: y * 200 + 50 },
        data: {
          label: (
            <div className="text-xs">
              <div className="font-bold text-green-600 mb-1">{labelB}</div>
              <div className="text-gray-500">输入: {inputParamsB}</div>
            </div>
          ),
        },
        style: { background: '#f0fdf4', border: '1px solid #22c55e', borderRadius: 8, padding: 12, width: 280 },
      })
      y++
    }
    return nodes
  }

  const savedData = state.mappingDiagram?.data
  const [nodes, setNodes, onNodesChange] = useNodesState(
    savedData?.nodes?.length ? savedData.nodes : buildInitialNodes()
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    savedData?.edges?.length ? savedData.edges : []
  )

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5,5' },
      label: '双击编辑映射规则',
    }, eds)),
    [setEdges]
  )

  const onEdgeDoubleClick = useCallback((event, edge) => {
    const label = prompt('映射规则（如：字段改名、类型转换、值映射）:', edge.label || '')
    if (label !== null) {
      setEdges((eds) => eds.map((e) => (e.id === edge.id ? { ...e, label } : e)))
    }
  }, [setEdges])

  const handleSave = async () => {
    const data = { nodes: nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e })) }
    await saveDiagram(state.project.id, state.folder?.id, 'mapping', data)
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center gap-4 p-4 bg-white border-b">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'sequence' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 时序图
        </button>
        <h1 className="text-lg font-bold">参数映射图</h1>
        <span className="text-xs text-gray-400">双击连线编辑映射规则 | 拖拽节点间的端点创建新连线</span>
        <div className="flex-1" />
        <button onClick={handleSave} className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
          保存
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projects' })}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          完成，回到项目列表
        </button>
      </div>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeDoubleClick={onEdgeDoubleClick}
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
