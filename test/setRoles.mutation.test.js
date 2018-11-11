const assert = require('assert')
const { unparse } = require('uuid-parse')
const supertest = require('supertest')
const createApp = require('../app')
const { createSetup, getAuthPassword } = require('./lib')
const { createPlayer } = require('./fixtures')
const { insert } = require('../data/udify')

describe('Mutation setRoles', function () {
  let setup
  let server
  let request

  before(async function () {
    setup = await createSetup()
    const app = await createApp(setup.dbPool, setup.logger, setup.serversPool)

    server = app.listen()
    request = supertest(server)
  })

  after(async function () {
    await setup.teardown()
    await server.close()
  })

  it('should error if unauthenticated', async function () {
    const { pool } = setup.serversPool.values().next().value
    const player = createPlayer()

    await insert(pool, 'bm_players', player)

    const { body, statusCode } = await request
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({ query: `mutation setRoles {
        setRoles(player:"${unparse(player.id)}", input: { roles: [], serverRoles: [] }) {
          id
        }
      }`})

    assert.equal(statusCode, 200)

    assert(body)
    assert.strictEqual(body.errors[0].message,
      'You do not have permission to perform this action, please contact your server administrator')
  })

  it('should require servers.manage permission', async function () {
    const cookie = await getAuthPassword(request, 'user@banmanagement.com')
    const { pool } = setup.serversPool.values().next().value
    const player = createPlayer()

    await insert(pool, 'bm_players', player)

    const { body, statusCode } = await request
      .post('/graphql')
      .set('Cookie', cookie)
      .set('Accept', 'application/json')
      .send({ query: `mutation setRoles {
        setRoles(player:"${unparse(player.id)}", input: { roles: [], serverRoles: [] }) {
          id
        }
      }`})

    assert.equal(statusCode, 200)

    assert(body)
    assert.strictEqual(body.errors[0].message,
      'You do not have permission to perform this action, please contact your server administrator')
  })

  it('should error if role does not exist', async function () {
    const cookie = await getAuthPassword(request, 'admin@banmanagement.com')
    const { pool } = setup.serversPool.values().next().value
    const player = createPlayer()

    await insert(pool, 'bm_players', player)

    const { body, statusCode } = await request
      .post('/graphql')
      .set('Cookie', cookie)
      .set('Accept', 'application/json')
      .send({ query: `mutation assignRole {
        setRoles(player:"${unparse(player.id)}", input: { roles: [ { id: 123123 } ], serverRoles: [] }) {
          id
        }
      }`})

    assert.equal(statusCode, 200)

    assert(body)
    assert.strictEqual(body.errors[0].message, 'Invalid role provided')
  })

  it('should error if server role does not exist', async function () {
    const cookie = await getAuthPassword(request, 'admin@banmanagement.com')
    const { config, pool } = setup.serversPool.values().next().value
    const player = createPlayer()

    await insert(pool, 'bm_players', player)

    const { body, statusCode } = await request
      .post('/graphql')
      .set('Cookie', cookie)
      .set('Accept', 'application/json')
      .send({ query: `mutation assignRole {
        setRoles(player:"${unparse(player.id)}", input: { roles: [], serverRoles: [ { role: { id: 123123 }, server: { id: "${config.id}" } } ] }) {
          id
        }
      }`})

    assert.equal(statusCode, 200)

    assert(body)
    assert.strictEqual(body.errors[0].message, 'Invalid role provided')
  })

  it('should error if server does not exist', async function () {
    const cookie = await getAuthPassword(request, 'admin@banmanagement.com')
    const { pool } = setup.serversPool.values().next().value
    const player = createPlayer()

    await insert(pool, 'bm_players', player)

    const { body, statusCode } = await request
      .post('/graphql')
      .set('Cookie', cookie)
      .set('Accept', 'application/json')
      .send({ query: `mutation assignRole {
        setRoles(player:"${unparse(player.id)}", input: { roles: [], serverRoles: [ { role: { id: 1 }, server: { id: "123" } } ] }) {
          id
        }
      }`})

    assert.equal(statusCode, 200)

    assert(body)
    assert.strictEqual(body.errors[0].message, 'Server 123 does not exist')
  })

  it('should set a players role', async function () {
    const cookie = await getAuthPassword(request, 'admin@banmanagement.com')
    const { config, pool } = setup.serversPool.values().next().value
    const player = createPlayer()

    await insert(pool, 'bm_players', player)

    const { body, statusCode } = await request
      .post('/graphql')
      .set('Cookie', cookie)
      .set('Accept', 'application/json')
      .send({ query: `mutation assignRole {
        setRoles(player:"${unparse(player.id)}", input: { roles: [ { id: 3 } ], serverRoles: [ { role: { id: 2 }, server: { id: "${config.id}" } } ] }) {
          roles {
            id
          }
          serverRoles {
            role {
              id
            }
            server {
              id
            }
          }
        }
      }`})

    assert.equal(statusCode, 200)

    assert(body)
    assert(body.data)

    assert.deepStrictEqual(body.data.setRoles.roles, [ { id: '3' }])
    assert.deepStrictEqual(body.data.setRoles.serverRoles, [ { role: { id: '2' }, server: { id: config.id } } ])
  })
})
