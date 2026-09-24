// 10X RPC — Subscription panel
'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { Crown, Check, Clock, Zap, X } from 'lucide-react'

interface PlanInfo {
  id: string
  name: string
  price: number
  period: string
  durationDays: number
  features: string[]
  badge?: string
  highlighted?: boolean
}

interface SubStatus {
  active: boolean
  plan: string
  planName: string
  endsAt: string | null
  daysLeft: number
  isTrial: boolean
  isLifetime: boolean
  autoRenew: boolean
}

export function SubscriptionPanel() {
  const [status, setStatus] = useState<SubStatus | null>(null)
  const [plans, setPlans] = useState<PlanInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [showPlans, setShowPlans] = useState(false)

  const refresh = async () => {
    try {
      const r = await api.subscriptionStatus()
      setStatus(r.status)
      setPlans(r.plans)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const handleActivate = async (planId: string) => {
    setBuying(true)
    try {
      const r = await api.subscriptionCreate(planId, 'manual_checkout')
      if (r.ok) {
        toast.success(r.message || 'Plan activated!', { duration: 4000 })
        await refresh()
        setShowPlans(false)
      } else {
        toast.error(r.error || 'Failed to activate plan')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBuying(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription? Access continues until the current period ends.')) return
    setBuying(true)
    try {
      const r = await api.subscriptionCancel()
      if (r.ok) {
        toast.success(r.message, { duration: 4000 })
        await refresh()
      } else {
        toast.error(r.message)
      }
    } finally { setBuying(false) }
  }

  if (loading) return null

  if (!status) return null

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#13111d]/95 via-[#0e0d14]/95 to-[#0a0a0f] border border-white/10 rounded-[28px] p-6 shadow-2xl backdrop-blur-xl">
      <div className="absolute -top-16 -right-12 w-48 h-48 bg-purple-900/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* Current plan */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            Subscription
          </h2>
          {status.active ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ACTIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
              EXPIRED
            </span>
          )}
        </div>

        {/* Status card */}
        <div className="glass-card-inner p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-purple-400 font-semibold mb-1">Current Plan</p>
              <p className="text-2xl font-black text-white">{status.planName}</p>
            </div>
            <div className="text-right">
              {status.isLifetime ? (
                <p className="text-3xl font-black text-amber-400">∞</p>
              ) : (
                <>
                  <p className="text-3xl font-black text-white">{status.daysLeft}</p>
                  <p className="text-xs text-white/40">days left</p>
                </>
              )}
            </div>
          </div>
          {status.endsAt && !status.isLifetime && (
            <p className="text-xs text-white/40 mt-2">Expires: {new Date(status.endsAt).toLocaleDateString()}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {!status.isLifetime && (
            <button
              onClick={() => setShowPlans(!showPlans)}
              className="flex-1 purple-gradient text-white font-semibold rounded-xl px-4 py-2.5 shadow-lg shadow-purple-900/30 hover:opacity-90 active:scale-[0.98] transition-all text-sm"
            >
              {status.isTrial ? 'Upgrade Plan' : 'Extend / Upgrade'}
            </button>
          )}
          {status.active && !status.isTrial && !status.isLifetime && status.autoRenew && (
            <button
              onClick={handleCancel}
              disabled={buying}
              className="bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Plan cards */}
        {showPlans && (
          <div className="mt-4 space-y-3">
            {plans.filter(p => p.id !== 'trial').map(plan => (
              <div
                key={plan.id}
                className={`glass-card-inner p-4 ${plan.highlighted ? 'border-purple-500/40 purple-glow' : ''} relative overflow-hidden`}
              >
                {plan.badge && (
                  <div className="absolute top-3 right-3 purple-gradient text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {plan.badge}
                  </div>
                )}
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-sm text-white/50">{plan.name.split('(')[0]}</span>
                  <span className="text-3xl font-black text-white">${plan.price}</span>
                  <span className="text-sm text-white/50">{plan.period}</span>
                </div>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/70">
                      <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleActivate(plan.id)}
                  disabled={buying}
                  className={`w-full font-bold rounded-xl py-2.5 text-sm transition-all active:scale-[0.98] disabled:opacity-50 ${
                    plan.highlighted
                      ? 'purple-gradient text-white shadow-lg shadow-purple-900/30 hover:opacity-90'
                      : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                  }`}
                >
                  {buying ? 'Processing...' : `Buy ${plan.name.split('(')[0].trim()}`}
                </button>
              </div>
            ))}
            <p className="text-xs text-white/30 text-center">
              Manual activation for now. Stripe integration coming soon.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
