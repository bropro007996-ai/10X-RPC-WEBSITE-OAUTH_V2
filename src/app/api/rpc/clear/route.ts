// 10X RPC — /api/rpc/clear — clear custom status via 24/7 Gateway
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { daemonSyncUser } from '@/lib/daemon-bridge'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  await db.session.update({
    where: { id: session.id },
    data: { customStatus: null, customStatusEmoji: null },
  })

  if (session.discordAccessToken) {
    await daemonSyncUser(session.userId)
  }

  return NextResponse.json({ ok: true, message: 'Custom status cleared' })
}
