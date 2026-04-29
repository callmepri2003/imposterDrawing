import React, { useEffect, useState } from 'react'
import { useSocket } from '../contexts/WebSocketContext.jsx'
import { useGameState } from '../contexts/GameStateContext.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'

export default function ErrorScreen() {
  const { socket, connected } = useSocket()
  const { state, dispatch } = useGameState()
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    if (connected) return
    const id = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) { clearInterval(id); return 0 }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [connected])

  function tryRejoin() {
    const { sessionToken, roomCode } = state
    if (sessionToken && roomCode) {
      socket?.emit('rejoin_room', { sessionToken, roomCode })
    }
  }

  function goHome() {
    dispatch({ type: 'GAME_RESET' })
    // Force a full page reload to reset socket
    window.location.reload()
  }

  if (connected && state.sessionToken) {
    // Auto-rejoin on reconnect
    tryRejoin()
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 max-w-sm mx-auto text-center space-y-6">
      <div className="text-5xl">⚡</div>
      <div>
        <h2 className="text-xl font-bold text-white">Disconnected</h2>
        <p className="text-gray-400 text-sm mt-1">Lost connection to the game</p>
      </div>

      <div className="w-full space-y-3">
        {state.roomCode && (
          <PrimaryButton fullWidth onClick={tryRejoin} disabled={connected}>
            {connected ? 'Reconnecting…' : `Rejoin ${state.roomCode}`}
          </PrimaryButton>
        )}
        <PrimaryButton fullWidth variant="ghost" onClick={goHome}>
          Go Home
        </PrimaryButton>
      </div>

      {countdown > 0 && !connected && (
        <p className="text-gray-600 text-xs">Retrying… {countdown}s</p>
      )}
    </div>
  )
}
