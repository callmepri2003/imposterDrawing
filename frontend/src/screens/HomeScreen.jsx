import React, { useState, useEffect } from 'react'
import { useSocket } from '../contexts/WebSocketContext.jsx'
import { useGameState } from '../contexts/GameStateContext.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'
import CodeInputBoxes from '../components/CodeInputBoxes.jsx'

export default function HomeScreen() {
  const [name, setName] = useState(() => localStorage.getItem('imposter_name') ?? '')
  const [showJoin, setShowJoin] = useState(false)
  const [code, setCode] = useState('')
  const { socket } = useSocket()
  const { state, dispatch } = useGameState()

  useEffect(() => {
    if (name) localStorage.setItem('imposter_name', name)
  }, [name])

  const nameValid = name.trim().length > 0

  function handleCreate() {
    if (!nameValid) return
    dispatch({ type: 'CLEAR_ERROR' })
    socket.emit('create_room', { displayName: name.trim() })
  }

  function handleJoin() {
    if (!nameValid || code.length < 6) return
    dispatch({ type: 'CLEAR_ERROR' })
    socket.emit('join_room', { displayName: name.trim(), roomCode: code })
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-violet-400">Imposter</h1>
          <p className="text-gray-400 text-sm">Drawing game — one of you doesn't know the word</p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Your display name"
            value={name}
            maxLength={20}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (showJoin ? handleJoin() : handleCreate())}
            className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-base"
            autoFocus
            data-testid="name-input"
          />

          {state.error && (
            <p className="text-red-400 text-sm text-center" role="alert">{state.error}</p>
          )}

          <PrimaryButton fullWidth onClick={handleCreate} disabled={!nameValid}>
            Create a Game
          </PrimaryButton>

          {!showJoin ? (
            <PrimaryButton fullWidth variant="ghost" onClick={() => setShowJoin(true)} disabled={!nameValid}>
              Join with Code
            </PrimaryButton>
          ) : (
            <div className="space-y-3">
              <CodeInputBoxes value={code} onChange={setCode} />
              <PrimaryButton fullWidth onClick={handleJoin} disabled={!nameValid || code.length < 6}>
                Join Game
              </PrimaryButton>
              <button
                onClick={() => { setShowJoin(false); setCode('') }}
                className="w-full text-gray-500 text-sm hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
