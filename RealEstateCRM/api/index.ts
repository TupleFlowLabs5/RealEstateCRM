import type { Request, Response } from 'express'
import app from '../server/app.js'

type VercelRequest = Request & { url?: string }

export default function handler(req: VercelRequest, res: Response) {
  const requestUrl = new URL(req.url || '/', 'http://localhost')
  const path = requestUrl.searchParams.get('__api_path')

  if (path !== null) {
    requestUrl.searchParams.delete('__api_path')
    req.url = `/api/${path}${requestUrl.search}`
  }

  return app(req, res)
}
