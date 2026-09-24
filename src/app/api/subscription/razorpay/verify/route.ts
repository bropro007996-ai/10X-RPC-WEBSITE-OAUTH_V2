// 10X RPC — /api/subscription/razorpay/verify — verify Razorpay payment + activate plan
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSession } from '@/lib/session'
import { RAZORPAY_ENABLED, activatePlan, getPlan } from '@/lib/subscription'

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

  const body = await req.json() as {
    razorpay_payment_id?: string
    razorpay_order_id?: string
    razorpay_signature?: string
    planId?: string
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, planId } = body

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !planId) {
    return NextResponse.json({ error: 'missing payment fields' }, { status: 400 })
  }

  const plan = getPlan(planId)
  if (!plan) {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 })
  }

  // Verify the payment signature
  const keySecret = process.env.RAZORPAY_KEY_SECRET!
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: 'invalid_signature', message: 'Payment verification failed' }, { status: 400 })
  }

  // Payment verified — activate the plan
  try {
    const status = await activatePlan(
      session.userId,
      planId,
      razorpay_payment_id,
      plan.price
    )

    return NextResponse.json({
      ok: true,
      message: `${plan.name} activated successfully!`,
      status,
    })
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e?.message || 'Failed to activate plan',
    }, { status: 500 })
  }
}
