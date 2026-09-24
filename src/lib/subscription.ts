// 10X RPC — Subscription plans + status
import { db } from './db'
import Razorpay from 'razorpay'

// Razorpay client (initialized lazily — only when payment routes are called)
let razorpayInstance: Razorpay | null = null
export function getRazorpay(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return null
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret })
  }
  return razorpayInstance
}

export const RAZORPAY_ENABLED = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)

export interface PlanInfo {
  id: string
  name: string
  price: number
  period: string
  durationDays: number
  features: string[]
  badge?: string
  highlighted?: boolean
}

export const PLANS: PlanInfo[] = [
  {
    id: 'trial',
    name: 'Trial',
    price: 0,
    period: '30 Days',
    durationDays: 30,
    features: ['Full feature access', '30 Days validity', 'No payment required'],
  },
  {
    id: 'plus',
    name: 'Plus (1 Month)',
    price: 2,
    period: '/ 1 Mo',
    durationDays: 30,
    features: ['Full feature access', 'Standard support', 'Basic discord role'],
  },
  {
    id: 'pro',
    name: 'Pro (3 Months)',
    price: 4,
    period: '/ 3 Mo',
    durationDays: 90,
    badge: '20% OFF',
    highlighted: true,
    features: ['Full feature access', 'Priority support', 'Game RPC requests', 'Custom discord role'],
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: 15,
    period: 'one-time',
    durationDays: 36500, // ~100 years
    features: ['Lifetime access', 'VIP support', 'All future features', 'Custom discord role'],
  },
]

export function getPlan(id: string): PlanInfo | undefined {
  return PLANS.find(p => p.id === id)
}

export interface SubscriptionStatus {
  active: boolean
  plan: string
  planName: string
  endsAt: string | null
  daysLeft: number
  isTrial: boolean
  isLifetime: boolean
  autoRenew: boolean
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const sub = await db.subscription.findUnique({ where: { userId } })
  const now = new Date()

  if (!sub || sub.status !== 'active' || sub.endsAt < now) {
    // Fall back to trial
    const trial = await db.trial.findUnique({ where: { userId } })
    const trialActive = trial?.active && trial.endsAt > now
    const trialMsLeft = trial ? trial.endsAt.getTime() - now.getTime() : 0
    return {
      active: !!trialActive,
      plan: 'trial',
      planName: 'Trial',
      endsAt: trial?.endsAt?.toISOString() || null,
      daysLeft: Math.max(0, Math.ceil(trialMsLeft / (24 * 60 * 60 * 1000))),
      isTrial: true,
      isLifetime: false,
      autoRenew: false,
    }
  }

  const msLeft = sub.endsAt.getTime() - now.getTime()
  return {
    active: true,
    plan: sub.plan,
    planName: getPlan(sub.plan)?.name || sub.plan,
    endsAt: sub.endsAt.toISOString(),
    daysLeft: Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))),
    isTrial: sub.plan === 'trial',
    isLifetime: sub.plan === 'lifetime',
    autoRenew: sub.autoRenew,
  }
}

export async function checkFeatureAccess(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const status = await getSubscriptionStatus(userId)
  if (status.active) return { allowed: true }
  return { allowed: false, reason: 'Your subscription has expired. Please choose a plan to continue.' }
}

export async function activatePlan(
  userId: string,
  planId: string,
  paymentId?: string,
  amountPaid?: number
): Promise<SubscriptionStatus> {
  const plan = getPlan(planId)
  if (!plan) throw new Error('Invalid plan')

  const now = new Date()
  const endsAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)

  // Check if there's an existing active subscription — extend from its end date
  const existing = await db.subscription.findUnique({ where: { userId } })
  const baseDate = existing && existing.status === 'active' && existing.endsAt > now
    ? existing.endsAt
    : now

  const finalEndsAt = new Date(baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)

  const sub = await db.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: planId,
      status: 'active',
      paymentId,
      amountPaid: amountPaid || plan.price,
      currency: 'usd',
      startsAt: now,
      endsAt: finalEndsAt,
      autoRenew: false,
    },
    update: {
      plan: planId,
      status: 'active',
      paymentId,
      amountPaid: amountPaid || plan.price,
      endsAt: finalEndsAt,
    },
  })

  // Also update the trial to match (so /api/me stays consistent)
  const trial = await db.trial.findUnique({ where: { userId } })
  if (trial) {
    await db.trial.update({
      where: { userId },
      data: { endsAt: finalEndsAt, active: true },
    })
  }

  return getSubscriptionStatus(userId)
}

export async function cancelSubscription(userId: string): Promise<{ ok: boolean; message: string }> {
  const sub = await db.subscription.findUnique({ where: { userId } })
  if (!sub) {
    return { ok: false, message: 'No subscription found' }
  }
  await db.subscription.update({
    where: { userId },
    data: { status: 'cancelled', autoRenew: false },
  })
  return { ok: true, message: 'Subscription cancelled. Access continues until the current period ends.' }
}
