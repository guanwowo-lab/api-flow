export default function CredentialBar({ credentials, onChange, env, onEnvChange }) {
  const { appKey, appSecret, accessToken } = credentials

  const update = (key, value) => onChange({ ...credentials, [key]: value })

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 text-sm shadow-sm">
      <span className="font-semibold text-gray-700 whitespace-nowrap">API 测试工具</span>
      <span className="text-gray-300">|</span>

      <label className="flex items-center gap-1 text-xs text-gray-500">
        appKey
        <input type="text" value={appKey || ''} onChange={e => update('appKey', e.target.value)}
          className="w-28 px-2 py-1 text-gray-700 border border-gray-300 rounded-md text-xs focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" placeholder="appKey" />
      </label>

      <label className="flex items-center gap-1 text-xs text-gray-500">
        appSecret
        <input type="password" value={appSecret || ''} onChange={e => update('appSecret', e.target.value)}
          className="w-36 px-2 py-1 text-gray-700 border border-gray-300 rounded-md text-xs focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" placeholder="appSecret" />
      </label>

      <label className="flex items-center gap-1 text-xs text-gray-500">
        环境
        <select value={env} onChange={e => onEnvChange(e.target.value)}
          className="px-2 py-1 text-gray-700 border border-gray-300 rounded-md text-xs focus:outline-none">
          <option value="test">测试环境</option>
          <option value="prod">生产环境</option>
        </select>
      </label>

      {accessToken && (
        <span className="ml-auto text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-200">
          Token: {accessToken.slice(0, 16)}...
        </span>
      )}
    </div>
  )
}
