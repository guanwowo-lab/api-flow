import { useState } from 'react'

export default function ApiEditor({ api, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  const handleFieldChange = (field, value) => {
    onChange({ ...api, [field]: value })
  }

  const handleParamChange = (paramType, idx, field, value) => {
    const params = [...api[paramType]]
    params[idx] = { ...params[idx], [field]: value }
    onChange({ ...api, [paramType]: params })
  }

  const addParam = (paramType) => {
    const params = [...(api[paramType] || []), { name: '', type: 'string', required: false, description: '' }]
    onChange({ ...api, [paramType]: params })
  }

  const removeParam = (paramType, idx) => {
    const params = api[paramType].filter((_, i) => i !== idx)
    onChange({ ...api, [paramType]: params })
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-3 bg-white">
      <div className="flex items-center gap-3 mb-3">
        <input
          value={api.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          className="flex-1 px-2 py-1 border border-gray-300 rounded font-medium outline-none"
          placeholder="接口名称"
        />
        <select
          value={api.method}
          onChange={(e) => handleFieldChange('method', e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded outline-none"
        >
          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          value={api.url}
          onChange={(e) => handleFieldChange('url', e.target.value)}
          className="w-64 px-2 py-1 border border-gray-300 rounded outline-none font-mono text-sm"
          placeholder="/api/path"
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-blue-600 hover:underline"
        >
          {expanded ? '收起' : '参数'}
        </button>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-sm">删除</button>
      </div>

      {expanded && (
        <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-blue-200">
          {renderParamTable('inputParams', '输入参数')}
          {renderParamTable('outputParams', '输出参数')}
        </div>
      )}
    </div>
  )

  function renderParamTable(paramType, title) {
    const params = api[paramType] || []
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">{title}</span>
          <button onClick={() => addParam(paramType)} className="text-xs text-blue-600 hover:underline">+ 添加</button>
        </div>
        {params.map((p, i) => (
          <div key={i} className="flex gap-1 mb-1">
            <input
              value={p.name}
              onChange={(e) => handleParamChange(paramType, i, 'name', e.target.value)}
              className="w-28 px-1 py-0.5 border border-gray-200 rounded text-xs outline-none font-mono"
              placeholder="参数名"
            />
            <input
              value={p.type}
              onChange={(e) => handleParamChange(paramType, i, 'type', e.target.value)}
              className="w-16 px-1 py-0.5 border border-gray-200 rounded text-xs outline-none"
              placeholder="类型"
            />
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={p.required}
                onChange={(e) => handleParamChange(paramType, i, 'required', e.target.checked)}
              />
              必填
            </label>
            <input
              value={p.description}
              onChange={(e) => handleParamChange(paramType, i, 'description', e.target.value)}
              className="flex-1 px-1 py-0.5 border border-gray-200 rounded text-xs outline-none"
              placeholder="说明"
            />
            <button onClick={() => removeParam(paramType, i)} className="text-red-400 text-xs">&times;</button>
          </div>
        ))}
      </div>
    )
  }
}
