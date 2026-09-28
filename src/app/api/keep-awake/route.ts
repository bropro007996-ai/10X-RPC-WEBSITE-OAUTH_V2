// 10X RPC — /api/keep-awake — keep-alive endpoint (pinged by Vercel Cron every 4 min)
// Keeps BOTH services warm to avoid free-tier cold starts:
//   1. Neon Postgres — runs a lightweight query (Neon suspends after ~5 min inactivity)
//   2. Render Backend — fetches /health (Render sleeps after ~15 min inactivity)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

export async function GET() {
  const results: Record<string, unknown> = {}

  // 1. Neon DB keep-alive — lightweight query
  const dbStart = Date.now()
  try {
    await db.session.count({ where: { expiresAt: { gt: new Date() } } })
    results.database = { ok: true, ms: Date.now() - dbStart }
  } catch (e) {
    results.database = { ok: false, ms: Date.now() - dbStart, error: e instanceof Error ? e.message.slice(0, 80) : 'failed' }
  }

  // 2. Render backend keep-alive — fetch /health
  const renderUrl = CONFIG.render.backendUrl
  if (renderUrl) {
    const renderStart = Date.now()
    try {
      const res = await fetch(`${renderUrl}${CONFIG.render.healthPath}`, {
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      })
      results.render = { ok: res.ok, ms: Date.now() - renderStart, status: res.status }
    } catch (e) {
      results.render = { ok: false, ms: Date.now() - renderStart, error: e instanceof Error ? e.message.slice(0, 80) : 'failed' }
    }
  } else {
    results.render = { ok: true, skipped: 'RENDER_BACKEND_URL not set' }
  }

  return NextResponse.json({
    ok: true,
    awake: true,
    timestamp: new Date().toISOString(),
    results,
  })
}
