// 10X RPC — frontend API client
export interface Me {
  authenticated: boolean
  user?: {
    id: string
    username: string
    discriminator: string
    avatar: string
    backgroundUrl?: string | null
  }
  session?: {
    statusEnabled?: boolean
    rpcEnabled: boolean
    gamesRpcEnabled: boolean
    gatewayReady: boolean
    userStatus: string
    customStatus: string | null
    customStatusEmoji: string | null
    statusPlatform?: string
    vrStatusActive: boolean
    sleepTimerActive: boolean
    sleepTimerEndsAt: string | null
    hasDiscordToken?: boolean
    lastPresenceUpdate?: string | null
  }
  trial?: {
    active: boolean
    endsAt: string | null
    msLeft: number
    daysLeft: number
  }
  globalConfig?: {
    city: string | null
    timezone: string
    rotatorEnabled: boolean
    rotatorIntervalMins: number
  } | null
  rpcConfig?: RpcConfig | null
  gameRpcConfig?: GameRpcConfig | null
  rotatorPresets?: RotatorPreset[]
  rotatorEnabled?: boolean
  app?: { name: string; tagline: string }
  subscription?: {
    active: boolean
    plan: string
    planName: string
    endsAt: string | null
    daysLeft: number
    isTrial: boolean
    isLifetime: boolean
    autoRenew: boolean
  }
}

export interface RpcConfig {
  id?: string
  name?: string
  type?: string
  platform?: string
  state?: string | null
  details?: string | null
  largeImage?: string | null
  largeText?: string | null
  smallImage?: string | null
  smallText?: string | null
  button1Label?: string | null
  button1Url?: string | null
  button2Label?: string | null
  button2Url?: string | null
  partyCurrent?: number | null
  partyMax?: number | null
  partyId?: string | null
  partySecret?: string | null
  startMinsAgo?: number
  endTotalMins?: number | null
  enabled?: boolean
}

export interface RotatorPreset {
  id?: string
  emoji?: string | null
  text: string
  durationMins?: number
  enabled?: boolean
  order?: number
}

// ===== Games RPC (completely separate from Normal RPC) =====
export interface SpoofGame {
  slug: string
  appId: string
  name: string
  img: string
  defaultState: string
  defaultDetails: string
  defaultPartyMax: number
  defaultPartyCurrent: number
}

export interface GameRpcConfig {
  id?: string
  gameSlug?: string
  enabled?: boolean
  state?: string | null
  details?: string | null
  largeImage?: string | null
  largeText?: string | null
  smallImage?: string | null
  smallText?: string | null
  button1Label?: string | null
  button1Url?: string | null
  button2Label?: string | null
  button2Url?: string | null
  partyCurrent?: number | null
  partyMax?: number | null
  startMinsAgo?: number
  endTotalMins?: number | null
}

export interface PlaceholderEntry {
  token: string
  desc: string
}

export interface AdminUser {
  id: string
  discordId: string
  username: string
  avatar: string
  createdAt: string
  trial: {
    active: boolean
    endsAt: string | null
    daysLeft: number
  } | null
  rpc: {
    rpcEnabled: boolean
    gatewayReady: boolean
    userStatus: string
    customStatus: string | null
    customStatusEmoji: string | null
    vrStatusActive: boolean
    hasDiscordToken: boolean
    lastPresenceUpdate: string | null
    sleepTimerActive: boolean
    sleepTimerEndsAt: string | null
  } | null
  rpcConfig: {
    name: string
    type: string
    platform: string
    enabled: boolean
  } | null
  globalConfig: {
    city: string | null
    timezone: string
    rotatorEnabled: boolean
  } | null
  isAdmin: boolean
}

export interface AdminPayment {
  id: string
  userId: string
  planId: string
  planName: string
  amount: number
  currency: string
  status: string
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  internalOrderId: string | null
  verifiedAt: Date | string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    discordId: string
    username: string
    avatar: string
    discriminator: string
  } | null
}

export interface AdminSubscription {
  id: string
  userId: string
  plan: string
  status: string
  paymentId: string | null
  amountPaid: number
  currency: string
  startsAt: string
  endsAt: string
  daysLeft: number
  autoRenew: boolean
  createdAt: string
  updatedAt: string
  user: {
    id: string
    discordId: string
    username: string
    avatar: string
    discriminator: string
    createdAt: string
  } | null
}

export interface AdminAuditLog {
  id: string
  action: string
  target: string | null
  actor: string
  metadata: string | null
  createdAt: string
}

export interface AdminAnnouncement {
  id: string
  type: 'info' | 'update' | 'warning' | 'maintenance'
  title: string
  message: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminSettings {
  id: string
  siteName: string
  heroTitle: string
  heroSubtitle: string
  discordInvite: string
  supportText: string | null
  maintenanceMode: boolean
  createdAt: string
  updatedAt: string
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const isGet = !init?.method || init.method.toUpperCase() === 'GET'
  const maxAttempts = isGet ? 3 : 1
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...init,
      })
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('not_authenticated')
        }
        if (isGet && attempt < maxAttempts && (res.status === 500 || res.status === 503)) {
          await new Promise(r => setTimeout(r, 600 * attempt))
          continue
        }
        const text = await res.text().catch(() => '')
        let msg = text
        try { msg = JSON.parse(text).error || text } catch {}
        throw new Error(msg || `Request failed: ${res.status}`)
      }
      return (await res.json()) as T
    } catch (err: any) {
      if (err?.message === 'not_authenticated') {
        throw err
      }
      lastError = err
      if (isGet && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 600 * attempt))
        continue
      }
      throw err
    }
  }
  throw lastError || new Error('Request failed')
}

export const api = {
  me: () => fetchJson<Me>('/api/me'),
  logout: () => fetchJson<{ ok: boolean; redirect: string }>('/api/logout', { method: 'POST' }),
  demoLogin: () => fetchJson<{ ok: boolean; demo: boolean; sessionToken?: string; redirect?: string }>('/api/demo-login', { method: 'POST' }),

  rpcSave: (data: RpcConfig) => fetchJson<{ ok: boolean; rpcConfig: RpcConfig }>('/api/rpc', {
    method: 'POST', body: JSON.stringify(data),
  }),
  rpcGet: () => fetchJson<{ rpcConfig: RpcConfig | null }>('/api/rpc'),
  rpcUpdate: () => fetchJson<{
    ok: boolean
    method?: string
    message?: string
    error?: string
    rpcEnabled?: boolean
    gatewayReady?: boolean
  }>('/api/rpc/update', { method: 'POST' }),
  rpcToggle: (enabled: boolean) => fetchJson<{
    ok: boolean
    enabled: boolean
    message?: string
    error?: string
  }>('/api/rpc/toggle', {
    method: 'POST', body: JSON.stringify({ enabled }),
  }),

  // ===== Games RPC (completely separate from Normal RPC) =====
  gamesList: () => fetchJson<{ games: SpoofGame[] }>('/api/games-rpc/list'),
  gamesRpcGet: () => fetchJson<{ gameRpcConfig: GameRpcConfig | null; gamesRpcEnabled: boolean }>('/api/games-rpc/config'),
  gamesRpcSave: (data: GameRpcConfig) => fetchJson<{ ok: boolean; gameRpcConfig: GameRpcConfig; gamesRpcEnabled: boolean }>(
    '/api/games-rpc/config', { method: 'POST', body: JSON.stringify(data) }
  ),
  gamesRpcToggle: (enabled: boolean) => fetchJson<{
    ok: boolean
    enabled: boolean
    message?: string
    error?: string
  }>('/api/games-rpc/toggle', {
    method: 'POST', body: JSON.stringify({ enabled }),
  }),

  customStatus: (emoji: string | null, text: string | null) =>
    fetchJson<{ ok: boolean }>('/api/rpc/custom-status', {
      method: 'POST', body: JSON.stringify({ emoji, text }),
    }),
  clearCustomStatus: () => fetchJson<{ ok: boolean }>('/api/rpc/clear', { method: 'POST' }),

  setStatus: (status: string) => fetchJson<{ ok: boolean; status: string }>('/api/rpc/status', {
    method: 'POST', body: JSON.stringify({ status }),
  }),
  statusUpdate: (data: {
    userStatus?: string
    customStatus?: string | null
    customStatusEmoji?: string | null
    statusPlatform?: string
  }) =>
    fetchJson<{
      ok: boolean
      statusEnabled: boolean
      userStatus: string
      customStatus: string | null
      customStatusEmoji: string | null
      statusPlatform: string
      message?: string
      error?: string
    }>('/api/status/update', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  statusToggle: (enabled: boolean) => fetchJson<{ ok: boolean; statusEnabled: boolean; userStatus?: string }>('/api/status/toggle', {
    method: 'POST', body: JSON.stringify({ enabled }),
  }),

  vrToggle: (active: boolean) => fetchJson<{ ok: boolean; vrStatusActive: boolean }>(
    '/api/vr-status/enable', { method: 'POST', body: JSON.stringify({ active }) }
  ),

  configSave: (city: string | null, timezone: string) => fetchJson<{ ok: boolean }>(
    '/api/config/save', { method: 'POST', body: JSON.stringify({ city, timezone }) }
  ),
  configAutoDetect: () => fetchJson<{ ok: boolean }>('/api/config/auto-detect', { method: 'POST' }),

  rotatorList: () => fetchJson<{ presets: RotatorPreset[] }>('/api/rotator/list'),
  rotatorSave: (data: RotatorPreset) => fetchJson<{ ok: boolean; preset: RotatorPreset }>(
    '/api/rotator/save', { method: 'POST', body: JSON.stringify(data) }
  ),
  rotatorDelete: (id: string) => fetchJson<{ ok: boolean }>(`/api/rotator/save?id=${id}`, { method: 'DELETE' }),
  rotatorToggle: (enabled: boolean, intervalMins?: number) =>
    fetchJson<{ ok: boolean }>('/api/rotator/toggle', {
      method: 'POST', body: JSON.stringify({ enabled, intervalMins }),
    }),

  sleepTimer: (hours: number | null) => fetchJson<{ ok: boolean; active?: boolean; endsAt?: string }>(
    '/api/sleep-timer', { method: 'POST', body: JSON.stringify({ hours }) }
  ),

  weather: (city: string) => fetchJson<{ tempC: number; condition: string; emoji: string; city: string }>(
    `/api/weather?city=${encodeURIComponent(city)}`
  ),

  background: (url: string | null) => fetchJson<{ ok: boolean; backgroundUrl: string | null }>(
    '/api/background', { method: 'POST', body: JSON.stringify({ url }) }
  ),

  keepAlive: () => fetchJson<{
    ok: boolean
    totalActive: number
    successCount: number
    failCount: number
    results: Array<{ userId: string; username: string; ok: boolean; message: string }>
  }>('/api/rpc/keep-alive', { method: 'POST' }),

  adminUsers: () => fetchJson<{
    ok: boolean
    totalUsers: number
    activeRpcUsers: number
    users: AdminUser[]
  }>('/api/admin/users'),

  adminForceRpc: (enable: boolean) => fetchJson<{
    ok: boolean
    action: string
    totalUsers: number
    successCount: number
    failCount: number
    results: Array<{ userId: string; username: string; ok: boolean; message: string }>
  }>('/api/admin/force-rpc', { method: 'POST', body: JSON.stringify({ enable }) }),

  adminDaemonStatus: () => fetchJson<{
    ok: boolean
    daemon?: {
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
    error?: string
  }>('/api/admin/daemon-status'),

  adminUserAction: (userId: string, action: string, data?: Record<string, unknown>) => fetchJson<{
    ok: boolean
    message?: string
    error?: string
  }>('/api/admin/user-action', {
    method: 'POST',
    body: JSON.stringify({ userId, action, ...data }),
  }),

  adminStats: () => fetchJson<{
    ok: boolean
    stats: {
      totalUsers: number
      activeSubscriptions: number
      totalRevenue: number
      trialUsers: number
      expiredSubs: number
      planBreakdown: Record<string, number>
      plans: Array<{ id: string; name: string; price: number }>
    }
  }>('/api/admin/stats'),

  adminPayments: (params?: { status?: string; search?: string; take?: number; skip?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.search) qs.set('search', params.search)
    if (params?.take) qs.set('take', String(params.take))
    if (params?.skip) qs.set('skip', String(params.skip))
    return fetchJson<{ ok: boolean; payments: AdminPayment[]; total: number; take: number; skip: number }>(`/api/admin/payments?${qs}`)
  },

  adminSubscriptions: (params?: { status?: string; search?: string; take?: number; skip?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.search) qs.set('search', params.search)
    return fetchJson<{ ok: boolean; subscriptions: AdminSubscription[]; total: number; take: number; skip: number }>(`/api/admin/subscriptions?${qs}`)
  },

  adminAuditLogs: (params?: { action?: string; actor?: string; target?: string; take?: number; skip?: number }) => {
    const qs = new URLSearchParams()
    if (params?.action) qs.set('action', params.action)
    if (params?.actor) qs.set('actor', params.actor)
    if (params?.target) qs.set('target', params.target)
    if (params?.take) qs.set('take', String(params.take))
    if (params?.skip) qs.set('skip', String(params.skip))
    return fetchJson<{ ok: boolean; logs: AdminAuditLog[]; total: number; take: number; skip: number }>(`/api/admin/audit-logs?${qs}`)
  },

  adminHealth: () => fetchJson<{
    ok: boolean
    health: {
      database: { ok: boolean; message: string; latencyMs?: number }
      razorpay: { ok: boolean; message: string }
      daemon: { ok: boolean; message: string; latencyMs?: number }
      overall: { ok: boolean; message: string }
    }
    checkedAt: string
  }>('/api/admin/health'),

  adminAnnouncements: () => fetchJson<{ ok: boolean; announcements: AdminAnnouncement[] }>('/api/admin/announcements'),
  adminCreateAnnouncement: (data: { type: string; title: string; message: string; isActive?: boolean }) => fetchJson<{ ok: boolean; announcement: AdminAnnouncement }>(
    '/api/admin/announcements', { method: 'POST', body: JSON.stringify(data) }
  ),
  adminUpdateAnnouncement: (id: string, data: { type?: string; title?: string; message?: string; isActive?: boolean }) => fetchJson<{ ok: boolean; announcement: AdminAnnouncement }>(
    `/api/admin/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }
  ),
  adminDeleteAnnouncement: (id: string) => fetchJson<{ ok: boolean; deleted: string }>(`/api/admin/announcements/${id}`, { method: 'DELETE' }),

  adminSettings: () => fetchJson<{ ok: boolean; settings: AdminSettings }>('/api/admin/settings'),
  adminUpdateSettings: (data: Partial<Omit<AdminSettings, 'id' | 'createdAt' | 'updatedAt'>>) => fetchJson<{ ok: boolean; settings: AdminSettings }>(
    '/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) }
  ),

  adminGrantAccess: (data: { userId: string; planId: string; durationDays: number; reason?: string }) => fetchJson<{ ok: boolean; message?: string }>(
    '/api/admin/grant-access', { method: 'POST', body: JSON.stringify(data) }
  ),

  adminSendNotification: (data: { userIds: string[]; type: string; title: string; message: string }) => fetchJson<{ ok: boolean; sent: number; invalid: number }>(
    '/api/admin/send-notification', { method: 'POST', body: JSON.stringify(data) }
  ),

  adminPlans: () => fetchJson<{ ok: boolean; plans: any[] }>('/api/plans'),
  adminCreatePlan: (data: Record<string, unknown>) => fetchJson<{ ok: boolean; plan: any }>(
    '/api/plans', { method: 'POST', body: JSON.stringify(data) }
  ),
  adminUpdatePlan: (data: Record<string, unknown>) => fetchJson<{ ok: boolean; plan: any }>(
    '/api/plans', { method: 'PUT', body: JSON.stringify(data) }
  ),
  adminDeletePlan: (id: string) => fetchJson<{ ok: boolean }>(`/api/plans?id=${id}`, { method: 'DELETE' }),

  placeholders: () => fetchJson<{ placeholders: PlaceholderEntry[] }>('/api/placeholders'),
  resolvePlaceholders: (text: string) => fetchJson<{ original: string; resolved: string }>(
    '/api/placeholders', { method: 'POST', body: JSON.stringify({ text }) }
  ),

  // ===== Subscription =====
  subscriptionStatus: () => fetchJson<{
    ok: boolean
    status: {
      active: boolean
      plan: string
      planName: string
      endsAt: string | null
      daysLeft: number
      isTrial: boolean
      isLifetime: boolean
      autoRenew: boolean
    }
    plans: Array<{
      id: string
      name: string
      price: number
      period: string
      durationDays: number
      features: string[]
      badge?: string
      highlighted?: boolean
    }>
  }>('/api/subscription/status'),

  subscriptionCreate: (planId: string, paymentId?: string) => fetchJson<{
    ok: boolean
    message?: string
    error?: string
    status?: {
      active: boolean
      plan: string
      planName: string
      endsAt: string | null
      daysLeft: number
      isTrial: boolean
      isLifetime: boolean
    }
  }>('/api/subscription/create', {
    method: 'POST',
    body: JSON.stringify({ planId, paymentId }),
  }),

  subscriptionCancel: () => fetchJson<{ ok: boolean; message: string }>(
    '/api/subscription/cancel', { method: 'POST' }
  ),

  razorpayCreateOrder: (planId: string) => fetchJson<{
    ok: boolean
    orderId: string
    amount: number
    currency: string
    keyId: string
    planId: string
    planName: string
    userEmail: string
    error?: string
  }>('/api/subscription/razorpay/create-order', {
    method: 'POST', body: JSON.stringify({ planId }),
  }),

  razorpayVerify: (data: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
    planId: string
  }) => fetchJson<{ ok: boolean; message?: string; error?: string; status?: any }>(
    '/api/subscription/razorpay/verify', {
    method: 'POST', body: JSON.stringify(data),
  }),
}
