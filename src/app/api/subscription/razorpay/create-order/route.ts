// 10X RPC — /api/subscription/razorpay/create-order — create a Razorpay order
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getRazorpay, RAZORPAY_ENABLED, getPlan } from '@/lib/subscription'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  if (!RAZORPAY_ENABLED) {
    return NextResponse.json({ error: 'razorpay_not_configured' }, { status: 503 })
  }

  const body = await req.json() as { planId?: string }
  const planId = body.planId

  if (!planId || planId === 'trial') {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 })
  }

  const plan = getPlan(planId)
  if (!plan) {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 })
  }

  const rzp = getRazorpay()!

  try {
    // Price in paise (1 INR = 100 paise). Using USD * 83 as approximate INR conversion.
    const amountInr = Math.round(plan.price * 83 * 100) // price * 83 INR/USD * 100 paise

    const order = await rzp.orders.create({
      amount: amountInr,
      currency: 'INR',
      receipt: `10xrpc_${planId}_${session.userId.slice(0, 8)}_${Date.now()}`,
      notes: {
        userId: session.userId,
        planId,
        planName: plan.name,
      },
    })

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planId,
      planName: plan.name,
      userEmail: session.user.username,
    })
  } catch (e: any) {
    console.error('Razorpay order creation error:', e)
    return NextResponse.json({
      ok: false,
      error: e?.message || 'Failed to create order',
    }, { status: 500 })
  }
}
