import { useState } from 'react'
import { Handle, Position } from 'reactflow'

const shapeStyles = {
  rect: { borderRadius: 6, minWidth: 120, padding: '10px 20px' },
  diamond: { transform: 'rotate(45deg)', borderRadius: 4, width: 80, height: 80, padding: 0 },
  circle: { borderRadius: '50%', width: 90, height: 90, padding: 0 },
  note: { borderRadius: '2px 2px 2px 16px', minWidth: 100, padding: '10px 16px', background: '#fef9c3', border: '1px solid #eab308' },
}

export default function ShapeNode({ data }) {
  const [label, setLabel] = useState(data.label || '')
  const [editing, setEditing] = useState(false)
  const style = shapeStyles[data.shape] || shapeStyles.rect
  const isDiamond = data.shape === 'diamond'
  const isCircle = data.shape === 'circle'

  const handleDoubleClick = () => setEditing(true)

  const finishEdit = () => {
    setEditing(false)
    data.label = label
  }

  return (
    <div onDoubleClick={handleDoubleClick}
      style={{
        ...style,
        background: style.background || '#f8fafc',
        border: `2px solid ${isDiamond ? '#f59e0b' : isCircle ? '#64748b' : '#3b82f6'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: 12, fontWeight: 500,
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#94a3b8' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#94a3b8' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#94a3b8' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#94a3b8' }} />

      {editing ? (
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={finishEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') finishEdit() }}
          style={{
            ...(isDiamond ? { transform: 'rotate(-45deg)', width: 70 } : {}),
            ...(isCircle ? { width: 60, textAlign: 'center' } : {}),
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: 12, fontWeight: 500, textAlign: 'center',
          }}
        />
      ) : (
        <span style={{
          ...(isDiamond ? { transform: 'rotate(-45deg)', width: 70 } : {}),
          textAlign: 'center', wordBreak: 'break-word',
        }}>
          {label || '双击编辑'}
        </span>
      )}
    </div>
  )
}
