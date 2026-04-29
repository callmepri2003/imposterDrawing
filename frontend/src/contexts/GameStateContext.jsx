import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { useSocket } from './WebSocketContext.jsx'

const PLAYER_COLORS = [
  '#a78bfa', '#34d399', '#fb923c', '#60a5fa',
  '#f472b6', '#facc15', '#4ade80', '#f87171',
]

export function getPlayerColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length]
}

const initialState = {
  phase: null,
  roomCode: null,
  sessionToken: null,
  playerId: null,
  players: [],
  hostId: null,
  drawOrder: [],
  currentTurnIdx: -1,
  turnSeq: 0,
  turnStart: null,
  strokes: [],
  myRole: null,
  myWord: null,
  readyCount: 0,
  totalCount: 0,
  votedCount: 0,
  myVote: null,
  reveal: null,
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'ROOM_JOINED': {
      const { sessionToken, playerId, roomState } = action.payload
      return {
        ...state,
        ...roomStateToState(roomState),
        sessionToken,
        playerId,
        error: null,
      }
    }
    case 'PLAYER_JOINED': {
      const existing = state.players.find(p => p.id === action.payload.player.id)
      const players = existing
        ? state.players.map(p => p.id === action.payload.player.id ? action.payload.player : p)
        : [...state.players, action.payload.player]
      return { ...state, players }
    }
    case 'PLAYER_LEFT':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.payload.playerId ? { ...p, isConnected: false } : p
        ),
      }
    case 'HOST_CHANGED':
      return {
        ...state,
        hostId: action.payload.newHostId,
        players: state.players.map(p => ({
          ...p,
          isHost: p.id === action.payload.newHostId,
        })),
      }
    case 'GAME_STARTING':
      return { ...state, phase: 'word_assignment', myRole: null, myWord: null }
    case 'ROLE_ASSIGNED':
      return { ...state, myRole: action.payload.role, myWord: action.payload.word ?? null }
    case 'READY_UPDATE':
      return { ...state, readyCount: action.payload.readyCount, totalCount: action.payload.totalCount }
    case 'ALL_READY':
      return { ...state, phase: 'drawing' }
    case 'TURN_START':
      return {
        ...state,
        currentTurnIdx: action.payload.currentTurnIdx ?? state.currentTurnIdx,
        turnSeq: action.payload.turnSeq,
        turnStart: action.payload,
      }
    case 'STROKE_COMMITTED':
      return { ...state, strokes: [...state.strokes, action.payload] }
    case 'VOTING_START':
      return {
        ...state,
        phase: 'voting',
        votedCount: 0,
        myVote: null,
        players: action.payload.players,
      }
    case 'VOTE_COUNT_UPDATE':
      return { ...state, votedCount: action.payload.votedCount, totalCount: action.payload.totalCount }
    case 'MY_VOTE_CAST':
      return { ...state, myVote: action.payload.targetPlayerId }
    case 'REVEAL':
      return { ...state, phase: 'reveal', reveal: action.payload }
    case 'GAME_RESET':
      return {
        ...initialState,
        phase: 'lobby',
        sessionToken: state.sessionToken,
        playerId: state.playerId,
        roomCode: state.roomCode,
        players: state.players,
        hostId: state.hostId,
      }
    case 'GAME_ABORTED':
      return {
        ...state,
        phase: 'lobby',
        strokes: [],
        myRole: null,
        myWord: null,
        reveal: null,
      }
    case 'DRAW_ORDER_SET':
      return {
        ...state,
        drawOrder: action.payload.drawOrder,
        currentTurnIdx: action.payload.currentTurnIdx,
      }
    case 'JOIN_ERROR':
      return { ...state, error: action.payload.message }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    case 'DISCONNECTED':
      return { ...state, phase: 'disconnected' }
    default:
      return state
  }
}

function roomStateToState(rs) {
  return {
    phase: rs.phase,
    roomCode: rs.roomCode,
    hostId: rs.hostId,
    players: rs.players ?? [],
    drawOrder: rs.drawOrder ?? [],
    currentTurnIdx: rs.currentTurnIdx ?? -1,
    turnSeq: rs.turnSeq ?? 0,
    strokes: rs.strokes ?? [],
    readyCount: rs.readyCount ?? 0,
  }
}

const GameStateContext = createContext(null)

export function GameStateProvider({ children }) {
  const { socket } = useSocket()
  const [state, dispatch] = useReducer(reducer, initialState)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!socket) return

    const on = (event, handler) => { socket.on(event, handler); return () => socket.off(event, handler) }

    const offs = [
      on('room_created', (data) => dispatch({ type: 'ROOM_JOINED', payload: data })),
      on('room_joined', (data) => dispatch({ type: 'ROOM_JOINED', payload: data })),
      on('room_rejoined', (data) => dispatch({ type: 'ROOM_JOINED', payload: data })),
      on('join_error', (data) => dispatch({ type: 'JOIN_ERROR', payload: data })),
      on('player_joined', (data) => dispatch({ type: 'PLAYER_JOINED', payload: data })),
      on('player_left', (data) => dispatch({ type: 'PLAYER_LEFT', payload: data })),
      on('host_changed', (data) => dispatch({ type: 'HOST_CHANGED', payload: data })),
      on('game_starting', () => dispatch({ type: 'GAME_STARTING' })),
      on('role_assigned', (data) => dispatch({ type: 'ROLE_ASSIGNED', payload: data })),
      on('ready_update', (data) => dispatch({ type: 'READY_UPDATE', payload: data })),
      on('all_ready', () => dispatch({ type: 'ALL_READY' })),
      on('turn_start', (data) => {
        const s = stateRef.current
        const idx = s.drawOrder.findIndex(id => id === data.activePlayerId)
        dispatch({ type: 'TURN_START', payload: { ...data, currentTurnIdx: idx } })
      }),
      on('stroke_end', (data) => dispatch({ type: 'STROKE_COMMITTED', payload: data })),
      on('voting_start', (data) => dispatch({ type: 'VOTING_START', payload: data })),
      on('vote_count_update', (data) => dispatch({ type: 'VOTE_COUNT_UPDATE', payload: data })),
      on('reveal', (data) => dispatch({ type: 'REVEAL', payload: data })),
      on('game_reset', () => dispatch({ type: 'GAME_RESET' })),
      on('game_aborted', () => dispatch({ type: 'GAME_ABORTED' })),
      on('disconnect', () => dispatch({ type: 'DISCONNECTED' })),
    ]

    return () => offs.forEach(off => off())
  }, [socket])

  return (
    <GameStateContext.Provider value={{ state, dispatch }}>
      {children}
    </GameStateContext.Provider>
  )
}

export function useGameState() {
  const ctx = useContext(GameStateContext)
  if (!ctx) throw new Error('useGameState must be used inside GameStateProvider')
  return ctx
}
