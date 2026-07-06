'use client'

import React from 'react'
import { useMirror } from './MirrorProvider'
import { CheckCircle2, Lock } from 'lucide-react'

type RecordTypeSelectorProps = {
  value: 'blanco' | 'x'
  onChange: (value: 'blanco' | 'x') => void
  label?: string
}

export default function RecordTypeSelector({
  value,
  onChange,
  label = 'Tipo de Registro'
}: RecordTypeSelectorProps) {
  const { isPro, isMirrorUser, loading } = useMirror()

  if (loading || !isPro || isMirrorUser) {
    return null
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 border border-slate-200">
        <button
          type="button"
          onClick={() => onChange('blanco')}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
            value === 'blanco'
              ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 size={15} className={value === 'blanco' ? 'text-emerald-600' : 'text-slate-400'} />
          Oficial (Blanco)
        </button>
        <button
          type="button"
          onClick={() => onChange('x')}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
            value === 'x'
              ? 'bg-slate-900 text-white shadow-sm border border-slate-800'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock size={14} className={value === 'x' ? 'text-teal-400' : 'text-slate-400'} />
          Interno (X)
        </button>
      </div>
    </div>
  )
}
