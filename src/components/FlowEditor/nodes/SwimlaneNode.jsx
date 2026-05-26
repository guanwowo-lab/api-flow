export default function SwimlaneNode({ data }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minWidth: 240,
        minHeight: 500,
        pointerEvents: 'none',
        background: data.bgColor || '#f0f0f008',
        borderLeft: `2px dashed ${data.borderColor || '#ccc'}60`,
        borderRight: `2px dashed ${data.borderColor || '#ccc'}60`,
      }}
    />
  )
}
