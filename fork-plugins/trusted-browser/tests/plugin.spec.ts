/** A trusted browser reaches the index and `/api` without the launch token; the fence and `/connect` stay unchanged. */
import { request as httpRequest } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as Connection from '@deepseek-ai/dsh-client-connection'
import type { PeerScope } from '@deepseek-ai/dsh-client-connection'
import HttpServer from '@deepseek-ai/dsh-host-webserver'
import * as Token from '@deepseek-ai/dsh-host-authentication-token'
import { BrowserAuth } from '@deepseek-ai/dsh-host-authentication-token/src/browser-auth.ts'
import { provideBrowserCredentials } from '../../../packages/client/connection/tests/browser-credentials.ts'
import * as TrustedBrowser from '../index.js'

const roots: Context[] = []
afterEach(async () => { for (const ctx of roots.splice(0)) await ctx.fiber.dispose() })

const INDEX = '<!doctype html><html><head></head><body></body></html>'

async function mounted(trusted: boolean, beforeToken = false) {
  const ctx = new Context(); roots.push(ctx)
  provideBrowserCredentials(ctx)
  await ctx.plugin(HttpServer, HttpServer.Config({ host: '127.0.0.1', port: 0 })).await()
  await ctx.plugin({ inject: [...Connection.inject], apply: Connection.apply }, { trustedHosts: ['agent.mini.home'] }).await()
  if (trusted && beforeToken) await ctx.plugin(TrustedBrowser).await()
  await ctx.plugin(Token, { cookieMaxAgeDays: 30 }).await()
  if (trusted && !beforeToken) await ctx.plugin(TrustedBrowser).await()
  ctx.webServer.registerFallback({
    auth: incoming => incoming.url.pathname === '/' ? 'required' : 'anonymous',
    resource: async (_request, peer) => new Response(ctx.webServer.renderIndex(INDEX, peer as PeerScope)),
  })
  ctx.webServer.register({
    kind: 'exact', path: '/whoami', auth: 'required',
    handler: (_request, response, peer) => { response.end(peer?.id) },
  })
  const auth = await BrowserAuth.create(ctx[Context.root], ctx.credentials, 30)
  const port = ctx.webServer.port!
  const token = new URL(auth.authenticatedUrl(`http://127.0.0.1:${String(port)}/`)).searchParams.get('token')!
  return { ctx, port, token }
}

function get(port: number, path: string, headers: Record<string, string>) {
  return new Promise<{ status: number; body: string; cookie: string | undefined }>((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, headers }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => { body += chunk })
      res.on('end', () => {
        resolve({ status: res.statusCode!, body, cookie: res.headers['set-cookie']?.[0]?.split(';', 1)[0] })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

describe('trusted-browser plugin', () => {
  it('keeps the launch-token session required when it is not mounted', async () => {
    const { port } = await mounted(false)
    expect((await get(port, '/', { host: 'agent.mini.home' })).status).toBe(401)
    expect((await get(port, '/api/session.list', { host: 'agent.mini.home' })).status).toBe(401)
    expect((await get(port, '/', { host: 'evil.example' })).status).toBe(403)
  })

  it('serves a trusted browser as one shared owner Peer with Host settings', async () => {
    const { port } = await mounted(true)
    const index = await get(port, '/', { host: 'agent.mini.home' })
    expect(index.status).toBe(200)
    expect(index.cookie).toBeUndefined()
    expect(index.body).toContain('globalThis["__DSH_TRANSPORT__"] = {"ownsHost":true}')
    const first = await get(port, '/whoami', { host: 'agent.mini.home', origin: 'https://agent.mini.home' })
    const second = await get(port, '/whoami', { host: `127.0.0.1:${String(port)}` })
    expect(first.status).toBe(200)
    expect(second.body).toBe(first.body)
    expect((await get(port, '/api/session.list', { host: 'agent.mini.home' })).status).not.toBe(401)
  })

  it('still refuses untrusted sources and keeps /connect behind the process token', async () => {
    const { ctx, port, token } = await mounted(true)
    expect(ctx.connection.authentication.authenticate({ headers: { host: 'evil.example' } })).toEqual({ rejection: 401 })
    expect((await get(port, '/', { host: 'evil.example' })).status).toBe(403)
    expect((await get(port, '/whoami', { host: 'agent.mini.home', origin: 'https://evil.example' })).status).toBe(403)
    expect((await get(port, '/whoami', { host: 'agent.mini.home', 'sec-fetch-site': 'cross-site' })).status).toBe(403)
    expect((await get(port, '/connect', { host: 'agent.mini.home' })).status).toBe(401)
    expect((await get(port, `/connect?token=${token}`, { host: 'agent.mini.home' })).status).toBe(302)
  })

  it.each([false, true])('lets a live token credential keep selecting its own Peer (mounted before token: %s)', async (beforeToken) => {
    const { port, token } = await mounted(true, beforeToken)
    const shared = (await get(port, '/whoami', { host: 'agent.mini.home' })).body
    const connect = await get(port, `/connect?token=${token}`, { host: 'agent.mini.home' })
    const api = await get(port, '/whoami', { host: 'agent.mini.home', cookie: connect.cookie! })
    expect(api.status).toBe(200)
    expect(api.body).not.toBe(shared)
    const exchange = await get(port, `/?token=${token}`, { host: 'agent.mini.home' })
    expect(exchange.status).toBe(303)
    const browser = await get(port, '/whoami', { host: 'agent.mini.home', cookie: exchange.cookie! })
    expect(browser.body).not.toBe(shared)
    expect(browser.body).not.toBe(api.body)
  })
})
