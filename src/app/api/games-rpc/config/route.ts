// 10X RPC — /api/games-rpc/config — GET/POST the user's Games RPC config
// COMPLETELY SEPARATE from /api/rpc (Normal RPC). Never touches rpcConfig or rpcEnabled.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { daemonSyncUser, daemonStopUserRpc } from '@/lib/daemon-bridge'
import { findSpoofGame } from '@/lib/spoof-games'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let gameRpcConfig = await db.gameRpcConfig.findUnique({ where: { userId: session.userId } })
  if (!gameRpcConfig) {
    // Initialize with Minecraft defaults
    const game = findSpoofGame('minecraft')!
    gameRpcConfig = await db.gameRpcConfig.create({
      data: {
        userId: session.userId,
        gameSlug: 'minecraft',
        enabled: false,
        state: game.defaultState,
        details: game.defaultDetails,
        partyCurrent: game.defaultPartyCurrent,
        partyMax: game.defaultPartyMax,
      },
    })
  }

  return NextResponse.json({ gameRpcConfig, gamesRpcEnabled: session.gamesRpcEnabled })
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

    const body = await req.json()
    const gameSlug = body.gameSlug || 'minecraft'

    // Validate game slug exists
    const game = findSpoofGame(gameSlug)
    if (!game) {
      return NextResponse.json({ ok: false, error: 'invalid_game_slug' }, { status: 400 })
    }

    const enabled = !!body.enabled

    const data = {
      gameSlug,
      enabled,
      state: body.state?.trim() || null,
      details: body.details?.trim() || null,
      largeImage: body.largeImage?.trim() || null,
      largeText: body.largeText?.trim() || null,
      smallImage: body.smallImage?.trim() || null,
      smallText: body.smallText?.trim() || null,
      button1Label: body.button1Label?.trim() || null,
      button1Url: body.button1Url?.trim() || null,
      button2Label: body.button2Label?.trim() || null,
      button2Url: body.button2Url?.trim() || null,
      partyCurrent: typeof body.partyCurrent === 'number' ? body.partyCurrent : 1,
      partyMax: typeof body.partyMax === 'number' ? body.partyMax : game.defaultPartyMax,
      startMinsAgo: typeof body.startMinsAgo === 'number' ? body.startMinsAgo : 0,
      endTotalMins: typeof body.endTotalMins === 'number' ? body.endTotalMins : null,
    }

    // 1. Save Games RPC config to DB (SEPARATE from Normal RPC's RpcConfig)
    const existing = await db.gameRpcConfig.findUnique({ where: { userId: session.userId } })
    let gameRpcConfig
    if (existing) {
      gameRpcConfig = await db.gameRpcConfig.update({ where: { userId: session.userId }, data })
    } else {
      gameRpcConfig = await db.gameRpcConfig.create({ data: { userId: session.userId, ...data } })
    }

    // 2. Update session.gamesRpcEnabled (SEPARATE from session.rpcEnabled)
    const keepGateway = enabled || !!session.rpcEnabled || !!session.statusEnabled
    await db.session.updateMany({
      where: { userId: session.userId },
      data: {
        gamesRpcEnabled: enabled,
        gatewayReady: keepGateway,
        lastPresenceUpdate: new Date(),
      },
    })

    // 3. Sync daemon: if enabled, push game activity; if disabled, clear it
    if (session.discordAccessToken) {
      if (enabled) {
        await daemonSyncUser(session.userId)
      } else {
        await daemonSyncUser(session.userId)
      }
    }

    return NextResponse.json({
      ok: true,
      gameRpcConfig,
      gamesRpcEnabled: enabled,
      message: enabled ? 'Games RPC updated & live on Discord' : 'Games RPC disabled & cleared',
    })
  } catch (e: any) {
    console.error('Error saving Games RPC config:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}
