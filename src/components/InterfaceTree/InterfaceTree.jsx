import { useState } from 'react'

export default function InterfaceTree({ apis, selectedId, onSelect, onToggle }) {
  const grouped = {}
  for (const api of apis) {
    if (!grouped[api.category]) grouped[api.category] = []
    grouped[api.category].push(api)
  }

  const [search, setSearch] = useState('')

  const filtered = search
    ? apis.filter(a => a.name.includes(search) || a.id.includes(search))
    : null

  return (
    <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200">
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          placeholder="搜索接口..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-400"
        />
      </div>

      {filtered ? (
        <div className="flex-1 overflow-auto p-2">
          {filtered.map(api => (
            <div
              key={api.id}
              onClick={() => onSelect(api.id)}
              className={`px-3 py-2 text-sm cursor-pointer rounded mb-0.5 hover:bg-blue-50 ${
                selectedId === api.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              {api.name}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {Object.entries(grouped).map(([category, items]) => (
            <CategoryGroup
              key={category}
              category={category}
              items={items}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryGroup({ category, items, selectedId, onSelect }) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
      >
        <span className="text-xs">{open ? '▼' : '▶'}</span>
        {category} ({items.length})
      </div>
      {open && (
        <div className="pb-1">
          {items.map(api => (
            <div
              key={api.id}
              onClick={() => onSelect(api.id)}
              className={`pl-8 pr-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${
                selectedId === api.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              {api.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
