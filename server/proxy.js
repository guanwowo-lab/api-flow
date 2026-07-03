import { Router } from 'express'
import { sign } from './sign-engine.js'

// Environment base URLs
const ENV_URLS = {
  test: 'https://openapi2-show.haoxiny.com',
  prod: 'https://openapi2.haoxiny.com',
}

function formatTimestamp(d = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function createProxyRouter() {
  const router = Router()

  router.post('/proxy', async (req, res) => {
    const { targetPath, params, env, appKey, appSecret, grantType, signRequired } = req.body

    if (!targetPath || !params) {
      return res.status(400).json({ success: false, desc: 'Missing targetPath or params' })
    }

    const baseUrl = ENV_URLS[env] || ENV_URLS.test
    const url = baseUrl + targetPath

    const body = { ...params }

    if (signRequired && appKey && appSecret) {
      const timestamp = formatTimestamp()
      const { encryptedSecret, sign: signValue } = sign(appKey, appSecret, timestamp, grantType || 'MD5')
      body.appKey = appKey
      body.appSecret = encryptedSecret
      body.sign = signValue
      body.timestamp = timestamp
      if (grantType) body.grantType = grantType
    }

    try {
      const start = Date.now()
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      const duration = Date.now() - start

      res.json({
        httpStatus: response.status,
        duration,
        data,
      })
    } catch (err) {
      res.status(502).json({
        success: false,
        desc: `Proxy error: ${err.message}`,
        httpStatus: 502,
        duration: 0,
        data: null,
      })
    }
  })

  return router
}
