import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { phoneWebMissingHint, resolvePhoneWebRoot } from './paths'

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

function resolveWebFile(root: string, urlPath: string): string | null {
  let pathname = urlPath
  try {
    pathname = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  if (pathname.includes('\0')) return null
  if (pathname === '/' || pathname === '') pathname = '/index.html'
  const rel = pathname.replace(/^\/+/, '')
  const full = resolve(root, rel)
  const rootFull = resolve(root)
  const relToRoot = relative(rootFull, full)
  if (relToRoot.startsWith('..') || relToRoot.includes(`..${sep}`)) return null
  if (!existsSync(full)) return null
  const st = statSync(full)
  if (!st.isFile()) return null
  return full
}

function fallbackHtml(): string {
  const hint = phoneWebMissingHint()
  return `<!doctype html>
<html lang="sl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Finance</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #f3eee6; color: #1c1814; margin: 2rem; max-width: 24rem; }
    </style>
  </head>
  <body>
    <h1>Finance</h1>
    <p>${hint}</p>
  </body>
</html>`
}

function sendFile(res: ServerResponse, file: string, headOnly: boolean): void {
  const ext = extname(file).toLowerCase()
  const type = MIME[ext] ?? 'application/octet-stream'
  const st = statSync(file)
  res.statusCode = 200
  res.setHeader('Content-Type', type)
  res.setHeader('Content-Length', String(st.size))
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (file.includes(`${sep}assets${sep}`)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  } else {
    res.setHeader('Cache-Control', 'no-cache')
  }
  if (headOnly) {
    res.end()
    return
  }
  const stream = createReadStream(file)
  stream.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 500
      res.end()
      return
    }
    res.destroy()
  })
  stream.pipe(res)
}

/** GET/HEAD of the Safari UI. Returns false when the request is not a web asset. */
export function tryServePhoneWeb(req: IncomingMessage, res: ServerResponse, url: string): boolean {
  const method = req.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD') return false
  if (url === '/health' || url === '/rpc') return false

  const headOnly = method === 'HEAD'
  const root = resolvePhoneWebRoot()
  if (!root) {
    if (url === '/' || url === '/index.html') {
      const body = fallbackHtml()
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      if (headOnly) {
        res.setHeader('Content-Length', String(Buffer.byteLength(body)))
        res.end()
        return true
      }
      res.end(body)
      return true
    }
    return false
  }

  const file = resolveWebFile(root, url)
  if (!file) return false
  sendFile(res, file, headOnly)
  return true
}
