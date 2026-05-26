import { useState } from 'react'
import { Handle, Position, NodeResizer } from 'reactflow'

const defaults = {
  rect: { borderRadius: 6, minWidth: 120, minHeight: 40 },
  diamond: { borderRadius: 4 },
  circle: {},
  note: { borderRadius: '2px 2px 2px 16px', minWidth: 100, minHeight: 40, background: '#fef9c3', border: '1px solid #eab308' },
}

export default function ShapeNode({ data, selected }) {
  const [label, setLabel] = useState(data.label || '')
  const [editing, setEditing] = useState(false)
  const def = defaults[data.shape] || defaults.rect
  const isDiamond = data.shape === 'diamond'
  const isCircle = data.shape === 'circle'
  const isFlex = data.shape === 'rect' || data.shape === 'note'

  const handleDoubleClick = () => setEditing(true)
  const finishEdit = () => { setEditing(false); data.label = label }

  const borderColor = isDiamond ? '#f59e0b' : isCircle ? '#64748b' : '#3b82f6'

  return (
    <div style={{ position: 'relative', minWidth: def.minWidth || 60, minHeight: def.minHeight || 30 }}>
      {(selected || isFlex) && <NodeResizer minWidth={60} minHeight={30} keepAspectRatio={isDiamond || isCircle} color="#3b82f6" />}
      <div onDoubleClick={handleDoubleClick}
        style={{
          ...def,
          width: '100%', height: '100%',
          background: def.background || '#f8fafc',
          border: def.border || `2px solid ${borderColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 12, fontWeight: 500,
          ...(isDiamond ? { transform: 'rotate(45deg)' } : {}),
          ...(isCircle ? { borderRadius: '50%' } : {}),
        }}
      >
        <Handle type="target" position={Position.Top} style={{ background: '#94a3b8' }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#94a3b8' }} />
        <Handle type="target" position={Position.Left} style={{ background: '#94a3b8' }} />
        <Handle type="source" position={Position.Right} style={{ background: '#94a3b8' }} />

        {editing ? (
          <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)}
            onBlur={finishEdit} onKeyDown={(e) => { if (e.key === 'Enter') finishEdit() }}
            style={{
              ...(isDiamond ? { transform: 'rotate(-45deg)', width: '70%' } : {}),
              ...(isCircle ? { width: '70%', textAlign: 'center' } : { width: '90%' }),
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 12, fontWeight: 500, textAlign: 'center',
            }}
          />
        ) : (
          <span style={{
            ...(isDiamond ? { transform: 'rotate(-45deg)' } : {}),
            textAlign: 'center', wordBreak: 'break-word',
            maxWidth: '90%',
          }}>
            {label || '双击编辑'}
          </span>
        )}
      </div>
    </div>
  )
}
