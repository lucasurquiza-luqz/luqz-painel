import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { CLIENT_ROSTER } from "@/lib/client-roster"
import { prisma } from "@/lib/db"

export async function POST() {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const result = await prisma.$transaction(async (tx) => {
    let created = 0
    let updated = 0
    let unchanged = 0

    for (const rosterItem of CLIENT_ROSTER) {
      let existing = rosterItem.clickupFolderId
        ? await tx.client.findUnique({ where: { clickupFolderId: rosterItem.clickupFolderId } })
        : null

      existing ??= await tx.client.findFirst({
        where: { name: { equals: rosterItem.name, mode: "insensitive" } },
      })

      if (!existing) {
        await tx.client.create({
          data: {
            name: rosterItem.name,
            active: rosterItem.active,
            clickupFolderId: rosterItem.clickupFolderId,
            statusReason: rosterItem.statusReason,
            statusChangedAt: new Date(),
            statusHistory: {
              create: {
                active: rosterItem.active,
                reason: rosterItem.statusReason ?? "Cadastro inicial pelo roster oficial.",
                source: "ROSTER_IMPORT",
                changedById: auth.user.userId,
              },
            },
          },
        })
        created++
        continue
      }

      const statusChanged = existing.active !== rosterItem.active
      const metadataChanged =
        existing.clickupFolderId !== rosterItem.clickupFolderId ||
        existing.statusReason !== rosterItem.statusReason

      if (!statusChanged && !metadataChanged) {
        unchanged++
        continue
      }

      await tx.client.update({
        where: { id: existing.id },
        data: {
          clickupFolderId: rosterItem.clickupFolderId,
          active: rosterItem.active,
          statusReason: rosterItem.statusReason,
          ...(statusChanged ? { statusChangedAt: new Date() } : {}),
          ...(statusChanged ? {
            statusHistory: {
              create: {
                active: rosterItem.active,
                reason: rosterItem.statusReason ?? "Status sincronizado pelo roster oficial.",
                source: "ROSTER_IMPORT",
                changedById: auth.user.userId,
              },
            },
          } : {}),
        },
      })
      updated++
    }

    return { created, updated, unchanged, total: CLIENT_ROSTER.length }
  })

  return NextResponse.json(result)
}
