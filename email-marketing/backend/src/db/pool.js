import pg from 'pg'
import { env } from '../config/env.js'

// Pool de connexions partagé. `query` est un raccourci ; `tx` enveloppe une
// transaction (BEGIN/COMMIT/ROLLBACK) autour d'un callback recevant le client.
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
})

pool.on('error', (err) => {
  console.error('[db] erreur client inattendue', err)
})

export const query = (text, params) => pool.query(text, params)

export async function tx(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
