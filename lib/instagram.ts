// Publicação no Instagram via Graph API oficial (Content Publishing).
// As imagens já chegam como URLs públicas JPEG (MinIO); aqui só criamos os
// containers e publicamos. Suporta imagem única (frase) e carrossel (2-10).

const IG_BASE = "https://graph.facebook.com/v21.0"

async function apiPost(path: string, params: Record<string, string>) {
  const res = await fetch(`${IG_BASE}/${path}?${new URLSearchParams(params)}`, { method: "POST" })
  if (!res.ok) throw new Error(`${path} [${res.status}]: ${await res.text()}`)
  return res.json() as Promise<{ id: string }>
}

async function apiGet(path: string, params: Record<string, string>) {
  const res = await fetch(`${IG_BASE}/${path}?${new URLSearchParams(params)}`)
  if (!res.ok) throw new Error(`${path} [${res.status}]: ${await res.text()}`)
  return res.json()
}

// Containers de mídia processam de forma assíncrona; esperamos ficar FINISHED.
async function pollUntilFinished(id: string, token: string, timeoutMs = 90_000, intervalMs = 3_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { status_code } = (await apiGet(id, { fields: "status_code", access_token: token })) as {
      status_code?: string
    }
    if (status_code === "FINISHED") return
    if (status_code === "ERROR") throw new Error(`Container ${id} entrou em ERROR`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Container ${id} deu timeout`)
}

export type PublishResult = { mediaId: string; permalink: string | null }

export async function publishToInstagram(opts: {
  igUserId: string
  token: string
  imageUrls: string[]
  caption: string
}): Promise<PublishResult> {
  const { igUserId, token, imageUrls, caption } = opts

  if (imageUrls.length < 1 || imageUrls.length > 10) {
    throw new Error(`Instagram aceita 1-10 imagens (recebi ${imageUrls.length})`)
  }
  if (caption.length > 2200) {
    throw new Error(`Legenda passa de 2200 chars (${caption.length})`)
  }

  let creationId: string

  if (imageUrls.length === 1) {
    // Imagem única (frase)
    const { id } = await apiPost(`${igUserId}/media`, {
      image_url: imageUrls[0],
      caption,
      access_token: token,
    })
    await pollUntilFinished(id, token)
    creationId = id
  } else {
    // Carrossel: containers filhos → container do álbum
    const childIds: string[] = []
    for (const url of imageUrls) {
      const { id } = await apiPost(`${igUserId}/media`, {
        image_url: url,
        is_carousel_item: "true",
        access_token: token,
      })
      childIds.push(id)
    }
    for (const id of childIds) await pollUntilFinished(id, token)

    const { id } = await apiPost(`${igUserId}/media`, {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
      access_token: token,
    })
    await pollUntilFinished(id, token)
    creationId = id
  }

  const { id: mediaId } = await apiPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  })

  let permalink: string | null = null
  try {
    const info = (await apiGet(mediaId, { fields: "permalink", access_token: token })) as {
      permalink?: string
    }
    permalink = info.permalink ?? null
  } catch {
    // permalink é não-crítico
  }

  return { mediaId, permalink }
}
