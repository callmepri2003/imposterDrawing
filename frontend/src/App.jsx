import React from 'react'
import { WebSocketProvider } from './contexts/WebSocketContext.jsx'
import { GameStateProvider, useGameState } from './contexts/GameStateContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import HomeScreen from './screens/HomeScreen.jsx'
import LobbyScreen from './screens/LobbyScreen.jsx'
import WordAssignmentScreen from './screens/WordAssignmentScreen.jsx'
import DrawingScreen from './screens/DrawingScreen.jsx'
import VotingScreen from './screens/VotingScreen.jsx'
import RevealScreen from './screens/RevealScreen.jsx'
import ErrorScreen from './screens/ErrorScreen.jsx'

function GameRouter() {
  const { state } = useGameState()
  const { phase } = state

  if (phase === 'disconnected') return <ErrorScreen />
  if (phase === 'lobby') return <LobbyScreen />
  if (phase === 'word_assignment') return <WordAssignmentScreen />
  if (phase === 'drawing') return <DrawingScreen />
  if (phase === 'voting') return <VotingScreen />
  if (phase === 'reveal') return <RevealScreen />
  return <HomeScreen />
}

export default function App() {
  return (
    <WebSocketProvider>
      <GameStateProvider>
        <ToastProvider>
          <div className="h-full">
            <GameRouter />
          </div>
        </ToastProvider>
      </GameStateProvider>
    </WebSocketProvider>
  )
}
