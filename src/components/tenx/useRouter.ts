// 10X RPC — hash router hook (useSyncExternalStore based, SSR-safe)
'use client'
import { useSyncExternalStore, useCallback } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'dashboard' }
  | { name: 'config' }
  | { name: 'rotator' }
  | { name: 'oauth-consent' }
  | { name: 'admin' }

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').trim()
  if (!clean) return { name: 'home' }
  const parts = clean.split('/')
  if (parts[0] === 'dashboard') return { name: 'dashboard' }
  if (parts[0] === 'config') return { name: 'config' }
  if (parts[0] === 'rotator') return { name: 'rotator' }
  if (parts[0] === 'oauth-consent' || parts[0] === 'login') return { name: 'oauth-consent' }
  if (parts[0] === 'admin') return { name: 'admin' }
  return { name: 'home' }
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'home': return '#/'
    case 'dashboard': return '#/dashboard'
    case 'config': return '#/config'
    case 'rotator': return '#/rotator'
    case 'oauth-consent': return '#/oauth-consent'
    case 'admin': return '#/admin'
  }
}

// Subscribe to the browser's hashchange event.
function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

// Client snapshot — reads the live hash.
function getSnapshot(): string {
  return window.location.hash
}

// Server snapshot — always the empty hash so SSR renders the "home" route.
function getServerSnapshot(): string {
  return ''
}

export function useRouter() {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const route = parseHash(hash)
  const navigate = useCallback((next: Route) => {
    if (typeof window !== 'undefined') {
      window.location.hash = toHash(next)
    }
  }, [])
  return { route, navigate, mounted: true }
}
