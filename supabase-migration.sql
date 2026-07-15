-- API-Flow 数据库迁移脚本
-- 在 Supabase SQL Editor 中执行此脚本

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 项目表（全局 API 库的文件夹）
CREATE TABLE api_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  apis JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 项目表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (name)
);

-- 项目内文件夹（对接文件夹）
CREATE TABLE project_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_project_folders_project ON project_folders(project_id);

-- API 提取数据（我方/客户提取的接口列表）
CREATE TABLE api_extracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id UUID NOT NULL REFERENCES project_folders(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('A', 'B')),
  apis JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (folder_id, side)
);

CREATE INDEX idx_api_extracts_folder ON api_extracts(folder_id);

-- 匹配数据（新：每个客户 API 存一行，用 client_api_key 寻址，不再依赖索引）
CREATE TABLE match_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id UUID NOT NULL REFERENCES project_folders(id) ON DELETE CASCADE,
  client_api_key TEXT NOT NULL,
  mappings JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (folder_id, client_api_key)
);

CREATE INDEX idx_match_items_folder ON match_items(folder_id);

-- 旧匹配表（已废弃，由 match_items 替代）
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id UUID NOT NULL REFERENCES project_folders(id) ON DELETE CASCADE,
  mappings JSONB DEFAULT '{}'::jsonb,
  pairs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (folder_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_folder ON matches(folder_id);

-- 流程图数据
CREATE TABLE flow_diagrams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id UUID NOT NULL REFERENCES project_folders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sequence', 'mapping')),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (folder_id, type)
);

CREATE INDEX idx_flow_diagrams_folder ON flow_diagrams(folder_id);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_api_folders_updated_at
  BEFORE UPDATE ON api_folders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_project_folders_updated_at
  BEFORE UPDATE ON project_folders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_api_extracts_updated_at
  BEFORE UPDATE ON api_extracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_match_items_updated_at
  BEFORE UPDATE ON match_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_flow_diagrams_updated_at
  BEFORE UPDATE ON flow_diagrams FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 启用 Row Level Security（Supabase 推荐）
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_extracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_diagrams ENABLE ROW LEVEL SECURITY;

-- 创建匿名访问策略（开发阶段使用 anon key）
-- 如果后续需要用户认证，将 USING 条件改为 (auth.uid() = user_id)
CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true);
CREATE POLICY "Allow all on api_folders" ON api_folders FOR ALL USING (true);
CREATE POLICY "Allow all on project_folders" ON project_folders FOR ALL USING (true);
CREATE POLICY "Allow all on api_extracts" ON api_extracts FOR ALL USING (true);
CREATE POLICY "Allow all on matches" ON matches FOR ALL USING (true);
CREATE POLICY "Allow all on match_items" ON match_items FOR ALL USING (true);
CREATE POLICY "Allow all on flow_diagrams" ON flow_diagrams FOR ALL USING (true);

-- 增量迁移：为已有表添加时间戳列
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_extracts' AND column_name = 'created_at') THEN
    ALTER TABLE api_extracts ADD COLUMN created_at TIMESTAMPTZ DEFAULT now(), ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'created_at') THEN
    ALTER TABLE matches ADD COLUMN created_at TIMESTAMPTZ DEFAULT now(), ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'flow_diagrams' AND column_name = 'created_at') THEN
    ALTER TABLE flow_diagrams ADD COLUMN created_at TIMESTAMPTZ DEFAULT now(), ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- 增量迁移：删除冗余的 project_id 列
ALTER TABLE api_extracts DROP COLUMN IF EXISTS project_id;
ALTER TABLE matches DROP COLUMN IF EXISTS project_id;
ALTER TABLE flow_diagrams DROP COLUMN IF EXISTS project_id;

-- 增量迁移：项目名称唯一约束
ALTER TABLE projects ADD CONSTRAINT IF NOT EXISTS projects_name_unique UNIQUE (name);
