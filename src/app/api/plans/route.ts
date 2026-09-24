// 10X RPC — /api/plans — GET (public list) + POST (admin create) + PUT (admin update) + DELETE (admin delete)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

// GET — public: list active plans (sorted by displayOrder)
export async function GET() {
  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  })
  return NextResponse.json({
    ok: true,
    plans: plans.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      priceInr: p.priceInr,
      priceDisplay: `₹${(p.priceInr / 100).toFixed(0)}`,
      durationDays: p.durationDays,
      description: p.description,
      features: JSON.parse(p.features || '[]'),
      isPopular: p.isPopular,
      badge: p.badge,
      displayOrder: p.displayOrder,
    })),
  })
}

// POST — admin: create plan
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json() as {
    name: string; slug: string; priceInr: number; durationDays: number;
    description?: string; features?: string[]; isActive?: boolean;
    displayOrder?: number; isPopular?: boolean; badge?: string;
  }

  if (!body.name || !body.slug || !body.priceInr || !body.durationDays) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const plan = await db.plan.create({
    data: {
      name: body.name,
      slug: body.slug,
      priceInr: body.priceInr,
      durationDays: body.durationDays,
      description: body.description || null,
      features: JSON.stringify(body.features || []),
      isActive: body.isActive ?? true,
      displayOrder: body.displayOrder ?? 0,
      isPopular: body.isPopular ?? false,
      badge: body.badge || null,
    },
  })

  await db.auditLog.create({
    data: { action: 'plan_created', target: plan.id, actor: session.userId, metadata: JSON.stringify({ name: plan.name }) },
  })

  return NextResponse.json({ ok: true, plan })
}

// PUT — admin: update plan
export async function PUT(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json() as {
    id: string; name?: string; priceInr?: number; durationDays?: number;
    description?: string; features?: string[]; isActive?: boolean;
    displayOrder?: number; isPopular?: boolean; badge?: string;
  }

  if (!body.id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const data: any = {}
  if (body.name !== undefined) data.name = body.name
  if (body.priceInr !== undefined) data.priceInr = body.priceInr
  if (body.durationDays !== undefined) data.durationDays = body.durationDays
  if (body.description !== undefined) data.description = body.description
  if (body.features !== undefined) data.features = JSON.stringify(body.features)
  if (body.isActive !== undefined) data.isActive = body.isActive
  if (body.displayOrder !== undefined) data.displayOrder = body.displayOrder
  if (body.isPopular !== undefined) data.isPopular = body.isPopular
  if (body.badge !== undefined) data.badge = body.badge

  const plan = await db.plan.update({ where: { id: body.id }, data })

  await db.auditLog.create({
    data: { action: 'plan_changed', target: plan.id, actor: session.userId, metadata: JSON.stringify(data) },
  })

  return NextResponse.json({ ok: true, plan })
}

// DELETE — admin: delete plan
export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  await db.plan.delete({ where: { id } })

  await db.auditLog.create({
    data: { action: 'plan_deleted', target: id, actor: session.userId },
  })

  return NextResponse.json({ ok: true })
}
