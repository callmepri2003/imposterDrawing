import React, { useEffect, useState } from 'react'
import { useSocket } from '../contexts/WebSocketContext.jsx'
import { useGameState } from '../contexts/GameStateContext.jsx'
import AvatarDot from '../components/AvatarDot.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'

const STAGES = ['votes', 'accused', 'question', 'reveal', 'word', 'full']

export default function RevealScreen() {
  const { socket } = useSocket()
  const { state } = useGameState()
  const { reveal, players, playerId, sessionToken, hostId } = state
  const [stage, setStage] = useState(0)

  const isHost = playerId === hostId

  useEffect(() => {
    if (!reveal) return
    const delays = [0, 1800, 3200, 4400, 5600, 7000]
    const timers = delays.map((d, i) => setTimeout(() => setStage(i), d))
    return () => timers.forEach(clearTimeout)
  }, [reveal])

  if (!reveal) return null

  const { imposterId, imposterName, secretWord, votes, outcome } = reveal
  const caught = outcome === 'caught'

  const sortedPlayers = players
    .map(p => ({ ...p, voteCount: votes[p.id]?.count ?? 0 }))
    .sort((a, b) => b.voteCount - a.voteCount)

  const maxVotes = sortedPlayers[0]?.voteCount ?? 0

  function playAgain() {
    socket.emit('play_again', { sessionToken })
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 max-w-sm mx-auto text-center space-y-6">
      {stage >= STAGES.indexOf('votes') && (
        <div className="w-full space-y-2">
          <p className="text-gray-400 text-sm uppercase tracking-widest">The votes are in</p>
          <div className="space-y-2 w-full">
            {sortedPlayers.map((p, i) => {
              const pct = maxVotes > 0 ? (p.voteCount / maxVotes) * 100 : 0
              const idx = players.findIndex(pl => pl.id === p.id)
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-xl bg-gray-800 transition-all duration-500 ${
                    stage < STAGES.indexOf('votes') + 1 ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                  }`}
                  style={{ transitionDelay: `${i * 150}ms` }}
                >
                  <AvatarDot index={idx} name={p.displayName} size="sm" />
                  <span className="text-white text-sm flex-shrink-0 w-20 text-left truncate">{p.displayName}</span>
                  <div className="flex-1 bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-violet-500 transition-all duration-700"
                      style={{ width: `${stage >= 1 ? pct : 0}%` }}
                    />
                  </div>
                  <span className="text-gray-400 text-sm w-6 text-right">{p.voteCount}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {stage >= STAGES.indexOf('accused') && (
        <div className="space-y-1">
          <p className="text-gray-400 text-sm">Most accused…</p>
          <p className="text-white text-2xl font-bold">{sortedPlayers[0]?.displayName}</p>
        </div>
      )}

      {stage >= STAGES.indexOf('question') && (
        <p className="text-gray-400 text-lg">Were they the imposter?</p>
      )}

      {stage >= STAGES.indexOf('reveal') && (
        <div className={`text-5xl font-extrabold ${caught ? 'text-green-400' : 'text-red-400'}`}>
          {caught ? 'YES! 🎉' : 'NO! 😈'}
        </div>
      )}

      {stage >= STAGES.indexOf('word') && (
        <div className="space-y-1">
          <p className="text-gray-400 text-sm">
            The imposter was <span className="text-white font-semibold">{imposterName}</span>
          </p>
          <p className="text-gray-400 text-sm">The secret word was</p>
          <p className="text-violet-400 text-3xl font-extrabold uppercase tracking-wide">{secretWord}</p>
        </div>
      )}

      {stage >= STAGES.indexOf('full') && (
        <div className="w-full space-y-3">
          {isHost && (
            <PrimaryButton fullWidth onClick={playAgain}>
              Play Again
            </PrimaryButton>
          )}
          <p className={`text-sm ${caught ? 'text-green-400' : 'text-red-400'}`}>
            {caught ? 'Crew wins! The imposter was caught.' : 'Imposter wins! They escaped.'}
          </p>
          {!isHost && (
            <p className="text-gray-500 text-sm">Waiting for host to start next round…</p>
          )}
        </div>
      )}
    </div>
  )
}
