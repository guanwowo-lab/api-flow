export default function SwimlaneNode({ data }) {
  return (
    <div
      style={{
        width: data.width || 240,
        height: data.height || 2000,
        background: data.bgColor || '#f0f0f008',
        border: `2px dashed ${data.borderColor || '#ccc'}40`,
        borderRadius: 8,
        pointerEvents: 'none',
      }}
    />
  )
}
