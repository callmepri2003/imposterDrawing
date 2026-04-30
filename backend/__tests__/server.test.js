import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { io as ioClient } from 'socket.io-client'
import { httpServer, _resetRateLimit } from '../server.js'
import { _clearAllRooms } from '../gameState.js'

let port
let clients = []

// Start once; re-starting breaks Socket.IO's internal listener state.
// Room state is reset between tests via _clearAllRooms.
beforeAll(async () => {
  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      port = httpServer.address().port
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise((resolve) => httpServer.close(resolve))
})

beforeEach(() => {
  _clearAllRooms()
  _resetRateLimit()
})

afterEach(async () => {
  for (const c of clients) c.disconnect()
  clients = []
  await new Promise(r => setTimeout(r, 50))
})

// ── helpers ───────────────────────────────────────────────────────────────────

function makeClient() {
  const c = ioClient(`http://localhost:${port}`, {
    transports: ['websocket'],
    reconnection: false,
  })
  clients.push(c)
  return c
}

/** Resolves with event data, rejects with Error after timeout. */
function waitFor(socket, event, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeout)
    socket.once(event, (data) => { clearTimeout(t); resolve(data) })
  })
}

/** Like waitFor but resolves with null on timeout instead of rejecting. */
function waitForOptional(socket, event, timeout = 400) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      socket.off(event, handler)
      resolve(null)
    }, timeout)
    function handler(data) { clearTimeout(t); resolve(data) }
    socket.once(event, handler)
  })
}

async function createGame(displayName = 'Alice') {
  const client = makeClient()
  await waitFor(client, 'connect')
  const p = waitFor(client, 'room_created')
  client.emit('create_room', { displayName })
  const data = await p
  return { client, ...data }
}

async function joinGame(roomCode, displayName) {
  const client = makeClient()
  await waitFor(client, 'connect')
  const p = waitFor(client, 'room_joined')
  client.emit('join_room', { displayName, roomCode })
  const data = await p
  return { client, ...data }
}

async function setupThreePlayers() {
  const a = await createGame('Alice')
  const b = await joinGame(a.roomCode, 'Bob')
  const c = await joinGame(a.roomCode, 'Carol')
  return { a, b, c, roomCode: a.roomCode }
}

async function startDrawing() {
  const { a, b, c, roomCode } = await setupThreePlayers()

  const roleP = Promise.all([
    waitFor(a.client, 'role_assigned'),
    waitFor(b.client, 'role_assigned'),
    waitFor(c.client, 'role_assigned'),
  ])
  a.client.emit('start_game', { sessionToken: a.sessionToken })
  await roleP

  // Register turn_start listener BEFORE emitting player_ready so we can't miss it
  const turnStartP = waitFor(a.client, 'turn_start')

  a.client.emit('player_ready', { sessionToken: a.sessionToken })
  b.client.emit('player_ready', { sessionToken: b.sessionToken })
  c.client.emit('player_ready', { sessionToken: c.sessionToken })

  const firstTurn = await turnStartP
  return { a, b, c, roomCode, firstTurn }
}

// ── create_room ───────────────────────────────────────────────────────────────

describe('create_room', () => {
  it('emits room_created with roomCode and sessionToken', async () => {
    const { roomCode, sessionToken, playerId } = await createGame()
    expect(roomCode).toMatch(/^[BCDFGHJKLMNPQRSTVWXYZ]{6}$/)
    expect(sessionToken).toBeTruthy()
    expect(playerId).toBeTruthy()
  })

  it('rejects empty display name', async () => {
    const client = makeClient()
    await waitFor(client, 'connect')
    const errP = waitFor(client, 'join_error')
    client.emit('create_room', { displayName: '' })
    const err = await errP
    expect(err.message).toBeTruthy()
  })
})

// ── join_room ─────────────────────────────────────────────────────────────────

describe('join_room', () => {
  it('lets a second player join and notifies existing players', async () => {
    const { client: aliceClient, roomCode } = await createGame('Alice')
    const playerJoinedP = waitFor(aliceClient, 'player_joined')
    const { playerId } = await joinGame(roomCode, 'Bob')
    const joined = await playerJoinedP
    expect(joined.player.displayName).toBe('Bob')
    expect(playerId).toBeTruthy()
  })

  it('rejects invalid room code', async () => {
    const client = makeClient()
    await waitFor(client, 'connect')
    const errP = waitFor(client, 'join_error')
    client.emit('join_room', { displayName: 'Bob', roomCode: 'ZZZZZZ' })
    const err = await errP
    expect(err.message).toMatch(/no game found/i)
  })

  it('rejects join when game has already started', async () => {
    const { a, roomCode } = await setupThreePlayers()
    const startingP = waitFor(a.client, 'game_starting')
    a.client.emit('start_game', { sessionToken: a.sessionToken })
    await startingP

    const lateClient = makeClient()
    await waitFor(lateClient, 'connect')
    const errP = waitFor(lateClient, 'join_error')
    lateClient.emit('join_room', { displayName: 'Dave', roomCode })
    const err = await errP
    expect(err.message).toMatch(/started/i)
  })
})

// ── start_game ────────────────────────────────────────────────────────────────

describe('start_game', () => {
  it('emits game_starting and role_assigned to all players', async () => {
    const { a, b, c } = await setupThreePlayers()

    const startingP = Promise.all([
      waitFor(a.client, 'game_starting'),
      waitFor(b.client, 'game_starting'),
      waitFor(c.client, 'game_starting'),
    ])
    const roleP = Promise.all([
      waitFor(a.client, 'role_assigned'),
      waitFor(b.client, 'role_assigned'),
      waitFor(c.client, 'role_assigned'),
    ])

    a.client.emit('start_game', { sessionToken: a.sessionToken })

    await startingP
    const roles = await roleP

    const imposters = roles.filter(r => r.role === 'imposter')
    const artists = roles.filter(r => r.role === 'artist')
    expect(imposters).toHaveLength(1)
    expect(artists).toHaveLength(2)
    artists.forEach(r => expect(r.word).toBeTruthy())
    expect(imposters[0].word).toBeUndefined()
  })

  it('non-host cannot start the game', async () => {
    const { a, b } = await setupThreePlayers()
    b.client.emit('start_game', { sessionToken: b.sessionToken })
    const received = await waitForOptional(a.client, 'game_starting', 400)
    expect(received).toBeNull()
  })

  it('does not start with fewer than 3 players', async () => {
    const alice = await createGame('Alice')
    await joinGame(alice.roomCode, 'Bob')
    alice.client.emit('start_game', { sessionToken: alice.sessionToken })
    const received = await waitForOptional(alice.client, 'game_starting', 400)
    expect(received).toBeNull()
  })
})

// ── drawing phase ─────────────────────────────────────────────────────────────

describe('drawing phase', () => {
  it('emits turn_start with turnSeq=1 after all players ready', async () => {
    const { firstTurn } = await startDrawing()
    expect(firstTurn.activePlayerId).toBeTruthy()
    expect(firstTurn.turnSeq).toBe(1)
    expect(firstTurn.timeoutAt).toBeGreaterThan(Date.now())
  })

  it('turn_start includes drawOrder so clients can resolve player names', async () => {
    const { firstTurn } = await startDrawing()
    expect(Array.isArray(firstTurn.drawOrder)).toBe(true)
    expect(firstTurn.drawOrder).toHaveLength(3)
    expect(firstTurn.drawOrder).toContain(firstTurn.activePlayerId)
  })

  it('does not broadcast stroke from the wrong player', async () => {
    const { a, b, c, firstTurn } = await startDrawing()
    const notActive = [a, b, c].find(x => x.playerId !== firstTurn.activePlayerId)

    notActive.client.emit('stroke_begin', { sessionToken: notActive.sessionToken, x: 0.5, y: 0.5 })

    // None of the clients should receive stroke_begin
    const [ra, rb, rc] = await Promise.all([
      waitForOptional(a.client, 'stroke_begin', 300),
      waitForOptional(b.client, 'stroke_begin', 300),
      waitForOptional(c.client, 'stroke_begin', 300),
    ])
    expect(ra).toBeNull()
    expect(rb).toBeNull()
    expect(rc).toBeNull()
  })

  it('does not advance on stale turnSeq', async () => {
    const { a, b, c, firstTurn } = await startDrawing()
    const active = [a, b, c].find(x => x.playerId === firstTurn.activePlayerId)

    // Register next turn listener BEFORE emitting so we can't miss it
    const nextTurnP = waitForOptional(a.client, 'turn_start', 400)

    active.client.emit('end_turn', {
      sessionToken: active.sessionToken,
      turnSeq: 9999,
      points: [{ x: 0.1, y: 0.2 }],
    })

    const next = await nextTurnP
    expect(next).toBeNull()
  })

  it('advances turn after valid end_turn and increments turnSeq', async () => {
    const { a, b, c, firstTurn } = await startDrawing()
    const active = [a, b, c].find(x => x.playerId === firstTurn.activePlayerId)

    // Register next turn listener BEFORE emitting end_turn
    const nextTurnP = waitFor(a.client, 'turn_start')

    active.client.emit('end_turn', {
      sessionToken: active.sessionToken,
      turnSeq: firstTurn.turnSeq,
      points: [{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.5 }],
    })

    const next = await nextTurnP
    expect(next.turnSeq).toBe(2)
  })
})

// ── disconnection ─────────────────────────────────────────────────────────────

describe('disconnection', () => {
  it('emits player_left when a player disconnects', async () => {
    const { a, c } = await setupThreePlayers()
    const leftP = waitFor(a.client, 'player_left')
    c.client.disconnect()
    clients = clients.filter(cl => cl !== c.client)
    const left = await leftP
    expect(left.playerId).toBe(c.playerId)
  })

  it('emits host_changed when host disconnects', async () => {
    const { a, b, c } = await setupThreePlayers()
    const hostChangedP = waitForOptional(b.client, 'host_changed', 1000)
    a.client.disconnect()
    clients = clients.filter(cl => cl !== a.client)
    const changed = await hostChangedP
    expect(changed).not.toBeNull()
    expect(changed.newHostId).toBeTruthy()
  })
})

// ── rejoin ────────────────────────────────────────────────────────────────────

describe('rejoin_room', () => {
  it('allows a player to rejoin with their session token', async () => {
    const alice = await createGame('Alice')
    await joinGame(alice.roomCode, 'Bob')
    await joinGame(alice.roomCode, 'Carol')

    alice.client.disconnect()
    clients = clients.filter(cl => cl !== alice.client)
    await new Promise(r => setTimeout(r, 80))

    const newClient = makeClient()
    await waitFor(newClient, 'connect')
    const rejoinP = waitFor(newClient, 'room_rejoined')
    newClient.emit('rejoin_room', { sessionToken: alice.sessionToken, roomCode: alice.roomCode })
    const rejoined = await rejoinP
    expect(rejoined.playerId).toBe(alice.playerId)
  })

  it('rejects rejoin with unknown session token', async () => {
    const { roomCode } = await createGame('Alice')
    const client = makeClient()
    await waitFor(client, 'connect')
    const errP = waitFor(client, 'join_error')
    client.emit('rejoin_room', { sessionToken: 'bad-token', roomCode })
    const err = await errP
    expect(err.message).toBeTruthy()
  })
})
