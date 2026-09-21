// 10X RPC — /api/uptime — public system status aggregator
// Checks: Vercel frontend (self), Render 24/7 daemon, Neon Postgres, Discord API.
// No auth required — this is a public status endpoint.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

interface ServiceStatus {
  name: string
  status: 'operational' | 'degraded' | 'down' | 'pending'
  latencyMs: number | null
  message: string
  detail?: string
}

async function checkRender(): Promise<ServiceStatus> {
  const url = CONFIG.render.backendUrl
  if (!url) {
    return {
      name: 'Render Backend (24/7 Daemon)',
      status: 'pending',
      latencyMs: null,
      message: 'Not deployed',
      detail: 'RENDER_BACKEND_URL is not set. Daemon runs separately.',
    }
  }
  const start = Date.now()
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(`${url}${CONFIG.render.healthPath}`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
    clearTimeout(t)
    const latency = Date.now() - start
    if (!res.ok) {
      return {
        name: 'Render Backend (24/7 Daemon)',
        status: 'down',
        latencyMs: latency,
        message: `HTTP ${res.status}`,
      }
    }
    const body = await res.json().catch(() => ({}))
    const uptime = body?.uptime
    const upStr =
      typeof uptime === 'number'
        ? `uptime ${formatUptime(uptime)}`
        : 'health ok'
    return {
      name: 'Render Backend (24/7 Daemon)',
      status: 'operational',
      latencyMs: latency,
      message: upStr,
      detail: body?.service ? `service: ${body.service}` : undefined,
    }
  } catch (e) {
    return {
      name: 'Render Backend (24/7 Daemon)',
      status: 'down',
      latencyMs: null,
      message: e instanceof Error ? e.message.slice(0, 80) : 'fetch failed',
    }
  }
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    await db.user.count()
    const latency = Date.now() - start
    return {
      name: 'Neon Postgres Database',
      status: 'operational',
      latencyMs: latency,
      message: 'Connected',
    }
  } catch (e) {
    return {
      name: 'Neon Postgres Database',
      status: 'down',
      latencyMs: null,
      message: e instanceof Error ? e.message.slice(0, 80) : 'query failed',
    }
  }
}

async function checkDiscord(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(`${CONFIG.discord.apiBase}/gateway`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
    clearTimeout(t)
    const latency = Date.now() - start
    if (!res.ok) {
      return {
        name: 'Discord API',
        status: 'degraded',
        latencyMs: latency,
        message: `HTTP ${res.status}`,
      }
    }
    return {
      name: 'Discord API',
      status: 'operational',
      latencyMs: latency,
      message: 'Gateway reachable',
    }
  } catch (e) {
    return {
      name: 'Discord API',
      status: 'down',
      latencyMs: null,
      message: e instanceof Error ? e.message.slice(0, 80) : 'fetch failed',
    }
  }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export async function GET() {
  const t0 = Date.now()
  const [render, database, discord] = await Promise.all([
    checkRender(),
    checkDatabase(),
    checkDiscord(),
  ])

  const self: ServiceStatus = {
    name: 'Vercel Frontend',
    status: 'operational',
    latencyMs: 1,
    message: 'Serving requests',
  }

  const services = [self, render, database, discord]

  const anyDown = services.some((s) => s.status === 'down')
  const anyDegraded = services.some((s) => s.status === 'degraded')
  const anyPending = services.some((s) => s.status === 'pending')
  const overall: 'operational' | 'degraded' | 'partial_outage' | 'pending' =
    anyDown ? 'partial_outage' : anyDegraded ? 'degraded' : anyPending ? 'pending' : 'operational'

  return NextResponse.json(
    {
      overall,
      services,
      checkedAt: new Date().toISOString(),
      elapsedMs: Date.now() - t0,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}
