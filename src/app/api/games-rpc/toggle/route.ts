// 10X RPC — /api/games-rpc/toggle — Enable/Disable Games RPC
// COMPLETELY SEPARATE from /api/rpc/toggle (Normal RPC). Never touches rpcEnabled or rpcConfig.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { daemonSyncUser } from '@/lib/daemon-bridge'
import { findSpoofGame } from '@/lib/spoof-games'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
    }

    const body = await req.json() as { enabled?: boolean }
    const enabled = !!body.enabled

    if (enabled) {
      // 1. Check trial
      const trial = await db.trial.findUnique({ where: { userId: session.userId } })
      if (!trial || !trial.active || trial.endsAt < new Date()) {
        return NextResponse.json(
          { ok: false, error: 'trial_expired', message: 'Your trial has expired.' },
          { status: 403 }
        )
      }

      // 2. Load/create the game RPC config (default: Minecraft)
      let gameRpcConfig = await db.gameRpcConfig.findUnique({ where: { userId: session.userId } })
      if (gameRpcConfig) {
        gameRpcConfig = await db.gameRpcConfig.update({
          where: { userId: session.userId },
          data: { enabled: true },
        })
      } else {
        const game = findSpoofGame('minecraft')!
        gameRpcConfig = await db.gameRpcConfig.create({
          data: {
            userId: session.userId,
            gameSlug: 'minecraft',
            enabled: true,
            state: game.defaultState,
            details: game.defaultDetails,
            partyCurrent: game.defaultPartyCurrent,
            partyMax: game.defaultPartyMax,
          },
        })
      }

      // 3. Enable Games RPC in session — NEVER touches rpcEnabled
      await db.session.updateMany({
        where: { userId: session.userId },
        data: {
          gamesRpcEnabled: true,
          gatewayReady: true,
          lastPresenceUpdate: new Date(),
        },
      })

      // 4. Sync daemon (pushes game activity — takes priority over normal RPC)
      if (session.discordAccessToken) {
        await daemonSyncUser(session.userId)
      }

      return NextResponse.json({
        ok: true,
        enabled: true,
        gameRpcConfig,
        message: 'Games RPC enabled & live on Discord',
      })
    } else {
      // Disable Games RPC — NEVER touches rpcEnabled or statusEnabled
      const statusSession = await db.session.findFirst({
        where: { userId: session.userId, statusEnabled: true },
      })
      const normalRpcSession = await db.session.findFirst({
        where: { userId: session.userId, rpcEnabled: true },
      })
      const keepGateway = !!statusSession || !!normalRpcSession

      await db.session.updateMany({
        where: { userId: session.userId },
        data: {
          gamesRpcEnabled: false,
          gatewayReady: keepGateway,
          lastPresenceUpdate: new Date(),
        },
      })

      const gameRpcConfig = await db.gameRpcConfig.findUnique({ where: { userId: session.userId } })
      if (gameRpcConfig) {
        await db.gameRpcConfig.update({
          where: { userId: session.userId },
          data: { enabled: false },
        })
      }

      // Sync daemon — will clear the game activity (transition detected)
      if (session.discordAccessToken) {
        await daemonSyncUser(session.userId)
      }

      return NextResponse.json({
        ok: true,
        enabled: false,
        message: 'Games RPC disabled & cleared from Discord',
      })
    }
  } catch (e: any) {
    console.error('Error in /api/games-rpc/toggle:', e)
    return NextResponse.json({
      ok: false,
      error: 'toggle_failed',
      message: e?.message || 'Failed to toggle Games RPC',
    }, { status: 500 })
  }
}
