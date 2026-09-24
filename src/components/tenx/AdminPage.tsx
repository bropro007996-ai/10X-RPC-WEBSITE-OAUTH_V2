// 10X RPC — Admin dashboard page (#/admin)
'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api, type AdminUser } from '@/lib/api-client'
import { useRouter } from './useRouter'
import { Card, PrimaryButton, GhostButton, BackButton, Badge } from './ui'
import { Activity, Server, Users, Zap, Trash2, RefreshCw, Clock, Power } from 'lucide-react'

interface DaemonInfo {
  running: boolean
  uptimeSeconds?: number
  activeConnections?: number
  totalTrackedUsers?: number
  users?: Array<{
    userId: string
    connected: boolean
    platform: string
    lastStatus: string
    lastConnectedAt?: string
  }>
}

export function AdminPage() {
  const { navigate } = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [daemon, setDaemon] = useState<DaemonInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeRpcCount, setActiveRpcCount] = useState(0)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [usersRes, daemonRes] = await Promise.all([
        api.adminUsers(),
        api.adminDaemonStatus().catch(() => ({ ok: false })),
      ])
      setUsers(usersRes.users)
      setActiveRpcCount(usersRes.activeRpcUsers)
      if (daemonRes.ok && daemonRes.daemon) {
        setDaemon(daemonRes.daemon)
      }
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load'
      if (msg.includes('forbidden')) {
        setError('You are not an admin. Your Discord ID is not in the admin list.')
      } else if (msg.includes('not_authenticated')) {
        setError('Please sign in first.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30000)
    return () => clearInterval(t)
  }, [refresh])

  const handleForceEnable = async () => {
    setBusy(true)
    try {
      const r = await api.adminForceRpc(true)
      toast.success(`RPC force-enabled for ${r.successCount}/${r.totalUsers} users`, { duration: 4000 })
      refresh()
    } catch { toast.error('Failed to force-enable RPC') }
    finally { setBusy(false) }
  }

  const handleForceDisable = async () => {
    setBusy(true)
    try {
      const r = await api.adminForceRpc(false)
      toast.success(`RPC force-disabled for ${r.successCount}/${r.totalUsers} users`, { duration: 4000 })
      refresh()
    } finally { setBusy(false) }
  }

  const handleKeepAlive = async () => {
    setBusy(true)
    try {
      const r = await api.keepAlive()
      toast.success(`Keep-alive: ${r.successCount}/${r.totalActive} refreshed`, { duration: 4000 })
      refresh()
    } catch { toast.error('Keep-alive failed') }
    finally { setBusy(false) }
  }

  const handleUserAction = async (userId: string, action: string, data?: Record<string, unknown>) => {
    setBusy(true)
    try {
      const r = await api.adminUserAction(userId, action, data)
      if (r.ok) toast.success(r.message || `Action "${action}" completed`, { duration: 3000 })
      else toast.error(r.error || 'Action failed')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally { setBusy(false) }
  }

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
        <Card>
          <div className="text-center space-y-3 py-8">
            <div className="text-4xl">🔒</div>
            <p className="text-white/70 font-medium">Access Denied</p>
            <p className="text-sm text-white/50 max-w-xs mx-auto">{error}</p>
          </div>
        </Card>
      </div>
    )
  }

  const verifiedUsers = users.filter(u => u.rpc?.hasDiscordToken).length
  const statusUsers = users.filter(u => u.rpc?.rpcEnabled || u.rpc?.userStatus === 'online').length

  return (
    <div className="min-h-screen px-4 sm:px-6 py-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <BackButton onClick={() => navigate({ name: 'dashboard' })} />
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <button
          onClick={refresh}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <StatCard icon={<Users className="w-4 h-4" />} label="Total Users" value={users.length} color="text-purple-300" />
        <StatCard icon={<Activity className="w-4 h-4" />} label="Active RPC" value={activeRpcCount} color="text-green-400" />
        <StatCard icon={<Zap className="w-4 h-4" />} label="Verified" value={verifiedUsers} color="text-blue-400" />
        <StatCard icon={<Server className="w-4 h-4" />} label="Daemon Conn." value={daemon?.activeConnections ?? 0} color="text-amber-400" />
      </div>

      {/* Daemon Status Card */}
      {daemon && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />
              24/7 Daemon Status
            </h3>
            <Badge className={daemon.running ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}>
              <span className={`w-1.5 h-1.5 rounded-full ${daemon.running ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              {daemon.running ? 'RUNNING' : 'STOPPED'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="text-white/40 uppercase tracking-wider">Uptime</p>
              <p className="text-white font-mono">{daemon.uptimeSeconds ? formatUptime(daemon.uptimeSeconds) : '—'}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-white/40 uppercase tracking-wider">Connections</p>
              <p className="text-white font-mono">{daemon.activeConnections ?? 0}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-white/40 uppercase tracking-wider">Tracked Users</p>
              <p className="text-white font-mono">{daemon.totalTrackedUsers ?? 0}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-white/40 uppercase tracking-wider">Last Tick</p>
              <p className="text-white font-mono">{daemon.users?.length ? 'recent' : '—'}</p>
            </div>
          </div>
          {daemon.users && daemon.users.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-xs text-white/40 mb-2">Connected Users:</p>
              {daemon.users.map((u, i) => (
                <div key={i} className="flex items-center gap-2 text-xs mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${u.connected ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-white/70 font-mono">{u.userId.slice(0, 12)}...</span>
                  <span className="text-white/40">{u.platform}</span>
                  <span className="text-white/40">{u.lastStatus}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Bulk Actions */}
      <Card className="mb-6">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <Power className="w-4 h-4 text-purple-400" />
          Bulk RPC Control
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <PrimaryButton onClick={handleForceEnable} disabled={busy} className="text-xs">
            {busy ? '...' : 'Force Enable All'}
          </PrimaryButton>
          <GhostButton onClick={handleKeepAlive} disabled={busy} className="text-xs">
            {busy ? '...' : 'Keep-Alive'}
          </GhostButton>
          <GhostButton onClick={handleForceDisable} disabled={busy} className="text-xs text-red-400">
            {busy ? '...' : 'Disable All'}
          </GhostButton>
        </div>
        <p className="text-xs text-white/40 mt-3">
          Force Enable: pushes RPC + status for all verified users. Keep-Alive: refreshes presence. Disable: stops all RPC.
        </p>
      </Card>

      {/* User List */}
      <Card>
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          All Users ({users.length})
        </h3>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto styled-scroll">
          {users.map(u => (
            <UserRow
              key={u.id}
              user={u}
              expanded={expandedUser === u.id}
              onToggle={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
              onAction={(action, data) => handleUserAction(u.id, action, data)}
              busy={busy}
            />
          ))}
        </div>
      </Card>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
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

function UserRow({ user, expanded, onToggle, onAction, busy }: {
  user: AdminUser
  expanded: boolean
  onToggle: () => void
  onAction: (action: string, data?: Record<string, unknown>) => void
  busy: boolean
}) {
  const rpc = user.rpc
  return (
    <div className="glass-card-inner p-3 space-y-2">
      <div className="flex items-center gap-3">
        <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full" />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{user.username}</span>
            {user.isAdmin && (
              <Badge className="bg-purple-500/20 text-purple-300 text-[10px]">ADMIN</Badge>
            )}
            <span className="text-[10px] text-white/30">{expanded ? '▲' : '▼'}</span>
          </div>
          <p className="text-xs text-white/40 font-mono">{user.discordId}</p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          {rpc?.rpcEnabled ? (
            <Badge className="bg-green-500/20 text-green-300 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              RPC LIVE
            </Badge>
          ) : (
            <Badge className="bg-white/5 text-white/40 text-[10px]">RPC OFF</Badge>
          )}
          {rpc?.hasDiscordToken ? (
            <Badge className="bg-blue-500/10 text-blue-300 text-[10px]">🔑 VERIFIED</Badge>
          ) : (
            <Badge className="bg-yellow-500/10 text-yellow-300 text-[10px]">⚠ NO TOKEN</Badge>
          )}
        </div>
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {user.trial?.daysLeft ?? 0}d left</span>
        {rpc?.customStatus && (
          <span>💬 {rpc.customStatusEmoji} {rpc.customStatus}</span>
        )}
        {rpc?.userStatus && (
          <span className={`uppercase ${rpc.userStatus === 'online' ? 'text-green-400' : rpc.userStatus === 'idle' ? 'text-yellow-400' : rpc.userStatus === 'dnd' ? 'text-red-400' : 'text-gray-400'}`}>
            {rpc.userStatus}
          </span>
        )}
        {user.rpcConfig && (
          <span>🎮 {user.rpcConfig.name}</span>
        )}
        {rpc?.lastPresenceUpdate && (
          <span className="text-white/30">
            {new Date(rpc.lastPresenceUpdate).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div className="pt-2 mt-2 border-t border-white/5 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onAction('sync')}
              disabled={busy}
              className="inline-flex items-center gap-1 bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-purple-500/25 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Sync
            </button>
            <button
              onClick={() => onAction('stop-rpc')}
              disabled={busy}
              className="inline-flex items-center gap-1 bg-red-500/15 border border-red-500/30 text-red-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-500/25 disabled:opacity-50 transition-colors"
            >
              <Power className="w-3 h-3" /> Stop RPC
            </button>
            <button
              onClick={() => onAction('toggle-status', { enable: !rpc?.rpcEnabled })}
              disabled={busy}
              className="inline-flex items-center gap-1 bg-blue-500/15 border border-blue-500/30 text-blue-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-blue-500/25 disabled:opacity-50 transition-colors"
            >
              <Activity className="w-3 h-3" /> {rpc?.rpcEnabled ? 'Disable' : 'Enable'} Status
            </button>
            <button
              onClick={() => onAction('extend-trial', { days: 30 })}
              disabled={busy}
              className="inline-flex items-center gap-1 bg-green-500/15 border border-green-500/30 text-green-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-green-500/25 disabled:opacity-50 transition-colors"
            >
              <Clock className="w-3 h-3" /> +30d Trial
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete user ${user.username}? This removes all their data.`)) {
                  onAction('delete-user')
                }
              }}
              disabled={busy}
              className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-300/80 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>

          {/* User details */}
          <div className="grid grid-cols-2 gap-2 text-[10px] text-white/40 font-mono">
            <div>ID: {user.id}</div>
            <div>Created: {new Date(user.createdAt).toLocaleDateString()}</div>
            {user.globalConfig && (
              <>
                <div>City: {user.globalConfig.city || '—'}</div>
                <div>TZ: {user.globalConfig.timezone}</div>
              </>
            )}
            {rpc && (
              <>
                <div>Gateway: {rpc.gatewayReady ? '✓ ready' : '✗ down'}</div>
                <div>VR: {rpc.vrStatusActive ? '✓ active' : '✗ off'}</div>
                {rpc.sleepTimerActive && (
                  <div>Sleep: until {new Date(rpc.sleepTimerEndsAt!).toLocaleTimeString()}</div>
                )}
              </>
            )}
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
