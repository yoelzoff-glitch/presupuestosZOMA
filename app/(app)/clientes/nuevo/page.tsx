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
  Mail,
  Phone,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

type ExcelClient = {
  cuit: string
  name: string
  address: string
  email: string
  phone: string
}

export default function NuevoCliente() {
  const [cuit, setCuit] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function getUserContext() {
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      throw new Error('No se pudo obtener el usuario logueado.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('users_profiles')
      .select('company_id, role')
      .eq('id', userData.user.id)
      .single()

    if (profileError || !profile?.company_id) {
      throw new Error('No se pudo obtener la empresa del usuario.')
    }

    return { 
      companyId: profile.company_id, 
      role: profile.role, 
      userId: userData.user.id 
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setErrorMsg('')
    setSuccessMsg('')

    if (!name.trim()) {
      setErrorMsg('El Nombre / Razón Social es obligatorio.')
      return
    }

    // El CUIT/DNI ya no es obligatorio, pero si se pone, debe ser numérico
    if (cuit.trim() && !/^\d+$/.test(cuit.trim())) {
      setErrorMsg('El CUIT/DNI debe ser numérico, sin guiones ni espacios.')
      return
    }

    setLoading(true)

    try {
      const { companyId, role, userId } = await getUserContext()

      const { error } = await supabase.from('clients').insert({
        company_id: companyId,
        cuit: cuit.trim() || null,
        name: name.trim(),
        address: address.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        seller_id: role === 'vendedor' ? userId : null
      })

      if (error) {
        if (error.message.toLowerCase().includes('duplicate')) {
          setErrorMsg('Ese CUIT/DNI ya existe en la base de datos.')
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
      setEmail('')
      setPhone('')
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
      const { companyId, role, userId } = await getUserContext()

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
          return {
            cuit: getValue(row, ['cuit', 'dni', 'documento', 'identificacion']),
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
            email: getValue(row, ['email', 'mail', 'correo', 'e-mail']),
            phone: getValue(row, ['phone', 'telefono', 'tel', 'celular', 'whatsapp']),
          }
        })
        .filter((client) => client.name) // Solo pedimos nombre obligatorio

      if (!clients.length) {
        setErrorMsg(
          'No se encontraron clientes válidos. El Excel debe tener al menos una columna de Nombre.'
        )
        return
      }

      const payload = clients.map((client) => ({
        company_id: companyId,
        cuit: client.cuit.replace(/\D/g, '') || null,
        name: client.name,
        address: client.address || null,
        email: client.email || null,
        phone: client.phone || null,
        seller_id: role === 'vendedor' ? userId : null
      }))

      const { error } = await supabase.from('clients').insert(payload)

      if (error) {
        console.error(error)
        if (error.message.toLowerCase().includes('duplicate')) {
          setErrorMsg('Hay CUIT/DNI repetidos en el Excel que ya existen en la base de datos.')
        } else {
          setErrorMsg('Error al importar clientes. Verificá que las columnas sean correctas.')
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
      <div className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-500 hover:shadow-xl">
        <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-8 py-10 text-white relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-200 backdrop-blur-md">
              <Building2 size={16} />
              Alta de cliente flexible
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-tight">
              Nuevo Cliente
            </h1>

            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300 font-medium">
              Cargá empresas o consumidores finales. Solo el nombre es obligatorio; 
              el resto de los datos podés completarlos luego.
            </p>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-8">
          <label className="flex cursor-pointer flex-col sm:flex-row items-center justify-between gap-5 rounded-[2rem] border-2 border-dashed border-blue-200 bg-white px-7 py-6 transition-all hover:border-blue-400 hover:bg-blue-50/50 group">
            <div className="flex items-center gap-5">
              <div className="rounded-2xl bg-blue-600 p-4 text-white shadow-lg shadow-blue-600/30 transition group-hover:scale-110">
                {importing ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Upload size={24} />
                )}
              </div>

              <div className="text-center sm:text-left">
                <p className="text-lg font-black text-slate-900">
                  Importar desde Excel
                </p>
                <p className="text-sm font-semibold text-slate-500 leading-relaxed">
                  Columnas sugeridas: Nombre, CUIT/DNI, Dirección, Mail, Teléfono.
                </p>
              </div>
            </div>

            <span className="shrink-0 rounded-2xl bg-slate-950 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl transition hover:bg-blue-600 active:scale-95">
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

        <form onSubmit={handleSubmit} className="space-y-8 p-8 lg:p-10">
          {errorMsg && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 animate-in fade-in slide-in-from-top-2">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-700 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 size={20} />
              {successMsg}
            </div>
          )}

          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block group">
                <span className="mb-2.5 block text-sm font-black text-slate-700 transition group-focus-within:text-blue-600">
                  Nombre / Razón social <span className="text-red-500">*</span>
                </span>

                <div className="flex items-center gap-3 rounded-[1.25rem] border-2 border-slate-100 bg-slate-50/50 px-5 py-4 transition-all focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/50">
                  <Building2 size={20} className="text-slate-400 group-focus-within:text-blue-500" />
                  <input
                    value={name}
                    required
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Juan Pérez o Empresa S.A."
                    className="w-full bg-transparent text-base font-bold text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400"
                  />
                </div>
              </label>

              <label className="block group">
                <span className="mb-2.5 block text-sm font-black text-slate-700 transition group-focus-within:text-blue-600">
                  CUIT / DNI
                </span>

                <div className="flex items-center gap-3 rounded-[1.25rem] border-2 border-slate-100 bg-slate-50/50 px-5 py-4 transition-all focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/50">
                  <IdCard size={20} className="text-slate-400 group-focus-within:text-blue-500" />
                  <input
                    value={cuit}
                    onChange={(e) => setCuit(e.target.value)}
                    placeholder="Opcional: Solo números"
                    className="w-full bg-transparent text-base font-bold text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400"
                  />
                </div>
              </label>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <label className="block group">
                <span className="mb-2.5 block text-sm font-black text-slate-700 transition group-focus-within:text-blue-600">
                  Email
                </span>

                <div className="flex items-center gap-3 rounded-[1.25rem] border-2 border-slate-100 bg-slate-50/50 px-5 py-4 transition-all focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/50">
                  <Mail size={20} className="text-slate-400 group-focus-within:text-blue-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full bg-transparent text-base font-bold text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400"
                  />
                </div>
              </label>

              <label className="block group">
                <span className="mb-2.5 block text-sm font-black text-slate-700 transition group-focus-within:text-blue-600">
                  Teléfono / WhatsApp
                </span>

                <div className="flex items-center gap-3 rounded-[1.25rem] border-2 border-slate-100 bg-slate-50/50 px-5 py-4 transition-all focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/50">
                  <Phone size={20} className="text-slate-400 group-focus-within:text-blue-500" />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: +54 9 11 ..."
                    className="w-full bg-transparent text-base font-bold text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400"
                  />
                </div>
              </label>
            </div>

            <label className="block group">
              <span className="mb-2.5 block text-sm font-black text-slate-700 transition group-focus-within:text-blue-600">
                Dirección completa
              </span>

              <div className="flex items-center gap-3 rounded-[1.25rem] border-2 border-slate-100 bg-slate-50/50 px-5 py-4 transition-all focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/50">
                <MapPin size={20} className="text-slate-400 group-focus-within:text-blue-500" />
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, Número, Localidad..."
                  className="w-full bg-transparent text-base font-bold text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400"
                />
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-4 border-t border-slate-100 pt-8">
            <button
              type="button"
              onClick={() => {
                setCuit('')
                setName('')
                setAddress('')
                setEmail('')
                setPhone('')
                setErrorMsg('')
                setSuccessMsg('')
              }}
              className="rounded-2xl border-2 border-slate-200 bg-white px-8 py-4 text-sm font-black text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
            >
              Limpiar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-3 rounded-2xl bg-blue-600 px-10 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/25 transition-all hover:bg-blue-700 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && <Loader2 size={20} className="animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}