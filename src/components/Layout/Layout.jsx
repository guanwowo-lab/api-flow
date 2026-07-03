import { useState, useMemo } from 'react'
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
  const [credentials, setCredentials] = useState({ appKey: '', appSecret: '', accessToken: '' })
  const [env, setEnv] = useState('test')
  const [activeView, setActiveView] = useState('apiTest')
  const [selectedApiId, setSelectedApiId] = useState(null)

  const selectedApi = useMemo(
    () => allApis.find(a => a.id === selectedApiId),
    [selectedApiId]
  )

  // Listen for navigation events from History replay
  function handleNavChange(view, apiId) {
    setActiveView(view)
    if (apiId) setSelectedApiId(apiId)
  }

  // Expose navigation handler globally for replay
  window.handleNav = (view, apiId) => {
    setActiveView(view)
    if (apiId) setSelectedApiId(apiId)
  }

  return (
    <div className="h-screen flex flex-col">
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
              setActiveView('apiTest')
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
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {activeView === 'apiTest' && (
              <ApiTest
                api={selectedApi}
                credentials={credentials}
                env={env}
                onTokenUpdate={token => setCredentials(prev => ({ ...prev, accessToken: token }))}
              />
            )}
            {activeView === 'batchTest' && (
              <BatchTest
                apis={allApis}
                credentials={credentials}
                env={env}
                onTokenUpdate={token => setCredentials(prev => ({ ...prev, accessToken: token }))}
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
