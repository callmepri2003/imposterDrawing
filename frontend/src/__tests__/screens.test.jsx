import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider } from '../components/Toast.jsx'

// mockEmit and mockConnected must be hoisted so they're available inside vi.mock factories
const { mockEmit, mockConnected } = vi.hoisted(() => ({
  mockEmit: vi.fn(),
  mockConnected: { value: true },
}))

// Mock WebSocketContext so socket.emit is always available
vi.mock('../contexts/WebSocketContext.jsx', () => ({
  useSocket: () => ({
    socket: { emit: mockEmit, on: vi.fn(), off: vi.fn() },
    connected: mockConnected.value,
  }),
  WebSocketProvider: ({ children }) => <>{children}</>,
}))

// SharedCanvas requires a real browser canvas — stub it out so DrawingScreen is testable
vi.mock('../components/canvas/SharedCanvas.jsx', () => ({
  default: () => <div data-testid="shared-canvas" />,
}))

// GameStateContext: real reducer, but using our mocked socket context
import { GameStateProvider, useGameState } from '../contexts/GameStateContext.jsx'
import HomeScreen from '../screens/HomeScreen.jsx'
import LobbyScreen from '../screens/LobbyScreen.jsx'
import WordAssignmentScreen from '../screens/WordAssignmentScreen.jsx'
import VotingScreen from '../screens/VotingScreen.jsx'
import DrawingScreen from '../screens/DrawingScreen.jsx'
import RevealScreen from '../screens/RevealScreen.jsx'
import ErrorScreen from '../screens/ErrorScreen.jsx'
import App from '../App.jsx'

function Wrapper({ children }) {
  return (
    <GameStateProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </GameStateProvider>
  )
}

function SetState({ dispatch: dispatchFn, children }) {
  const { dispatch } = useGameState()
  React.useEffect(() => { dispatchFn(dispatch) }, [])
  return <>{children}</>
}

function withState(dispatchFn, children) {
  return (
    <Wrapper>
      <SetState dispatch={dispatchFn}>{children}</SetState>
    </Wrapper>
  )
}

function lobbyDispatch(dispatch) {
  dispatch({
    type: 'ROOM_JOINED',
    payload: {
      sessionToken: 'tok',
      playerId: 'p1',
      roomState: {
        phase: 'lobby',
        roomCode: 'BCDFGH',
        hostId: 'p1',
        players: [
          { id: 'p1', displayName: 'Alice', isHost: true, isConnected: true },
          { id: 'p2', displayName: 'Bob', isHost: false, isConnected: true },
        ],
        drawOrder: [],
        currentTurnIdx: -1,
        turnSeq: 0,
        strokes: [],
        readyCount: 0,
      },
    },
  })
}

beforeEach(() => {
  mockEmit.mockClear()
  mockConnected.value = true
  localStorage.clear()
})

// ── App routing ───────────────────────────────────────────────────────────────

describe('App', () => {
  it('renders HomeScreen when phase is null', () => {
    render(<Wrapper><App /></Wrapper>)
    expect(screen.getByText('Create a Game')).toBeInTheDocument()
  })
})

// ── HomeScreen ────────────────────────────────────────────────────────────────

describe('HomeScreen', () => {
  it('renders name input and action buttons', () => {
    render(<Wrapper><HomeScreen /></Wrapper>)
    expect(screen.getByTestId('name-input')).toBeInTheDocument()
    expect(screen.getByText('Create a Game')).toBeInTheDocument()
    expect(screen.getByText('Join with Code')).toBeInTheDocument()
  })

  it('disables Create button when name is empty', () => {
    render(<Wrapper><HomeScreen /></Wrapper>)
    expect(screen.getByText('Create a Game')).toBeDisabled()
  })

  it('enables Create button after typing a name', () => {
    render(<Wrapper><HomeScreen /></Wrapper>)
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Alice' } })
    expect(screen.getByText('Create a Game')).not.toBeDisabled()
  })

  it('emits create_room when Create is clicked', () => {
    render(<Wrapper><HomeScreen /></Wrapper>)
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByText('Create a Game'))
    expect(mockEmit).toHaveBeenCalledWith('create_room', { displayName: 'Alice' })
  })

  it('reveals code input when Join with Code is clicked', () => {
    render(<Wrapper><HomeScreen /></Wrapper>)
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByText('Join with Code'))
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(1)
  })

  it('persists name to localStorage', () => {
    render(<Wrapper><HomeScreen /></Wrapper>)
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Bob' } })
    expect(localStorage.getItem('imposter_name')).toBe('Bob')
  })

  it('trims whitespace-only names (Create stays disabled)', () => {
    render(<Wrapper><HomeScreen /></Wrapper>)
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: '   ' } })
    expect(screen.getByText('Create a Game')).toBeDisabled()
  })
})

// ── LobbyScreen ───────────────────────────────────────────────────────────────

describe('LobbyScreen', () => {
  it('displays the room code', () => {
    render(withState(lobbyDispatch, <LobbyScreen />))
    expect(screen.getByText('BCDFGH')).toBeInTheDocument()
  })

  it('shows connected player names', () => {
    render(withState(lobbyDispatch, <LobbyScreen />))
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
    expect(screen.getByText(/Bob/)).toBeInTheDocument()
  })

  it('disables Start Game when fewer than 3 players', () => {
    render(withState(lobbyDispatch, <LobbyScreen />))
    expect(screen.getByText('Start Game')).toBeDisabled()
  })

  it('emits start_game when host clicks Start Game with 3+ players', () => {
    const threePlayerDispatch = (dispatch) => {
      dispatch({
        type: 'ROOM_JOINED',
        payload: {
          sessionToken: 'tok',
          playerId: 'p1',
          roomState: {
            phase: 'lobby',
            roomCode: 'BCDFGH',
            hostId: 'p1',
            players: [
              { id: 'p1', displayName: 'Alice', isHost: true, isConnected: true },
              { id: 'p2', displayName: 'Bob', isHost: false, isConnected: true },
              { id: 'p3', displayName: 'Carol', isHost: false, isConnected: true },
            ],
            drawOrder: [],
            currentTurnIdx: -1,
            turnSeq: 0,
            strokes: [],
            readyCount: 0,
          },
        },
      })
    }
    render(withState(threePlayerDispatch, <LobbyScreen />))
    fireEvent.click(screen.getByText('Start Game'))
    expect(mockEmit).toHaveBeenCalledWith('start_game', { sessionToken: 'tok' })
  })
})

// ── WordAssignmentScreen ──────────────────────────────────────────────────────

describe('WordAssignmentScreen', () => {
  it('shows ARTIST role with hold-to-reveal for non-imposter', () => {
    render(
      withState(
        (d) => { d({ type: 'ROLE_ASSIGNED', payload: { role: 'artist', word: 'volcano' } }) },
        <WordAssignmentScreen />
      )
    )
    expect(screen.getByText('ARTIST')).toBeInTheDocument()
    expect(screen.getByText(/hold to reveal/i)).toBeInTheDocument()
  })

  it('shows IMPOSTER role with blend-in instructions', () => {
    render(
      withState(
        (d) => { d({ type: 'ROLE_ASSIGNED', payload: { role: 'imposter' } }) },
        <WordAssignmentScreen />
      )
    )
    expect(screen.getByText('IMPOSTER')).toBeInTheDocument()
    expect(screen.getByText(/blend in/i)).toBeInTheDocument()
  })

  it('emits player_ready when Got it is clicked', () => {
    render(
      withState(
        (d) => {
          d({ type: 'ROOM_JOINED', payload: { sessionToken: 'tok', playerId: 'p1', roomState: { phase: 'word_assignment', roomCode: 'X', hostId: 'p1', players: [], drawOrder: [], currentTurnIdx: -1, turnSeq: 0, strokes: [], readyCount: 0 } } })
          d({ type: 'ROLE_ASSIGNED', payload: { role: 'artist', word: 'cat' } })
        },
        <WordAssignmentScreen />
      )
    )
    fireEvent.click(screen.getByText(/got it/i))
    expect(mockEmit).toHaveBeenCalledWith('player_ready', { sessionToken: 'tok' })
  })
})

// ── VotingScreen ──────────────────────────────────────────────────────────────

describe('VotingScreen', () => {
  function renderVoting() {
    return render(
      withState(
        (d) => {
          d({
            type: 'ROOM_JOINED',
            payload: {
              sessionToken: 'tok',
              playerId: 'p1',
              roomState: {
                phase: 'voting',
                roomCode: 'X',
                hostId: 'p1',
                players: [
                  { id: 'p1', displayName: 'Alice', isHost: true, isConnected: true },
                  { id: 'p2', displayName: 'Bob', isHost: false, isConnected: true },
                  { id: 'p3', displayName: 'Carol', isHost: false, isConnected: true },
                ],
                drawOrder: [],
                currentTurnIdx: -1,
                turnSeq: 0,
                strokes: [],
                readyCount: 0,
              },
            },
          })
          d({ type: 'VOTING_START', payload: { players: [
            { id: 'p1', displayName: 'Alice', isHost: true, isConnected: true },
            { id: 'p2', displayName: 'Bob', isHost: false, isConnected: true },
            { id: 'p3', displayName: 'Carol', isHost: false, isConnected: true },
          ], timeoutAt: Date.now() + 45000 } })
        },
        <VotingScreen />
      )
    )
  }

  it('shows other players but not self', () => {
    renderVoting()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Carol')).toBeInTheDocument()
  })

  it('opens confirmation sheet on player click', () => {
    renderVoting()
    fireEvent.click(screen.getByText('Bob'))
    expect(screen.getAllByText(/vote for/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })

  it('emits submit_vote on confirm', () => {
    renderVoting()
    fireEvent.click(screen.getByText('Bob'))
    fireEvent.click(screen.getByText('Confirm'))
    expect(mockEmit).toHaveBeenCalledWith('submit_vote', {
      sessionToken: 'tok',
      targetPlayerId: 'p2',
    })
  })
})

// ── DrawingScreen ─────────────────────────────────────────────────────────────

describe('DrawingScreen', () => {
  const players = [
    { id: 'p1', displayName: 'Alice', isHost: true, isConnected: true },
    { id: 'p2', displayName: 'Bob', isHost: false, isConnected: true },
    { id: 'p3', displayName: 'Carol', isHost: false, isConnected: true },
  ]

  function drawingDispatch({ playerId = 'p1', activePlayerId = 'p2', role = 'artist', word = 'cat' } = {}) {
    return (dispatch) => {
      // Lobby state: drawOrder is still empty — this is what causes the bug without the fix
      dispatch({
        type: 'ROOM_JOINED',
        payload: {
          sessionToken: 'tok',
          playerId,
          roomState: {
            phase: 'lobby',
            roomCode: 'BCDFGH',
            hostId: 'p1',
            players,
            drawOrder: [],
            currentTurnIdx: -1,
            turnSeq: 0,
            strokes: [],
            readyCount: 0,
          },
        },
      })
      dispatch({ type: 'ROLE_ASSIGNED', payload: { role, word } })
      dispatch({ type: 'ALL_READY' })
      // TURN_START is the sole source of drawOrder — must populate it
      dispatch({
        type: 'TURN_START',
        payload: {
          activePlayerId,
          drawOrder: ['p1', 'p2', 'p3'],
          currentTurnIdx: ['p1', 'p2', 'p3'].indexOf(activePlayerId),
          turnSeq: 1,
          roundNumber: 1,
          totalRounds: 2,
          timeoutAt: Date.now() + 30000,
        },
      })
    }
  }

  it('shows active player name when spectating (regression: was showing "...")', () => {
    render(withState(drawingDispatch({ activePlayerId: 'p2' }), <DrawingScreen />))
    expect(screen.getByText(/Bob is drawing/)).toBeInTheDocument()
  })

  it('shows "Your turn" label when it is the local player\'s turn', () => {
    render(withState(drawingDispatch({ playerId: 'p1', activePlayerId: 'p1' }), <DrawingScreen />))
    expect(screen.getByText('Your turn')).toBeInTheDocument()
  })

  it('shows End Turn button when it is the local player\'s turn', () => {
    render(withState(drawingDispatch({ playerId: 'p1', activePlayerId: 'p1' }), <DrawingScreen />))
    expect(screen.getByText('End Turn')).toBeInTheDocument()
  })

  it('shows word for artist on their turn', () => {
    render(withState(drawingDispatch({ playerId: 'p1', activePlayerId: 'p1', role: 'artist', word: 'elephant' }), <DrawingScreen />))
    expect(screen.getByText('elephant')).toBeInTheDocument()
  })

  it('shows IMPOSTER label for imposter on their turn', () => {
    render(withState(drawingDispatch({ playerId: 'p1', activePlayerId: 'p1', role: 'imposter' }), <DrawingScreen />))
    expect(screen.getByText(/IMPOSTER/)).toBeInTheDocument()
  })

  it('shows correct spectator turn countdown', () => {
    // p1 is local player, drawOrder=['p1','p2','p3'], active is p2 (idx 1)
    // diff = (0 - 1 + 3) % 3 = 2
    render(withState(drawingDispatch({ playerId: 'p1', activePlayerId: 'p2' }), <DrawingScreen />))
    expect(screen.getByText(/your turn in 2 turns/i)).toBeInTheDocument()
  })

  it('emits end_turn with sessionToken and turnSeq when End Turn clicked', () => {
    render(withState(drawingDispatch({ playerId: 'p1', activePlayerId: 'p1' }), <DrawingScreen />))
    fireEvent.click(screen.getByText('End Turn'))
    expect(mockEmit).toHaveBeenCalledWith('end_turn', expect.objectContaining({
      sessionToken: 'tok',
      turnSeq: 1,
    }))
  })

  it('renders the shared canvas', () => {
    render(withState(drawingDispatch(), <DrawingScreen />))
    expect(screen.getByTestId('shared-canvas')).toBeInTheDocument()
  })
})

// ── RevealScreen ──────────────────────────────────────────────────────────────

describe('RevealScreen', () => {
  const revealPayload = {
    imposterId: 'p2',
    imposterName: 'Bob',
    secretWord: 'volcano',
    votes: {
      p1: { count: 1, voterIds: ['p3'] },
      p2: { count: 2, voterIds: ['p1', 'p2'] },
      p3: { count: 0, voterIds: [] },
    },
    outcome: 'caught',
  }

  function renderReveal({ isHost = true } = {}) {
    return render(
      withState(
        (d) => {
          d({
            type: 'ROOM_JOINED',
            payload: {
              sessionToken: 'tok',
              playerId: isHost ? 'p1' : 'p3',
              roomState: {
                phase: 'reveal',
                roomCode: 'X',
                hostId: 'p1',
                players: [
                  { id: 'p1', displayName: 'Alice', isHost: true, isConnected: true },
                  { id: 'p2', displayName: 'Bob', isHost: false, isConnected: true },
                  { id: 'p3', displayName: 'Carol', isHost: false, isConnected: true },
                ],
                drawOrder: [],
                currentTurnIdx: -1,
                turnSeq: 0,
                strokes: [],
                readyCount: 0,
              },
            },
          })
          d({ type: 'REVEAL', payload: revealPayload })
        },
        <RevealScreen />
      )
    )
  }

  it('renders vote bars immediately (stage 0)', () => {
    renderReveal()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows imposter name and secret word after all stages', async () => {
    vi.useFakeTimers()
    renderReveal()
    await act(async () => { vi.advanceTimersByTime(7100) })
    expect(screen.getByText('volcano')).toBeInTheDocument()
    expect(screen.getByText('The secret word was')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows Play Again for host after all stages', async () => {
    vi.useFakeTimers()
    renderReveal({ isHost: true })
    await act(async () => { vi.advanceTimersByTime(7100) })
    expect(screen.getByText('Play Again')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('does not show Play Again for non-host', async () => {
    vi.useFakeTimers()
    renderReveal({ isHost: false })
    await act(async () => { vi.advanceTimersByTime(7100) })
    expect(screen.queryByText('Play Again')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('emits play_again when host clicks Play Again', async () => {
    vi.useFakeTimers()
    renderReveal({ isHost: true })
    await act(async () => { vi.advanceTimersByTime(7100) })
    fireEvent.click(screen.getByText('Play Again'))
    expect(mockEmit).toHaveBeenCalledWith('play_again', { sessionToken: 'tok' })
    vi.useRealTimers()
  })
})

// ── ErrorScreen ───────────────────────────────────────────────────────────────

describe('ErrorScreen', () => {
  function renderError({ connected = false, hasSession = true } = {}) {
    mockConnected.value = connected
    return render(
      withState(
        (d) => {
          if (hasSession) {
            d({
              type: 'ROOM_JOINED',
              payload: {
                sessionToken: 'tok',
                playerId: 'p1',
                roomState: {
                  phase: 'disconnected',
                  roomCode: 'BCDFGH',
                  hostId: 'p1',
                  players: [],
                  drawOrder: [],
                  currentTurnIdx: -1,
                  turnSeq: 0,
                  strokes: [],
                  readyCount: 0,
                },
              },
            })
          }
          d({ type: 'DISCONNECTED' })
        },
        <ErrorScreen />
      )
    )
  }

  it('shows Disconnected heading', () => {
    renderError()
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('shows enabled Rejoin button when disconnected and has roomCode', () => {
    renderError({ connected: false })
    const btn = screen.getByText(/Rejoin/i)
    expect(btn).not.toBeDisabled()
  })

  it('shows disabled Reconnecting button when connected', () => {
    renderError({ connected: true })
    expect(screen.getByText('Reconnecting…')).toBeDisabled()
  })

  it('shows Go Home button', () => {
    renderError()
    expect(screen.getByText('Go Home')).toBeInTheDocument()
  })

  it('emits rejoin_room when Rejoin is clicked', () => {
    renderError({ connected: false })
    fireEvent.click(screen.getByText(/Rejoin/i))
    expect(mockEmit).toHaveBeenCalledWith('rejoin_room', {
      sessionToken: 'tok',
      roomCode: 'BCDFGH',
    })
  })
})
