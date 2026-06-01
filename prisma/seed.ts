import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "admin@luqz.com.br" } })
  if (existing) {
    console.log("Admin já existe.")
    return
  }

  const hash = await bcrypt.hash("luqz@2024", 12)
  const user = await prisma.user.create({
    data: {
      name: "Admin LUQZ",
      email: "admin@luqz.com.br",
      password: hash,
      role: "ADMIN",
    },
  })

  console.log(`Admin criado: ${user.email}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
