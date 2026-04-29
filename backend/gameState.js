import { v4 as uuidv4 } from 'uuid'

/** @type {Map<string, import('./types.js').Room>} */
const rooms = new Map()

/** @type {Map<string, { roomCode: string, playerId: string }>} */
const sessionIndex = new Map()

const ROOM_CHARSET = 'BCDFGHJKLMNPQRSTVWXYZ'

export function generateRoomCode() {
  let code
  let attempts = 0
  do {
    code = Array.from({ length: 6 }, () =>
      ROOM_CHARSET[Math.floor(Math.random() * ROOM_CHARSET.length)]
    ).join('')
    attempts++
    if (attempts > 1000) throw new Error('Could not generate unique room code')
  } while (rooms.has(code))
  return code
}

export function createRoom(displayName, socketId) {
  const roomCode = generateRoomCode()
  const playerId = uuidv4()
  const sessionToken = uuidv4()

  const player = {
    id: playerId,
    displayName,
    socketId,
    sessionToken,
    isHost: true,
    isConnected: true,
  }

  const room = {
    roomCode,
    hostId: playerId,
    phase: 'lobby',
    players: new Map([[playerId, player]]),
    drawOrder: [],
    currentTurnIdx: -1,
    turnSeq: 0,
    rotationsLeft: 2,
    currentWord: '',
    imposterId: null,
    strokes: [],
    votes: new Map(),
    readyPlayers: new Set(),
  }

  rooms.set(roomCode, room)
  sessionIndex.set(sessionToken, { roomCode, playerId })

  return { room, player }
}

export function joinRoom(room, displayName, socketId) {
  const playerId = uuidv4()
  const sessionToken = uuidv4()

  const player = {
    id: playerId,
    displayName,
    socketId,
    sessionToken,
    isHost: false,
    isConnected: true,
  }

  room.players.set(playerId, player)
  sessionIndex.set(sessionToken, { roomCode: room.roomCode, playerId })

  return player
}

export function getRoomByCode(roomCode) {
  return rooms.get(roomCode?.toUpperCase()) ?? null
}

export function getRoomBySessionToken(sessionToken) {
  const entry = sessionIndex.get(sessionToken)
  if (!entry) return null
  const room = rooms.get(entry.roomCode)
  if (!room) return null
  const player = room.players.get(entry.playerId)
  if (!player) return null
  return { room, player }
}

export function getAllRooms() {
  return Array.from(rooms.values())
}

export function destroyRoom(db, roomCode) {
  const room = rooms.get(roomCode)
  if (!room) return
  for (const player of room.players.values()) {
    sessionIndex.delete(player.sessionToken)
  }
  rooms.delete(roomCode)
  if (db) {
    db.prepare('DELETE FROM rooms WHERE room_code = ?').run(roomCode)
  }
}

export function persistRoom(db, room) {
  if (!db) return
  const state = {
    roomCode: room.roomCode,
    hostId: room.hostId,
    phase: room.phase,
    players: Array.from(room.players.entries()).map(([id, p]) => [id, {
      id: p.id,
      displayName: p.displayName,
      sessionToken: p.sessionToken,
      isHost: p.isHost,
      isConnected: false,
      socketId: null,
    }]),
    drawOrder: room.drawOrder,
    currentTurnIdx: room.currentTurnIdx,
    turnSeq: room.turnSeq,
    rotationsLeft: room.rotationsLeft,
    currentWord: room.currentWord,
    imposterId: room.imposterId,
    strokes: room.strokes,
    votes: Array.from(room.votes.entries()),
    readyPlayers: Array.from(room.readyPlayers),
  }
  db.prepare(
    'INSERT OR REPLACE INTO rooms (room_code, state_json, updated_at) VALUES (?, ?, ?)'
  ).run(room.roomCode, JSON.stringify(state), Date.now())
}

export function loadRooms(db) {
  if (!db) return
  const rows = db.prepare('SELECT state_json FROM rooms').all()
  for (const row of rows) {
    try {
      const state = JSON.parse(row.state_json)
      const room = {
        roomCode: state.roomCode,
        hostId: state.hostId,
        phase: state.phase,
        players: new Map(
          state.players.map(([id, p]) => [id, { ...p, isConnected: false, socketId: null }])
        ),
        drawOrder: state.drawOrder,
        currentTurnIdx: state.currentTurnIdx,
        turnSeq: state.turnSeq,
        rotationsLeft: state.rotationsLeft,
        currentWord: state.currentWord,
        imposterId: state.imposterId,
        strokes: state.strokes,
        votes: new Map(state.votes),
        readyPlayers: new Set(state.readyPlayers),
      }
      rooms.set(room.roomCode, room)
      for (const player of room.players.values()) {
        sessionIndex.set(player.sessionToken, { roomCode: room.roomCode, playerId: player.id })
      }
    } catch (e) {
      console.error('Failed to load room from DB:', e.message)
    }
  }
}

export function _clearAllRooms() {
  rooms.clear()
  sessionIndex.clear()
}
