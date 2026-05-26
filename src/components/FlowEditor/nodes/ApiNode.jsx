import { useState } from 'react'
import { Handle, Position } from 'reactflow'

export default function ApiNode({ data }) {
  const isLeft = data.side === 'A'
  const [showPopup, setShowPopup] = useState(false)
  const color = isLeft ? '#3b82f6' : '#22c55e'
  const bg = isLeft ? '#eff6ff' : '#f0fdf4'
  const border = isLeft ? '#3b82f6' : '#22c55e'

  return (
    <div style={{ position: 'relative' }}>
      {/* 小圆点 */}
      <div onClick={(e) => { e.stopPropagation(); setShowPopup(!showPopup) }}
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: color, border: '2px solid #fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#fff', fontWeight: 'bold',
        }}
      >
        <Handle type="source" id="t" position={Position.Top} style={{ background: color, width: 6, height: 6 }} />
        <Handle type="source" id="b" position={Position.Bottom} style={{ background: color, width: 6, height: 6 }} />
        <Handle type="source" id="l" position={Position.Left} style={{ background: color, width: 6, height: 6 }} />
        <Handle type="source" id="r" position={Position.Right} style={{ background: color, width: 6, height: 6 }} />
        {(data.label || 'A')[0]}
      </div>

      {/* 浮窗 */}
      {showPopup && (
        <div style={{
          position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
          background: bg, border: `2px solid ${border}`, borderRadius: 8,
          padding: '8px 12px', minWidth: 160, zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: 12,
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{data.label}</div>
          <div style={{ color: '#666', fontFamily: 'monospace', fontSize: 11 }}>
            <span style={{
              display: 'inline-block', background: color, color: '#fff', borderRadius: 3,
              padding: '0 4px', marginRight: 4, fontSize: 10, fontWeight: 600,
            }}>{data.method}</span>
            {data.url}
          </div>
        </div>
      )}
    </div>
  )
}
