import { useState, useEffect } from 'react'
import { useProject } from '../../store/ProjectContext'
import ApiEditor from '../ApiExtractor/ApiEditor'

export default function ApiManager() {
  const { state, saveExtract, loadApiFolders, saveApiFolder, dispatch } = useProject()
  const folders = state.apiFolders || []
  const [draftApis, setDraftApis] = useState([])
  const [initialized, setInitialized] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    loadApiFolders()
  }, [loadApiFolders])

  useEffect(() => {
    if (!initialized && state.extractA) {
      setDraftApis((state.extractA.apis || []).map((a) => ({ ...a })))
      setInitialized(true)
    }
  }, [state.extractA, initialized])

  const updateApi = (idx, updated) => {
    setDraftApis((prev) => prev.map((a, i) => (i === idx ? updated : a)))
    setDirty(true)
  }

  const deleteApi = (idx) => {
    setDraftApis((prev) => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const addApi = () => {
    const newApi = { name: '', url: '', method: 'POST', inputParams: [], outputParams: [] }
    setDraftApis((prev) => [...prev, newApi])
    setDirty(true)
  }

  const importFromFolder = (folder) => {
    const folderApis = (folder.apis || []).map((a) => ({ ...a }))
    setDraftApis((prev) => [...prev, ...folderApis])
    setDirty(true)
    setShowImport(false)
  }

  const handleSaveAll = async () => {
    await saveExtract(state.project.id, state.folder?.id, 'A', draftApis)
    setDirty(false)
  }

  const handleCleanup = async () => {
    const keepNames = ['消息数据', '通知数据', '售后订单数据', '订单数据', '商品数据']
    const keepApis = []
    for (const f of folders) {
      if (keepNames.some((n) => f.name.includes(n))) {
        keepApis.push(...(f.apis || []))
      }
    }

    const keepSet = new Set(keepApis.map((a) => (a.name || '') + '|' + (a.url || '')))
    const junk = draftApis.filter((a) => !keepSet.has((a.name || '') + '|' + (a.url || '')))

    if (junk.length === 0) {
      alert('没有需要清理的接口，当前项目中的接口都在你的 5 个文件夹中。')
      return
    }

    if (!confirm(`将 ${junk.length} 个不在你5个文件夹中的接口移入"垃圾数据"文件夹？\n项目只保留 ${keepApis.length} 个。`)) return

    // 创建垃圾数据文件夹
    await saveApiFolder({ name: '垃圾数据_' + Date.now(), apis: junk })
    await loadApiFolders()

    // 替换项目数据为干净的 28 个
    const cleanApis = keepApis.map((a) => ({ ...a }))
    await saveExtract(state.project.id, state.folder?.id, 'A', cleanApis)
    setDraftApis(cleanApis)
    setDirty(false)
  }

  const handleContinue = async () => {
    if (dirty) await saveExtract(state.project.id, state.folder?.id, 'A', draftApis)
    dispatch({ type: 'SET_VIEW', payload: 'upload' })
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'projects' })}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; 项目列表
        </button>
        <h1 className="text-xl font-bold">我方 API 管理 — {state.project?.name}</h1>
        <span className="text-sm text-gray-400 ml-auto">{draftApis.length} 个接口</span>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
        在这里维护本项目的<strong>我方系统</strong> API 接口。编辑接口后需点击接口上的<strong>"保存"</strong>按钮，再点击下方<strong>"全部保存到数据库"</strong>完成持久化。
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <button onClick={addApi} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          + 添加接口
        </button>
        <button
          onClick={() => setShowImport(!showImport)}
          className={`px-4 py-2 rounded-lg text-sm border ${showImport ? 'bg-gray-200 border-gray-400' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
        >
          📂 从 API 库导入
        </button>
        <button
          onClick={handleCleanup}
          className="px-4 py-2 rounded-lg text-sm bg-red-100 text-red-600 hover:bg-red-200 border border-red-300"
          title="将不在5个API库文件夹中的接口移入垃圾数据文件夹"
        >
          🗑 清理垃圾数据
        </button>
        <button
          onClick={handleSaveAll}
          disabled={!dirty}
          className={`px-4 py-2 rounded-lg text-sm ml-auto ${dirty ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-400'}`}
        >
          {dirty ? '● 全部保存到数据库' : '已全部保存 ✓'}
        </button>
        <button
          onClick={handleContinue}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
        >
          上传客户文档 &rarr;
        </button>
      </div>

      {showImport && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium mb-3">选择要导入的文件夹：</h3>
          {folders.length === 0 ? (
            <p className="text-sm text-gray-400">
              暂无预置接口，请先到 <a className="text-blue-600 underline cursor-pointer"
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'apiLibrary' })}>API 库</a> 创建文件夹和接口。
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => importFromFolder(f)}
                  className="text-left px-3 py-2 rounded border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-sm"
                >
                  📁 {f.name}
                  <span className="text-xs text-gray-400 ml-1">({(f.apis || []).length} 个接口)</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {draftApis.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-lg mb-2">暂无接口</p>
          <p>点击"+ 添加接口"手动录入，或"从 API 库导入"已有接口</p>
        </div>
      ) : (
        <div className="space-y-1">
          {draftApis.map((api, i) => (
            <ApiEditor
              key={i}
              api={api}
              onSave={(updated) => updateApi(i, updated)}
              onDelete={() => deleteApi(i)}
            />
          ))}
        </div>
      )}

      {draftApis.length > 0 && (
        <button
          onClick={handleContinue}
          className="w-full mt-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg"
        >
          保存并上传客户文档
        </button>
      )}
    </div>
  )
}
