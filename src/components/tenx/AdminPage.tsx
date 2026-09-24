// 10X RPC — Admin dashboard page (#/admin) — UPGRADED
'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api, type AdminUser } from '@/lib/api-client'
import { useRouter } from './useRouter'
import { Card, PrimaryButton, GhostButton, BackButton, Badge } from './ui'
import { Activity, Server, Users, Zap, Trash2, RefreshCw, Clock, Power, DollarSign, Search, Crown, BarChart3, LayoutGrid } from 'lucide-react'

interface DaemonInfo {
  running: boolean
  uptimeSeconds?: number
  activeConnections?: number
  totalTrackedUsers?: number
  users?: Array<{ userId: string; connected: boolean; platform: string; lastStatus: string; lastConnectedAt?: string }>
}

interface StatsInfo {
  totalUsers: number
  activeSubscriptions: number
  totalRevenue: number
  trialUsers: number
  expiredSubs: number
  planBreakdown: Record<string, number>
}

const RPC_TEMPLATES = [
  { icon: '🎮', name: 'Gaming', state: 'In a match', details: 'Ranked', type: 'PLAYING' },
  { icon: '💻', name: 'VS Code', state: 'Editing', details: 'Working on project', type: 'PLAYING' },
  { icon: '🎵', name: 'Spotify', state: 'Listening', details: 'Playlist', type: 'LISTENING' },
  { icon: '📺', name: 'Twitch', state: 'Live', details: 'Streaming', type: 'STREAMING' },
  { icon: '😴', name: 'Away', state: 'AFK', details: 'Be right back', type: 'PLAYING' },
  { icon: '🎯', name: '10X RPC', state: 'Custom', details: 'Custom', type: 'PLAYING' },
]

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-purple-500',
  plus: 'bg-blue-500',
  pro: 'bg-amber-500',
  lifetime: 'bg-orange-500',
}

type FilterType = 'all' | 'active-rpc' | 'verified' | 'trial' | 'expired'

export function AdminPage() {
  const { navigate } = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [daemon, setDaemon] = useState<DaemonInfo | null>(null)
  const [stats, setStats] = useState<StatsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeRpcCount, setActiveRpcCount] = useState(0)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateUserId, setTemplateUserId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [usersRes, daemonRes, statsRes] = await Promise.all([
        api.adminUsers(),
        api.adminDaemonStatus().catch(() => ({ ok: false })),
        api.adminStats().catch(() => ({ ok: false })),
      ])
      setUsers(usersRes.users)
      setActiveRpcCount(usersRes.activeRpcUsers)
      if (daemonRes.ok && daemonRes.daemon) setDaemon(daemonRes.daemon)
      if (statsRes.ok && statsRes.stats) setStats(statsRes.stats)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load'
      if (msg.includes('forbidden')) setError('You are not an admin.')
      else if (msg.includes('not_authenticated')) setError('Please sign in first.')
      else setError(msg)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    refresh()
    if (!autoRefresh) return
    const t = setInterval(refresh, 30000)
    return () => clearInterval(t)
  }, [refresh, autoRefresh])

  const handleForceEnable = async () => {
    setBusy(true)
    try {
      const r = await api.adminForceRpc(true)
      toast.success(`RPC force-enabled for ${r.successCount}/${r.totalUsers} users`)
      refresh()
    } catch { toast.error('Failed') } finally { setBusy(false) }
  }

  const handleForceDisable = async () => {
    setBusy(true)
    try {
      const r = await api.adminForceRpc(false)
      toast.success(`RPC force-disabled for ${r.successCount}/${r.totalUsers} users`)
      refresh()
    } finally { setBusy(false) }
  }

  const handleKeepAlive = async () => {
    setBusy(true)
    try {
      const r = await api.keepAlive()
      toast.success(`Keep-alive: ${r.successCount}/${r.totalActive} refreshed`)
      refresh()
    } catch { toast.error('Keep-alive failed') } finally { setBusy(false) }
  }

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

  const handleApplyTemplate = async (userId: string, tpl: typeof RPC_TEMPLATES[0]) => {
    setBusy(true)
    try {
      const r = await api.adminUserAction(userId, 'apply-template', { template: tpl })
      if (r.ok) toast.success(`Template "${tpl.name}" applied`)
      else toast.error(r.error || 'Failed')
      refresh()
    } catch { toast.error('Failed') } finally { setBusy(false) }
  }

  const filteredUsers = users.filter(u => {
    if (searchQuery && !u.username.toLowerCase().includes(searchQuery.toLowerCase())) return false
    switch (filter) {
      case 'active-rpc': return u.rpc?.rpcEnabled
      case 'verified': return u.rpc?.hasDiscordToken
      case 'trial': return u.trial?.active && (u.trial.daysLeft ?? 0) > 0
      case 'expired': return !u.trial?.active || (u.trial.daysLeft ?? 0) === 0
      default: return true
    }
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mb-3" />
          <p className="text-white/60 text-sm">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <BackButton onClick={() => navigate({ name: 'dashboard' })} />
          <h1 className="text-2xl font-bold text-white">Admin</h1>
          <div className="w-16" />
        </div>
        <Card><div className="text-center space-y-3 py-8"><div className="text-4xl">🔒</div><p className="text-white/70 font-medium">Access Denied</p><p className="text-sm text-white/50 max-w-xs mx-auto">{error}</p></div></Card>
      </div>
    )
  }

  const verifiedUsers = users.filter(u => u.rpc?.hasDiscordToken).length
  const daemonHealth = daemon?.running ? (daemon.activeConnections ?? 0 > 0 ? 'healthy' : 'degraded') : 'down'

  return (
    <div className="min-h-screen px-4 sm:px-6 py-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <BackButton onClick={() => navigate({ name: 'dashboard' })} />
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-white/50 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-purple-500" />
            Auto
          </label>
          <button onClick={refresh} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <StatCard icon={<Users className="w-4 h-4" />} label="Total Users" value={users.length} color="text-purple-300" />
        <StatCard icon={<Activity className="w-4 h-4" />} label="Active RPC" value={activeRpcCount} color="text-green-400" />
        <StatCard icon={<DollarSign className="w-4 h-4" />} label="Revenue" value={`$${stats?.totalRevenue ?? 0}`} color="text-amber-400" />
        <StatCard icon={<Crown className="w-4 h-4" />} label="Subs" value={stats?.activeSubscriptions ?? 0} color="text-blue-400" />
      </div>

      {/* Plan Distribution */}
      {stats?.planBreakdown && (
        <Card className="mb-6">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-400" />Plan Distribution</h3>
          <div className="space-y-2">
            {Object.entries(stats.planBreakdown).map(([plan, count]) => (
              <div key={plan} className="flex items-center gap-3">
                <span className="text-xs text-white/60 w-16 capitalize">{plan}</span>
                <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${PLAN_COLORS[plan] || 'bg-gray-500'} transition-all`}
                    style={{ width: `${users.length > 0 ? (count / users.length) * 100 : 0}%`, minWidth: count > 0 ? '2rem' : '0' }}
                  />
                </div>
                <span className="text-xs text-white/50 font-mono w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Daemon Status */}
      {daemon && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white flex items-center gap-2"><Server className="w-4 h-4 text-purple-400" />Daemon Status</h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${daemonHealth === 'healthy' ? 'bg-green-400 animate-pulse' : daemonHealth === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'}`} />
              <span className={`text-xs font-semibold ${daemonHealth === 'healthy' ? 'text-green-400' : daemonHealth === 'degraded' ? 'text-yellow-400' : 'text-red-400'}`}>
                {daemonHealth.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div><p className="text-white/40 uppercase tracking-wider">Uptime</p><p className="text-white font-mono">{daemon.uptimeSeconds ? formatUptime(daemon.uptimeSeconds) : '—'}</p></div>
            <div><p className="text-white/40 uppercase tracking-wider">Connections</p><p className="text-white font-mono">{daemon.activeConnections ?? 0}</p></div>
            <div><p className="text-white/40 uppercase tracking-wider">Tracked</p><p className="text-white font-mono">{daemon.totalTrackedUsers ?? 0}</p></div>
            <div><p className="text-white/40 uppercase tracking-wider">Verified</p><p className="text-white font-mono">{verifiedUsers}</p></div>
          </div>
          {daemon.users && daemon.users.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5">
              {daemon.users.map((u, i) => (
                <div key={i} className="flex items-center gap-2 text-xs mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${u.connected ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-white/70 font-mono">{u.userId.slice(0, 12)}...</span>
                  <span className="text-white/40">{u.platform}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Bulk Actions */}
      <Card className="mb-6">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Power className="w-4 h-4 text-purple-400" />Bulk Control</h3>
        <div className="grid grid-cols-3 gap-2">
          <PrimaryButton onClick={handleForceEnable} disabled={busy} className="text-xs">{busy ? '...' : 'Force Enable All'}</PrimaryButton>
          <GhostButton onClick={handleKeepAlive} disabled={busy} className="text-xs">{busy ? '...' : 'Keep-Alive'}</GhostButton>
          <GhostButton onClick={handleForceDisable} disabled={busy} className="text-xs text-red-400">{busy ? '...' : 'Disable All'}</GhostButton>
        </div>
      </Card>

      {/* RPC Templates */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-purple-400" />RPC Templates</h3>
          <button onClick={() => setShowTemplates(!showTemplates)} className="text-xs text-purple-300 hover:text-white">
            {showTemplates ? 'Hide' : 'Show'}
          </button>
        </div>
        {showTemplates && (
          <>
            <p className="text-xs text-white/40 mb-3">Select a user below, then click a template to apply it instantly.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {RPC_TEMPLATES.map(tpl => (
                <button
                  key={tpl.name}
                  onClick={() => templateUserId ? handleApplyTemplate(templateUserId, tpl) : toast.info('Select a user first')}
                  disabled={busy}
                  className="glass-card-inner p-3 text-left hover:border-purple-500/30 transition-colors disabled:opacity-50"
                >
                  <div className="text-xl mb-1">{tpl.icon}</div>
                  <p className="text-xs font-semibold text-white">{tpl.name}</p>
                  <p className="text-[10px] text-white/40">{tpl.state}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-white/30">Target: {templateUserId ? users.find(u => u.id === templateUserId)?.username : 'None selected'}</p>
          </>
        )}
      </Card>

      {/* User List */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-purple-400" />Users ({filteredUsers.length})</h3>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by username..."
              className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40"
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          {(['all', 'active-rpc', 'verified', 'trial', 'expired'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                filter === f ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/50 border border-white/8'
              }`}
            >
              {f.replace('-', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto styled-scroll">
          {filteredUsers.map(u => (
            <UserRow
              key={u.id}
              user={u}
              expanded={expandedUser === u.id}
              isTemplateTarget={templateUserId === u.id}
              onToggle={() => { setExpandedUser(expandedUser === u.id ? null : u.id); setTemplateUserId(u.id) }}
              onAction={(action, data) => handleUserAction(u.id, action, data)}
              busy={busy}
            />
          ))}
        </div>
      </Card>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className="glass-card-inner p-3 text-center">
      <div className={`flex items-center justify-center gap-1.5 mb-1 ${color}`}>
        {icon}
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  )
}

function UserRow({ user, expanded, isTemplateTarget, onToggle, onAction, busy }: {
  user: AdminUser
  expanded: boolean
  isTemplateTarget: boolean
  onToggle: () => void
  onAction: (action: string, data?: Record<string, unknown>) => void
  busy: boolean
}) {
  const rpc = user.rpc
  return (
    <div className={`glass-card-inner p-3 space-y-2 ${isTemplateTarget ? 'border-purple-500/40' : ''}`}>
      <div className="flex items-center gap-3">
        <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full" />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{user.username}</span>
            {user.isAdmin && <Badge className="bg-purple-500/20 text-purple-300 text-[10px]">ADMIN</Badge>}
            {isTemplateTarget && <Badge className="bg-amber-500/20 text-amber-300 text-[10px]">🎯 TARGET</Badge>}
            <span className="text-[10px] text-white/30">{expanded ? '▲' : '▼'}</span>
          </div>
          <p className="text-xs text-white/40 font-mono">{user.discordId}</p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          {rpc?.rpcEnabled ? (
            <Badge className="bg-green-500/20 text-green-300 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />RPC LIVE</Badge>
          ) : <Badge className="bg-white/5 text-white/40 text-[10px]">RPC OFF</Badge>}
          {rpc?.hasDiscordToken ? <Badge className="bg-blue-500/10 text-blue-300 text-[10px]">🔑 VERIFIED</Badge> : <Badge className="bg-yellow-500/10 text-yellow-300 text-[10px]">⚠ NO TOKEN</Badge>}
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
            <button onClick={() => { if (confirm(`Delete ${user.username}?`)) onAction('delete-user') }} disabled={busy} className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-300/80 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 disabled:opacity-50"><Trash2 className="w-3 h-3" />Delete</button>
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

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
