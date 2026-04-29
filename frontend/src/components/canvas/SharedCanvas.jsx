import React, { useEffect, useRef } from 'react'
import CanvasManager from './CanvasManager.js'
import { useSocket } from '../../contexts/WebSocketContext.jsx'

export default function SharedCanvas({ isActive, sessionToken, turnSeq, strokes, color, width, onStrokeEnd }) {
  const committedRef = useRef(null)
  const activeRef = useRef(null)
  const managerRef = useRef(null)
  const { socket } = useSocket()

  // Init manager on mount
  useEffect(() => {
    if (!committedRef.current || !activeRef.current) return
    const mgr = new CanvasManager(committedRef.current, activeRef.current)
    mgr.init()
    managerRef.current = mgr

    mgr.onStrokeBegin(({ x, y }) => {
      socket?.emit('stroke_begin', { sessionToken, x, y })
    })
    mgr.onStrokePoint(({ x, y }) => {
      socket?.emit('stroke_point', { sessionToken, x, y })
    })
    mgr.onStrokeEnd(({ points, color: c, width: w }) => {
      onStrokeEnd?.({ points, color: c, width: w })
    })

    return () => mgr.destroy()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync active state
  useEffect(() => {
    managerRef.current?.setActive(isActive)
  }, [isActive])

  // Sync color and width
  useEffect(() => { managerRef.current?.setColor(color) }, [color])
  useEffect(() => { managerRef.current?.setWidth(width) }, [width])

  // Handle incoming remote strokes
  useEffect(() => {
    if (!socket) return
    const onBegin = ({ x, y }) => managerRef.current?.drawRemoteStrokeBegin(x, y, color, width)
    const onPoint = ({ x, y }) => managerRef.current?.drawRemoteStrokePoint(x, y)
    const onEnd = ({ points, color: c, width: w }) => managerRef.current?.drawRemoteStrokeEnd(points, c, w)
    socket.on('stroke_begin', onBegin)
    socket.on('stroke_point', onPoint)
    socket.on('stroke_end', onEnd)
    return () => {
      socket.off('stroke_begin', onBegin)
      socket.off('stroke_point', onPoint)
      socket.off('stroke_end', onEnd)
    }
  }, [socket, color, width])

  // Replay full stroke history when strokes change (reconnect / phase entry)
  useEffect(() => {
    managerRef.current?.replayStrokes(strokes ?? [])
  }, [strokes])

  // iOS context loss: redraw on visibility restore
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        managerRef.current?.replayStrokes(strokes ?? [])
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [strokes])

  return (
    <div className="relative w-full flex-1 rounded-xl overflow-hidden bg-white">
      <canvas
        ref={committedRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />
      <canvas
        ref={activeRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none', cursor: isActive ? 'crosshair' : 'default' }}
      />
    </div>
  )
}
