import { createContext, useContext, useReducer, useCallback } from 'react'
import { projectApi, apiFolderApi, projectFolderApi, extractApi, matchItemApi, diagramApi } from './api'
import { supabase } from './supabaseClient'

const ProjectContext = createContext(null)

const initialState = {
  project: null,
  projectList: [],
  myApis: [],
  apiFolders: [],
  extractA: null,
  extractB: null,
  matches: null,
  sequenceDiagram: null,
  mappingDiagram: null,
  folder: null,
  projectFolders: [],
  activeView: 'home',
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PROJECT':
      return { ...state, project: action.payload }
    case 'SET_PROJECT_LIST':
      return { ...state, projectList: action.payload }
    case 'SET_EXTRACT':
      if (!action.payload) return action.side === 'A' ? { ...state, extractA: null } : { ...state, extractB: null }
      return action.payload.side === 'A'
        ? { ...state, extractA: action.payload }
        : { ...state, extractB: action.payload }
    case 'SET_MATCHES':
      return { ...state, matches: action.payload }
    case 'SET_DIAGRAM':
      if (!action.payload) {
        if (action.diagramType === 'sequence') return { ...state, sequenceDiagram: null }
        if (action.diagramType === 'mapping') return { ...state, mappingDiagram: null }
        return state
      }
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
    // 优先显示缓存数据
    try {
      const cached = localStorage.getItem('apiflow_projects')
      if (cached) dispatch({ type: 'SET_PROJECT_LIST', payload: JSON.parse(cached) })
    } catch {}
    const list = await projectApi.list()
    dispatch({ type: 'SET_PROJECT_LIST', payload: list })
    try { localStorage.setItem('apiflow_projects', JSON.stringify(list)) } catch {}
  }, [])

  const renameProject = useCallback(async (id, name) => {
    await projectApi.rename(id, name)
    await loadProjects()
  }, [loadProjects])

  const deleteProject = useCallback(async (id) => {
    await projectApi.remove(id)
    await loadProjects()
  }, [loadProjects])

  const createProject = useCallback(async (name) => {
    const project = await projectApi.create(name)
    dispatch({ type: 'SET_PROJECT', payload: project })
    await loadProjects()
    return project
  }, [loadProjects])

  const openProject = useCallback(async (id) => {
    const project = await projectApi.get(id)
    if (!project) return
    dispatch({ type: 'SET_PROJECT', payload: project })
    dispatch({ type: 'SET_FOLDER', payload: null })

    const folders = await projectFolderApi.list(id)

    dispatch({ type: 'SET_PROJECT_FOLDERS', payload: folders })
    dispatch({ type: 'SET_VIEW', payload: 'projectFolders' })
  }, [])

  const loadApiFolders = useCallback(async () => {
    // 优先显示缓存数据
    try {
      const cached = localStorage.getItem('apiflow_api_folders')
      if (cached) dispatch({ type: 'SET_API_FOLDERS', payload: JSON.parse(cached) })
    } catch {}
    const list = await apiFolderApi.list()
    dispatch({ type: 'SET_API_FOLDERS', payload: list })
    try { localStorage.setItem('apiflow_api_folders', JSON.stringify(list)) } catch {}
  }, [])

  const saveApiFolder = useCallback(async (folder) => {
    const result = await apiFolderApi.save(folder)
    await loadApiFolders()
    return result
  }, [loadApiFolders])

  const deleteApiFolder = useCallback(async (id) => {
    await apiFolderApi.remove(id)
    await loadApiFolders()
  }, [loadApiFolders])

  const loadProjectFolders = useCallback(async (projectId) => {
    const list = await projectFolderApi.list(projectId)
    dispatch({ type: 'SET_PROJECT_FOLDERS', payload: list })
  }, [])

  const createProjectFolder = useCallback(async (projectId, name) => {
    const folder = await projectFolderApi.create(projectId, name)
    await loadProjectFolders(projectId)
    return folder
  }, [loadProjectFolders])

  const deleteProjectFolder = useCallback(async (projectId, id) => {
    await projectFolderApi.remove(projectId, id)
    await loadProjectFolders(projectId)
  }, [loadProjectFolders])

  const openFolder = useCallback(async (folder) => {
    dispatch({ type: 'SET_FOLDER', payload: folder })

    const [extractB, items, seq, map] = await Promise.all([
      extractApi.get(folder.id, 'B'),
      matchItemApi.list(folder.id),
      diagramApi.get(folder.id, 'sequence'),
      diagramApi.get(folder.id, 'mapping'),
    ])

    if (extractB) dispatch({ type: 'SET_EXTRACT', payload: extractB })
    else dispatch({ type: 'SET_EXTRACT', payload: null, side: 'B' })

    // 转换为 {[clientApiKey]: mappings[]}
    const mappingsRecord = {}
    for (const item of items) {
      mappingsRecord[item.clientApiKey] = item.mappings || []
    }
    dispatch({ type: 'SET_MATCHES', payload: mappingsRecord })

    if (seq) dispatch({ type: 'SET_DIAGRAM', payload: seq })
    else dispatch({ type: 'SET_DIAGRAM', payload: null, diagramType: 'sequence' })

    if (map) dispatch({ type: 'SET_DIAGRAM', payload: map })
    else dispatch({ type: 'SET_DIAGRAM', payload: null, diagramType: 'mapping' })

    // Go to choice page instead of directly to match/upload
    dispatch({ type: 'SET_VIEW', payload: 'folderChoice' })
  }, [])

  const saveExtract = useCallback(async (folderId, side, apis) => {
    const data = await extractApi.save(folderId, side, apis)
    dispatch({ type: 'SET_EXTRACT', payload: data })
    await projectFolderApi.touch(folderId)
  }, [])

  const saveMatches = useCallback(async (folderId, clientApiKey, mappings) => {
    await matchItemApi.save(folderId, clientApiKey, mappings)
    await projectFolderApi.touch(folderId)
  }, [])

  const saveDiagram = useCallback(async (folderId, type, diagramData) => {
    const data = await diagramApi.save(folderId, type, diagramData)
    dispatch({ type: 'SET_DIAGRAM', payload: data })
    await projectFolderApi.touch(folderId)
  }, [])

  return (
    <ProjectContext.Provider value={{
      state, dispatch,
      loadProjects, createProject, renameProject, deleteProject, openProject,
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
