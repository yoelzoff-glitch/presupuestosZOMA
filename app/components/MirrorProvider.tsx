'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

type MirrorContextType = {
  isMirrorUser: boolean
  hasMirrorAccount: boolean
  mirrorEmail: string | null
  isMirrorActive: boolean
  isPro: boolean
  loading: boolean
  refreshMirrorStatus: () => Promise<void>
}

const MirrorContext = createContext<MirrorContextType | undefined>(undefined)

export function MirrorProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Omit<MirrorContextType, 'loading' | 'refreshMirrorStatus'>>({
    isMirrorUser: false,
    hasMirrorAccount: false,
    mirrorEmail: null,
    isMirrorActive: false,
    isPro: false
  })
  const [loading, setLoading] = useState(true)

  const refreshMirrorStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/mirror/status')
      if (res.ok) {
        const data = await res.json()
        setStatus({
          isMirrorUser: data.isMirrorUser,
          hasMirrorAccount: data.hasMirrorAccount,
          mirrorEmail: data.mirrorEmail,
          isMirrorActive: data.isMirrorActive,
          isPro: data.isPro
        })
      }
    } catch (error) {
      console.error('Error fetching mirror status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMirrorStatus()
  }, [refreshMirrorStatus])

  return (
    <MirrorContext.Provider
      value={{
        ...status,
        loading,
        refreshMirrorStatus
      }}
    >
      {children}
    </MirrorContext.Provider>
  )
}

export function useMirror() {
  const context = useContext(MirrorContext)
  if (context === undefined) {
    throw new Error('useMirror debe ser usado dentro de un MirrorProvider')
  }
  return context
}
