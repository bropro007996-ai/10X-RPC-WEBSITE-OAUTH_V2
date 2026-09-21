// Next.js Server Lifecycle Hook — Instrumentation
// Starts the 24/7 Discord RPC & Status Daemon on server boot ONLY when real
// Discord credentials are configured. In demo/sandbox mode (no Discord creds),
// the daemon is skipped — demo users have no discordAccessToken, so the gateway
// sync paths are never reached and the app runs fully in preview mode.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const hasDiscordCreds = !!(
      process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
    )
    if (!hasDiscordCreds) {
      console.log('[Instrumentation] Running in DEMO mode (no Discord credentials). RPC daemon skipped.')
      return
    }
    try {
      const { getRpcDaemon } = await import('@/lib/rpc-daemon')
      getRpcDaemon().start().catch((err: unknown) => {
        console.error('[Instrumentation] Failed to start 10X RPC Daemon:', err)
      })
    } catch (err) {
      console.error('[Instrumentation] Error importing rpc-daemon:', err)
    }
  }
}
