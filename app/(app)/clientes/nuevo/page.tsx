'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Building2,
  CheckCircle2,
  IdCard,
  Loader2,
  MapPin,
  Upload,
} from 'lucide-react'
import * as XLSX from 'xlsx'

type ExcelClient = {
  cuit: string
  name: string
  address: string
}

export default function NuevoCliente() {
  const [cuit, setCuit] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function getCompanyId() {
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      throw new Error('No se pudo obtener el usuario logueado.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()

    if (profileError || !profile?.company_id) {
      throw new Error('No se pudo obtener la empresa del usuario.')
    }

    return profile.company_id
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setErrorMsg('')
    setSuccessMsg('')

    if (!cuit.trim()) {
      setErrorMsg('Ingresá el CUIT.')
      return
    }

    if (!/^\d+$/.test(cuit.trim())) {
      setErrorMsg('El CUIT debe ser numérico, sin guiones ni espacios.')
      return
    }

    if (!name.trim()) {
      setErrorMsg('Ingresá el nombre del cliente.')
      return
    }

    setLoading(true)

    try {
      const companyId = await getCompanyId()

      const { error } = await supabase.from('clients').insert({
        company_id: companyId,
        cuit: cuit.trim(),
        name: name.trim(),
        address: address.trim(),
      })

      if (error) {
        if (error.message.toLowerCase().includes('duplicate')) {
          setErrorMsg('Ese CUIT ya existe.')
        } else {
          console.error(error)
          setErrorMsg('Error al guardar el cliente.')
        }
        return
      }

      setSuccessMsg('Cliente creado correctamente.')
      setCuit('')
      setName('')
      setAddress('')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  function normalizeKey(key: string) {
    return key
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
  }

  function getValue(row: Record<string, any>, possibleKeys: string[]) {
    const normalizedRow: Record<string, any> = {}

    Object.keys(row).forEach((key) => {
      normalizedRow[normalizeKey(key)] = row[key]
    })

    for (const key of possibleKeys) {
      const value = normalizedRow[normalizeKey(key)]
      if (value !== undefined && value !== null) return String(value).trim()
    }

    return ''
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    setErrorMsg('')
    setSuccessMsg('')

    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()

    if (!['xlsx', 'xls', 'xlsm'].includes(extension || '')) {
      setErrorMsg('El archivo debe ser Excel: .xlsx, .xls o .xlsm.')
      e.target.value = ''
      return
    }

    setImporting(true)

    try {
      const companyId = await getCompanyId()

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: '',
      })

      if (!rows.length) {
        setErrorMsg('El Excel está vacío.')
        return
      }

      const clients: ExcelClient[] = rows
        .map((row) => {
          const client = {
            cuit: getValue(row, ['cuit', 'CUIT']),
            name: getValue(row, [
              'name',
              'nombre',
              'razon_social',
              'razón social',
              'cliente',
            ]),
            address: getValue(row, [
              'address',
              'direccion',
              'dirección',
              'domicilio',
            ]),
          }

          client.cuit = client.cuit.replace(/\D/g, '')

          return client
        })
        .filter((client) => client.cuit && client.name)

      if (!clients.length) {
        setErrorMsg(
          'No se encontraron clientes válidos. El Excel debe tener columnas CUIT y Nombre.'
        )
        return
      }

      const invalidCuit = clients.find((client) => !/^\d+$/.test(client.cuit))

      if (invalidCuit) {
        setErrorMsg('Hay CUIT inválidos. Deben ser numéricos.')
        return
      }

      const payload = clients.map((client) => ({
        company_id: companyId,
        cuit: client.cuit,
        name: client.name,
        address: client.address,
      }))

      const { error } = await supabase.from('clients').insert(payload)

      if (error) {
        console.error(error)

        if (error.message.toLowerCase().includes('duplicate')) {
          setErrorMsg(
            'Hay CUIT repetidos o clientes que ya existen en la base de datos.'
          )
        } else {
          setErrorMsg('Error al importar clientes desde Excel.')
        }

        return
      }

      setSuccessMsg(`Se importaron ${payload.length} clientes correctamente.`)
    } catch (err) {
      console.error(err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Error inesperado al importar.'
      )
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 px-8 py-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-200">
            <Building2 size={16} />
            Alta de cliente
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight">
            Nuevo Cliente
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Cargá los datos principales del cliente para poder generar
            presupuestos, comprobantes y cuenta corriente.
          </p>
        </div>

        <div className="border-b border-slate-100 bg-slate-50 px-8 py-6">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-dashed border-blue-300 bg-white px-5 py-4 transition hover:bg-blue-50">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                {importing ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <Upload size={22} />
                )}
              </div>

              <div>
                <p className="text-sm font-black text-slate-800">
                  Importar listado desde Excel
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  Acepta .xlsx, .xls y .xlsm. Columnas: CUIT, Nombre y Dirección.
                </p>
              </div>
            </div>

            <span className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white">
              Seleccionar archivo
            </span>

            <input
              type="file"
              accept=".xlsx,.xls,.xlsm"
              onChange={handleExcelImport}
              disabled={importing}
              className="hidden"
            />
          </label>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-8">
          {errorMsg && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              <CheckCircle2 size={18} />
              {successMsg}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                CUIT
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <IdCard size={18} className="text-slate-400" />
                <input
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                  placeholder="Ej: 30712345678"
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Nombre / Razón social
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <Building2 size={18} className="text-slate-400" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
                />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Dirección
            </span>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
              <MapPin size={18} className="text-slate-400" />
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección del cliente"
                className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
              />
            </div>
          </label>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={() => {
                setCuit('')
                setName('')
                setAddress('')
                setErrorMsg('')
                setSuccessMsg('')
              }}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Limpiar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}