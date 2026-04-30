import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'
import {
  createRoom,
  joinRoom,
  getRoomByCode,
  getRoomBySessionToken,
  getAllRooms,
  destroyRoom,
  persistRoom,
  loadRooms,
} from './gameState.js'
import { pickWord } from './words.js'

const app = express()
const httpServer = createServer(app)

export const io = new Server(httpServer, {
  transports: ['websocket'],
  pingTimeout: 8000,
  pingInterval: 3000,
  cors: { origin: '*' },
})

// Persistence is intentionally a no-op stub (db = null).
// Rooms live in process memory; state survives socket reconnects
// but not server restarts. For crash durability, wire in a SQLite
// adapter here (better-sqlite3 requires prebuilts for the target Node version).
export const db = null
loadRooms(db)

app.get('/health', (_req, res) => res.json({ ok: true }))

// In-process rate limiting: 10 join/create attempts per IP per minute
const joinAttempts = new Map()

function checkRateLimit(ip) {
  const now = Date.now()
  let entry = joinAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 }
  }
  entry.count++
  joinAttempts.set(ip, entry)
  return entry.count <= 10
}

export function _resetRateLimit() {
  joinAttempts.clear()
}

// Turn timers: roomCode -> Timeout
const turnTimers = new Map()
const votingTimers = new Map()

function clearTurnTimer(roomCode) {
  const t = turnTimers.get(roomCode)
  if (t) { clearTimeout(t); turnTimers.delete(roomCode) }
}

function clearVotingTimer(roomCode) {
  const t = votingTimers.get(roomCode)
  if (t) { clearTimeout(t); votingTimers.delete(roomCode) }
}

function serializePlayer(p) {
  return { id: p.id, displayName: p.displayName, isConnected: p.isConnected, isHost: p.isHost }
}

function serializeRoom(room) {
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    phase: room.phase,
    players: Array.from(room.players.values()).map(serializePlayer),
    drawOrder: room.drawOrder,
    currentTurnIdx: room.currentTurnIdx,
    turnSeq: room.turnSeq,
    strokes: room.strokes,
    readyCount: room.readyPlayers?.size ?? 0,
  }
}

function connectedPlayers(room) {
  return Array.from(room.players.values()).filter(p => p.isConnected)
}

export function startTurn(room) {
  room.turnSeq++
  const activePlayerId = room.drawOrder[room.currentTurnIdx]
  const TURN_MS = 30_000
  const timeoutAt = Date.now() + TURN_MS

  io.to(room.roomCode).emit('turn_start', {
    activePlayerId,
    drawOrder: room.drawOrder,
    turnSeq: room.turnSeq,
    turnNumber: room.currentTurnIdx + 1,
    totalTurns: room.drawOrder.length,
    roundNumber: 3 - room.rotationsLeft,
    totalRounds: 2,
    timeoutAt,
  })

  persistRoom(db, room)

  const seq = room.turnSeq
  const code = room.roomCode
  const t = setTimeout(() => {
    const r = getRoomByCode(code)
    if (r && r.phase === 'drawing' && r.turnSeq === seq) {
      advanceTurn(r)
    }
  }, TURN_MS + 3_000)
  turnTimers.set(room.roomCode, t)
}

export function advanceTurn(room) {
  clearTurnTimer(room.roomCode)

  if (connectedPlayers(room).length < 3) {
    abortGame(room, 'not_enough_players')
    return
  }

  let steps = 0
  const total = room.drawOrder.length
  do {
    room.currentTurnIdx = (room.currentTurnIdx + 1) % total
    if (room.currentTurnIdx === 0) room.rotationsLeft--
    steps++
  } while (
    steps <= total &&
    !room.players.get(room.drawOrder[room.currentTurnIdx])?.isConnected
  )

  if (room.rotationsLeft <= 0) {
    startVoting(room)
    return
  }

  startTurn(room)
}

export function startVoting(room) {
  clearTurnTimer(room.roomCode)
  room.phase = 'voting'
  room.votes = new Map()

  const VOTING_MS = 45_000
  const timeoutAt = Date.now() + VOTING_MS
  const players = Array.from(room.players.values()).map(serializePlayer)

  io.to(room.roomCode).emit('voting_start', { players, timeoutAt })
  persistRoom(db, room)

  const code = room.roomCode
  const t = setTimeout(() => {
    const r = getRoomByCode(code)
    if (r && r.phase === 'voting') finalizeVoting(r)
  }, VOTING_MS + 3_000)
  votingTimers.set(room.roomCode, t)
}

export function finalizeVoting(room) {
  clearVotingTimer(room.roomCode)
  room.phase = 'reveal'

  const counts = new Map()
  for (const targetId of room.votes.values()) {
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1)
  }

  let maxVotes = 0
  let accusedId = null
  for (const [pid, count] of counts) {
    if (count > maxVotes) { maxVotes = count; accusedId = pid }
  }

  const outcome = accusedId === room.imposterId ? 'caught' : 'escaped'

  const votesPayload = {}
  for (const [pid, count] of counts) {
    const voterIds = Array.from(room.votes.entries())
      .filter(([, t]) => t === pid)
      .map(([v]) => v)
    votesPayload[pid] = { count, voterIds }
  }

  const imposter = room.players.get(room.imposterId)
  io.to(room.roomCode).emit('reveal', {
    imposterId: room.imposterId,
    imposterName: imposter?.displayName ?? 'Unknown',
    secretWord: room.currentWord,
    votes: votesPayload,
    outcome,
  })

  persistRoom(db, room)
}

function abortGame(room, reason) {
  clearTurnTimer(room.roomCode)
  clearVotingTimer(room.roomCode)
  room.phase = 'lobby'
  io.to(room.roomCode).emit('game_aborted', { reason })
  persistRoom(db, room)
}

function handleDisconnect(room, player) {
  player.isConnected = false
  io.to(room.roomCode).emit('player_left', { playerId: player.id })

  // Transfer host if needed
  if (room.hostId === player.id) {
    const next = Array.from(room.players.values()).find(p => p.id !== player.id && p.isConnected)
    if (next) {
      room.hostId = next.id
      next.isHost = true
      io.to(room.roomCode).emit('host_changed', { newHostId: next.id })
    }
  }

  const connected = connectedPlayers(room)
  if (connected.length === 0) {
    destroyRoom(db, room.roomCode)
    return
  }

  if (room.phase === 'drawing') {
    if (room.drawOrder[room.currentTurnIdx] === player.id) {
      advanceTurn(room)
    } else if (connected.length < 3) {
      abortGame(room, 'not_enough_players')
    } else {
      persistRoom(db, room)
    }
  } else if (room.phase === 'voting') {
    if (connected.length < 3) {
      abortGame(room, 'not_enough_players')
    } else {
      const allVoted = connected.every(p => room.votes.has(p.id))
      if (allVoted && room.votes.size > 0) finalizeVoting(room)
      else persistRoom(db, room)
    }
  } else {
    persistRoom(db, room)
  }
}

io.on('connection', (socket) => {
  const clientIp = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim()
    ?? socket.handshake.address

  function guard(sessionToken) {
    return getRoomBySessionToken(sessionToken) ?? {}
  }

  socket.on('create_room', ({ displayName } = {}) => {
    if (!checkRateLimit(clientIp)) {
      socket.emit('join_error', { message: 'Too many attempts. Try again in a minute.' })
      return
    }
    const name = displayName?.trim()
    if (!name) { socket.emit('join_error', { message: 'Display name required.' }); return }

    const { room, player } = createRoom(name, socket.id)
    socket.join(room.roomCode)
    persistRoom(db, room)

    socket.emit('room_created', {
      roomCode: room.roomCode,
      sessionToken: player.sessionToken,
      playerId: player.id,
      roomState: serializeRoom(room),
    })
  })

  socket.on('join_room', ({ displayName, roomCode } = {}) => {
    if (!checkRateLimit(clientIp)) {
      socket.emit('join_error', { message: 'Too many attempts. Try again in a minute.' })
      return
    }
    const name = displayName?.trim()
    const code = roomCode?.trim().toUpperCase()
    if (!name || !code) { socket.emit('join_error', { message: 'Name and code required.' }); return }

    const room = getRoomByCode(code)
    if (!room) { socket.emit('join_error', { message: 'No game found with that code.' }); return }
    if (room.phase !== 'lobby') { socket.emit('join_error', { message: 'This game has already started.' }); return }
    if (room.players.size >= 8) { socket.emit('join_error', { message: 'This game is full.' }); return }

    const player = joinRoom(room, name, socket.id)
    socket.join(room.roomCode)
    persistRoom(db, room)

    socket.emit('room_joined', {
      sessionToken: player.sessionToken,
      playerId: player.id,
      roomState: serializeRoom(room),
    })
    socket.to(room.roomCode).emit('player_joined', { player: serializePlayer(player) })
  })

  socket.on('rejoin_room', ({ sessionToken, roomCode } = {}) => {
    const room = getRoomByCode(roomCode)
    if (!room) { socket.emit('join_error', { message: 'Game not found.' }); return }

    let found = null
    for (const p of room.players.values()) {
      if (p.sessionToken === sessionToken) { found = p; break }
    }
    if (!found) { socket.emit('join_error', { message: 'Session not found.' }); return }

    found.socketId = socket.id
    found.isConnected = true
    socket.join(room.roomCode)
    persistRoom(db, room)

    socket.emit('room_rejoined', {
      sessionToken,
      playerId: found.id,
      roomState: serializeRoom(room),
    })
    socket.to(room.roomCode).emit('player_joined', { player: serializePlayer(found) })
  })

  socket.on('start_game', ({ sessionToken } = {}) => {
    const { room, player } = guard(sessionToken)
    if (!room || !player?.isHost || room.phase !== 'lobby') return

    const connected = connectedPlayers(room)
    if (connected.length < 3) return

    room.phase = 'word_assignment'
    room.currentWord = pickWord()
    room.imposterId = connected[Math.floor(Math.random() * connected.length)].id
    room.drawOrder = connected.map(p => p.id).sort(() => Math.random() - 0.5)
    room.currentTurnIdx = -1
    room.turnSeq = 0
    room.rotationsLeft = 2
    room.strokes = []
    room.votes = new Map()
    room.readyPlayers = new Set()

    io.to(room.roomCode).emit('game_starting')

    for (const p of connected) {
      const s = io.sockets.sockets.get(p.socketId)
      if (!s) continue
      if (p.id === room.imposterId) {
        s.emit('role_assigned', { role: 'imposter' })
      } else {
        s.emit('role_assigned', { role: 'artist', word: room.currentWord })
      }
    }

    persistRoom(db, room)
  })

  socket.on('player_ready', ({ sessionToken } = {}) => {
    const { room, player } = guard(sessionToken)
    if (!room || !player || room.phase !== 'word_assignment') return

    room.readyPlayers.add(player.id)
    const total = connectedPlayers(room).length

    io.to(room.roomCode).emit('ready_update', {
      readyCount: room.readyPlayers.size,
      totalCount: total,
    })

    if (room.readyPlayers.size >= total) {
      room.phase = 'drawing'
      io.to(room.roomCode).emit('all_ready')
      persistRoom(db, room)
      advanceTurn(room)
    }
  })

  socket.on('stroke_begin', ({ sessionToken, x, y } = {}) => {
    const { room, player } = guard(sessionToken)
    if (!room || !player || room.phase !== 'drawing') return
    if (room.drawOrder[room.currentTurnIdx] !== player.id) return
    socket.to(room.roomCode).emit('stroke_begin', { playerId: player.id, x, y })
  })

  socket.on('stroke_point', ({ sessionToken, x, y } = {}) => {
    const { room, player } = guard(sessionToken)
    if (!room || !player || room.phase !== 'drawing') return
    if (room.drawOrder[room.currentTurnIdx] !== player.id) return
    socket.to(room.roomCode).emit('stroke_point', { playerId: player.id, x, y })
  })

  socket.on('end_turn', ({ sessionToken, turnSeq, points, color, width } = {}) => {
    const { room, player } = guard(sessionToken)
    if (!room || !player || room.phase !== 'drawing') return
    if (room.drawOrder[room.currentTurnIdx] !== player.id) return
    if (turnSeq !== room.turnSeq) return

    clearTurnTimer(room.roomCode)

    if (Array.isArray(points) && points.length > 0) {
      const stroke = {
        id: uuidv4(),
        playerId: player.id,
        points,
        color: color ?? '#000000',
        width: width ?? 4,
      }
      room.strokes.push(stroke)
      io.to(room.roomCode).emit('stroke_end', {
        playerId: player.id,
        points: stroke.points,
        color: stroke.color,
        width: stroke.width,
      })
    }

    advanceTurn(room)
  })

  socket.on('submit_vote', ({ sessionToken, targetPlayerId } = {}) => {
    const { room, player } = guard(sessionToken)
    if (!room || !player || room.phase !== 'voting') return
    if (player.id === targetPlayerId) return
    if (room.votes.has(player.id)) return
    if (!room.players.has(targetPlayerId)) return

    room.votes.set(player.id, targetPlayerId)
    const total = connectedPlayers(room).length

    io.to(room.roomCode).emit('vote_count_update', {
      votedCount: room.votes.size,
      totalCount: total,
    })

    persistRoom(db, room)

    if (room.votes.size >= total) finalizeVoting(room)
  })

  socket.on('play_again', ({ sessionToken } = {}) => {
    const { room, player } = guard(sessionToken)
    if (!room || !player?.isHost || room.phase !== 'reveal') return

    room.phase = 'lobby'
    room.strokes = []
    room.votes = new Map()
    room.currentWord = ''
    room.imposterId = null
    room.drawOrder = []
    room.readyPlayers = new Set()

    io.to(room.roomCode).emit('game_reset')
    persistRoom(db, room)
  })

  socket.on('leave_room', ({ sessionToken } = {}) => {
    const { room, player } = guard(sessionToken)
    if (room && player) handleDisconnect(room, player)
  })

  socket.on('disconnect', () => {
    for (const room of getAllRooms()) {
      for (const p of room.players.values()) {
        if (p.socketId === socket.id && p.isConnected) {
          handleDisconnect(room, p)
          return
        }
      }
    }
  })
})

const PORT = process.env.PORT ?? 3000
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => console.log(`Server on port ${PORT}`))
}

export { app, httpServer }
