import { useState } from 'react'
import { Handle, Position } from 'reactflow'

export default function ApiNode({ data }) {
  const isLeft = data.side === 'A'
  const [expanded, setExpanded] = useState(data.collapsed ? false : true)
  const collapsed = !expanded

  if (collapsed) {
    return (
      <div onClick={() => setExpanded(true)}
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: isLeft ? '#3b82f6' : '#22c55e',
          border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#fff', fontWeight: 'bold',
        }}
      >
        <Handle type="target" position={Position.Top} style={{ background: '#94a3b8', width: 6, height: 6 }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#94a3b8', width: 6, height: 6 }} />
        <Handle type="target" position={Position.Left} style={{ background: '#94a3b8', width: 6, height: 6 }} />
        <Handle type="source" position={Position.Right} style={{ background: '#94a3b8', width: 6, height: 6 }} />
        {(data.label || 'API')[0]}
      </div>
    )
  }

  return (
    <div onClick={() => setExpanded(false)}
      className={`px-3 py-1.5 rounded-lg border-2 min-w-[120px] text-xs cursor-pointer ${isLeft ? 'border-blue-400 bg-blue-50' : 'border-green-400 bg-green-50'}`}>
      <Handle type="target" position={Position.Left} style={{ background: '#94a3b8', width: 6, height: 6 }} />
      <div className="font-medium">{data.label}</div>
      <div className="text-[10px] text-gray-500 font-mono">{data.method} {data.url}</div>
      <Handle type="source" position={Position.Right} style={{ background: '#94a3b8', width: 6, height: 6 }} />
    </div>
  )
}
