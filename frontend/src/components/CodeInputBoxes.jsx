import React, { useRef } from 'react'

export default function CodeInputBoxes({ value, onChange }) {
  const chars = value.split('').concat(Array(6).fill('')).slice(0, 6)
  const refs = useRef([])

  function handleChange(i, e) {
    const char = e.target.value.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '').slice(-1)
    const next = [...chars]
    next[i] = char
    onChange(next.join(''))
    if (char && i < 5) refs.current[i + 1]?.focus()
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData('text')
      .toUpperCase()
      .replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '')
      .slice(0, 6)
    onChange(pasted.padEnd(6, '').slice(0, 6))
    refs.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div className="flex gap-2 justify-center" role="group" aria-label="Room code">
      {chars.map((ch, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="text"
          maxLength={1}
          value={ch}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="w-10 h-12 text-center text-xl font-bold uppercase bg-gray-700 border-2 border-gray-600 rounded-lg text-white focus:border-violet-500 focus:outline-none caret-transparent"
          aria-label={`Code character ${i + 1}`}
        />
      ))}
    </div>
  )
}
