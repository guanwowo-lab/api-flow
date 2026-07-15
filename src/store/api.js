import { supabase } from './supabaseClient'

// 字段映射：JS camelCase ↔ DB snake_case
const mapToDb = (row) => {
  const mapped = { ...row }
  if (mapped.createdAt !== undefined) { mapped.created_at = mapped.createdAt; delete mapped.createdAt }
  if (mapped.updatedAt !== undefined) { mapped.updated_at = mapped.updatedAt; delete mapped.updatedAt }
  if (mapped.projectId !== undefined) { mapped.project_id = mapped.projectId; delete mapped.projectId }
  if (mapped.folderId !== undefined) { mapped.folder_id = mapped.folderId; delete mapped.folderId }
  if (mapped.clientApiKey !== undefined) { mapped.client_api_key = mapped.clientApiKey; delete mapped.clientApiKey }
  return mapped
}

const mapFromDb = (row) => {
  if (!row) return row
  const mapped = {}
  if (row.created_at !== undefined) mapped.createdAt = row.created_at
  if (row.updated_at !== undefined) mapped.updatedAt = row.updated_at
  if (row.project_id !== undefined) mapped.projectId = row.project_id
  if (row.folder_id !== undefined) mapped.folderId = row.folder_id
  if (row.client_api_key !== undefined) mapped.clientApiKey = row.client_api_key
  const { created_at, updated_at, project_id, folder_id, client_api_key, ...rest } = row
  return { ...rest, ...mapped }
}

const mapArray = (rows) => (rows || []).map(mapFromDb)

// ─── Projects ───

export const projectApi = {
  async list() {
    const { data, error } = await supabase.from('projects').select('*').order('updated_at', { ascending: false })
    if (error) throw error
    return mapArray(data)
  },

  async get(id) {
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? mapFromDb(data) : null
  },

  async create(name) {
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('projects').insert({ name, created_at: now, updated_at: now }).select().single()
    if (error) throw error
    return mapFromDb(data)
  },

  async rename(id, name) {
    const { error } = await supabase.from('projects')
      .update({ name, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  },

  async remove(id) {
    // ON DELETE CASCADE 自动处理子表
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
  },
}

// ─── API Folders ───

export const apiFolderApi = {
  async list() {
    const { data, error } = await supabase.from('api_folders').select('*').order('updated_at', { ascending: false })
    if (error) throw error
    return mapArray(data)
  },

  async get(id) {
    const { data, error } = await supabase.from('api_folders').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? mapFromDb(data) : null
  },

  async save(folder) {
    const now = new Date().toISOString()
    const payload = mapToDb({
      name: folder.name,
      apis: folder.apis || [],
      createdAt: folder.createdAt || now,
      updatedAt: now,
    })
    if (folder.id) {
      const { data, error } = await supabase.from('api_folders').update(payload).eq('id', folder.id).select().single()
      if (error) throw error
      return mapFromDb(data)
    } else {
      const { data, error } = await supabase.from('api_folders').insert(payload).select().single()
      if (error) throw error
      return mapFromDb(data)
    }
  },

  async remove(id) {
    const { error } = await supabase.from('api_folders').delete().eq('id', id)
    if (error) throw error
  },
}

// ─── Project Folders ───

export const projectFolderApi = {
  async list(projectId) {
    const { data, error } = await supabase.from('project_folders').select('*').eq('project_id', projectId)
    if (error) throw error
    return mapArray(data)
  },

  async create(projectId, name) {
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('project_folders')
      .insert({ project_id: projectId, name, created_at: now, updated_at: now }).select().single()
    if (error) throw error
    return mapFromDb(data)
  },

  async remove(projectId, id) {
    // ON DELETE CASCADE 自动处理子表
    const { error } = await supabase.from('project_folders').delete().eq('id', id)
    if (error) throw error
  },

  async rename(id, name) {
    const { error } = await supabase.from('project_folders')
      .update({ name, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  },

  async touch(id) {
    await supabase.from('project_folders').update({ updated_at: new Date().toISOString() }).eq('id', id)
  },
}

// ─── API Extracts ───

export const extractApi = {
  async get(folderId, side) {
    const { data, error } = await supabase.from('api_extracts')
      .select('*').eq('folder_id', folderId).eq('side', side).maybeSingle()
    if (error) throw error
    return data ? mapFromDb(data) : null
  },

  async save(folderId, side, apis) {
    const now = new Date().toISOString()
    const existing = await this.get(folderId, side)
    if (existing) {
      const { data, error } = await supabase.from('api_extracts')
        .update({ apis, updated_at: now }).eq('id', existing.id).select().single()
      if (error) throw error
      return mapFromDb(data)
    } else {
      const { data, error } = await supabase.from('api_extracts')
        .insert({ folder_id: folderId, side, apis, created_at: now, updated_at: now }).select().single()
      if (error) throw error
      return mapFromDb(data)
    }
  },
}

// ─── Matches ───

export const matchApi = {
  async get(folderId) {
    const { data, error } = await supabase.from('matches')
      .select('*').eq('folder_id', folderId).maybeSingle()
    if (error) throw error
    return data ? mapFromDb(data) : null
  },

  async save(folderId, matchData) {
    const now = new Date().toISOString()
    const existing = await this.get(folderId)
    const payload = mapToDb({ folderId, ...matchData })
    if (existing) {
      const { data, error } = await supabase.from('matches')
        .update({ ...payload, updated_at: now }).eq('id', existing.id).select().single()
      if (error) throw error
      return mapFromDb(data)
    } else {
      const { data, error } = await supabase.from('matches')
        .insert({ ...payload, created_at: now, updated_at: now }).select().single()
      if (error) throw error
      return mapFromDb(data)
    }
  },
}

// ─── Match Items（新：每个客户 API 存一行）───

export const matchItemApi = {
  async list(folderId) {
    const { data, error } = await supabase.from('match_items')
      .select('*').eq('folder_id', folderId).order('created_at', { ascending: true })
    if (error) throw error
    return mapArray(data)
  },

  async save(folderId, clientApiKey, mappings) {
    const now = new Date().toISOString()
    const existing = await this.get(folderId, clientApiKey)
    const payload = mapToDb({ folderId, clientApiKey, mappings })
    if (existing) {
      const { data, error } = await supabase.from('match_items')
        .update({ ...payload, updated_at: now }).eq('id', existing.id).select().single()
      if (error) throw error
      return mapFromDb(data)
    } else {
      const { data, error } = await supabase.from('match_items')
        .insert({ ...payload, created_at: now, updated_at: now }).select().single()
      if (error) throw error
      return mapFromDb(data)
    }
  },

  async get(folderId, clientApiKey) {
    const { data, error } = await supabase.from('match_items')
      .select('*').eq('folder_id', folderId).eq('client_api_key', clientApiKey).maybeSingle()
    if (error) throw error
    return data ? mapFromDb(data) : null
  },

  async remove(folderId, clientApiKey) {
    const { error } = await supabase.from('match_items')
      .delete().eq('folder_id', folderId).eq('client_api_key', clientApiKey)
    if (error) throw error
  },
}

// ─── Flow Diagrams ───

export const diagramApi = {
  async get(folderId, type) {
    const { data, error } = await supabase.from('flow_diagrams')
      .select('*').eq('folder_id', folderId).eq('type', type).maybeSingle()
    if (error) throw error
    return data ? mapFromDb(data) : null
  },

  async save(folderId, type, diagramData) {
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('flow_diagrams')
      .upsert({ folder_id: folderId, type, data: diagramData, updated_at: now }, { onConflict: 'folder_id,type' })
      .select().single()
    if (error) throw error
    return mapFromDb(data)
  },
}
