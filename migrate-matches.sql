-- 将旧 matches 表数据迁移到新的 match_items 表
-- 在 Supabase SQL Editor 中执行

-- Step 1: 从旧的 matches.mappings 拆出每条 clientIdx → mappings 记录
WITH old_rows AS (
  SELECT
    m.folder_id,
    entry.key::int AS client_idx,          -- 旧格式的数组索引
    entry.value AS mappings,                -- 该客户API的参数映射数组
    m.created_at,
    m.updated_at
  FROM matches m
  CROSS JOIN LATERAL jsonb_each(m.mappings) AS entry
  WHERE jsonb_array_length(entry.value) > 0  -- 跳过空数组
),

-- Step 2: 从 api_extracts (side='B') 中取出每个客户API的 name 和 url
client_ids AS (
  SELECT
    ext.folder_id,
    arr.i - 1 AS client_idx,               -- WITH ORDINALITY 是 1-based，转为 0-based
    arr.item->>'name' AS api_name,
    arr.item->>'url'  AS api_url
  FROM api_extracts ext
  CROSS JOIN LATERAL jsonb_array_elements(ext.apis) WITH ORDINALITY AS arr(item, i)
  WHERE ext.side = 'B'
)

-- Step 3: 关联生成 client_api_key 并写入新表
INSERT INTO match_items (folder_id, client_api_key, mappings, created_at, updated_at)
SELECT
  r.folder_id,
  COALESCE(
    c.api_name || '|||' || c.api_url,
    'unknown-idx-' || r.client_idx        -- 万一 api_extracts 被删了，用占位 key
  ) AS client_api_key,
  r.mappings,
  COALESCE(r.created_at, now()) AS created_at,
  COALESCE(r.updated_at, now()) AS updated_at
FROM old_rows r
LEFT JOIN client_ids c
  ON c.folder_id = r.folder_id
  AND c.client_idx = r.client_idx
ON CONFLICT (folder_id, client_api_key) DO NOTHING;

-- 验证迁移结果
SELECT
  folder_id,
  client_api_key,
  jsonb_array_length(mappings) AS param_count
FROM match_items
ORDER BY folder_id, client_api_key;
