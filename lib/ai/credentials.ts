import { prisma } from "@/lib/db"
import { decryptSecret, encryptSecret } from "@/lib/crypto-secrets"
import type { AiProvider } from "@prisma/client"

export async function getProviderApiKey(provider: AiProvider, envFallback?: string): Promise<string | null> {
  const credential = await prisma.aiCredential.findUnique({ where: { provider } })
  if (credential) return decryptSecret(credential.encryptedValue)
  return envFallback ?? null
}

export async function saveProviderApiKey(
  provider: AiProvider,
  label: string,
  apiKey: string,
  updatedById: string
) {
  const encryptedValue = encryptSecret(apiKey)
  const lastFour = apiKey.slice(-4)

  return prisma.aiCredential.upsert({
    where: { provider },
    create: { provider, label, encryptedValue, lastFour, updatedById },
    update: { label, encryptedValue, lastFour, updatedById },
  })
}
