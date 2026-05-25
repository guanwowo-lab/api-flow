import { createContext, useContext, useReducer, useCallback } from 'react'
import db from './db'

const ProjectContext = createContext(null)

const initialState = {
  project: null,           // { id, name, createdAt, updatedAt }
  projectList: [],         // [{ id, name, createdAt, updatedAt }]
  myApis: [],              // [{ id, name, method, url, inputParams, outputParams }]
  apiFolders: [],           // [{ id, name, apis: [], createdAt, updatedAt }]
  extractA: null,          // { id, projectId, side: 'A', apis: [] }
  extractB: null,          // { id, projectId, side: 'B', apis: [] }
  matches: null,           // { id, projectId, pairs: [] }
  sequenceDiagram: null,   // { id, projectId, type: 'sequence', data: { nodes, edges } }
  mappingDiagram: null,    // { id, projectId, type: 'mapping', data: { nodes, edges } }
  folder: null,            // { id, projectId, name }
  projectFolders: [],      // [{ id, projectId, name, createdAt, updatedAt }]
  activeView: 'home',
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PROJECT':
      return { ...state, project: action.payload }
    case 'SET_PROJECT_LIST':
      return { ...state, projectList: action.payload }
    case 'SET_EXTRACT':
      return action.payload.side === 'A'
        ? { ...state, extractA: action.payload }
        : { ...state, extractB: action.payload }
    case 'SET_MATCHES':
      return { ...state, matches: action.payload }
    case 'SET_DIAGRAM':
      return action.payload.type === 'sequence'
        ? { ...state, sequenceDiagram: action.payload }
        : { ...state, mappingDiagram: action.payload }
    case 'SET_API_FOLDERS':
      return { ...state, apiFolders: action.payload }
    case 'SET_FOLDER':
      return { ...state, folder: action.payload }
    case 'SET_PROJECT_FOLDERS':
      return { ...state, projectFolders: action.payload }
    case 'SET_VIEW':
      return { ...state, activeView: action.payload }
    case 'RESET':
      return { ...initialState, projectList: state.projectList }
    default:
      return state
  }
}

export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const loadProjects = useCallback(async () => {
    const list = await db.projects.orderBy('updatedAt').reverse().toArray()
    dispatch({ type: 'SET_PROJECT_LIST', payload: list })
  }, [])

  const createProject = useCallback(async (name) => {
    const now = new Date().toISOString()
    const id = await db.projects.add({ name, createdAt: now, updatedAt: now })
    const project = { id, name, createdAt: now, updatedAt: now }
    dispatch({ type: 'SET_PROJECT', payload: project })
    await loadProjects()
    return project
  }, [loadProjects])

  const openProject = useCallback(async (id) => {
    const project = await db.projects.get(id)
    if (!project) return
    dispatch({ type: 'SET_PROJECT', payload: project })
    dispatch({ type: 'SET_FOLDER', payload: null })

    let folders = await db.projectFolders.where({ projectId: id }).toArray()

    // 自动迁移：如果没有文件夹，但存在旧数据，创建默认文件夹并迁移
    if (folders.length === 0) {
      const oldExtractA = await db.apiExtracts.where({ projectId: id, side: 'A' }).filter((e) => !e.folderId).first()
      const oldExtractB = await db.apiExtracts.where({ projectId: id, side: 'B' }).filter((e) => !e.folderId).first()
      const oldMatches = await db.matches.where({ projectId: id }).filter((m) => !m.folderId).first()
      const hasData = oldExtractA || oldExtractB || oldMatches

      if (hasData) {
        const now = new Date().toISOString()
        const folderId = await db.projectFolders.add({ projectId: id, name: '默认对接文件夹', createdAt: now, updatedAt: now })

        // 迁移旧数据
        const tables = [
          { store: db.apiExtracts, name: 'apiExtracts' },
          { store: db.matches, name: 'matches' },
          { store: db.flowDiagrams, name: 'flowDiagrams' },
        ]
        for (const { store } of tables) {
          const docs = await store.where({ projectId: id }).filter((d) => !d.folderId).toArray()
          for (const doc of docs) {
            await store.update(doc.id, { folderId })
          }
        }

        folders = await db.projectFolders.where({ projectId: id }).toArray()
      }
    }

    dispatch({ type: 'SET_PROJECT_FOLDERS', payload: folders })
    dispatch({ type: 'SET_VIEW', payload: 'projectFolders' })
  }, [])

  const loadApiFolders = useCallback(async () => {
    const list = await db.apiFolders.orderBy('updatedAt').reverse().toArray()
    dispatch({ type: 'SET_API_FOLDERS', payload: list })
  }, [])

  const saveApiFolder = useCallback(async (folder) => {
    const now = new Date().toISOString()
    const data = {
      name: folder.name,
      apis: folder.apis || [],
      createdAt: folder.createdAt || now,
      updatedAt: now,
    }
    if (folder.id) {
      await db.apiFolders.update(folder.id, data)
      data.id = folder.id
    } else {
      data.id = await db.apiFolders.add(data)
    }
    await loadApiFolders()
    return data
  }, [loadApiFolders])

  const deleteApiFolder = useCallback(async (id) => {
    await db.apiFolders.delete(id)
    await loadApiFolders()
  }, [loadApiFolders])

  const loadProjectFolders = useCallback(async (projectId) => {
    const list = await db.projectFolders.where({ projectId }).toArray()
    dispatch({ type: 'SET_PROJECT_FOLDERS', payload: list })
  }, [])

  const createProjectFolder = useCallback(async (projectId, name) => {
    const now = new Date().toISOString()
    const id = await db.projectFolders.add({ projectId, name, createdAt: now, updatedAt: now })
    await loadProjectFolders(projectId)
    return { id, projectId, name, createdAt: now, updatedAt: now }
  }, [loadProjectFolders])

  const deleteProjectFolder = useCallback(async (projectId, id) => {
    await db.projectFolders.delete(id)
    // 同时清理该文件夹下的数据
    const extracts = await db.apiExtracts.where({ folderId: id }).toArray()
    for (const e of extracts) await db.apiExtracts.delete(e.id)
    const matchDocs = await db.matches.where({ folderId: id }).toArray()
    for (const m of matchDocs) await db.matches.delete(m.id)
    const diagrams = await db.flowDiagrams.where({ folderId: id }).toArray()
    for (const d of diagrams) await db.flowDiagrams.delete(d.id)
    await loadProjectFolders(projectId)
  }, [loadProjectFolders])

  const openFolder = useCallback(async (folder) => {
    dispatch({ type: 'SET_FOLDER', payload: folder })

    const extractA = await db.apiExtracts.where({ folderId: folder.id, side: 'A' }).first()
    const extractB = await db.apiExtracts.where({ folderId: folder.id, side: 'B' }).first()
    if (extractA) dispatch({ type: 'SET_EXTRACT', payload: extractA })
    else dispatch({ type: 'SET_EXTRACT', payload: { folderId: folder.id, side: 'A', apis: [] } })
    if (extractB) dispatch({ type: 'SET_EXTRACT', payload: extractB })

    const matches = await db.matches.where({ folderId: folder.id }).first()
    if (matches) dispatch({ type: 'SET_MATCHES', payload: matches })

    const seq = await db.flowDiagrams.where({ folderId: folder.id, type: 'sequence' }).first()
    if (seq) dispatch({ type: 'SET_DIAGRAM', payload: seq })

    const map = await db.flowDiagrams.where({ folderId: folder.id, type: 'mapping' }).first()
    if (map) dispatch({ type: 'SET_DIAGRAM', payload: map })

    if (extractB && extractB.apis && extractB.apis.length > 0) {
      dispatch({ type: 'SET_VIEW', payload: 'match' })
    } else {
      dispatch({ type: 'SET_VIEW', payload: 'upload' })
    }
  }, [])

  const saveExtract = useCallback(async (projectId, folderId, side, apis) => {
    const existing = await db.apiExtracts.where({ folderId, side }).first()
    const data = { projectId, folderId, side, apis }
    if (existing) {
      await db.apiExtracts.update(existing.id, data)
      data.id = existing.id
    } else {
      data.id = await db.apiExtracts.add(data)
    }
    dispatch({ type: 'SET_EXTRACT', payload: data })
    await db.projectFolders.update(folderId, { updatedAt: new Date().toISOString() })
  }, [])

  const saveMatches = useCallback(async (projectId, folderId, matchData) => {
    const existing = await db.matches.where({ folderId }).first()
    const data = { projectId, folderId, ...matchData }
    if (existing) {
      await db.matches.update(existing.id, data)
      data.id = existing.id
    } else {
      data.id = await db.matches.add(data)
    }
    dispatch({ type: 'SET_MATCHES', payload: data })
    await db.projectFolders.update(folderId, { updatedAt: new Date().toISOString() })
  }, [])

  const saveDiagram = useCallback(async (projectId, folderId, type, diagramData) => {
    const existing = await db.flowDiagrams.where({ folderId, type }).first()
    const data = { projectId, folderId, type, data: diagramData }
    if (existing) {
      await db.flowDiagrams.update(existing.id, data)
      data.id = existing.id
    } else {
      data.id = await db.flowDiagrams.add(data)
    }
    dispatch({ type: 'SET_DIAGRAM', payload: data })
    await db.projectFolders.update(folderId, { updatedAt: new Date().toISOString() })
  }, [])

  return (
    <ProjectContext.Provider value={{
      state, dispatch,
      loadProjects, createProject, openProject,
      saveExtract, saveMatches, saveDiagram,
      loadApiFolders, saveApiFolder, deleteApiFolder,
      loadProjectFolders, createProjectFolder, deleteProjectFolder, openFolder,
    }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}
