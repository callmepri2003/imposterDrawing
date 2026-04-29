import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const WebSocketContext = createContext(null)

export function WebSocketProvider({ children, socketUrl }) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    const url = socketUrl ?? (import.meta.env.VITE_SOCKET_URL ?? '')
    const socket = io(url, { transports: ['websocket'], autoConnect: true })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))

    return () => { socket.disconnect() }
  }, [socketUrl])

  return (
    <WebSocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useSocket() {
  const ctx = useContext(WebSocketContext)
  if (!ctx) throw new Error('useSocket must be used inside WebSocketProvider')
  return ctx
}
