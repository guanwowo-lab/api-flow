import { useState, useCallback } from 'react'

const KNOWN_TYPES = new Set([
  'string', 'int', 'integer', 'number', 'float', 'double', 'decimal',
  'boolean', 'bool', 'array', 'object', 'list', 'date', 'datetime', 'timestamp',
  'long', 'bigint', 'varchar', 'text', 'json', 'enum',
])
const REQUIRED_VALUES = new Set(['是', '必填', 'Y', 'YES', 'TRUE', '1', '必传'])
const NOT_REQUIRED_VALUES = new Set(['否', '可选', 'N', 'NO', 'FALSE', '0', '非必填'])

function hasChildren(type) {
  if (!type) return false
  const t = type.toLowerCase()
  return t.includes('object') || t.includes('array') || t.includes('list')
}

function newParam() {
  return { name: '', type: 'string', required: false, description: '', remark: '', children: [] }
}

export default function ApiEditor({ api, onSave, onDelete }) {
  const [draft, setDraft] = useState(() => {
    // 确保所有已有参数的 children 字段存在
    const d = { ...api }
    for (const side of ['inputParams', 'outputParams']) {
      if (d[side]) {
        d[side] = ensureChildren(d[side])
      }
    }
    return d
  })
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(true)
  const [scannerOpen, setScannerOpen] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [scanResult, setScanResult] = useState(null)
  // 跟踪展开的参数路径，格式 "0", "0.1", "0.1.2" ...
  const [expandedPaths, setExpandedPaths] = useState(new Set())

  const togglePath = (path) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleFieldChange = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }))
    setSaved(false)
  }

  const handleSave = () => {
    onSave(draft)
    setSaved(true)
  }

  // ---- 嵌套参数 CRUD ----

  const getParamsAt = useCallback((pathStr) => {
    if (!pathStr) return draft.inputParams // fallback
    const [paramType, ...indices] = pathStr.split(':')
    if (indices.length === 0 || indices[0] === '') return draft[paramType] || []
    let arr = draft[paramType] || []
    for (const idx of indices) {
      if (!arr[parseInt(idx)]) return []
      arr = arr[parseInt(idx)].children || []
    }
    return arr
  }, [draft])

  const updateParamsAt = useCallback((pathStr, updater) => {
    const [paramType, ...indices] = pathStr.split(':')
    setDraft((d) => {
      if (indices.length === 0 || indices[0] === '') {
        return { ...d, [paramType]: updater(d[paramType] || []) }
      }
      return { ...d, [paramType]: updateNested(d[paramType] || [], indices.map(Number), updater) }
    })
    setSaved(false)
  }, [])

  const handleParamChange = (pathStr, idx, field, value) => {
    updateParamsAt(pathStr, (params) =>
      params.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    )
  }

  const addParam = (pathStr) => {
    updateParamsAt(pathStr, (params) => [...params, newParam()])
  }

  const removeParam = (pathStr, idx) => {
    updateParamsAt(pathStr, (params) => params.filter((_, i) => i !== idx))
  }

  const removeAllParams = (pathStr) => {
    updateParamsAt(pathStr, () => [])
  }

  // ---- 粘贴扫描 ----

  const openScanner = (pathStr) => {
    setScannerOpen(pathStr)
    setPasteText('')
    setScanResult(null)
  }

  const doScan = () => {
    const text = pasteText.trim()
    if (!text) return
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length === 0) return

    // 检测缩进（用于嵌套）
    const indentLevels = lines.map((l) => l.match(/^(\s*)/)[1].length)
    const nonZero = indentLevels.filter((n) => n > 0)
    const unit = nonZero.length > 0 ? Math.min(...nonZero) : 2
    const minIndent = Math.min(...indentLevels)
    const normalized = lines.map((l, i) => ({
      text: l.trim(),
      level: minIndent > 0 ? Math.max(0, Math.round((indentLevels[i] - minIndent) / Math.max(unit, 1))) : 0,
    }))

    const delimiter = detectDelimiter(normalized.map((n) => n.text))
    const rows = normalized.map((n) => ({
      cells: splitRow(n.text, delimiter),
      level: Math.min(n.level, 5), // cap at depth 5
    }))

    const maxCols = Math.max(...rows.map((r) => r.cells.length))
    const padded = rows.map((r) => ({
      cells: [...r.cells, ...Array(maxCols - r.cells.length).fill('')],
      level: r.level,
    }))

    const allRows = padded.map((r) => r.cells)
    let dataStart = 0
    let headerSkipped = false
    if (allRows.length > 1 && looksLikeHeader(allRows[0], allRows.slice(1))) {
      dataStart = 1
      headerSkipped = true
    }

    const dataRows = padded.slice(dataStart)
    const hasReq = scannerOpen?.startsWith('inputParams')

    const mapping = autoMapColumns(
      dataRows.map((r) => r.cells),
      maxCols,
      hasReq
    )

    setScanResult({
      headers: headerSkipped ? padded[0].cells : null,
      rows: dataRows,
      mapping,
    })
  }

  const adjustLevel = (rowIdx, delta) => {
    if (!scanResult) return
    const newRows = scanResult.rows.map((r, i) =>
      i === rowIdx ? { ...r, level: Math.max(0, Math.min(5, r.level + delta)) } : r
    )
    setScanResult({ ...scanResult, rows: newRows })
  }

  const confirmImport = () => {
    if (!scanResult || !scannerOpen) return
    const { rows, mapping } = scanResult
    const hasReq = scannerOpen.startsWith('inputParams')

    // 栈式层级构建：每个 row 根据 level 找到正确的父节点
    const root = { children: [], level: -1 }
    const stack = [root]

    for (const row of rows) {
      const param = buildParam(row, mapping, hasReq)
      // 弹出栈直到找到 level 小于当前行的父节点
      while (stack.length > 0 && stack[stack.length - 1].level >= row.level) {
        stack.pop()
      }
      const parent = stack[stack.length - 1]
      parent.children.push(param)
      stack.push({ ...param, level: row.level, children: param.children })
    }

    const newParams = root.children

    const existingNames = new Set(getParamsAt(scannerOpen).map((p) => p.name))
    const filtered = newParams.filter((p) => p.name && !existingNames.has(p.name))

    updateParamsAt(scannerOpen, (params) => [...params, ...filtered])
    setScannerOpen(null)
    setScanResult(null)
    setPasteText('')
  }

  const changeMapping = (colIdx, field) => {
    if (!scanResult) return
    const newMapping = { ...scanResult.mapping }
    for (const [k, v] of Object.entries(newMapping)) {
      if (v === field && k !== String(colIdx)) newMapping[k] = 'skip'
    }
    newMapping[colIdx] = field
    setScanResult({ ...scanResult, mapping: newMapping })
  }

  // ---- 渲染 ----

  const ipPath = 'inputParams:'
  const opPath = 'outputParams:'

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
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-sm text-blue-600 hover:underline shrink-0">
          {expanded ? '收起参数' : '编辑参数'}
        </button>
        {!saved && (
          <button type="button" onClick={handleSave} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 shrink-0">
            保存
          </button>
        )}
        {saved && <span className="text-xs text-green-600 shrink-0">已保存</span>}
        <button type="button" onClick={onDelete} className="text-red-400 hover:text-red-600 text-sm shrink-0">删除</button>
      </div>

      {expanded && (
        <div className="space-y-4 pl-4 border-l-2 border-blue-200">
          <ParamGroup
            path={ipPath}
            title="输入参数"
            hasRequired={true}
            params={draft.inputParams || []}
            depth={0}
            expandedPaths={expandedPaths}
            onTogglePath={togglePath}
            onParamChange={handleParamChange}
            onAddParam={addParam}
            onRemoveParam={removeParam}
            onRemoveAllParams={removeAllParams}
            isScanning={scannerOpen === ipPath}
            scanResult={scannerOpen === ipPath ? scanResult : null}
            onOpenScanner={() => openScanner(ipPath)}
            onCloseScanner={() => setScannerOpen(null)}
            onPasteText={setPasteText}
            pasteText={scannerOpen === ipPath ? pasteText : ''}
            onDoScan={doScan}
            onChangeMapping={changeMapping}
            onAdjustLevel={adjustLevel}
            onConfirmImport={confirmImport}
            onCancelScan={() => { setScanResult(null); setPasteText(''); }}
          />
          <div className="border-t border-gray-100" />
          <ParamGroup
            path={opPath}
            title="输出参数"
            hasRequired={false}
            params={draft.outputParams || []}
            depth={0}
            expandedPaths={expandedPaths}
            onTogglePath={togglePath}
            onParamChange={handleParamChange}
            onAddParam={addParam}
            onRemoveParam={removeParam}
            onRemoveAllParams={removeAllParams}
            isScanning={scannerOpen === opPath}
            scanResult={scannerOpen === opPath ? scanResult : null}
            onOpenScanner={() => openScanner(opPath)}
            onCloseScanner={() => setScannerOpen(null)}
            onPasteText={setPasteText}
            pasteText={scannerOpen === opPath ? pasteText : ''}
            onDoScan={doScan}
            onChangeMapping={changeMapping}
            onAdjustLevel={adjustLevel}
            onConfirmImport={confirmImport}
            onCancelScan={() => { setScanResult(null); setPasteText(''); }}
          />
        </div>
      )}
    </div>
  )
}

// ---- 参数组递归组件 ----

function ParamGroup({
  path, title, hasRequired, params, depth,
  expandedPaths, onTogglePath, onParamChange, onAddParam, onRemoveParam, onRemoveAllParams,
  isScanning, scanResult, onOpenScanner, onCloseScanner, onPasteText, pasteText,
  onDoScan, onChangeMapping, onAdjustLevel, onConfirmImport, onCancelScan,
}) {
  const indent = depth * 16
  const borderColor = depth === 0 ? 'border-blue-200' : depth === 1 ? 'border-green-200' : 'border-orange-200'
  const bgColor = depth === 0 ? '' : depth === 1 ? 'bg-green-50/30' : 'bg-orange-50/30'

  return (
    <div style={{ marginLeft: indent > 0 ? 12 : 0 }} className={bgColor}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">
          {depth > 0 && <span className="text-gray-300 mr-1">↳</span>}
          {title} ({params.length})
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={onOpenScanner} className="text-xs text-purple-600 hover:underline">📋 粘贴扫描</button>
          <button type="button" onClick={() => onAddParam(path)} className="text-xs text-blue-600 hover:underline">+ 添加参数</button>
          {params.length > 0 && (
            <button type="button" onClick={() => { if (confirm(`确定删除全部 ${params.length} 个参数？此操作不可撤销。`)) onRemoveAllParams(path) }}
              className="text-xs text-red-400 hover:text-red-600 hover:underline">全部删除</button>
          )}
        </div>
      </div>

      {/* 粘贴扫描面板 */}
      {isScanning && (
        <div className="mb-3 border border-purple-300 rounded-lg bg-purple-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-700">📋 批量粘贴扫描</span>
            <button type="button" onClick={onCloseScanner} className="text-gray-400 hover:text-gray-600 text-xs">关闭</button>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            从 Excel / Word 中复制参数，用缩进表示层级关系（空格/Tab缩进即为子参数）
          </p>

          {!scanResult ? (
            <>
              <textarea
                value={pasteText}
                onChange={(e) => onPasteText(e.target.value)}
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                placeholder={'粘贴表格数据，缩进表示子参数：\nuserId\tstring\t是\t用户ID\t\nuserInfo\tobject\t是\t用户信息\n    userName\tstring\t是\t姓名\n    address\tobject\t否\t地址\n        province\tstring\t是\t省份'}
              />
              <button type="button" onClick={onDoScan} disabled={!pasteText.trim()}
                className="mt-2 px-4 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50">
                扫描识别
              </button>
            </>
          ) : (
            <ScanPreview
              scanResult={scanResult}
              hasRequired={hasRequired}
              onChangeMapping={onChangeMapping}
              onAdjustLevel={onAdjustLevel}
              onConfirm={onConfirmImport}
              onCancel={onCancelScan}
            />
          )}
        </div>
      )}

      {params.length === 0 && !isScanning && (
        <p className="text-xs text-gray-400 py-2 ml-4">暂无参数</p>
      )}

      {params.map((p, i) => {
        const childPath = `${path}${i}`
        const isExpanded = expandedPaths.has(childPath)
        const canHaveChildren = hasChildren(p.type)

        return (
          <div key={i}>
            <ParamRow
              param={p}
              hasRequired={hasRequired}
              path={path}
              index={i}
              depth={depth}
              canHaveChildren={canHaveChildren}
              isExpanded={isExpanded}
              onToggle={() => onTogglePath(childPath)}
              onChange={(field, value) => onParamChange(path, i, field, value)}
              onDelete={() => onRemoveParam(path, i)}
              onAddChild={() => {
                onAddParam(`${path}${i}:`)
                if (!isExpanded) onTogglePath(childPath)
              }}
            />

            {canHaveChildren && isExpanded && (
              <ParamGroup
                path={`${path}${i}:`}
                title={`${p.name || '子参数'} 的子参数`}
                hasRequired={hasRequired}
                params={p.children || []}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                onTogglePath={onTogglePath}
                onParamChange={onParamChange}
                onAddParam={onAddParam}
                onRemoveParam={onRemoveParam}
                onRemoveAllParams={onRemoveAllParams}
                isScanning={false}
                scanResult={null}
                onOpenScanner={() => onOpenScanner(`${path}${i}:`)}
                onCloseScanner={onCloseScanner}
                onPasteText={onPasteText}
                pasteText=""
                onDoScan={onDoScan}
                onChangeMapping={onChangeMapping}
                onAdjustLevel={onAdjustLevel}
                onConfirmImport={onConfirmImport}
                onCancelScan={onCancelScan}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---- 参数行 ----

function ParamRow({ param, hasRequired, path, index, depth, canHaveChildren, isExpanded, onToggle, onChange, onDelete, onAddChild }) {
  return (
    <div className={`flex flex-wrap items-end gap-1.5 mb-2 rounded p-2 ${depth === 0 ? 'bg-gray-50' : depth === 1 ? 'bg-green-50' : 'bg-orange-50'}`}>
      {canHaveChildren && (
        <button type="button" onClick={onToggle}
          className={`text-xs shrink-0 mb-0.5 px-0.5 ${isExpanded ? 'text-blue-600' : 'text-gray-400'}`}
          title={isExpanded ? '收起子参数' : '展开子参数'}>
          {isExpanded ? '▼' : '▶'}
        </button>
      )}
      {!canHaveChildren && <span className="w-4 shrink-0" />}

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-gray-400">字段名称</span>
        <input value={param.name} onChange={(e) => onChange('name', e.target.value)}
          className="w-28 px-1.5 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400 font-mono"
          placeholder="userId" />
      </label>

      {hasRequired && (
        <label className="flex flex-col gap-0.5 items-center">
          <span className="text-[10px] text-gray-400">必传</span>
          <input type="checkbox" checked={param.required}
            onChange={(e) => onChange('required', e.target.checked)} className="mt-0.5" />
        </label>
      )}

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-gray-400">数据类型</span>
        <input value={param.type} onChange={(e) => onChange('type', e.target.value)}
          className="w-20 px-1.5 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="string" />
      </label>

      <label className="flex flex-col gap-0.5 flex-1 min-w-[80px]">
        <span className="text-[10px] text-gray-400">字段描述</span>
        <input value={param.description} onChange={(e) => onChange('description', e.target.value)}
          className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="字段含义" />
      </label>

      <label className="flex flex-col gap-0.5 flex-1 min-w-[80px]">
        <span className="text-[10px] text-gray-400">备注</span>
        <input value={param.remark || ''} onChange={(e) => onChange('remark', e.target.value)}
          className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="额外说明" />
      </label>

      {canHaveChildren && (
        <button type="button" onClick={onAddChild}
          className="text-xs text-green-600 hover:underline mb-0.5 shrink-0" title="添加子参数">
          + 子参数
        </button>
      )}

      <button type="button" onClick={onDelete} className="text-red-400 hover:text-red-600 text-xs mb-0.5 shrink-0">删除</button>
    </div>
  )
}

// ---- 辅助函数 ----

function ensureChildren(arr) {
  return arr.map((p) => ({
    ...p,
    children: p.children ? ensureChildren(p.children) : [],
    remark: p.remark || '',
  }))
}

function updateNested(arr, indices, updater) {
  if (indices.length === 0) return updater(arr)
  const [idx, ...rest] = indices
  return arr.map((item, i) =>
    i === idx
      ? { ...item, children: updateNested(item.children || [], rest, updater) }
      : item
  )
}

function buildParam(row, mapping, hasRequired) {
  const param = newParam()
  for (const [colIdx, field] of Object.entries(mapping)) {
    const val = (row.cells[parseInt(colIdx)] || '').trim()
    if (field === 'required') {
      param[field] = REQUIRED_VALUES.has(val.toUpperCase()) || REQUIRED_VALUES.has(val)
    } else if (field !== 'skip') {
      param[field] = val
    }
  }
  return param
}

function countParams(arr) {
  let count = arr.length
  for (const p of arr) {
    if (p.children) count += countParams(p.children)
  }
  return count
}

// ---- 粘贴扫描工具函数 ----

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
  return 'whitespace'
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

function looksLikeHeader(firstRow, dataRows) {
  const headerKeywords = ['参数名', '字段名', '名称', '类型', '必填', '是否', '说明', '描述', '备注', '参数', '字段', 'name', 'type', 'description', 'remark', 'required']
  let headerScore = 0
  for (const cell of firstRow) {
    const lower = cell.toLowerCase().trim()
    if (headerKeywords.some((kw) => lower.includes(kw))) headerScore++
  }
  if (headerScore >= 2) return true
  let typeMismatch = 0
  for (let i = 0; i < Math.min(firstRow.length, 4); i++) {
    const firstVal = firstRow[i]?.trim()
    const sampleVals = dataRows.slice(0, 3).map((r) => r[i]?.trim()).filter(Boolean)
    if (firstVal && sampleVals.length > 0) {
      if (!KNOWN_TYPES.has(firstVal.toLowerCase()) && sampleVals.every((v) => KNOWN_TYPES.has(v.toLowerCase()))) typeMismatch++
    }
  }
  return typeMismatch >= 2
}

function autoMapColumns(dataRows, colCount, hasRequired) {
  const mapping = {}
  const fields = hasRequired
    ? ['name', 'type', 'required', 'description', 'remark']
    : ['name', 'type', 'description', 'remark']
  const scores = []
  for (let c = 0; c < colCount; c++) {
    const values = dataRows.map((r) => (r[c] || '').trim()).filter(Boolean)
    if (values.length === 0) { scores.push({}); continue }
    const colScores = {}
    colScores.name = scoreName(values)
    colScores.type = scoreType(values)
    if (hasRequired) colScores.required = scoreRequired(values)
    colScores.description = scoreDescription(values)
    colScores.remark = scoreRemark(values)
    scores.push(colScores)
  }
  const remaining = new Set(fields)
  const usedCols = new Set()
  while (remaining.size > 0 && usedCols.size < colCount) {
    let best = null
    for (let c = 0; c < colCount; c++) {
      if (usedCols.has(c)) continue
      for (const f of remaining) {
        const s = scores[c][f] || -999
        if (best === null || s > best.score) best = { col: c, field: f, score: s }
      }
    }
    if (!best || best.score < 0.3) break
    mapping[best.col] = best.field
    usedCols.add(best.col)
    remaining.delete(best.field)
  }
  for (let c = 0; c < colCount; c++) {
    if (!(c in mapping)) mapping[c] = 'skip'
  }
  return mapping
}

function scoreName(values) {
  let score = 0
  for (const v of values) {
    if (/^[a-zA-Z_]\w*$/.test(v)) score += 2
    else if (/^[一-鿿]{1,8}$/.test(v)) score += 1
    else if (/^[一-鿿]{9,}$/.test(v)) score -= 1
    else score -= 0.5
  }
  return score / values.length
}

function scoreType(values) {
  let score = 0
  for (const v of values) {
    if (KNOWN_TYPES.has(v.toLowerCase())) score += 3
    else if (/^(int|string|bool|float|number|array|object|date|list)/i.test(v)) score += 1
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

function scoreRemark(values) {
  let score = 0
  const nonEmpty = values.filter(Boolean)
  if (nonEmpty.length < values.length * 0.5) score += 2
  for (const v of values) {
    if (v.length > 20) score += 1
    if (/\d/.test(v) && /[a-zA-Z]/.test(v)) score += 0.5
  }
  return score / Math.max(values.length, 1)
}

// ---- 扫描预览组件 ----

function ScanPreview({ scanResult, hasRequired, onChangeMapping, onAdjustLevel, onConfirm, onCancel }) {
  const { headers, rows, mapping } = scanResult
  const fields = hasRequired
    ? ['name', 'type', 'required', 'description', 'remark']
    : ['name', 'type', 'description', 'remark']
  const fieldLabels = {
    name: '字段名称', type: '数据类型', required: '是否必传',
    description: '字段描述', remark: '备注', skip: '— 跳过 —',
  }
  const colCount = headers ? headers.length : Math.max(...rows.map((r) => r.cells.length))
  return (
    <div>
      {/* 列映射 */}
      <div className="mb-3">
        <span className="text-xs font-medium text-gray-600 mb-1 block">列映射：选择每列对应的字段</span>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: colCount }, (_, c) => (
            <div key={c} className="flex items-center gap-1 bg-white rounded border border-gray-300 px-2 py-1">
              <span className="text-[10px] text-gray-400">列{c + 1}</span>
              <select value={mapping[c] || 'skip'} onChange={(e) => onChangeMapping(c, e.target.value)}
                className="text-xs border-none outline-none bg-transparent">
                {fields.map((f) => (<option key={f} value={f}>{fieldLabels[f]}</option>))}
                <option value="skip">{fieldLabels.skip}</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* 层级提示 */}
      <div className="mb-2 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded px-2 py-1">
        💡 <strong>层级</strong>：◀ ▶ 调整每行的嵌套层级（共 {rows.length} 行，可滚动查看全部）。
        子参数会自动归入上方最近的父参数下。
      </div>

      {/* 预览表格 — 显示全部行，固定表头可滚动 */}
      <div className="overflow-auto mb-3 border border-gray-300 rounded" style={{ maxHeight: '45vh' }}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-purple-100 sticky top-0 z-10">
              <th className="border border-purple-200 px-2 py-1 text-gray-500 text-[10px] w-12">层级</th>
              {Object.keys(mapping).map((c) => (
                <th key={c} className={`border border-purple-200 px-2 py-1 text-left ${mapping[c] === 'skip' ? 'text-gray-300' : 'text-purple-700'}`}>
                  {fieldLabels[mapping[c]] || `列${parseInt(c) + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-200 px-1 py-0.5 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onAdjustLevel(ri, -1)}
                      disabled={row.level === 0}
                      className={`text-[10px] rounded px-0.5 ${row.level === 0 ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-200'}`}
                      title="减少层级"
                    >◀</button>
                    <span className={`text-[10px] font-mono min-w-[12px] ${row.level > 0 ? 'text-purple-600 font-bold' : 'text-gray-300'}`}>
                      {row.level}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAdjustLevel(ri, 1)}
                      disabled={row.level >= 5}
                      className={`text-[10px] rounded px-0.5 ${row.level >= 5 ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-200'}`}
                      title="增加层级"
                    >▶</button>
                  </div>
                </td>
                {Object.keys(mapping).map((c) => (
                  <td key={c}
                    className={`border border-gray-200 px-2 py-1 ${mapping[c] === 'skip' ? 'text-gray-300 italic' : ''}`}
                    style={{ paddingLeft: row.level > 0 ? 8 + row.level * 14 : 6 }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {mapping[c] !== 'skip' && c === Object.keys(mapping)[0] && row.level > 0 && (
                        <span className="text-purple-300 shrink-0">{'└ '.repeat(row.level)}</span>
                      )}
                      {row.cells[parseInt(c)] || <span className="text-gray-300">—</span>}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
