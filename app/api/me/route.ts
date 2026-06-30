import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"

export async function GET() {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  return NextResponse.json({ id: auth.user.userId, name: auth.user.name, role: auth.user.role })
}
