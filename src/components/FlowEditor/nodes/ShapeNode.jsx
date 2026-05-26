import { useState } from 'react'
import { Handle, Position, NodeResizer } from 'reactflow'
import '@reactflow/node-resizer/dist/style.css'

const defaults = {
  rect: { borderRadius: 6, background: '#f8fafc', border: '2px solid #3b82f6' },
  diamond: { borderRadius: 6, background: '#f8fafc', border: '2px solid #f59e0b', transform: 'rotate(45deg)' },
  circle: { borderRadius: '50%', background: '#f8fafc', border: '2px solid #64748b' },
  note: { borderRadius: '2px 2px 2px 16px', background: '#fef9c3', border: '1px solid #eab308' },
}

export default function ShapeNode({ data, selected, width, height }) {
  const [label, setLabel] = useState(data.label || '')
  const [editing, setEditing] = useState(false)
  const def = defaults[data.shape] || defaults.rect
  const isDiamond = data.shape === 'diamond'
  const isCircle = data.shape === 'circle'

  const w = width || 140
  const h = height || 50

  const handleDoubleClick = () => setEditing(true)
  const finishEdit = () => { setEditing(false); data.label = label }

  const isSquare = isCircle || isDiamond
  const dw = isSquare ? Math.min(w, h) : w
  const dh = isSquare ? Math.min(w, h) : h

  return (
    <div style={{
      width: dw, height: dh,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...def,
      cursor: 'pointer', fontSize: 12, fontWeight: 500, position: 'relative',
      boxSizing: 'border-box',
    }}>
      <NodeResizer minWidth={60} minHeight={30} color="#3b82f6" />
      <Handle type="target" position={Position.Top} style={{ background: '#94a3b8' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#94a3b8' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#94a3b8' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#94a3b8' }} />

      {editing ? (
        <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)}
          onBlur={finishEdit} onKeyDown={(e) => { if (e.key === 'Enter') finishEdit() }}
          style={{
            ...(isDiamond ? { transform: 'rotate(-45deg)' } : {}),
            width: '80%', textAlign: 'center',
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: 12, fontWeight: 500,
          }}
        />
      ) : (
        <span onClick={handleDoubleClick} style={{
          ...(isDiamond ? { transform: 'rotate(-45deg)' } : {}),
          textAlign: 'center', wordBreak: 'break-word', maxWidth: '85%',
        }}>
          {label || '双击编辑'}
        </span>
      )}
    </div>
  )
}
