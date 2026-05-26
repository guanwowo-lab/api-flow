export default function SwimlaneNode({ data }) {
  return (
    <div
      className="pointer-events-none"
      style={{
        width: '100%',
        height: '100%',
        minWidth: 240,
        minHeight: 500,
        background: data.bgColor || '#f0f0f008',
        borderLeft: `2px dashed ${data.borderColor || '#ccc'}60`,
        borderRight: `2px dashed ${data.borderColor || '#ccc'}60`,
        position: 'relative',
      }}
    >
      {data.label && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          background: data.borderColor || '#3b82f6',
          color: '#fff', textAlign: 'center', padding: '2px 8px',
          fontSize: 11, fontWeight: 'bold', borderRadius: '0 0 4px 4px',
        }}>
          {data.label}
        </div>
      )}
    </div>
  )
}
