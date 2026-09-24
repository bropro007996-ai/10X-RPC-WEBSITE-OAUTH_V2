// 10X RPC — /api/admin/user-action — per-user admin actions (admin only)
// Actions: sync (push presence), stop-rpc (clear presence), extend-trial, delete-user
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'
import { daemonSyncUser, daemonStopUserRpc } from '@/lib/daemon-bridge'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    userId?: string
    action?: 'sync' | 'stop-rpc' | 'extend-trial' | 'delete-user' | 'toggle-status' | 'toggle-games-rpc' | 'apply-template'
    days?: number
    enable?: boolean
    template?: { name: string; state: string; details: string; type: string }
  }

  const { userId, action } = body
  if (!userId || !action) {
    return NextResponse.json({ error: 'missing userId or action' }, { status: 400 })
  }

  try {
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, discordId: true, username: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    switch (action) {
      case 'sync': {
        const result = await daemonSyncUser(userId)
        return NextResponse.json({ ok: result.ok, message: result.message, method: result.method })
      }

      case 'stop-rpc': {
        await db.session.updateMany({
          where: { userId },
          data: { rpcEnabled: false, gatewayReady: false },
        })
        await db.rpcConfig.updateMany({
          where: { userId },
          data: { enabled: false },
        })
        const result = await daemonStopUserRpc(userId)
        return NextResponse.json({ ok: result.ok, message: 'RPC stopped & cleared' })
      }

      case 'toggle-status': {
        const s = await db.session.findFirst({
          where: { userId, discordAccessToken: { not: null }, expiresAt: { gt: new Date() } },
          orderBy: { discordTokenExpiresAt: 'desc' },
        })
        const newStatus = !body.enable ? !s?.statusEnabled : body.enable
        await db.session.updateMany({
          where: { userId },
          data: { statusEnabled: newStatus },
        })
        if (s?.discordAccessToken) {
          await daemonSyncUser(userId)
        }
        return NextResponse.json({ ok: true, statusEnabled: newStatus })
      }

      case 'toggle-games-rpc': {
        const s = await db.session.findFirst({
          where: { userId, discordAccessToken: { not: null }, expiresAt: { gt: new Date() } },
          orderBy: { discordTokenExpiresAt: 'desc' },
        })
        const newGamesRpc = !body.enable ? !s?.gamesRpcEnabled : body.enable
        await db.session.updateMany({
          where: { userId },
          data: { gamesRpcEnabled: newGamesRpc },
        })
        await db.gameRpcConfig.updateMany({
          where: { userId },
          data: { enabled: newGamesRpc },
        })
        if (s?.discordAccessToken) {
          await daemonSyncUser(userId)
        }
        return NextResponse.json({ ok: true, gamesRpcEnabled: newGamesRpc })
      }

      case 'extend-trial': {
        const days = body.days || 30
        const trial = await db.trial.findUnique({ where: { userId } })
        const now = new Date()
        const baseDate = trial?.endsAt && trial.endsAt > now ? trial.endsAt : now
        const newEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)
        if (trial) {
          await db.trial.update({
            where: { userId },
            data: { endsAt: newEnd, active: true },
          })
        } else {
          await db.trial.create({
            data: { userId, endsAt: newEnd, active: true },
          })
        }
        return NextResponse.json({
          ok: true,
          message: `Trial extended by ${days} days`,
          newEndDate: newEnd.toISOString(),
        })
      }

      case 'delete-user': {
        // Cascade delete — removes sessions, rpcConfigs, trials, etc.
        await db.user.delete({ where: { id: userId } })
        return NextResponse.json({ ok: true, message: 'User deleted' })
      }

      case 'apply-template': {
        const tpl = body.template
        if (!tpl?.name) {
          return NextResponse.json({ error: 'missing template' }, { status: 400 })
        }
        const existing = await db.rpcConfig.findFirst({ where: { userId } })
        const tplData = {
          name: tpl.name,
          type: tpl.type || 'PLAYING',
          state: tpl.state || null,
          details: tpl.details || null,
        }
        if (existing) {
          await db.rpcConfig.update({ where: { id: existing.id }, data: tplData })
        } else {
          await db.rpcConfig.create({ data: { userId, ...tplData } })
        }
        // Sync daemon to push the new config
        await daemonSyncUser(userId)
        return NextResponse.json({ ok: true, message: `Template "${tpl.name}" applied` })
      }

      default:
        return NextResponse.json({ error: 'unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'unknown error',
    }, { status: 500 })
  }
}
