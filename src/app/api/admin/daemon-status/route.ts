// 10X RPC — /api/admin/daemon-status — get the 24/7 daemon's internal state (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const renderUrl = CONFIG.render.backendUrl
  if (!renderUrl) {
    return NextResponse.json({
      ok: true,
      daemon: { running: false, message: 'RENDER_BACKEND_URL not set' },
    })
  }

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch(`${renderUrl}/debug-daemon`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
    clearTimeout(t)
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Render returned ${res.status}` })
    }
    const data = await res.json()
    return NextResponse.json({
      ok: true,
      daemon: {
        running: data.running,
        uptimeSeconds: data.uptimeSeconds,
        lastTickAt: data.lastTickAt,
        activeConnections: data.activeConnections,
        totalTrackedUsers: data.totalTrackedUsers,
        users: (data.users || []).map((u: any) => ({
          userId: u.userId,
          connected: u.connected,
          platform: u.platform,
          lastStatus: u.lastStatus,
          lastConnectedAt: u.lastConnectedAt,
        })),
      },
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'fetch failed',
    })
  }
}
