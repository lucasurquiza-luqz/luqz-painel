import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const BUCKET = process.env.MINIO_BUCKET ?? "luqz-painel"
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL ?? ""

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT,
  region: "us-east-1", // MinIO ignora mas o SDK exige
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true, // obrigatorio para MinIO
})

// Cliente para ASSINAR URLs que o navegador vai usar (upload direto).
// Precisa apontar para o host PUBLICO do MinIO, senao a URL assinada nao e alcancavel.
const s3Public = new S3Client({
  endpoint: process.env.MINIO_PUBLIC_URL || process.env.MINIO_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,
})

// Politica de leitura publica (anonima) para servir arquivos direto pelo navegador.
const PUBLIC_READ_POLICY = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { AWS: ["*"] },
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${BUCKET}/*`],
    },
  ],
})

// Garante que o bucket existe E que a leitura publica esta aplicada.
// Idempotente: aplica a politica mesmo em bucket pre-existente (criado na mao).
let bucketReady = false
export async function ensureBucket() {
  if (bucketReady) return
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }))
  }
  // Sempre (re)aplica a politica de leitura publica — cobre bucket criado manualmente.
  try {
    await s3.send(new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: PUBLIC_READ_POLICY }))
  } catch (err) {
    console.error("[storage] Falha ao aplicar politica de leitura publica:", err)
  }
  bucketReady = true
}

export async function uploadToMinIO(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await ensureBucket()
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )
  return `${PUBLIC_URL}/${BUCKET}/${key}`
}

export async function uploadBase64ToMinIO(
  key: string,
  base64: string,
  contentType: string
): Promise<string> {
  // Remove prefixo "data:image/jpeg;base64," se existir
  const data = base64.replace(/^data:[^;]+;base64,/, "")
  const buffer = Buffer.from(data, "base64")
  return uploadToMinIO(key, buffer, contentType)
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3, cmd, { expiresIn })
}

export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${BUCKET}/${key}`
}

// URL assinada para UPLOAD direto do navegador (PUT), sem passar pelo app/proxy.
// Ideal para arquivos grandes (ex.: vídeo de Reel). Retorna a URL de upload e a URL pública final.
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 900
): Promise<{ uploadUrl: string; publicUrl: string }> {
  await ensureBucket()
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType })
  const uploadUrl = await getSignedUrl(s3Public, cmd, { expiresIn })
  return { uploadUrl, publicUrl: `${PUBLIC_URL}/${BUCKET}/${key}` }
}