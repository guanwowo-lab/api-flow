import { useState, useMemo, useEffect, useCallback } from 'react'
import { useProject } from '../../store/ProjectContext'
import CredentialBar from '../CredentialBar/CredentialBar'
import InterfaceTree from '../InterfaceTree/InterfaceTree'
import ApiTest from '../../pages/ApiTest/ApiTest'
import BatchTest from '../../pages/BatchTest/BatchTest'
import History from '../../pages/History/History'

// Load all API definitions statically (Vite glob import)
const apiModules = import.meta.glob('../../config/api-defs/*.json', { eager: true, import: 'default' })
let allApis = []
for (const mod of Object.values(apiModules)) {
  allApis = allApis.concat(mod)
}

const NAV_ITEMS = [
  { key: 'apiTest', label: '接口测试' },
  { key: 'batchTest', label: '批量测试' },
  { key: 'history', label: '历史记录' },
]

export default function Layout() {
  const { dispatch } = useProject()
  const [credentials, setCredentials] = useState({ appKey: '', appSecret: '', accessToken: '' })
  const [env, setEnv] = useState('test')
  const [activeView, setActiveView] = useState('apiTest')
  const [selectedApiId, setSelectedApiId] = useState(null)

  const handleTokenUpdate = useCallback(token => {
    setCredentials(prev => ({ ...prev, accessToken: token }))
  }, [])

  const selectedApi = useMemo(
    () => allApis.find(a => a.id === selectedApiId),
    [selectedApiId]
  )

  // Expose navigation handler globally for History replay
  useEffect(() => {
    window.handleNav = (view, apiId) => {
      setActiveView(view)
      if (apiId) setSelectedApiId(apiId)
    }
    return () => { delete window.handleNav }
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <CredentialBar
        credentials={credentials}
        onChange={setCredentials}
        env={env}
        onEnvChange={setEnv}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-72 flex-shrink-0 overflow-hidden">
          <InterfaceTree
            apis={allApis}
            selectedId={selectedApiId}
            onSelect={id => {
              setSelectedApiId(id)
              if (activeView === 'batchTest') {
                window.dispatchEvent(new CustomEvent('batchAddApi', { detail: id }))
              } else {
                setActiveView('apiTest')
              }
            }}
          />
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Nav tabs */}
          <div className="flex border-b border-gray-200 bg-white px-4">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeView === item.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
              className="ml-auto px-4 py-2 text-sm text-gray-500 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-300 transition-colors"
            >
              ← 返回首页
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {activeView === 'apiTest' && (
              <ApiTest
                api={selectedApi}
                credentials={credentials}
                env={env}
                onTokenUpdate={handleTokenUpdate}
              />
            )}
            {activeView === 'batchTest' && (
              <BatchTest
                credentials={credentials}
                env={env}
                onTokenUpdate={handleTokenUpdate}
              />
            )}
            {activeView === 'history' && (
              <History apis={allApis} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
