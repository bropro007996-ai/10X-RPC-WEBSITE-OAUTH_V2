// 10X RPC — /api/subscription/status — get user's subscription status
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getSubscriptionStatus, PLANS } from '@/lib/subscription'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const status = await getSubscriptionStatus(session.userId)
  return NextResponse.json({
    ok: true,
    status,
    plans: PLANS,
  })
}
