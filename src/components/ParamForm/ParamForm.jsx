export default function ParamForm({ params, values, onChange, onSubmit, loading }) {
  const visibleParams = params?.filter(p => !p.hidden) || []
  const missingRequired = visibleParams.filter(p => p.required && !values[p.name] && !p.autoFill)

  return (
    <div className="space-y-3">
      {visibleParams.map(param => (
        <div key={param.name}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {param.label}
            {param.required && <span className="text-red-500 ml-0.5">*</span>}
            {param.autoFill === 'accessToken' && (
              <span className="text-xs text-gray-400 ml-2">(从顶部凭据自动填入)</span>
            )}
            {param.autoFill === 'timestamp' && (
              <span className="text-xs text-gray-400 ml-2">(自动生成)</span>
            )}
            {param.autoFill === 'credential' && (
              <span className="text-xs text-gray-400 ml-2">(从顶部凭据自动填入)</span>
            )}
          </label>

          {param.type === 'enum' ? (
            <select
              value={values[param.name] || param.default || ''}
              onChange={e => onChange(param.name, e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            >
              {param.options?.map((opt, i) => (
                <option key={opt} value={opt}>
                  {param.optionLabels?.[i] || opt}
                </option>
              ))}
            </select>
          ) : param.type === 'number' ? (
            <input
              type="number"
              value={values[param.name] ?? param.default ?? ''}
              onChange={e => onChange(param.name, e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          ) : (
            <input
              type={param.sensitive ? 'password' : 'text'}
              value={values[param.name] || ''}
              onChange={e => onChange(param.name, e.target.value)}
              placeholder={param.autoFill ? '自动填充...' : `输入${param.label}`}
              readOnly={!!param.autoFill}
              className={`w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-400 ${
                param.autoFill ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
              }`}
            />
          )}
        </div>
      ))}

      <button
        type="button"
        disabled={loading || (missingRequired && missingRequired.length > 0)}
        onClick={onSubmit}
        className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '发送中...' : '发送请求'}
      </button>
    </div>
  )
}
