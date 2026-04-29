import React from 'react'
import { getPlayerColor } from '../contexts/GameStateContext.jsx'

export default function AvatarDot({ index = 0, name = '', size = 'md' }) {
  const color = getPlayerColor(index)
  const sizes = { sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-gray-900 flex-shrink-0 ${sizes[size]}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
