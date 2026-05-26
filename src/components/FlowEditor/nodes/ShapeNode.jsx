import { useState, useCallback, useRef, useEffect } from 'react'
import { Handle, Position } from 'reactflow'

const defaults = {
  rect: { borderRadius: 6, background: '#f8fafc', border: '2px solid #3b82f6' },
  diamond: { borderRadius: 6, background: '#f8fafc', border: '2px solid #f59e0b', transform: 'rotate(45deg)' },
  circle: { borderRadius: '50%', background: '#f8fafc', border: '2px solid #64748b' },
  ellipse: { borderRadius: '50%', background: '#f8fafc', border: '2px solid #64748b' },
  note: { borderRadius: '2px 2px 2px 16px', background: '#fef9c3', border: '1px solid #eab308' },
}

const handleSize = 8

export default function ShapeNode({ id, data, selected, width, height }) {
  const [label, setLabel] = useState(data.label || '')
  const [editing, setEditing] = useState(false)
  const nodeRef = useRef(null)
  const [dims, setDims] = useState({ w: width || 140, h: height || 50 })
  const def = defaults[data.shape] || defaults.rect
  const isDiamond = data.shape === 'diamond'
  const isCircle = data.shape === 'circle'
  const isSquare = isCircle || isDiamond
  const isEllipse = data.shape === 'ellipse'
  const dw = isSquare ? Math.min(dims.w, dims.h) : dims.w
  const dh = isSquare ? Math.min(dims.w, dims.h) : dims.h

  const handleDoubleClick = () => setEditing(true)
  const finishEdit = () => { setEditing(false); data.label = label }

  const resizeRef = useRef({ dir: '', startX: 0, startY: 0, startW: 0, startH: 0 })

  const onPointerDown = useCallback((e, dir) => {
    e.stopPropagation(); e.preventDefault(); e.nativeEvent.stopImmediatePropagation()
    resizeRef.current = { dir, startX: e.clientX, startY: e.clientY, startW: dw, startH: dh }
    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'
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
      // 直接更新 DOM
      if (nodeRef.current) {
        const el = nodeRef.current.closest('.react-flow__node')
        if (el) {
          el.style.width = nw + 'px'
          el.style.height = nh + 'px'
        }
      }
      setDims({ w: nw, h: nh })
    }
    const onUp = () => {
      if (resizeRef.current.dir) {
        resizeRef.current.dir = ''
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        // 最终尺寸同步到 React Flow
        const el = nodeRef.current?.closest('.react-flow__node')
        if (el && data.setNodes) {
          data.setNodes((nds) => nds.map((n) => n.id === id ? { ...n, width: parseInt(el.style.width), height: parseInt(el.style.height) } : n))
        }
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [id, data.setNodes, isSquare])

  const corner = (dir) => (
    <div
      onPointerDown={(e) => onPointerDown(e, dir)}
      style={{
        position: 'absolute', width: handleSize, height: handleSize,
        background: selected ? '#3b82f6' : 'transparent',
        border: selected ? '1px solid #fff' : 'none',
        borderRadius: 2, zIndex: 10, cursor: 'nwse-resize',
        ...(dir.includes('n') ? { top: -handleSize/2 } : { bottom: -handleSize/2 }),
        ...(dir.includes('w') ? { left: -handleSize/2 } : { right: -handleSize/2 }),
      }}
    />
  )

  return (
    <div ref={nodeRef} style={{
      width: dw, height: dh, minWidth: 30, minHeight: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...def, cursor: 'pointer', fontSize: 12, fontWeight: 500,
      position: 'relative', boxSizing: 'border-box',
    }}>
      <Handle id="top" position={Position.Top} style={{ background: '#3b82f6', width: 10, height: 10, border: '2px solid #fff' }} />
      <Handle id="bottom" position={Position.Bottom} style={{ background: '#3b82f6', width: 10, height: 10, border: '2px solid #fff' }} />
      <Handle id="left" position={Position.Left} style={{ background: '#3b82f6', width: 10, height: 10, border: '2px solid #fff' }} />
      <Handle id="right" position={Position.Right} style={{ background: '#3b82f6', width: 10, height: 10, border: '2px solid #fff' }} />

      {selected && (<>{corner('nw')}{corner('ne')}{corner('sw')}{corner('se')}</>)}

      {editing ? (
        <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)}
          onBlur={finishEdit} onKeyDown={(e) => { if (e.key === 'Enter') finishEdit() }}
          style={{ ...(isDiamond?{transform:'rotate(-45deg)'}:{}), width:'80%', textAlign:'center', background:'transparent', border:'none', outline:'none', fontSize:12, fontWeight:500 }} />
      ) : (
        <span onClick={handleDoubleClick} style={{ ...(isDiamond?{transform:'rotate(-45deg)'}:{}), textAlign:'center', wordBreak:'break-word', maxWidth:'85%' }}>
          {label || '双击编辑'}
        </span>
      )}
    </div>
  )
}
