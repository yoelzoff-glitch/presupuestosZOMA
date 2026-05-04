'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  User,
  Save,
} from 'lucide-react'

export default function EditarCliente() {
  const { id } = useParams()

  const [cuit, setCuit] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    loadClient()
  }, [])

  async function loadClient() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      toast.error('Error al cargar cliente')
    }

    if (data) {
      setCuit(data.cuit || '')
      setName(data.name || '')
      setAddress(data.address || '')
    }

    setInitialLoading(false)
  }

  async function updateClient() {
    if (!name) {
      toast.error('El nombre es obligatorio')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('clients')
      .update({
        cuit,
        name,
        address,
      })
      .eq('id', id)

    setLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Cliente actualizado correctamente')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* HEADER */}
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-green-500/20 blur-3xl" />

        <div className="relative z-10">
          <Link
            href="/clientes"
            className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-green-200 hover:text-white"
          >
            <ArrowLeft size={17} />
            Volver a clientes
          </Link>

          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-green-200">
            <User size={14} />
            Cliente
          </div>

          <h1 className="text-3xl font-black">
            Editar cliente
          </h1>

          <p className="mt-2 text-sm text-slate-300">
            Modificá los datos del cliente
          </p>
        </div>
      </section>

      {/* FORM */}
      <section className="rounded-3xl border bg-white p-6 shadow-sm space-y-5">
        {initialLoading ? (
          <p className="text-sm text-slate-500">Cargando cliente...</p>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-600">
                CUIT
              </label>
              <input
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                className="w-full border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ej: 30-12345678-9"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-600">
                Nombre / Razón Social *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ej: Juan Pérez SRL"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-600">
                Dirección
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ej: Av. Corrientes 1234"
              />
            </div>
          </>
        )}
      </section>

      {/* BUTTON */}
      <div>
        <button
          onClick={updateClient}
          disabled={loading || initialLoading}
          className="w-full bg-green-600 text-white py-3 rounded-2xl font-bold hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={18} />
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}