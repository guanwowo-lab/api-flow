import { useState, useMemo } from 'react'

const KNOWN_TYPES = new Set([
  'string', 'int', 'integer', 'number', 'float', 'double', 'decimal',
  'boolean', 'bool', 'array', 'object', 'date', 'datetime', 'timestamp',
  'long', 'bigint', 'varchar', 'text', 'json', 'enum',
])
const REQUIRED_VALUES = new Set(['是', '必填', 'Y', 'YES', 'TRUE', '1', '必传', 'TRUE'])
const NOT_REQUIRED_VALUES = new Set(['否', '可选', 'N', 'NO', 'FALSE', '0', '非必填', 'FALSE'])

export default function ApiEditor({ api, onSave, onDelete }) {
  const [draft, setDraft] = useState({ ...api })
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(true)
  const [scannerOpen, setScannerOpen] = useState(null) // null | 'inputParams' | 'outputParams'
  const [pasteText, setPasteText] = useState('')
  const [scanResult, setScanResult] = useState(null) // { headers, rows, mapping }

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

  // ---- 粘贴扫描逻辑 ----

  const openScanner = (paramType) => {
    setScannerOpen(paramType)
    setPasteText('')
    setScanResult(null)
  }

  const doScan = () => {
    const text = pasteText.trim()
    if (!text) return

    // 检测分隔符
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length === 0) return

    const delimiter = detectDelimiter(lines)
    const rows = lines.map((l) => splitRow(l, delimiter))

    // 检测第一行是否为表头
    const maxCols = Math.max(...rows.map((r) => r.length))
    const padded = rows.map((r) => [...r, ...Array(maxCols - r.length).fill('')])

    let dataRows = padded
    let headerSkipped = false
    if (padded.length > 1 && looksLikeHeader(padded[0], padded.slice(1))) {
      dataRows = padded.slice(1)
      headerSkipped = true
    }

    // 自动映射列
    const mapping = autoMapColumns(dataRows, maxCols, scannerOpen === 'inputParams')

    setScanResult({ headers: headerSkipped ? padded[0] : null, rows: dataRows, mapping })
  }

  const confirmImport = () => {
    if (!scanResult || !scannerOpen) return
    const { rows, mapping } = scanResult

    const newParams = rows.map((row) => {
      const param = { name: '', type: 'string', required: false, description: '', remark: '' }
      for (const [colIdx, field] of Object.entries(mapping)) {
        const val = (row[parseInt(colIdx)] || '').trim()
        if (field === 'required') {
          param[field] = REQUIRED_VALUES.has(val.toUpperCase()) || REQUIRED_VALUES.has(val)
        } else {
          param[field] = val
        }
      }
      return param
    })

    // 如果已有同名字段，跳过
    const existingNames = new Set((draft[scannerOpen] || []).map((p) => p.name))
    const filtered = newParams.filter((p) => p.name && !existingNames.has(p.name))

    setDraft((d) => ({
      ...d,
      [scannerOpen]: [...(d[scannerOpen] || []), ...filtered],
    }))
    setSaved(false)
    setScannerOpen(null)
    setScanResult(null)
    setPasteText('')
  }

  const changeMapping = (colIdx, field) => {
    if (!scanResult) return
    const newMapping = { ...scanResult.mapping }
    // 清除其他列对该 field 的映射
    for (const [k, v] of Object.entries(newMapping)) {
      if (v === field && k !== String(colIdx)) newMapping[k] = 'skip'
    }
    newMapping[colIdx] = field
    setScanResult({ ...scanResult, mapping: newMapping })
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
    const isScanning = scannerOpen === paramType
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">{title} ({params.length})</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => openScanner(paramType)} className="text-xs text-purple-600 hover:underline">📋 粘贴扫描</button>
            <button type="button" onClick={() => addParam(paramType)} className="text-xs text-blue-600 hover:underline">+ 添加参数</button>
          </div>
        </div>

        {/* 粘贴扫描面板 */}
        {isScanning && (
          <div className="mb-3 border border-purple-300 rounded-lg bg-purple-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-700">📋 批量粘贴扫描</span>
              <button type="button" onClick={() => setScannerOpen(null)} className="text-gray-400 hover:text-gray-600 text-xs">关闭</button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              从 Excel / Word / Markdown 表格中复制参数数据，粘贴到下方，点击"扫描识别"
            </p>

            {!scanResult ? (
              <>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  placeholder={'粘贴表格数据，例如：\nuserId\tstring\t是\t用户唯一标识\t长度32位\nuserName\tstring\t是\t用户姓名\t\nage\tint\t否\t用户年龄\t可选'}
                />
                <button
                  type="button"
                  onClick={doScan}
                  disabled={!pasteText.trim()}
                  className="mt-2 px-4 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50"
                >
                  扫描识别
                </button>
              </>
            ) : (
              <ScanPreview
                scanResult={scanResult}
                hasRequired={hasRequired}
                onChangeMapping={changeMapping}
                onConfirm={confirmImport}
                onCancel={() => { setScanResult(null); setPasteText(''); }}
              />
            )}
          </div>
        )}

        {params.length === 0 && !isScanning && (
          <p className="text-xs text-gray-400 py-2">暂无参数，点击"+ 添加参数"或"粘贴扫描"批量导入</p>
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

// ---- 粘贴扫描：分隔符检测 ----

function detectDelimiter(lines) {
  const samples = lines.slice(0, Math.min(5, lines.length))
  const counts = { tab: 0, pipe: 0, comma: 0 }

  for (const line of samples) {
    if (line.includes('\t')) counts.tab++
    if (line.includes('|')) counts.pipe++
    if (line.includes(',') || line.includes('，')) counts.comma++
  }

  if (counts.tab >= samples.length * 0.5) return '\t'
  if (counts.pipe >= samples.length * 0.5) return '|'
  if (counts.comma >= samples.length * 0.5) return ','
  return 'whitespace' // 多空格分隔
}

function splitRow(line, delimiter) {
  if (delimiter === 'whitespace') {
    return line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean)
  }
  if (delimiter === '|') {
    return line.split('|').map((s) => s.trim()).filter((s, i, arr) => s || (i > 0 && i < arr.length - 1))
  }
  return line.split(delimiter).map((s) => s.trim())
}

// ---- 粘贴扫描：表头检测 ----

function looksLikeHeader(firstRow, dataRows) {
  const headerKeywords = ['参数名', '字段名', '名称', '类型', '必填', '是否', '说明', '描述', '备注', '参数', '字段', 'name', 'type', 'description', 'remark', 'required']

  let headerScore = 0
  for (const cell of firstRow) {
    const lower = cell.toLowerCase().trim()
    if (headerKeywords.some((kw) => lower.includes(kw))) headerScore++
  }
  if (headerScore >= 2) return true

  // 检查第一行与数据行的类型差异
  let typeMismatch = 0
  for (let i = 0; i < Math.min(firstRow.length, 4); i++) {
    const firstVal = firstRow[i]?.trim()
    const sampleVals = dataRows.slice(0, 3).map((r) => r[i]?.trim()).filter(Boolean)
    if (firstVal && sampleVals.length > 0) {
      const firstIsType = KNOWN_TYPES.has(firstVal.toLowerCase())
      const samplesAreType = sampleVals.every((v) => KNOWN_TYPES.has(v.toLowerCase()))
      if (!firstIsType && samplesAreType) typeMismatch++
    }
  }
  return typeMismatch >= 2
}

// ---- 粘贴扫描：自动列映射 ----

function autoMapColumns(dataRows, colCount, hasRequired) {
  const mapping = {}
  const fields = hasRequired
    ? ['name', 'type', 'required', 'description', 'remark']
    : ['name', 'type', 'description', 'remark']
  const assigned = new Set()

  // 为每列计算各字段的得分
  const scores = []
  for (let c = 0; c < colCount; c++) {
    const values = dataRows.map((r) => (r[c] || '').trim()).filter(Boolean)
    if (values.length === 0) { scores.push({}); continue }

    const colScores = {}
    colScores.name = scoreName(values)
    colScores.type = scoreType(values)
    if (hasRequired) colScores.required = scoreRequired(values)
    colScores.description = scoreDescription(values)
    colScores.remark = scoreRemark(values, colScores)
    scores.push(colScores)
  }

  // 贪心分配：每轮选出最高分的 (col, field)
  const remaining = new Set(fields)
  const usedCols = new Set()

  while (remaining.size > 0 && usedCols.size < colCount) {
    let best = null
    for (let c = 0; c < colCount; c++) {
      if (usedCols.has(c)) continue
      for (const f of remaining) {
        const s = scores[c][f] || -999
        if (best === null || s > best.score) {
          best = { col: c, field: f, score: s }
        }
      }
    }
    if (!best || best.score < 0.3) break

    mapping[best.col] = best.field
    usedCols.add(best.col)
    remaining.delete(best.field)
  }

  // 未分配的列标记为 skip
  for (let c = 0; c < colCount; c++) {
    if (!(c in mapping)) mapping[c] = 'skip'
  }

  return mapping
}

function scoreName(values) {
  let score = 0
  for (const v of values) {
    if (/^[a-zA-Z_]\w*$/.test(v)) score += 2        // 英文标识符
    else if (/^[一-鿿]{1,8}$/.test(v)) score += 1  // 短中文
    else if (/^[一-鿿]{9,}$/.test(v)) score -= 1   // 长中文 → 更像描述
    else score -= 0.5
  }
  return score / values.length
}

function scoreType(values) {
  let score = 0
  for (const v of values) {
    if (KNOWN_TYPES.has(v.toLowerCase())) score += 3
    else if (/^(int|string|bool|float|number|array|object|date)/i.test(v)) score += 1
    else score -= 0.5
  }
  return score / values.length
}

function scoreRequired(values) {
  let score = 0
  for (const v of values) {
    if (REQUIRED_VALUES.has(v) || REQUIRED_VALUES.has(v.toUpperCase())) score += 3
    else if (NOT_REQUIRED_VALUES.has(v) || NOT_REQUIRED_VALUES.has(v.toUpperCase())) score += 2
    else score -= 1
  }
  return score / values.length
}

function scoreDescription(values) {
  let score = 0
  for (const v of values) {
    if (/[一-鿿]/.test(v) && v.length > 3) score += 2
    else if (v.length > 10) score += 1
    else score -= 0.3
  }
  return score / values.length
}

function scoreRemark(values, otherScores) {
  // 备注通常是最后一列，且内容较杂
  let score = 0
  const nonEmpty = values.filter(Boolean)
  if (nonEmpty.length < values.length * 0.5) score += 2 // 很多空值 → 更像备注
  for (const v of values) {
    if (v.length > 20) score += 1
    if (/\d/.test(v) && /[a-zA-Z]/.test(v)) score += 0.5
  }
  return score / Math.max(values.length, 1)
}

// ---- 扫描预览组件 ----

function ScanPreview({ scanResult, hasRequired, onChangeMapping, onConfirm, onCancel }) {
  const { headers, rows, mapping } = scanResult
  const fields = hasRequired
    ? ['name', 'type', 'required', 'description', 'remark']
    : ['name', 'type', 'description', 'remark']
  const fieldLabels = {
    name: '字段名称', type: '数据类型', required: '是否必传',
    description: '字段描述', remark: '备注', skip: '— 跳过 —',
  }

  const previewRows = rows.slice(0, 10)

  return (
    <div>
      {/* 列映射选择器 */}
      <div className="mb-3">
        <span className="text-xs font-medium text-gray-600 mb-1 block">列映射：为每列选择对应的字段</span>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: headers ? headers.length : Math.max(...rows.map((r) => r.length)) }, (_, c) => (
            <div key={c} className="flex items-center gap-1 bg-white rounded border border-gray-300 px-2 py-1">
              <span className="text-[10px] text-gray-400">列{c + 1}</span>
              <span className="text-[10px] text-gray-300">|</span>
              <select
                value={mapping[c] || 'skip'}
                onChange={(e) => onChangeMapping(c, e.target.value)}
                className="text-xs border-none outline-none bg-transparent"
              >
                {fields.map((f) => (
                  <option key={f} value={f}>{fieldLabels[f]}</option>
                ))}
                <option value="skip">{fieldLabels.skip}</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* 预览表格 */}
      <div className="overflow-x-auto mb-3">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-purple-100">
              {Object.keys(mapping).map((c) => (
                <th key={c} className={`border border-purple-200 px-2 py-1 text-left ${mapping[c] === 'skip' ? 'text-gray-300' : 'text-purple-700'}`}>
                  {fieldLabels[mapping[c]] || `列${parseInt(c) + 1}`}
                  {headers && <div className="text-[10px] text-gray-400 font-normal">({headers[parseInt(c)] || ''})</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {Object.keys(mapping).map((c) => (
                  <td key={c} className={`border border-gray-200 px-2 py-0.5 ${mapping[c] === 'skip' ? 'text-gray-300' : ''}`}>
                    {row[parseInt(c)] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 10 && (
          <p className="text-[10px] text-gray-400 mt-1">... 还有 {rows.length - 10} 行</p>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button type="button" onClick={onConfirm} className="px-4 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">
          确认导入 ({rows.length} 条)
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50">
          取消
        </button>
      </div>
    </div>
  )
}
