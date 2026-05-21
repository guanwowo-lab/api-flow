import { Handle, Position } from 'reactflow'

export default function ApiNode({ data }) {
  const isLeft = data.side === 'A'
  return (
    <div className={`px-4 py-2 rounded-lg border-2 min-w-[160px] text-sm ${isLeft ? 'border-blue-400 bg-blue-50' : 'border-green-400 bg-green-50'}`}>
      <Handle type="target" position={Position.Left} />
      <div className="font-medium">{data.label}</div>
      <div className="text-xs text-gray-500 font-mono">{data.method} {data.url}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
