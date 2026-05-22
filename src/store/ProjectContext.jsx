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
  activeView: 'home',      // 'home' | 'projects' | 'myApis' | 'create' | 'manage' | 'upload' | ...
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

    const extractA = await db.apiExtracts.where({ projectId: id, side: 'A' }).first()
    const extractB = await db.apiExtracts.where({ projectId: id, side: 'B' }).first()
    if (extractA) dispatch({ type: 'SET_EXTRACT', payload: extractA })
    if (extractB) dispatch({ type: 'SET_EXTRACT', payload: extractB })

    const matches = await db.matches.where({ projectId: id }).first()
    if (matches) dispatch({ type: 'SET_MATCHES', payload: matches })

    const seq = await db.flowDiagrams.where({ projectId: id, type: 'sequence' }).first()
    if (seq) dispatch({ type: 'SET_DIAGRAM', payload: seq })

    const map = await db.flowDiagrams.where({ projectId: id, type: 'mapping' }).first()
    if (map) dispatch({ type: 'SET_DIAGRAM', payload: map })

    dispatch({ type: 'SET_VIEW', payload: 'upload' })
  }, [])

  const saveExtract = useCallback(async (projectId, side, apis) => {
    const existing = await db.apiExtracts.where({ projectId, side }).first()
    const data = { projectId, side, apis }
    if (existing) {
      await db.apiExtracts.update(existing.id, data)
      data.id = existing.id
    } else {
      data.id = await db.apiExtracts.add(data)
    }
    dispatch({ type: 'SET_EXTRACT', payload: data })
    await db.projects.update(projectId, { updatedAt: new Date().toISOString() })
  }, [])

  const saveMatches = useCallback(async (projectId, pairs) => {
    const existing = await db.matches.where({ projectId }).first()
    const data = { projectId, pairs }
    if (existing) {
      await db.matches.update(existing.id, data)
      data.id = existing.id
    } else {
      data.id = await db.matches.add(data)
    }
    dispatch({ type: 'SET_MATCHES', payload: data })
    await db.projects.update(projectId, { updatedAt: new Date().toISOString() })
  }, [])

  const saveDiagram = useCallback(async (projectId, type, diagramData) => {
    const existing = await db.flowDiagrams.where({ projectId, type }).first()
    const data = { projectId, type, data: diagramData }
    if (existing) {
      await db.flowDiagrams.update(existing.id, data)
      data.id = existing.id
    } else {
      data.id = await db.flowDiagrams.add(data)
    }
    dispatch({ type: 'SET_DIAGRAM', payload: data })
    await db.projects.update(projectId, { updatedAt: new Date().toISOString() })
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

  return (
    <ProjectContext.Provider value={{
      state, dispatch,
      loadProjects, createProject, openProject,
      saveExtract, saveMatches, saveDiagram,
      loadApiFolders, saveApiFolder, deleteApiFolder,
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
