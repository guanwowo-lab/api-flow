export default function CredentialBar({ credentials, onChange, env, onEnvChange }) {
  const { appKey, appSecret, accessToken } = credentials

  const update = (key, value) => onChange({ ...credentials, [key]: value })

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 text-white text-sm">
      <span className="font-semibold whitespace-nowrap">API Test Tool</span>

      <label className="flex items-center gap-1 ml-4">
        appKey:
        <input
          type="text"
          value={appKey || ''}
          onChange={e => update('appKey', e.target.value)}
          className="w-28 px-2 py-0.5 text-gray-900 rounded text-xs"
          placeholder="appKey"
        />
      </label>

      <label className="flex items-center gap-1">
        appSecret:
        <input
          type="password"
          value={appSecret || ''}
          onChange={e => update('appSecret', e.target.value)}
          className="w-36 px-2 py-0.5 text-gray-900 rounded text-xs"
          placeholder="appSecret"
        />
      </label>

      <label className="flex items-center gap-1 ml-2">
        环境:
        <select
          value={env}
          onChange={e => onEnvChange(e.target.value)}
          className="px-2 py-0.5 text-gray-900 rounded text-xs"
        >
          <option value="test">测试环境</option>
          <option value="prod">生产环境</option>
        </select>
      </label>

      {accessToken && (
        <span className="ml-auto text-xs text-green-400">
          Token: {accessToken.slice(0, 20)}...
        </span>
      )}
    </div>
  )
}
