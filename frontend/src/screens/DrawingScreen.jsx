import React, { useState, useEffect, useRef } from 'react'
import { useSocket } from '../contexts/WebSocketContext.jsx'
import { useGameState } from '../contexts/GameStateContext.jsx'
import SharedCanvas from '../components/canvas/SharedCanvas.jsx'
import CountdownTimer from '../components/CountdownTimer.jsx'
import AvatarDot from '../components/AvatarDot.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'

const COLORS = [
  { value: '#1e293b', label: 'Black' },
  { value: '#ef4444', label: 'Red' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f97316', label: 'Orange' },
  { value: '#a855f7', label: 'Purple' },
]
const WIDTHS = [2, 5, 10]

export default function DrawingScreen() {
  const { socket } = useSocket()
  const { state } = useGameState()
  const { players, drawOrder, currentTurnIdx, turnSeq, turnStart, strokes, playerId, sessionToken, myRole, myWord } = state

  const [color, setColor] = useState(COLORS[0].value)
  const [width, setWidth] = useState(WIDTHS[1])
  const [hasDrawn, setHasDrawn] = useState(false)
  const [showTurnBanner, setShowTurnBanner] = useState(false)
  const prevTurnSeq = useRef(0)

  const activePlayerId = drawOrder[currentTurnIdx]
  const isMyTurn = activePlayerId === playerId
  const activePlayer = players.find(p => p.id === activePlayerId)
  const activePlayerIndex = players.findIndex(p => p.id === activePlayerId)

  // Show "YOUR TURN" banner when turn changes to us
  useEffect(() => {
    if (isMyTurn && turnSeq !== prevTurnSeq.current) {
      prevTurnSeq.current = turnSeq
      setShowTurnBanner(true)
      setHasDrawn(false)
      navigator.vibrate?.(200)
      const t = setTimeout(() => setShowTurnBanner(false), 1500)
      return () => clearTimeout(t)
    }
    if (!isMyTurn) prevTurnSeq.current = turnSeq
  }, [isMyTurn, turnSeq])

  function handleStrokeEnd({ points, color: c, width: w }) {
    setHasDrawn(true)
    // Don't auto-submit — user taps End Turn
    // Store locally so we can send on End Turn
    pendingStroke.current = { points, color: c, width: w }
  }

  const pendingStroke = useRef(null)

  function endTurn() {
    const stroke = pendingStroke.current
    socket.emit('end_turn', {
      sessionToken,
      turnSeq,
      points: stroke?.points ?? [],
      color: stroke?.color ?? color,
      width: stroke?.width ?? width,
    })
    pendingStroke.current = null
    setHasDrawn(false)
  }

  function handleTimerExpire() {
    if (isMyTurn) endTurn()
  }

  return (
    <div className="h-full flex flex-col p-3 max-w-lg mx-auto relative">
      {/* YOUR TURN banner */}
      {showTurnBanner && (
        <div className="absolute inset-0 z-20 bg-violet-600/90 flex items-center justify-center rounded-2xl pointer-events-none">
          <p className="text-white text-4xl font-extrabold tracking-wide animate-pulse">YOUR TURN!</p>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-gray-400 text-sm">
          Turn {currentTurnIdx + 1}/{drawOrder.length} · Round {turnStart?.roundNumber ?? 1}/2
        </span>
        {isMyTurn && turnStart?.timeoutAt && (
          <CountdownTimer timeoutAt={turnStart.timeoutAt} onExpire={handleTimerExpire} />
        )}
      </div>

      {/* Active player indicator */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <AvatarDot index={activePlayerIndex} name={activePlayer?.displayName ?? '?'} size="sm" />
        <span className={`text-sm font-medium ${isMyTurn ? 'text-violet-400' : 'text-gray-300'}`}>
          {isMyTurn ? 'Your turn' : `${activePlayer?.displayName ?? '...'} is drawing`}
        </span>
      </div>

      {/* Word reminder — same position/style for both roles */}
      <div className="mb-2 px-1 h-5">
        {isMyTurn && (
          <p className="text-gray-400 text-xs">
            {myRole === 'imposter'
              ? <span className="text-red-400 font-medium">You are the IMPOSTER</span>
              : <>Word: <span className="text-violet-400 font-semibold">{myWord}</span></>
            }
          </p>
        )}
      </div>

      {/* Canvas */}
      <SharedCanvas
        isActive={isMyTurn}
        sessionToken={sessionToken}
        turnSeq={turnSeq}
        strokes={strokes}
        color={color}
        width={width}
        onStrokeEnd={handleStrokeEnd}
      />

      {/* Controls (active player only) */}
      {isMyTurn ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between bg-gray-800 rounded-xl p-3">
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c.value ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-gray-800' : ''}`}
                  style={{ backgroundColor: c.value }}
                  aria-label={c.label}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {WIDTHS.map(w => (
                <button
                  key={w}
                  onClick={() => setWidth(w)}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${width === w ? 'bg-violet-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  aria-label={`Stroke width ${w}`}
                >
                  <span
                    className="rounded-full bg-white"
                    style={{ width: w * 1.5, height: w * 1.5 }}
                  />
                </button>
              ))}
            </div>
          </div>
          <PrimaryButton fullWidth onClick={endTurn}>
            End Turn
          </PrimaryButton>
        </div>
      ) : (
        <div className="mt-3 px-1">
          <p className="text-gray-600 text-xs text-center">Spectating — your turn in {
            (() => {
              const myIdx = drawOrder.indexOf(playerId)
              if (myIdx === -1) return '...'
              const diff = (myIdx - currentTurnIdx + drawOrder.length) % drawOrder.length
              return diff === 0 ? 'soon' : `${diff} turn${diff > 1 ? 's' : ''}`
            })()
          }</p>
        </div>
      )}
    </div>
  )
}
