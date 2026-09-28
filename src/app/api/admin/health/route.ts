// 10X RPC — /api/admin/health — system health check (admin only)
// Returns { database, razorpay, daemon, overall }
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

interface ServiceHealth {
  ok: boolean
  message: string
  latencyMs?: number
}

async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now()
  try {
    const count = await db.user.count()
    return {
      ok: true,
      message: `reachable (${count} users)`,
      latencyMs: Date.now() - start,
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'db unreachable',
      latencyMs: Date.now() - start,
    }
  }
}

function checkRazorpay(): ServiceHealth {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (keyId && keySecret) {
    return { ok: true, message: `configured (key_id: ${keyId.slice(0, 8)}...)` }
  }
  return { ok: false, message: 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set' }
}

async function checkDaemon(): Promise<ServiceHealth> {
  const backendUrl = CONFIG.render.backendUrl
  if (!backendUrl) {
    return { ok: false, message: 'RENDER_BACKEND_URL not set' }
  }
  const start = Date.now()
  try {
    const url = `${backendUrl.replace(/\/$/, '')}${CONFIG.render.healthPath}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timer)
    if (!res.ok) {
      return {
        ok: false,
        message: `daemon health endpoint returned ${res.status}`,
        latencyMs: Date.now() - start,
      }
    }
    return {
      ok: true,
      message: 'reachable',
      latencyMs: Date.now() - start,
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'fetch failed',
      latencyMs: Date.now() - start,
    }
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden', message: 'Admin access required' }, { status: 403 })
  }

  try {
    const [database, daemon] = await Promise.all([checkDatabase(), checkDaemon()])
    const razorpay = checkRazorpay()

    const overall = database.ok && razorpay.ok && daemon.ok

    return NextResponse.json({
      ok: overall,
      health: {
        database,
        razorpay,
        daemon,
        overall: { ok: overall, message: overall ? 'all systems operational' : 'one or more systems degraded' },
      },
      checkedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('admin/health error:', e)
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'unknown error',
        health: {
          database: { ok: false, message: 'check failed' },
          razorpay: { ok: false, message: 'check failed' },
          daemon: { ok: false, message: 'check failed' },
          overall: { ok: false, message: 'health check error' },
        },
      },
      { status: 500 }
    )
  }
}
