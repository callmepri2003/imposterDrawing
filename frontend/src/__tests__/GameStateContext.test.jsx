import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { GameStateProvider, useGameState, getPlayerColor } from '../contexts/GameStateContext.jsx'
import { WebSocketProvider } from '../contexts/WebSocketContext.jsx'

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const handlers = {}
  const socket = {
    on: (event, fn) => { handlers[event] = fn },
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
    _trigger: (event, data) => handlers[event]?.(data),
  }
  return { io: () => socket, _socket: socket }
})

function Wrapper({ children }) {
  return (
    <WebSocketProvider socketUrl="http://localhost:3000">
      <GameStateProvider>{children}</GameStateProvider>
    </WebSocketProvider>
  )
}

function StateCapture({ onState }) {
  const { state } = useGameState()
  onState(state)
  return null
}

describe('GameStateContext reducer', () => {
  it('starts with null phase', () => {
    let captured
    render(<Wrapper><StateCapture onState={s => { captured = s }} /></Wrapper>)
    expect(captured.phase).toBeNull()
  })

  it('ROOM_JOINED sets phase to lobby', () => {
    let captured
    let dispatch
    function Capture() {
      const ctx = useGameState()
      dispatch = ctx.dispatch
      captured = ctx.state
      return null
    }
    render(<Wrapper><Capture /></Wrapper>)

    act(() => {
      dispatch({
        type: 'ROOM_JOINED',
        payload: {
          sessionToken: 'tok',
          playerId: 'p1',
          roomState: {
            phase: 'lobby',
            roomCode: 'ABCDEF',
            hostId: 'p1',
            players: [{ id: 'p1', displayName: 'Alice', isHost: true, isConnected: true }],
            drawOrder: [],
            currentTurnIdx: -1,
            turnSeq: 0,
            strokes: [],
            readyCount: 0,
          },
        },
      })
    })

    expect(captured.phase).toBe('lobby')
    expect(captured.roomCode).toBe('ABCDEF')
    expect(captured.sessionToken).toBe('tok')
    expect(captured.playerId).toBe('p1')
  })

  it('PLAYER_JOINED adds a new player', () => {
    let captured
    let dispatch
    function Capture() {
      const ctx = useGameState()
      dispatch = ctx.dispatch
      captured = ctx.state
      return null
    }
    render(<Wrapper><Capture /></Wrapper>)

    act(() => {
      dispatch({
        type: 'ROOM_JOINED',
        payload: {
          sessionToken: 'tok',
          playerId: 'p1',
          roomState: {
            phase: 'lobby',
            roomCode: 'ABCDEF',
            hostId: 'p1',
            players: [{ id: 'p1', displayName: 'Alice', isHost: true, isConnected: true }],
            drawOrder: [],
            currentTurnIdx: -1,
            turnSeq: 0,
            strokes: [],
          },
        },
      })
    })

    act(() => {
      dispatch({
        type: 'PLAYER_JOINED',
        payload: { player: { id: 'p2', displayName: 'Bob', isHost: false, isConnected: true } },
      })
    })

    expect(captured.players).toHaveLength(2)
    expect(captured.players[1].displayName).toBe('Bob')
  })

  it('PLAYER_LEFT marks player as disconnected', () => {
    let captured
    let dispatch
    function Capture() {
      const ctx = useGameState()
      dispatch = ctx.dispatch
      captured = ctx.state
      return null
    }
    render(<Wrapper><Capture /></Wrapper>)

    act(() => {
      dispatch({
        type: 'ROOM_JOINED',
        payload: {
          sessionToken: 'tok',
          playerId: 'p1',
          roomState: {
            phase: 'lobby',
            roomCode: 'ABCDEF',
            hostId: 'p1',
            players: [
              { id: 'p1', displayName: 'Alice', isHost: true, isConnected: true },
              { id: 'p2', displayName: 'Bob', isHost: false, isConnected: true },
            ],
            drawOrder: [],
            currentTurnIdx: -1,
            turnSeq: 0,
            strokes: [],
          },
        },
      })
    })

    act(() => dispatch({ type: 'PLAYER_LEFT', payload: { playerId: 'p2' } }))
    expect(captured.players.find(p => p.id === 'p2')?.isConnected).toBe(false)
  })

  it('HOST_CHANGED updates hostId and player.isHost', () => {
    let captured
    let dispatch
    function Capture() {
      const ctx = useGameState()
      dispatch = ctx.dispatch
      captured = ctx.state
      return null
    }
    render(<Wrapper><Capture /></Wrapper>)

    act(() => {
      dispatch({
        type: 'ROOM_JOINED',
        payload: {
          sessionToken: 'tok',
          playerId: 'p2',
          roomState: {
            phase: 'lobby',
            roomCode: 'ABCDEF',
            hostId: 'p1',
            players: [
              { id: 'p1', displayName: 'Alice', isHost: true, isConnected: true },
              { id: 'p2', displayName: 'Bob', isHost: false, isConnected: true },
            ],
            drawOrder: [],
            currentTurnIdx: -1,
            turnSeq: 0,
            strokes: [],
          },
        },
      })
    })

    act(() => dispatch({ type: 'HOST_CHANGED', payload: { newHostId: 'p2' } }))
    expect(captured.hostId).toBe('p2')
    expect(captured.players.find(p => p.id === 'p2')?.isHost).toBe(true)
  })

  it('ROLE_ASSIGNED stores role and word', () => {
    let captured
    let dispatch
    function Capture() {
      const ctx = useGameState()
      dispatch = ctx.dispatch
      captured = ctx.state
      return null
    }
    render(<Wrapper><Capture /></Wrapper>)

    act(() => dispatch({ type: 'ROLE_ASSIGNED', payload: { role: 'artist', word: 'lighthouse' } }))
    expect(captured.myRole).toBe('artist')
    expect(captured.myWord).toBe('lighthouse')
  })

  it('REVEAL stores reveal payload and sets phase', () => {
    let captured
    let dispatch
    function Capture() {
      const ctx = useGameState()
      dispatch = ctx.dispatch
      captured = ctx.state
      return null
    }
    render(<Wrapper><Capture /></Wrapper>)

    const revealPayload = {
      imposterId: 'p1',
      imposterName: 'Alice',
      secretWord: 'volcano',
      votes: { p1: { count: 2, voterIds: ['p2', 'p3'] } },
      outcome: 'caught',
    }
    act(() => dispatch({ type: 'REVEAL', payload: revealPayload }))
    expect(captured.phase).toBe('reveal')
    expect(captured.reveal.secretWord).toBe('volcano')
    expect(captured.reveal.outcome).toBe('caught')
  })

  it('GAME_RESET returns to lobby phase', () => {
    let captured
    let dispatch
    function Capture() {
      const ctx = useGameState()
      dispatch = ctx.dispatch
      captured = ctx.state
      return null
    }
    render(<Wrapper><Capture /></Wrapper>)

    act(() => dispatch({ type: 'ROLE_ASSIGNED', payload: { role: 'imposter' } }))
    act(() => dispatch({ type: 'GAME_RESET' }))
    expect(captured.phase).toBe('lobby')
    expect(captured.myRole).toBeNull()
  })
})

describe('getPlayerColor', () => {
  it('returns a hex color for index 0', () => {
    expect(getPlayerColor(0)).toMatch(/^#[0-9a-f]{6}/i)
  })

  it('wraps around for indices >= 8', () => {
    expect(getPlayerColor(0)).toBe(getPlayerColor(8))
  })
})
