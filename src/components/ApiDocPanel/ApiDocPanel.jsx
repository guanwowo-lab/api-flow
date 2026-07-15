export default function ApiDocPanel({ api }) {
  if (!api) {
    return <div className="text-sm text-gray-400 py-8 text-center">请选择一个接口</div>
  }

  return (
    <div className="h-full overflow-auto">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">接口说明</h3>
      <p className="text-xs text-gray-500 mb-1">
        <span className="font-mono bg-gray-100 px-1 rounded">POST</span> {api.path}
      </p>
      <p className="text-xs text-gray-400 mb-3">
        签名认证: {api.signRequired ? '需要' : '不需要'}
      </p>

      {/* Input params */}
      <h4 className="text-xs font-semibold text-gray-600 mb-1 mt-3">📥 输入参数</h4>
      <ParamsTable params={api.params} />

      {/* Output params */}
      {api.outputParams && api.outputParams.length > 0 && (
        <>
          <h4 className="text-xs font-semibold text-gray-600 mb-1 mt-4">📤 输出参数</h4>
          <ParamsTable params={api.outputParams} />
        </>
      )}
    </div>
  )
}

function ParamsTable({ params }) {
  if (!params || params.length === 0) return <div className="text-xs text-gray-400 py-2">暂无</div>

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-gray-100">
          <tr>
            <th className="text-left p-1.5 border border-gray-200 font-medium text-gray-600 w-[90px]">字段名称</th>
            <th className="text-left p-1.5 border border-gray-200 font-medium text-gray-600">字段描述</th>
            <th className="text-left p-1.5 border border-gray-200 font-medium text-gray-600 w-[55px]">类型</th>
            <th className="text-left p-1.5 border border-gray-200 font-medium text-gray-600">备注</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={p.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="p-1.5 border border-gray-200 font-mono text-gray-800 break-all">{p.name}</td>
              <td className="p-1.5 border border-gray-200 text-gray-600">{p.docDesc || p.label || '-'}</td>
              <td className="p-1.5 border border-gray-200 font-mono text-gray-500">{p.docType || '-'}</td>
              <td className="p-1.5 border border-gray-200 text-gray-500 text-xs">
                {p.required ? <span className="text-red-500 font-medium">必填 </span> : null}
                {p.desc || p.docNote || ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
