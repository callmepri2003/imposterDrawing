import React, { useState } from 'react'
import { useSocket } from '../contexts/WebSocketContext.jsx'
import { useGameState } from '../contexts/GameStateContext.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'

export default function WordAssignmentScreen() {
  const { socket } = useSocket()
  const { state } = useGameState()
  const { myRole, myWord, sessionToken, readyCount, totalCount } = state
  const [ready, setReady] = useState(false)
  const [revealed, setRevealed] = useState(false)

  function markReady() {
    setReady(true)
    socket.emit('player_ready', { sessionToken })
  }

  const isImposter = myRole === 'imposter'

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 max-w-sm mx-auto">
      <div className="w-full space-y-6">
        <div className="text-center">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Your Role</p>
          <h2 className="text-2xl font-bold text-white">Get ready!</h2>
        </div>

        {/* Role card — identical layout for both roles, content differs */}
        <div className={`rounded-2xl border-2 p-6 text-center space-y-4 ${
          isImposter ? 'border-red-500/50 bg-red-500/5' : 'border-violet-500/50 bg-violet-500/5'
        }`}>
          <div className={`text-4xl font-extrabold tracking-wide ${
            isImposter ? 'text-red-400' : 'text-violet-400'
          }`}>
            {isImposter ? 'IMPOSTER' : 'ARTIST'}
          </div>

          {isImposter ? (
            <p className="text-gray-300 text-sm leading-relaxed">
              You have no word. Watch what others draw and blend in.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-400 text-xs uppercase tracking-wider">The secret word is</p>
              <button
                onPointerDown={() => setRevealed(true)}
                onPointerUp={() => setRevealed(false)}
                onPointerLeave={() => setRevealed(false)}
                className="relative w-full"
                aria-label="Hold to reveal word"
              >
                <div className={`px-4 py-3 rounded-xl bg-gray-700 border-2 border-violet-500 transition-all ${
                  revealed ? '' : 'blur-md select-none'
                }`}>
                  <span className="text-2xl font-bold text-white uppercase tracking-wide">{myWord}</span>
                </div>
                {!revealed && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-violet-400 text-sm font-medium">Hold to reveal</span>
                  </div>
                )}
              </button>
            </div>
          )}
        </div>

        <p className="text-gray-500 text-xs text-center">Don't show your screen to others!</p>

        <div className="space-y-3">
          <PrimaryButton fullWidth onClick={markReady} disabled={ready}>
            {ready ? 'Waiting for others…' : "Got it, I'm ready"}
          </PrimaryButton>
          {ready && (
            <p className="text-gray-500 text-sm text-center">
              {readyCount}/{totalCount} ready
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
