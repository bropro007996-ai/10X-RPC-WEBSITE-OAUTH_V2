// 10X RPC — Admin shell with tabbed sidebar navigation
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from '../useRouter'
import { BackButton } from '../ui'
import {
  LayoutDashboard, Users, CreditCard, Crown, Megaphone, Send,
  Settings, ScrollText, HeartPulse, RefreshCw, Shield, Tag, Bell,
  BarChart3, Flag, Webhook
} from 'lucide-react'
import { OverviewTab } from './OverviewTab'
import { UsersTab } from './UsersTab'
import { PaymentsTab } from './PaymentsTab'
import { SubscriptionsTab } from './SubscriptionsTab'
import { AnnouncementsTab } from './AnnouncementsTab'
import { BroadcastTab } from './BroadcastTab'
import { SettingsTab } from './SettingsTab'
import { AuditLogsTab } from './AuditLogsTab'
import { HealthTab } from './HealthTab'
import { PlansTab } from './PlansTab'
import { NotificationsTab } from './NotificationsTab'
import { AnalyticsTab } from './AnalyticsTab'
import { FeatureFlagsTab } from './FeatureFlagsTab'
import { WebhooksTab } from './WebhooksTab'

export type AdminTab =
  | 'overview'
  | 'analytics'
  | 'users'
  | 'payments'
  | 'subscriptions'
  | 'plans'
  | 'announcements'
  | 'broadcast'
  | 'notifications'
  | 'feature-flags'
  | 'webhooks'
  | 'settings'
  | 'audit-logs'
  | 'health'

interface TabDef {
  id: AdminTab
  label: string
  icon: typeof LayoutDashboard
  desc: string
}

const TABS: TabDef[] = [
  { id: 'overview',      label: 'Overview',      icon: LayoutDashboard, desc: 'Stats, daemon & bulk control' },
  { id: 'analytics',     label: 'Analytics',     icon: BarChart3,       desc: 'Charts & growth metrics' },
  { id: 'users',         label: 'Users',         icon: Users,           desc: 'Manage user accounts' },
  { id: 'payments',      label: 'Payments',      icon: CreditCard,     desc: 'All payment transactions' },
  { id: 'subscriptions', label: 'Subscriptions', icon: Crown,           desc: 'Active & expired subs' },
  { id: 'plans',         label: 'Plans',         icon: Tag,             desc: 'Subscription plan CRUD' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone,      desc: 'Site-wide announcements' },
  { id: 'broadcast',     label: 'Broadcast',    icon: Send,           desc: 'Mass notify users' },
  { id: 'notifications', label: 'Notifications', icon: Bell,            desc: 'Sent notification log' },
  { id: 'feature-flags', label: 'Feature Flags', icon: Flag,            desc: 'Global feature toggles' },
  { id: 'webhooks',      label: 'Webhooks',      icon: Webhook,         desc: 'Outgoing webhook config' },
  { id: 'settings',      label: 'Settings',      icon: Settings,        desc: 'Site configuration' },
  { id: 'audit-logs',    label: 'Audit Logs',    icon: ScrollText,      desc: 'Admin action history' },
  { id: 'health',        label: 'System Health', icon: HeartPulse,      desc: 'Service status' },
]

interface AdminShellProps {
  /** Refresh trigger — when this changes, the active tab refetches */
  refreshKey: number
  onRefresh: () => void
  refreshing: boolean
  autoRefresh: boolean
  onToggleAuto: (v: boolean) => void
}

export function AdminShell({ refreshKey, onRefresh, refreshing, autoRefresh, onToggleAuto }: AdminShellProps) {
  const { navigate } = useRouter()
  // Persist active tab in the URL hash so refreshes remember it
  const [active, setActive] = useState<AdminTab>(() => {
    if (typeof window === 'undefined') return 'overview'
    const h = window.location.hash.replace('#', '').replace(/^admin-/, '')
    return (TABS.find(t => t.id === h)?.id) || 'overview'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const newHash = `#admin-${active}`
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash)
    }
  }, [active])

  const ActiveIcon = TABS.find(t => t.id === active)?.icon || LayoutDashboard

  return (
    <div className="min-h-screen px-4 sm:px-6 py-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <BackButton onClick={() => navigate({ name: 'dashboard' })} />
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg purple-gradient flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="hidden sm:flex items-center gap-1 text-xs text-white/50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => onToggleAuto(e.target.checked)}
              className="accent-purple-500"
            />
            Auto
          </label>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Layout: sidebar + content */}
      <div className="grid lg:grid-cols-[220px_1fr] gap-4">
        {/* Sidebar (desktop) / horizontal pills (mobile) */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          {/* Desktop vertical menu */}
          <nav className="hidden lg:flex flex-col gap-1 p-2 glass-card">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = tab.id === active
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                    isActive
                      ? 'bg-purple-500/15 border border-purple-500/30 text-white'
                      : 'border border-transparent text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? 'text-purple-300' : 'text-purple-400/70'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{tab.label}</div>
                    <div className="text-[10px] text-white/40 truncate">{tab.desc}</div>
                  </div>
                </button>
              )
            })}
          </nav>

          {/* Mobile horizontal scrollable pills */}
          <nav className="lg:hidden -mx-4 px-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5 pb-1 w-max">
              {TABS.map(tab => {
                const Icon = tab.icon
                const isActive = tab.id === active
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActive(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
                        : 'bg-white/5 text-white/60 border border-white/8'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0">
          {/* Tab title strip */}
          <div className="flex items-center gap-2 mb-4">
            <ActiveIcon className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-bold text-white">
              {TABS.find(t => t.id === active)?.label}
            </h2>
            <span className="text-xs text-white/40">·</span>
            <span className="text-xs text-white/40 truncate">
              {TABS.find(t => t.id === active)?.desc}
            </span>
          </div>

          {active === 'overview' && <OverviewTab refreshKey={refreshKey} />}
          {active === 'analytics' && <AnalyticsTab refreshKey={refreshKey} />}
          {active === 'users' && <UsersTab refreshKey={refreshKey} />}
          {active === 'payments' && <PaymentsTab refreshKey={refreshKey} />}
          {active === 'subscriptions' && <SubscriptionsTab refreshKey={refreshKey} />}
          {active === 'plans' && <PlansTab refreshKey={refreshKey} />}
          {active === 'announcements' && <AnnouncementsTab refreshKey={refreshKey} />}
          {active === 'broadcast' && <BroadcastTab refreshKey={refreshKey} />}
          {active === 'notifications' && <NotificationsTab refreshKey={refreshKey} />}
          {active === 'feature-flags' && <FeatureFlagsTab refreshKey={refreshKey} />}
          {active === 'webhooks' && <WebhooksTab refreshKey={refreshKey} />}
          {active === 'settings' && <SettingsTab refreshKey={refreshKey} />}
          {active === 'audit-logs' && <AuditLogsTab refreshKey={refreshKey} />}
          {active === 'health' && <HealthTab refreshKey={refreshKey} />}
        </main>
      </div>
    </div>
  )
}
