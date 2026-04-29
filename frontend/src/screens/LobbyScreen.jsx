import React from 'react'
import { useSocket } from '../contexts/WebSocketContext.jsx'
import { useGameState } from '../contexts/GameStateContext.jsx'
import { useToast } from '../components/Toast.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'
import AvatarDot from '../components/AvatarDot.jsx'

export default function LobbyScreen() {
  const { socket } = useSocket()
  const { state } = useGameState()
  const toast = useToast()
  const { roomCode, players, hostId, playerId, sessionToken } = state

  const isHost = playerId === hostId
  const connectedCount = players.filter(p => p.isConnected).length
  const canStart = connectedCount >= 3

  function copyCode() {
    navigator.clipboard?.writeText(roomCode).then(() => toast('Code copied!'))
  }

  function share() {
    if (navigator.share) {
      navigator.share({ title: 'Join my Imposter Drawing game', text: `Join with code: ${roomCode}` })
    } else {
      copyCode()
    }
  }

  function startGame() {
    socket.emit('start_game', { sessionToken })
  }

  return (
    <div className="min-h-full flex flex-col p-6 max-w-sm mx-auto">
      <div className="flex-1 space-y-6">
        <div className="text-center space-y-3 pt-4">
          <p className="text-gray-400 text-sm uppercase tracking-widest">Room Code</p>
          <p className="text-5xl font-extrabold font-mono tracking-widest text-violet-400">{roomCode}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={copyCode}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
            >
              Copy
            </button>
            <button
              onClick={share}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
            >
              Share
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-gray-400 text-sm font-medium">
            Players ({connectedCount}/8)
          </p>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-xl bg-gray-800 ${!p.isConnected ? 'opacity-40' : ''}`}
              >
                <AvatarDot index={i} name={p.displayName} />
                <span className="flex-1 text-white font-medium">
                  {p.displayName}
                  {p.id === playerId && <span className="text-gray-500 text-sm ml-1">(you)</span>}
                </span>
                {p.id === hostId && (
                  <span className="text-yellow-400 text-xs font-medium bg-yellow-400/10 px-2 py-0.5 rounded-full">
                    Host
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 space-y-3 safe-bottom">
        {isHost ? (
          <>
            {!canStart && (
              <p className="text-gray-500 text-sm text-center">Need at least 3 players to start</p>
            )}
            <PrimaryButton fullWidth onClick={startGame} disabled={!canStart}>
              Start Game
            </PrimaryButton>
          </>
        ) : (
          <p className="text-gray-400 text-center text-sm animate-pulse">Waiting for host to start…</p>
        )}
      </div>
    </div>
  )
}
