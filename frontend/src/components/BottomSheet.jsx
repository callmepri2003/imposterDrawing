import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function BottomSheet({ isOpen, onClose, children, title }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-gray-800 rounded-t-2xl p-6 pb-10 safe-bottom animate-in slide-in-from-bottom duration-200">
        {title && <p className="text-gray-400 text-sm mb-4 text-center">{title}</p>}
        {children}
      </div>
    </div>,
    document.body
  )
}
