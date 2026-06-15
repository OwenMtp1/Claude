import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

// Applique db/schema.sql (idempotent : create table if not exists).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.resolve(__dirname, '../../../db/schema.sql')

async function main() {
  const sql = fs.readFileSync(schemaPath, 'utf8')
  console.log(`[migrate] application de ${schemaPath}`)
  await pool.query(sql)
  console.log('[migrate] terminé ✓')
  await pool.end()
}

main().catch((e) => {
  console.error('[migrate] échec', e)
  process.exit(1)
})
