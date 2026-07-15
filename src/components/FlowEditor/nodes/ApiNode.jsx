import { useState } from 'react'
import { Handle, Position } from 'reactflow'

export default function ApiNode({ data, selected }) {
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
          width: 30, height: 30, borderRadius: '50%',
          background: color, border: '2px solid #fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#fff', fontWeight: 'bold',
        }}
      >
        <Handle type="source" id="st" position={Position.Top} style={{ background: color, width: 6, height: 6, opacity: (data.connectMode || selected) ? 1 : 0 }} />
        <Handle type="source" id="sb" position={Position.Bottom} style={{ background: color, width: 6, height: 6, opacity: (data.connectMode || selected) ? 1 : 0 }} />
        <Handle type="source" id="sl" position={Position.Left} style={{ background: color, width: 6, height: 6, opacity: (data.connectMode || selected) ? 1 : 0 }} />
        <Handle type="source" id="sr" position={Position.Right} style={{ background: color, width: 6, height: 6, opacity: (data.connectMode || selected) ? 1 : 0 }} />
        {(data.label || 'A')[0]}
      </div>

      {/* 浮窗 */}
      {showPopup && (
        <div style={{
          position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
          background: bg, border: `2px solid ${border}`, borderRadius: 8,
          padding: '6px 10px', zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: 12,
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 600 }}>{data.label}</div>
        </div>
      )}
    </div>
  )
}
