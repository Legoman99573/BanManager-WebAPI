const { createConnection } = require('mysql2/promise')
const { encrypt } = require('../../../data/crypto')
const { parse } = require('uuid-parse')
const udify = require('../../../data/udify')
const ExposedError = require('../../../data/exposed-error')
const tables = require('../../../data/tables')

module.exports = async function updateServer (obj, { id, input }, { state }) {
  if (!state.serversPool.has(id)) throw new ExposedError('Server not found')

  // @TODO Check if connection details changed to avoid needing password to change server name
  const conn = await createConnection(input)

  const tablesMissing = await Promise.reduce(tables, async (missing, table) => {
    const [[{ exists }]] = await conn.execute(
      'SELECT COUNT(*) AS `exists` FROM information_schema.tables WHERE table_schema = ? AND table_name = ?'
      , [input.database, input.tables[table]])

    if (!exists) missing.push(table)

    return missing
  }, [])

  if (tablesMissing.length) {
    conn.end()
    throw new ExposedError(`Tables do not exist in the database: ${tablesMissing.join(', ')}`)
  }

  const [[exists]] = await conn.query(
    'SELECT id FROM ?? WHERE id = ?'
    , [input.tables.players, parse(input.console, Buffer.alloc(16))])

  conn.end()

  if (!exists) {
    throw new ExposedError(`Console UUID not found in ${input.tables.players} table`)
  }

  if (input.password) {
    input.password = await encrypt(process.env.ENCRYPTION_KEY, input.password)
  } else {
    input.password = ''
  }

  // Clean up
  input.console = parse(input.console, Buffer.alloc(16))
  input.tables = JSON.stringify(input.tables)

  await udify.update(state.dbPool, 'bm_web_servers', input, { id })

  return { id }
}
