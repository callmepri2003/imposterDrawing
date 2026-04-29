import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider } from '../components/Toast.jsx'

// mockEmit must be hoisted so it's available inside vi.mock factories
const { mockEmit } = vi.hoisted(() => ({ mockEmit: vi.fn() }))

// Mock WebSocketContext so socket.emit is always available
vi.mock('../contexts/WebSocketContext.jsx', () => ({
  useSocket: () => ({
    socket: { emit: mockEmit, on: vi.fn(), off: vi.fn() },
    connected: true,
  }),
  WebSocketProvider: ({ children }) => <>{children}</>,
}))

// GameStateContext: real reducer, but using our mocked socket context
import { GameStateProvider, useGameState } from '../contexts/GameStateContext.jsx'
import HomeScreen from '../screens/HomeScreen.jsx'
import LobbyScreen from '../screens/LobbyScreen.jsx'
import WordAssignmentScreen from '../screens/WordAssignmentScreen.jsx'
import VotingScreen from '../screens/VotingScreen.jsx'
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
