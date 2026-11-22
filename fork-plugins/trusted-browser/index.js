/**
 * Serve a trusted browser without the launch-token session.
 *
 * Mounting this plugin makes every request that passes Connection's Host/Origin
 * fence (loopback, the listener's bind IP, or a `trustedHosts` entry) speak for
 * one shared owner Peer when no other authentication provider accepts it. The
 * index and `/api` then load without the launch-token Cookie, and pages served
 * to an owner Peer may use Host settings. Requests the fence refuses still get
 * 403. `GET /connect` keeps requiring the process launch token, and a live
 * token Cookie keeps selecting its own Peer.
 *
 * The network path becomes the only access check, so mount this plugin only
 * when the listener is reachable through trusted hosts alone.
 *
 * Enable it in a profile: add `"@local/trusted-browser": "link:<this directory>"`
 * to the profile's package.json dependencies, run `pnpm install` there, and
 * append to its cordis.patch.yml:
 *
 *     - insert:
 *         - id: trusted-browser
 *           name: '@local/trusted-browser'
 *
 * Tests: `pnpm exec vitest run --config fork-plugins/trusted-browser/vitest.config.ts`
 * from the repository root; types: `tsc -p fork-plugins/trusted-browser`.
 * @module @local/trusted-browser
 */

/** Stable plugin name. */
export const name = 'trusted-browser'
/** Connection applies the fence and creates Peers; ConnectionAuthentication owns providers. */
export const inject = ['connection', 'connection.authentication']

/**
 * Register the fallback provider and the privileged-page injection.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin scope owning the shared Peer and registrations.
 */
export function apply(ctx) {
  const peer = ctx.connection.createPeer({ principal: { kind: 'owner' } })
  // `admit` re-enters the provider list; the nested pass skips this provider so
  // other providers decide first regardless of registration order.
  let nested = false
  ctx.connection.authentication.register({
    authenticate(request) {
      if (nested) return undefined
      nested = true
      let admission
      try {
        admission = ctx.connection.admit(request)
      } finally {
        nested = false
      }
      if ('peer' in admission) return admission.peer
      // 403 is a refused source; 401 and 503 mean the source passed the fence.
      return admission.rejection === 403 ? undefined : peer
    },
  })
  ctx.on('webserver/index-inject', (table, pagePeer) => {
    if (pagePeer.principal.kind !== 'owner') return
    // Connection's client reports the privileged surface reachable when the
    // transport declares that the page owns the Host; every other transport
    // field stays at its served-page default.
    table.push({ kind: 'global', name: '__DSH_TRANSPORT__', value: { ownsHost: true } })
  })
}
