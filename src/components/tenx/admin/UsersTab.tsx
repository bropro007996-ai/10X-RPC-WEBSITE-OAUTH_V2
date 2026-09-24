// 10X RPC — Admin Users tab (searchable + filterable user list with per-row actions)
'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api, type AdminUser } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState } from './shared'
import {
  Search, RefreshCw, Power, Activity, Clock, Trash2, Crown, Gift, Ban, CheckCircle2, UserCog
} from 'lucide-react'

type FilterType = 'all' | 'active-rpc' | 'verified' | 'trial' | 'expired' | 'admins'

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active-rpc', label: 'Active RPC' },
  { id: 'verified', label: 'Verified' },
  { id: 'trial', label: 'Trial' },
  { id: 'expired', label: 'Expired' },
  { id: 'admins', label: 'Admins' },
]

interface UsersTabProps {
  refreshKey: number
}

export function UsersTab({ refreshKey }: UsersTabProps) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [grantUserId, setGrantUserId] = useState<string | null>(null)
  const [grantPlan, setGrantPlan] = useState('plus')
  const [grantDays, setGrantDays] = useState(30)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.adminUsers()
      setUsers(res.users)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh, refreshKey])

  const handleUserAction = async (userId: string, action: string, data?: Record<string, unknown>) => {
    setBusy(true)
    try {
      const r = await api.adminUserAction(userId, action, data)
      if (r.ok) toast.success(r.message || `Action "${action}" completed`)
      else toast.error(r.error || 'Action failed')
      refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  const handleGrantAccess = async () => {
    if (!grantUserId) return
    setBusy(true)
    try {
      const r = await api.adminGrantAccess({
        userId: grantUserId,
        planId: grantPlan,
        durationDays: grantDays,
        reason: 'Admin grant',
      })
      if (r.ok) toast.success(r.message || 'Access granted')
      else toast.error('Grant failed')
      setGrantUserId(null)
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const filteredUsers = users.filter(u => {
    if (searchQuery && !u.username.toLowerCase().includes(searchQuery.toLowerCase())) return false
    switch (filter) {
      case 'active-rpc': return u.rpc?.rpcEnabled
      case 'verified': return u.rpc?.hasDiscordToken
      case 'trial': return u.trial?.active && (u.trial.daysLeft ?? 0) > 0
      case 'expired': return !u.trial?.active || (u.trial.daysLeft ?? 0) === 0
      case 'admins': return u.isAdmin
      default: return true
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="inline-block w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mb-2" />
        <p className="text-xs text-white/50 ml-3">Loading users...</p>
      </div>
    )
  }

  if (error) return <AdminErrorState message={error} onRetry={refresh} />

  return (
    <div className="space-y-4">
      <AdminCard>
        <AdminSectionTitle icon={<UserCog className="w-4 h-4" />}>
          Users ({filteredUsers.length} / {users.length})
        </AdminSectionTitle>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by username..."
            className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                filter === f.id ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/50 border border-white/8'
              }`}
            >
              {f.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* User list */}
        {filteredUsers.length === 0 ? (
          <AdminEmptyState icon="👤" title="No users match" hint="Try a different search or filter." />
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto styled-scroll pr-1">
            {filteredUsers.map(u => (
              <UserRow
                key={u.id}
                user={u}
                expanded={expandedUser === u.id}
                isGrantTarget={grantUserId === u.id}
                onToggle={() => {
                  setExpandedUser(expandedUser === u.id ? null : u.id)
                  setGrantUserId(u.id)
                }}
                onAction={handleUserAction}
                busy={busy}
              />
            ))}
          </div>
        )}
      </AdminCard>

      {/* Grant access panel */}
      {grantUserId && (
        <AdminCard>
          <AdminSectionTitle icon={<Gift className="w-4 h-4" />}>
            Grant Access — {users.find(u => u.id === grantUserId)?.username}
          </AdminSectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Plan</label>
              <select
                value={grantPlan}
                onChange={e => setGrantPlan(e.target.value)}
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 outline-none focus-visible:ring-purple-500/40"
              >
                <option value="trial">Trial</option>
                <option value="plus">Plus</option>
                <option value="pro">Pro</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Duration (days)</label>
              <input
                type="number"
                min={1}
                max={3650}
                value={grantDays}
                onChange={e => setGrantDays(Math.max(1, Number(e.target.value)))}
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 outline-none focus-visible:ring-purple-500/40"
              />
            </div>
            <button
              onClick={handleGrantAccess}
              disabled={busy}
              className="purple-gradient text-white font-semibold rounded-xl px-3 py-2 text-xs hover:opacity-90 disabled:opacity-50"
            >
              {busy ? '...' : 'Grant'}
            </button>
          </div>
        </AdminCard>
      )}
    </div>
  )
}

function UserRow({ user, expanded, isGrantTarget, onToggle, onAction, busy }: {
  user: AdminUser
  expanded: boolean
  isGrantTarget: boolean
  onToggle: () => void
  onAction: (action: string, data?: Record<string, unknown>) => void
  busy: boolean
}) {
  const rpc = user.rpc
  return (
    <div className={`glass-card-inner p-3 space-y-2 ${isGrantTarget ? 'border-purple-500/40' : ''}`}>
      <div className="flex items-center gap-3">
        <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full" />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">{user.username}</span>
            {user.isAdmin && (
              <span className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <Crown className="w-2.5 h-2.5" />ADMIN
              </span>
            )}
            {isGrantTarget && <span className="bg-amber-500/20 text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">🎯 TARGET</span>}
            <span className="text-[10px] text-white/30">{expanded ? '▲' : '▼'}</span>
          </div>
          <p className="text-xs text-white/40 font-mono">{user.discordId}</p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          {rpc?.rpcEnabled ? (
            <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />RPC LIVE
            </span>
          ) : <span className="bg-white/5 text-white/40 text-[10px] font-semibold px-2 py-0.5 rounded-full">RPC OFF</span>}
          {rpc?.hasDiscordToken
            ? <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-300 text-[10px] font-semibold px-2 py-0.5 rounded-full"><CheckCircle2 className="w-2.5 h-2.5" />VERIFIED</span>
            : <span className="bg-yellow-500/10 text-yellow-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">⚠ NO TOKEN</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{user.trial?.daysLeft ?? 0}d</span>
        {rpc?.customStatus && <span>💬 {rpc.customStatusEmoji} {rpc.customStatus}</span>}
        {user.rpcConfig && <span>🎮 {user.rpcConfig.name}</span>}
        {rpc?.lastPresenceUpdate && <span className="text-white/30">{new Date(rpc.lastPresenceUpdate).toLocaleTimeString()}</span>}
      </div>
      {expanded && (
        <div className="pt-2 mt-2 border-t border-white/5 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => onAction('sync')} disabled={busy} className="inline-flex items-center gap-1 bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-purple-500/25 disabled:opacity-50"><RefreshCw className="w-3 h-3" />Sync</button>
            <button onClick={() => onAction('stop-rpc')} disabled={busy} className="inline-flex items-center gap-1 bg-red-500/15 border border-red-500/30 text-red-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-500/25 disabled:opacity-50"><Power className="w-3 h-3" />Stop RPC</button>
            <button onClick={() => onAction('toggle-status', { enable: !rpc?.rpcEnabled })} disabled={busy} className="inline-flex items-center gap-1 bg-blue-500/15 border border-blue-500/30 text-blue-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-blue-500/25 disabled:opacity-50"><Activity className="w-3 h-3" />Toggle Status</button>
            <button onClick={() => onAction('extend-trial', { days: 30 })} disabled={busy} className="inline-flex items-center gap-1 bg-green-500/15 border border-green-500/30 text-green-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-green-500/25 disabled:opacity-50"><Clock className="w-3 h-3" />+30d Trial</button>
            <button onClick={() => onAction('ban')} disabled={busy} className="inline-flex items-center gap-1 bg-orange-500/15 border border-orange-500/30 text-orange-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-orange-500/25 disabled:opacity-50"><Ban className="w-3 h-3" />Ban</button>
            <button onClick={() => { if (confirm(`Delete ${user.username}? This cannot be undone.`)) onAction('delete-user') }} disabled={busy} className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-300/80 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 disabled:opacity-50"><Trash2 className="w-3 h-3" />Delete</button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-white/40 font-mono">
            <div>ID: {user.id.slice(0, 16)}</div>
            <div>Created: {new Date(user.createdAt).toLocaleDateString()}</div>
            {rpc && <><div>Gateway: {rpc.gatewayReady ? '✓' : '✗'}</div><div>VR: {rpc.vrStatusActive ? '✓' : '✗'}</div></>}
          </div>
        </div>
      )}
    </div>
  )
}
