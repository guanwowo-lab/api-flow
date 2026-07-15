import { useState } from 'react'
import { Handle, Position, NodeResizer } from 'reactflow'

const defaults = {
  rect: { borderRadius: 6, background: '#f8fafc', border: '2px solid #3b82f6' },
  diamond: { background: 'transparent', border: 'none' },
  circle: { borderRadius: '50%', background: '#f8fafc', border: '2px solid #64748b' },
  ellipse: { borderRadius: '50%', background: '#f0fdf4', border: '2px solid #22c55e' },
  note: { borderRadius: '2px 2px 2px 16px', background: '#fef9c3', border: '1px solid #eab308' },
  label: { borderRadius: 4, background: '#f1f5f9', border: 'none', fontSize: 11, color: '#475569' },
  end: { borderRadius: 20, background: '#fef2f2', border: '2px solid #ef4444' },
}

export default function ShapeNode({ id, data, selected }) {
  const [label, setLabel] = useState(data.label || '')
  const [editing, setEditing] = useState(false)
  const def = defaults[data.shape] || defaults.rect
  const isDiamond = data.shape === 'diamond'
  const isCircle = data.shape === 'circle'
  const isEllipse = data.shape === 'ellipse'
  const isNote = data.shape === 'note'

  const finishEdit = () => {
    setEditing(false)
    data.label = label
    if (data.setNodes) {
      data.setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, label } } : n))
    }
  }

  return (
    <>
      {selected && (
        <NodeResizer
          minWidth={30}
          minHeight={20}
          isVisible={selected}
          lineStyle={{ borderColor: '#3b82f6' }}
          handleStyle={{ background: '#3b82f6', border: '1px solid #fff', width: 8, height: 8 }}
        />
      )}
      <div style={{
        width: '100%', height: '100%', minWidth: 30, minHeight: 20,
        display: 'flex', alignItems: isNote ? 'flex-start' : 'center', justifyContent: isNote ? 'flex-start' : 'center',
        padding: isNote ? '4px 6px' : 0,
        ...def, cursor: 'pointer', fontSize: 12, fontWeight: 500,
        position: 'relative', boxSizing: 'border-box', overflow: 'visible',
      }}>
        {isDiamond && (
          <svg style={{ position: 'absolute', top: -2, left: -2, width: 'calc(100% + 4px)', height: 'calc(100% + 4px)', pointerEvents: 'none', zIndex: -1 }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="50,0 100,50 50,100 0,50" fill="#f8fafc" stroke="#f59e0b" strokeWidth="3" />
          </svg>
        )}
        <Handle type="source" id="top" position={Position.Top} style={{ background: '#3b82f6', width: 10, height: 10, opacity: (data.connectMode || selected) ? 1 : 0 }} />
        <Handle type="source" id="bottom" position={Position.Bottom} style={{ background: '#3b82f6', width: 10, height: 10, opacity: (data.connectMode || selected) ? 1 : 0 }} />
        <Handle type="source" id="left" position={Position.Left} style={{ background: '#3b82f6', width: 10, height: 10, opacity: (data.connectMode || selected) ? 1 : 0 }} />
        <Handle type="source" id="right" position={Position.Right} style={{ background: '#3b82f6', width: 10, height: 10, opacity: (data.connectMode || selected) ? 1 : 0 }} />

        {editing ? (
          <textarea
            autoFocus
            className="nodrag nowheel"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={finishEdit}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') finishEdit()
              if (e.key === 'Escape') finishEdit()
              e.stopPropagation()
            }}
            style={{
              width: '90%', textAlign: isNote ? 'left' : 'center', background: 'transparent', border: 'none',
              outline: 'none', fontSize: 12, fontWeight: 500, resize: 'none',
              fontFamily: 'inherit', lineHeight: 1.4,
            }}
            rows={Math.max(1, label.split('\n').length)}
          />
        ) : (
          <span onDoubleClick={() => setEditing(true)} style={{ textAlign: isNote ? 'left' : 'center', wordBreak: 'break-word', maxWidth: '85%', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
            {label || '双击编辑'}
          </span>
        )}
      </div>
    </>
  )
}
