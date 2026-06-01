import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// Vincula ou desvincula um grupo a um cliente
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const { groupId, linked } = await req.json()

  const group = await prisma.group.update({
    where: { id: groupId },
    data: { clientId: linked ? clientId : null },
  })

  return NextResponse.json({ group })
}
