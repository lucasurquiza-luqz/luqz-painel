import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const legacyTables = [
  "Client",
  "User",
  "Group",
  "ScheduledMessage",
  "GroupMessage",
  "MessageLog",
  "WaConversation",
  "WaMessage",
]

try {
  const tables = await prisma.$queryRaw`
    SELECT table_name AS "tableName"
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `
  const tableNames = new Set(tables.map((row) => row.tableName))

  if (tableNames.has("_prisma_migrations")) {
    console.log("[luqz-dash] histórico de migrations encontrado")
    process.exitCode = 0
  } else if (tableNames.size === 0) {
    console.log("[luqz-dash] banco vazio; baseline será aplicado normalmente")
    process.exitCode = 0
  } else {
    const missingLegacyTables = legacyTables.filter((table) => !tableNames.has(table))
    const partiallyMigrated = [
      "ContextSource",
      "ContextItem",
      "ContextSnapshot",
      "ContextSnapshotItem",
      "ClientStatusHistory",
    ].some((table) => tableNames.has(table))

    const statusColumns = await prisma.$queryRaw`
      SELECT column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Client'
        AND column_name IN ('clickupFolderId', 'statusReason', 'statusChangedAt')
    `

    if (
      missingLegacyTables.length === 0 &&
      !partiallyMigrated &&
      statusColumns.length === 0
    ) {
      console.log("[luqz-dash] schema legado reconhecido e íntegro")
      process.exitCode = 42
    } else {
      console.error("[luqz-dash] schema não corresponde ao legado esperado")
      if (missingLegacyTables.length > 0) {
        console.error(`[luqz-dash] tabelas legadas ausentes: ${missingLegacyTables.join(", ")}`)
      }
      if (partiallyMigrated || statusColumns.length > 0) {
        console.error("[luqz-dash] foram detectados sinais de migration parcial")
      }
      process.exitCode = 1
    }
  }
} catch (error) {
  console.error("[luqz-dash] não foi possível inspecionar o schema do banco")
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
