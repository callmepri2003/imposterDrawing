import React, { useState } from 'react'
import { useSocket } from '../contexts/WebSocketContext.jsx'
import { useGameState } from '../contexts/GameStateContext.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import CountdownTimer from '../components/CountdownTimer.jsx'
import AvatarDot from '../components/AvatarDot.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'

export default function VotingScreen() {
  const { socket } = useSocket()
  const { state } = useGameState()
  const { players, playerId, sessionToken, votedCount, totalCount, myVote, turnStart } = state
  const [pending, setPending] = useState(null)
  const [sheet, setSheet] = useState(false)

  const votable = players.filter(p => p.id !== playerId && p.isConnected)
  const hasVoted = !!myVote

  function selectPlayer(p) {
    if (hasVoted) return
    setPending(p)
    setSheet(true)
  }

  function confirmVote() {
    if (!pending) return
    socket.emit('submit_vote', { sessionToken, targetPlayerId: pending.id })
    // Optimistic update via dispatch happens via server event
    setSheet(false)
  }

  // Use voting timeoutAt stored in turnStart or fall back
  const timeoutAt = state.votingTimeoutAt

  return (
    <div className="min-h-full flex flex-col p-6 max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Who's the imposter?</h2>
          <p className="text-gray-400 text-sm mt-0.5">Vote for who you think it is</p>
        </div>
        {timeoutAt && <CountdownTimer timeoutAt={timeoutAt} />}
      </div>

      <div className="flex-1 space-y-2">
        {votable.map((p, i) => {
          const idx = players.findIndex(pl => pl.id === p.id)
          const selected = myVote === p.id
          return (
            <button
              key={p.id}
              onClick={() => selectPlayer(p)}
              disabled={hasVoted}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                selected
                  ? 'border-violet-500 bg-violet-500/10'
                  : hasVoted
                  ? 'border-gray-700 bg-gray-800 opacity-60'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-500 active:scale-[0.98]'
              }`}
            >
              <AvatarDot index={idx} name={p.displayName} />
              <span className="flex-1 font-medium text-white">{p.displayName}</span>
              {selected && <span className="text-violet-400 text-lg">✓</span>}
            </button>
          )
        })}
      </div>

      <div className="pt-4 space-y-2 safe-bottom">
        <p className="text-gray-500 text-xs text-center">You can't vote for yourself</p>
        {hasVoted ? (
          <p className="text-gray-400 text-sm text-center">
            Waiting for others… {votedCount}/{totalCount} voted
          </p>
        ) : (
          <p className="text-gray-500 text-sm text-center">Tap a player to vote</p>
        )}
      </div>

      <BottomSheet isOpen={sheet} onClose={() => setSheet(false)} title="Confirm your vote">
        <div className="space-y-4">
          <p className="text-white text-lg font-semibold text-center">
            Vote for <span className="text-violet-400">{pending?.displayName}</span>?
          </p>
          <PrimaryButton fullWidth onClick={confirmVote}>Confirm</PrimaryButton>
          <PrimaryButton fullWidth variant="ghost" onClick={() => setSheet(false)}>Cancel</PrimaryButton>
        </div>
      </BottomSheet>
    </div>
  )
}
