// 10X RPC — Admin Plans tab (CRUD for subscription plans)
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, type AdminPlan } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, timeAgo, useAdminFetch } from './shared'
import { Tag, Plus, Trash2, Edit3, X, Check, Star, Eye, EyeOff, GripVertical } from 'lucide-react'

interface PlansTabProps {
  refreshKey: number
}

interface PlanForm {
  name: string
  slug: string
  priceInr: number
  durationDays: number
  description: string
  featuresText: string
  isActive: boolean
  isPopular: boolean
  badge: string
  displayOrder: number
}

const EMPTY_FORM: PlanForm = {
  name: '',
  slug: '',
  priceInr: 0,
  durationDays: 30,
  description: '',
  featuresText: '',
  isActive: true,
  isPopular: false,
  badge: '',
  displayOrder: 0,
}

export function PlansTab({ refreshKey }: PlansTabProps) {
  const fetcher = useCallback(() => api.adminPlans(), [])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey])

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminPlan | null>(null)
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)

  const plans = data?.plans ?? []

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (p: AdminPlan) => {
    setEditing(p)
    setForm({
      name: p.name,
      slug: p.slug,
      priceInr: p.priceInr,
      durationDays: p.durationDays,
      description: p.description || '',
      featuresText: p.features.join('\n'),
      isActive: p.isActive,
      isPopular: p.isPopular,
      badge: p.badge || '',
      displayOrder: p.displayOrder,
    })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Name and slug are required')
      return
    }
    if (form.priceInr <= 0 || form.durationDays <= 0) {
      toast.error('Price and duration must be greater than 0')
      return
    }
    setBusy(true)
    try {
      const features = form.featuresText
        .split('\n')
        .map(f => f.trim())
        .filter(Boolean)

      if (editing) {
        await api.adminUpdatePlan({
          id: editing.id,
          name: form.name,
          priceInr: form.priceInr,
          durationDays: form.durationDays,
          description: form.description || undefined,
          features,
          isActive: form.isActive,
          displayOrder: form.displayOrder,
          isPopular: form.isPopular,
          badge: form.badge || undefined,
        })
        toast.success('Plan updated')
      } else {
        await api.adminCreatePlan({
          name: form.name,
          slug: form.slug,
          priceInr: form.priceInr,
          durationDays: form.durationDays,
          description: form.description || undefined,
          features,
          isActive: form.isActive,
          displayOrder: form.displayOrder,
          isPopular: form.isPopular,
          badge: form.badge || undefined,
        })
        toast.success('Plan created')
      }
      setShowForm(false)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleDelete = async (p: AdminPlan) => {
    if (!confirm(`Delete plan "${p.name}"? This cannot be undone.`)) return
    setBusy(true)
    try {
      await api.adminDeletePlan(p.id)
      toast.success('Plan deleted')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleToggleActive = async (p: AdminPlan) => {
    setBusy(true)
    try {
      await api.adminUpdatePlan({ id: p.id, isActive: !p.isActive })
      toast.success(`Plan ${!p.isActive ? 'activated' : 'deactivated'}`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleTogglePopular = async (p: AdminPlan) => {
    setBusy(true)
    try {
      await api.adminUpdatePlan({ id: p.id, isPopular: !p.isPopular })
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-300">{plans.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-green-400">{plans.filter(p => p.isActive).length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Active</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-amber-400">{plans.filter(p => p.isPopular).length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Popular</div>
        </div>
      </div>

      <AdminCard>
        <AdminSectionTitle
          icon={<Tag className="w-4 h-4" />}
          right={
            <button
              onClick={openCreate}
              className="text-xs purple-gradient text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 hover:opacity-90"
            >
              <Plus className="w-3 h-3" />New Plan
            </button>
          }
        >
          Subscription Plans
        </AdminSectionTitle>

        {showForm && (
          <div className="mb-4 p-3 glass-card-inner space-y-3 border-purple-500/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-white">{editing ? 'Edit Plan' : 'New Plan'}</p>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Plus (1 Month)"
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
                  disabled={!!editing}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Slug * {!editing && '(immutable)'}</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="plus-1-month"
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
                  disabled={!!editing}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Price (paise)</label>
                <input
                  type="number"
                  min={0}
                  value={form.priceInr}
                  onChange={e => setForm({ ...form, priceInr: Number(e.target.value) })}
                  placeholder="9900"
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
                />
                <p className="text-[9px] text-white/30 mt-0.5">₹{(form.priceInr / 100).toFixed(0)}</p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Duration (days)</label>
                <input
                  type="number"
                  min={1}
                  value={form.durationDays}
                  onChange={e => setForm({ ...form, durationDays: Number(e.target.value) })}
                  placeholder="30"
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Display Order</label>
                <input
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={e => setForm({ ...form, displayOrder: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Full access for 1 month"
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Features (one per line)</label>
              <textarea
                value={form.featuresText}
                onChange={e => setForm({ ...form, featuresText: e.target.value })}
                placeholder={'Full feature access\nPriority support\nCustom Discord role'}
                rows={4}
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none resize-y"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Badge (optional)</label>
              <input
                type="text"
                value={form.badge}
                onChange={e => setForm({ ...form, badge: e.target.value })}
                placeholder="e.g. BEST VALUE"
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
                maxLength={30}
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="accent-purple-500"
                />
                Active
              </label>
              <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isPopular}
                  onChange={e => setForm({ ...form, isPopular: e.target.checked })}
                  className="accent-purple-500"
                />
                <Star className="w-3 h-3 text-amber-400" />
                Popular
              </label>
            </div>

            <button
              onClick={handleSubmit}
              disabled={busy}
              className="purple-gradient text-white font-semibold rounded-xl px-3 py-2 text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy ? '...' : (<><Check className="w-3 h-3" />{editing ? 'Update Plan' : 'Create Plan'}</>)}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : plans.length === 0 ? (
          <AdminEmptyState icon="🏷️" title="No plans yet" hint="Create your first subscription plan." />
        ) : (
          <div className="space-y-2">
            {plans.map(p => (
              <div key={p.id} className={`glass-card-inner p-3 space-y-2 ${!p.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="w-3 h-3 text-white/20 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">{p.name}</span>
                    {p.isPopular && (
                      <span className="inline-flex items-center gap-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                        <Star className="w-2.5 h-2.5" />POPULAR
                      </span>
                    )}
                    {p.badge && (
                      <span className="bg-purple-500/20 text-purple-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">{p.badge}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(p)}
                      disabled={busy}
                      title={p.isActive ? 'Deactivate' : 'Activate'}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50"
                    >
                      {p.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleTogglePopular(p)}
                      disabled={busy}
                      title="Toggle popular"
                      className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 ${p.isPopular ? 'text-amber-400' : 'text-white/70 hover:text-white'}`}
                    >
                      <Star className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      disabled={busy}
                      title="Edit"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={busy}
                      title="Delete"
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap">
                  <span className="font-mono text-amber-400">₹{(p.priceInr / 100).toFixed(0)}</span>
                  <span>·</span>
                  <span>{p.durationDays} days</span>
                  <span>·</span>
                  <span className="font-mono">/{p.slug}</span>
                  <span>·</span>
                  <span>order #{p.displayOrder}</span>
                  <span>·</span>
                  <span className="text-white/30">{timeAgo(p.updatedAt)}</span>
                </div>
                {p.description && (
                  <p className="text-xs text-white/60">{p.description}</p>
                )}
                {p.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
                    {p.features.map((f, i) => (
                      <span key={i} className="text-[10px] bg-white/5 text-white/50 px-1.5 py-0.5 rounded">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
