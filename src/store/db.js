import Dexie from 'dexie'

const db = new Dexie('APIFlowDB')

db.version(1).stores({
  projects: '++id, name, createdAt, updatedAt',
  apiExtracts: '++id, projectId, side',
  matches: '++id, projectId',
  flowDiagrams: '++id, projectId, type',
})

db.version(2).stores({
  projects: '++id, name, createdAt, updatedAt',
  apiExtracts: '++id, projectId, side',
  matches: '++id, projectId',
  flowDiagrams: '++id, projectId, type',
  apiFolders: '++id, name, createdAt, updatedAt',
})

export default db
