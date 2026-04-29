import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createRoom,
  joinRoom,
  getRoomByCode,
  getRoomBySessionToken,
  getAllRooms,
  destroyRoom,
  generateRoomCode,
  persistRoom,
  loadRooms,
  _clearAllRooms,
} from '../gameState.js'

beforeEach(() => {
  _clearAllRooms()
})

describe('generateRoomCode', () => {
  it('generates a 6-character code', () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(6)
  })

  it('uses only allowed characters', () => {
    const code = generateRoomCode()
    expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXYZ]{6}$/)
  })

  it('generates unique codes for different rooms', () => {
    const codes = new Set()
    for (let i = 0; i < 10; i++) {
      const { room } = createRoom(`Player${i}`, `socket${i}`)
      codes.add(room.roomCode)
    }
    expect(codes.size).toBe(10)
  })
})

describe('createRoom', () => {
  it('creates a room with the host player', () => {
    const { room, player } = createRoom('Alice', 'socket-1')
    expect(room.roomCode).toHaveLength(6)
    expect(room.phase).toBe('lobby')
    expect(room.players.size).toBe(1)
    expect(player.displayName).toBe('Alice')
    expect(player.isHost).toBe(true)
    expect(player.isConnected).toBe(true)
    expect(player.sessionToken).toBeTruthy()
  })

  it('stores the room so it can be retrieved by code', () => {
    const { room } = createRoom('Alice', 'socket-1')
    const found = getRoomByCode(room.roomCode)
    expect(found).toBe(room)
  })

  it('is case-insensitive for code lookup', () => {
    const { room } = createRoom('Alice', 'socket-1')
    expect(getRoomByCode(room.roomCode.toLowerCase())).toBe(room)
  })
})

describe('joinRoom', () => {
  it('adds a second player to the room', () => {
    const { room } = createRoom('Alice', 'socket-1')
    const player = joinRoom(room, 'Bob', 'socket-2')
    expect(room.players.size).toBe(2)
    expect(player.displayName).toBe('Bob')
    expect(player.isHost).toBe(false)
    expect(player.isConnected).toBe(true)
    expect(player.sessionToken).toBeTruthy()
  })

  it('assigns unique IDs and session tokens', () => {
    const { room } = createRoom('Alice', 'socket-1')
    const bob = joinRoom(room, 'Bob', 'socket-2')
    const carol = joinRoom(room, 'Carol', 'socket-3')
    expect(bob.id).not.toBe(carol.id)
    expect(bob.sessionToken).not.toBe(carol.sessionToken)
  })
})

describe('getRoomBySessionToken', () => {
  it('finds the room and player by session token', () => {
    const { room, player } = createRoom('Alice', 'socket-1')
    const result = getRoomBySessionToken(player.sessionToken)
    expect(result?.room).toBe(room)
    expect(result?.player).toBe(player)
  })

  it('returns null for unknown token', () => {
    expect(getRoomBySessionToken('bad-token')).toBeNull()
  })

  it('returns null for empty token', () => {
    expect(getRoomBySessionToken('')).toBeNull()
    expect(getRoomBySessionToken(undefined)).toBeNull()
  })
})

describe('getRoomByCode', () => {
  it('returns null for unknown code', () => {
    expect(getRoomByCode('XXXXXX')).toBeNull()
  })

  it('returns null for empty code', () => {
    expect(getRoomByCode('')).toBeNull()
    expect(getRoomByCode(undefined)).toBeNull()
  })
})

describe('getAllRooms', () => {
  it('returns all rooms', () => {
    createRoom('Alice', 's1')
    createRoom('Bob', 's2')
    expect(getAllRooms().length).toBe(2)
  })

  it('returns empty array when no rooms', () => {
    expect(getAllRooms()).toEqual([])
  })
})

describe('destroyRoom', () => {
  it('removes the room', () => {
    const { room } = createRoom('Alice', 's1')
    destroyRoom(null, room.roomCode)
    expect(getRoomByCode(room.roomCode)).toBeNull()
    expect(getAllRooms()).toHaveLength(0)
  })

  it('removes session token entries', () => {
    const { room, player } = createRoom('Alice', 's1')
    destroyRoom(null, room.roomCode)
    expect(getRoomBySessionToken(player.sessionToken)).toBeNull()
  })

  it('is a no-op for unknown room code', () => {
    expect(() => destroyRoom(null, 'XXXXXX')).not.toThrow()
  })

  it('calls db.prepare when db is provided', () => {
    const { room } = createRoom('Alice', 's1')
    const run = vi.fn()
    const mockDb = { prepare: vi.fn(() => ({ run })) }
    destroyRoom(mockDb, room.roomCode)
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE'))
    expect(run).toHaveBeenCalledWith(room.roomCode)
  })
})

describe('persistRoom', () => {
  it('is a no-op when db is null', () => {
    const { room } = createRoom('Alice', 's1')
    expect(() => persistRoom(null, room)).not.toThrow()
  })

  it('calls db.prepare with INSERT when db is provided', () => {
    const { room } = createRoom('Alice', 's1')
    const run = vi.fn()
    const mockDb = { prepare: vi.fn(() => ({ run })) }
    persistRoom(mockDb, room)
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT'))
    expect(run).toHaveBeenCalledWith(
      room.roomCode,
      expect.any(String),
      expect.any(Number)
    )
  })

  it('serialises players without socketId', () => {
    const { room } = createRoom('Alice', 's1')
    let captured
    const mockDb = {
      prepare: vi.fn(() => ({
        run: (code, json) => { captured = JSON.parse(json) },
      })),
    }
    persistRoom(mockDb, room)
    expect(captured.players[0][1].socketId).toBeNull()
  })
})

describe('loadRooms', () => {
  it('is a no-op when db is null', () => {
    expect(() => loadRooms(null)).not.toThrow()
  })

  it('restores rooms and rebuilds session index from db', () => {
    const { room, player } = createRoom('Alice', 's1')
    const serialised = []
    const mockWriteDb = {
      prepare: vi.fn(() => ({
        run: (code, json) => { serialised.push({ state_json: json }) },
      })),
    }
    persistRoom(mockWriteDb, room)

    // Destroy locally so we can prove loadRooms re-creates it
    destroyRoom(null, room.roomCode)
    expect(getRoomByCode(room.roomCode)).toBeNull()

    const mockReadDb = { prepare: vi.fn(() => ({ all: () => serialised })) }
    loadRooms(mockReadDb)

    const restored = getRoomByCode(room.roomCode)
    expect(restored).not.toBeNull()
    expect(restored.hostId).toBe(room.hostId)
    expect(getRoomBySessionToken(player.sessionToken)).not.toBeNull()
  })

  it('skips rows with invalid JSON without throwing', () => {
    const mockDb = {
      prepare: vi.fn(() => ({ all: () => [{ state_json: 'not-json' }] })),
    }
    expect(() => loadRooms(mockDb)).not.toThrow()
  })
})
