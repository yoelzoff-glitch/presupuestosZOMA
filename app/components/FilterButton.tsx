'use client'

import React from 'react'

interface FilterButtonProps {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  variant?: 'blue' | 'slate'
}

export default function FilterButton({ children, active, onClick, variant = 'slate' }: FilterButtonProps) {
  const baseStyles = "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all"
  
  const variants = {
    slate: active 
      ? 'bg-white text-slate-900 shadow-sm' 
      : 'text-slate-500 hover:text-slate-700',
    blue: active 
      ? 'bg-white text-slate-900 shadow-lg' 
      : 'text-blue-200 hover:text-white hover:bg-white/5'
  }

  return (
    <button 
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]}`}
    >
      {children}
    </button>
  )
}
