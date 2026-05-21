/**
 * 计算两个接口列表的匹配分数，返回推荐匹配对
 * @param {Array} apisA - 我方接口列表
 * @param {Array} apisB - 客户接口列表
 * @param {number} threshold - 匹配阈值 (0-1)，默认 0.4
 * @returns {Array<{apiA: object, apiB: object, score: number, details: object}>}
 */
export function computeMatches(apisA, apisB, threshold = 0.4) {
  const matches = []

  for (const apiA of apisA) {
    for (const apiB of apisB) {
      const { score, details } = computePairScore(apiA, apiB)
      if (score >= threshold) {
        matches.push({ apiA, apiB, score, details })
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score)
}

function computePairScore(apiA, apiB) {
  const nameScore = nameSimilarity(apiA.name, apiB.name)
  const urlScore = urlSimilarity(apiA.url, apiB.url)
  const inputScore = paramsOverlap(
    (apiA.inputParams || []).map((p) => p.name),
    (apiB.inputParams || []).map((p) => p.name)
  )
  const outputScore = paramsOverlap(
    (apiA.outputParams || []).map((p) => p.name),
    (apiB.outputParams || []).map((p) => p.name)
  )

  const weights = { name: 0.4, url: 0.25, input: 0.2, output: 0.15 }
  const score = (
    nameScore * weights.name +
    urlScore * weights.url +
    inputScore * weights.input +
    outputScore * weights.output
  )

  return {
    score: Math.round(score * 100) / 100,
    details: { nameScore, urlScore, inputScore, outputScore },
  }
}

function nameSimilarity(nameA, nameB) {
  if (!nameA || !nameB) return 0
  const a = nameA.toLowerCase()
  const b = nameB.toLowerCase()
  if (a === b) return 1

  const levScore = 1 - levenshtein(a, b) / Math.max(a.length, b.length)
  const wordsA = new Set(a.split(/[\s_\-/]+/))
  const wordsB = new Set(b.split(/[\s_\-/]+/))
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  const jaccardScore = union > 0 ? intersection / union : 0

  return Math.max(levScore, jaccardScore)
}

function urlSimilarity(urlA, urlB) {
  if (!urlA || !urlB) return 0
  const segsA = urlA.replace(/https?:\/\//, '').split('/').filter(Boolean)
  const segsB = urlB.replace(/https?:\/\//, '').split('/').filter(Boolean)
  const overlap = segsA.filter((s) => segsB.includes(s)).length
  const maxLen = Math.max(segsA.length, segsB.length)
  return maxLen > 0 ? overlap / maxLen : 0
}

function paramsOverlap(paramsA, paramsB) {
  if (!paramsA.length || !paramsB.length) return 0
  const setA = new Set(paramsA.map((p) => p.toLowerCase()))
  const setB = new Set(paramsB.map((p) => p.toLowerCase()))
  const intersection = [...setA].filter((p) => setB.has(p)).length
  return intersection / Math.max(setA.size, setB.size)
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}
