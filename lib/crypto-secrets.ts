import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET nao configurada.")
  return createHash("sha256").update(secret).digest()
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, encrypted].map((buffer) => buffer.toString("base64")).join(".")
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".")
  if (parts.length !== 3) throw new Error("Credencial criptografada invalida.")
  const [ivB64, authTagB64, encryptedB64] = parts
  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(authTagB64, "base64")
  const encrypted = Buffer.from(encryptedB64, "base64")
  if (iv.length !== 12 || authTag.length !== 16 || encrypted.length === 0) {
    throw new Error("Credencial criptografada invalida.")
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}
