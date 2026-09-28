// Next.js Server Lifecycle Hook — Instrumentation
//
// Daemon start strategy (split deployment):
//  - DEMO mode (no DISCORD_CLIENT_ID/SECRET): skip daemon entirely. UI works in preview.
//  - SERVERLESS / VERCEL frontend: skip the 24/7 tick loop. The Render backend owns
//    persistent gateway connections. API routes still do best-effort immediate pushes
//    via ensureDaemonRunning().syncUser(), but those one-off sockets are expected to
//    be short-lived on serverless.
//  - LONG-LIVED process (Render backend / local dev with creds): start the full
//    24/7 tick loop that maintains gateway sockets, rotates status, refreshes tokens,
//    and enforces sleep timers.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const hasDiscordCreds = !!(
      process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
    )

    if (!hasDiscordCreds) {
      console.log('[Instrumentation] DEMO mode (no Discord credentials). 24/7 daemon skipped.')
      return
    }

    // Vercel sets VERCEL=1 automatically. Also allow explicit opt-out.
    const isServerless =
      process.env.VERCEL === '1' ||
      process.env.DEPLOYMENT_MODE === 'serverless' ||
      process.env.SPLIT_DEPLOYMENT === 'true'

    if (isServerless) {
      console.log('[Instrumentation] Serverless (Vercel) detected. 24/7 daemon runs on Render — skipping tick loop here. API routes still do best-effort immediate pushes.')
      return
    }

    try {
      const { getRpcDaemon } = await import('@/lib/rpc-daemon')
      getRpcDaemon().start().catch((err: unknown) => {
        console.error('[Instrumentation] Failed to start 10X RPC Daemon:', err)
      })
      console.log('[Instrumentation] 24/7 daemon started (long-lived process).')
    } catch (err) {
      console.error('[Instrumentation] Error importing rpc-daemon:', err)
    }
  }
}
