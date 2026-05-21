import { useState } from 'react'

export default function ApiEditor({ api, onSave, onDelete }) {
  const [draft, setDraft] = useState({ ...api })
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(true)

  const handleFieldChange = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }))
    setSaved(false)
  }

  const handleParamChange = (paramType, idx, field, value) => {
    setDraft((d) => {
      const params = [...d[paramType]]
      params[idx] = { ...params[idx], [field]: value }
      return { ...d, [paramType]: params }
    })
    setSaved(false)
  }

  const addParam = (paramType) => {
    const newParam = { name: '', type: 'string', required: false, description: '', remark: '' }
    setDraft((d) => ({
      ...d,
      [paramType]: [...(d[paramType] || []), newParam],
    }))
    setSaved(false)
  }

  const removeParam = (paramType, idx) => {
    setDraft((d) => ({
      ...d,
      [paramType]: d[paramType].filter((_, i) => i !== idx),
    }))
    setSaved(false)
  }

  const handleSave = () => {
    onSave(draft)
    setSaved(true)
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-3 bg-white">
      <div className="flex items-center gap-3 mb-3">
        <input
          value={draft.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          className="flex-1 px-2 py-1 border border-gray-300 rounded font-medium outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="接口名称"
        />
        <select
          value={draft.method}
          onChange={(e) => handleFieldChange('method', e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded outline-none"
        >
          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          value={draft.url}
          onChange={(e) => handleFieldChange('url', e.target.value)}
          className="w-64 px-2 py-1 border border-gray-300 rounded outline-none font-mono text-sm focus:ring-2 focus:ring-blue-500"
          placeholder="/api/path"
        />
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-blue-600 hover:underline shrink-0"
        >
          {expanded ? '收起参数' : '编辑参数'}
        </button>
        {!saved && (
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 shrink-0"
          >
            保存
          </button>
        )}
        {saved && (
          <span className="text-xs text-green-600 shrink-0">已保存</span>
        )}
        <button type="button" onClick={onDelete} className="text-red-400 hover:text-red-600 text-sm shrink-0">删除</button>
      </div>

      {expanded && (
        <div className="space-y-4 pl-4 border-l-2 border-blue-200">
          {renderParamTable('inputParams', '输入参数', true)}
          <div className="border-t border-gray-100" />
          {renderParamTable('outputParams', '输出参数', false)}
        </div>
      )}
    </div>
  )

  function renderParamTable(paramType, title, hasRequired) {
    const params = draft[paramType] || []
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">{title} ({params.length})</span>
          <button type="button" onClick={() => addParam(paramType)} className="text-xs text-blue-600 hover:underline">+ 添加参数</button>
        </div>

        {params.length === 0 && (
          <p className="text-xs text-gray-400 py-2">暂无参数</p>
        )}

        {params.map((p, i) => (
          <div key={i} className="flex flex-wrap items-end gap-1.5 mb-2 bg-gray-50 rounded p-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-400">字段名称</span>
              <input
                value={p.name}
                onChange={(e) => handleParamChange(paramType, i, 'name', e.target.value)}
                className="w-28 px-1.5 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                placeholder="userId"
              />
            </label>

            {hasRequired && (
              <label className="flex flex-col gap-0.5 items-center">
                <span className="text-[10px] text-gray-400">必传</span>
                <input
                  type="checkbox"
                  checked={p.required}
                  onChange={(e) => handleParamChange(paramType, i, 'required', e.target.checked)}
                  className="mt-0.5"
                />
              </label>
            )}

            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-400">数据类型</span>
              <input
                value={p.type}
                onChange={(e) => handleParamChange(paramType, i, 'type', e.target.value)}
                className="w-20 px-1.5 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="string"
              />
            </label>

            <label className="flex flex-col gap-0.5 flex-1 min-w-[100px]">
              <span className="text-[10px] text-gray-400">字段描述</span>
              <input
                value={p.description}
                onChange={(e) => handleParamChange(paramType, i, 'description', e.target.value)}
                className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="字段含义"
              />
            </label>

            <label className="flex flex-col gap-0.5 flex-1 min-w-[100px]">
              <span className="text-[10px] text-gray-400">备注</span>
              <input
                value={p.remark || ''}
                onChange={(e) => handleParamChange(paramType, i, 'remark', e.target.value)}
                className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="额外说明"
              />
            </label>

            <button
              type="button"
              onClick={() => removeParam(paramType, i)}
              className="text-red-400 hover:text-red-600 text-xs mb-0.5"
            >
              删除
            </button>
          </div>
        ))}
      </div>
    )
  }
}
