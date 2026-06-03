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

// Garante que o bucket existe e e publico na primeira chamada
let bucketReady = false
export async function ensureBucket() {
  if (bucketReady) return
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }))
    // Politica de leitura publica para servir arquivos diretamente
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${BUCKET}/*`],
            },
          ],
        }),
      })
    )
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