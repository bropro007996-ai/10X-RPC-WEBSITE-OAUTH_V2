// 10X RPC — /api/logout
import { NextResponse } from 'next/server'
import { clearSessionCookie, getSession } from '@/lib/session'
import { CONFIG } from '@/lib/config'
import { logActivity } from '@/lib/activity/logger'

export const dynamic = 'force-dynamic'

export async function POST() {
  // Capture logout event before clearing the session
  const session = await getSession().catch(() => null)
  if (session) {
    await logActivity({
      userId: session.userId,
      username: session.user.username,
      type: 'logout',
      category: 'user',
    })
  }
  await clearSessionCookie()
  return NextResponse.json({ ok: true, redirect: `${CONFIG.app.url}/` })
}
