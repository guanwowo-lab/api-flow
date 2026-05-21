import Dexie from 'dexie'

const db = new Dexie('APIFlowDB')

db.version(1).stores({
  projects: '++id, name, createdAt, updatedAt',
  apiExtracts: '++id, projectId, side',
  matches: '++id, projectId',
  flowDiagrams: '++id, projectId, type',
})

export default db
