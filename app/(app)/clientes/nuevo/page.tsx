'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function NuevoCliente() {
  const [cuit, setCuit] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // ========================
    // VALIDACIONES (igual VBA)
    // ========================

    if (!cuit) {
      alert('Ingresá el CUIT')
      return
    }

    if (!/^\d+$/.test(cuit)) {
      alert('El CUIT debe ser numérico')
      return
    }

    if (!name) {
      alert('Ingresá el nombre')
      return
    }

    setLoading(true)

    // ========================
    // TRAER COMPANY_ID
    // ========================

    const { data: user } = await supabase.auth.getUser()

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.user?.id)
      .single()

    const company_id = profile?.company_id

    // ========================
    // INSERTAR
    // ========================

    const { error } = await supabase.from('clients').insert({
      company_id,
      cuit,
      name,
      address,
    })

    setLoading(false)

    if (error) {
      if (error.message.includes('duplicate')) {
        alert('Ese CUIT ya existe')
      } else {
        console.error(error)
        alert('Error al guardar')
      }
      return
    }

    alert('Cliente creado correctamente')

    // limpiar
    setCuit('')
    setName('')
    setAddress('')
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Nuevo Cliente</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          placeholder="CUIT"
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
          className="w-full border p-3 rounded"
        />

        <input
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border p-3 rounded"
        />

        <input
          placeholder="Dirección"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full border p-3 rounded"
        />

        <button
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-3 rounded w-full"
        >
          {loading ? 'Guardando...' : 'Guardar Cliente'}
        </button>
      </form>
    </div>
  )
}
