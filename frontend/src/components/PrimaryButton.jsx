import React from 'react'

export default function PrimaryButton({ children, onClick, disabled, fullWidth, variant = 'primary', className = '' }) {
  const base = 'min-h-[44px] px-6 py-3 rounded-xl font-semibold text-base transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 select-none'
  const variants = {
    primary: `bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white focus:ring-violet-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed`,
    ghost: `bg-transparent border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white focus:ring-gray-400 disabled:opacity-40 disabled:cursor-not-allowed`,
    danger: `bg-red-600 hover:bg-red-500 active:bg-red-700 text-white focus:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed`,
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  )
}
