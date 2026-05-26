import { useState, useCallback, useRef, useEffect } from 'react'
import { Handle, Position } from 'reactflow'

const defaults = {
  rect: { borderRadius: 6, background: '#f8fafc', border: '2px solid #3b82f6' },
  diamond: { borderRadius: 6, background: '#f8fafc', border: '2px solid #f59e0b', transform: 'rotate(45deg)' },
  circle: { borderRadius: '50%', background: '#f8fafc', border: '2px solid #64748b' },
  note: { borderRadius: '2px 2px 2px 16px', background: '#fef9c3', border: '1px solid #eab308' },
}

const handleSize = 8

export default function ShapeNode({ id, data, selected, width, height }) {
  const [label, setLabel] = useState(data.label || '')
  const [editing, setEditing] = useState(false)
  const def = defaults[data.shape] || defaults.rect
  const setNodes = data.setNodes
  const isDiamond = data.shape === 'diamond'
  const isCircle = data.shape === 'circle'

  const w = width || 140
  const h = height || 50
  const isSquare = isCircle || isDiamond
  const dw = isSquare ? Math.min(w, h) : w
  const dh = isSquare ? Math.min(w, h) : h

  const handleDoubleClick = () => setEditing(true)
  const finishEdit = () => { setEditing(false); data.label = label }

  const resizeRef = useRef({ dir: '', startX: 0, startY: 0, startW: 0, startH: 0 })

  const onResizeStart = useCallback((e, dir) => {
    e.stopPropagation(); e.preventDefault()
    resizeRef.current = { dir, startX: e.clientX, startY: e.clientY, startW: dw, startH: dh }
    document.body.style.cursor = dir.includes('e') || dir.includes('w') ? 'ew-resize' : 'ns-resize'
  }, [dw, dh])

  useEffect(() => {
    const onMove = (e) => {
      const r = resizeRef.current
      if (!r.dir) return
      const dx = e.clientX - r.startX
      const dy = e.clientY - r.startY
      let nw = r.startW, nh = r.startH
      if (r.dir.includes('e')) nw = Math.max(30, r.startW + dx)
      if (r.dir.includes('w')) nw = Math.max(30, r.startW - dx)
      if (r.dir.includes('s')) nh = Math.max(20, r.startH + dy)
      if (r.dir.includes('n')) nh = Math.max(20, r.startH - dy)
      if (isSquare) { const s = Math.min(nw, nh); nw = s; nh = s }
      if (setNodes) setNodes((nds) => nds.map((n) => n.id === id ? { ...n, width: nw, height: nh } : n))
    }
    const onUp = () => {
      if (resizeRef.current.dir) { resizeRef.current.dir = ''; document.body.style.cursor = '' }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [id, setNodes, isSquare])

  const cornerStyle = (dir) => ({
    position: 'absolute',
    width: handleSize, height: handleSize,
    background: selected ? '#3b82f6' : 'transparent',
    border: selected ? '1px solid #fff' : 'none',
    borderRadius: dir.includes('e') && dir.includes('s') ? '0 0 4px 0' :
                 dir.includes('w') && dir.includes('s') ? '0 0 0 4px' :
                 dir.includes('e') && dir.includes('n') ? '0 4px 0 0' : '4px 0 0 0',
    cursor: dir.includes('e') || dir.includes('w') ? 'ew-resize' : 'ns-resize',
    zIndex: 10,
    ...(
      dir.includes('n') ? { top: -handleSize / 2 } : { bottom: -handleSize / 2 }
    ),
    ...(
      dir.includes('w') ? { left: -handleSize / 2 } : { right: -handleSize / 2 }
    ),
  })

  return (
    <div style={{
      width: dw, height: dh,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...def,
      cursor: 'pointer', fontSize: 12, fontWeight: 500, position: 'relative',
      boxSizing: 'border-box',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#94a3b8' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#94a3b8' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#94a3b8' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#94a3b8' }} />

      {selected && (
        <>
          <div onMouseDown={(e) => onResizeStart(e, 'nw')} style={cornerStyle('nw')} />
          <div onMouseDown={(e) => onResizeStart(e, 'ne')} style={cornerStyle('ne')} />
          <div onMouseDown={(e) => onResizeStart(e, 'sw')} style={cornerStyle('sw')} />
          <div onMouseDown={(e) => onResizeStart(e, 'se')} style={cornerStyle('se')} />
        </>
      )}

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
