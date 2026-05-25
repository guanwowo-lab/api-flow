import { useCallback } from 'react'
import ReactFlow, {
  Controls, Background, MiniMap,
  addEdge, useNodesState, useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useProject } from '../../store/ProjectContext'
import ApiNode from './nodes/ApiNode'

const nodeTypes = { apiNode: ApiNode }

export default function SequenceEditor() {
  const { state, saveDiagram, dispatch } = useProject()
  const apisA = state.extractA?.apis || []
  const apisB = state.extractB?.apis || []

  const savedData = state.sequenceDiagram?.data

  const [nodes, setNodes, onNodesChange] = useNodesState(
    savedData?.nodes?.length ? savedData.nodes : []
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    savedData?.edges?.length ? savedData.edges : []
  )

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
