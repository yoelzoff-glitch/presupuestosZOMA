'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
} from 'lucide-react'

type ExcelProduct = {
  codigo: string
  proveedor: string
  producto: string
  categoria: string
  precio: number
}

export default function ImportarProductosPage() {
  const [rows, setRows] = useState<ExcelProduct[]>([])
  const [loading, setLoading] = useState(false)

  async function getCompanyId() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) return null

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()

    return profile?.company_id ?? null
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]

      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: '',
      })

      const normalized = json.map((row) => ({
        codigo: String(row.codigo ?? row.Codigo ?? '').trim(),
        proveedor: String(row.proveedor ?? row.Proveedor ?? '').trim(),
        producto: String(row.producto ?? row.Producto ?? '').trim(),
        categoria: String(row.categoria ?? row.Categoria ?? '').trim(),
        precio: Number(row.precio ?? row.Precio ?? 0),
      }))

      const validRows = normalized.filter(
        (row) => row.codigo && row.producto && !Number.isNaN(row.precio)
      )

      if (validRows.length === 0) {
        toast.error('El Excel no tiene productos válidos.')
        return
      }

      setRows(validRows)
      toast.success(`Se leyeron ${validRows.length} productos.`)
    }

    reader.readAsArrayBuffer(file)
  }

  async function importProducts() {
    if (rows.length === 0) {
      toast.error('Primero seleccioná un Excel.')
      return
    }

    setLoading(true)

    const companyId = await getCompanyId()

    if (!companyId) {
      toast.error('No se encontró la empresa del usuario.')
      setLoading(false)
      return
    }

    try {
      const newCodes = rows.map((r) => r.codigo)

      // 🧠 1. TRAER PRODUCTOS ACTUALES
      const { data: existingProducts, error: fetchError } = await supabase
        .from('products')
        .select('internal_code')
        .eq('company_id', companyId)

      if (fetchError) throw fetchError

      const existingCodes =
        existingProducts?.map((p) => p.internal_code) || []

      // 🧨 2. CALCULAR CUÁLES BORRAR
      const codesToDelete = existingCodes.filter(
        (code) => !newCodes.includes(code)
      )

      // 🗑️ 3. BORRAR SOLO LOS QUE SOBRAN
      if (codesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('products')
          .delete()
          .eq('company_id', companyId)
          .in('internal_code', codesToDelete)

        if (deleteError) throw deleteError
      }

      // 📦 4. UPSERT (INSERT / UPDATE)
      const productsToInsert = rows.map((row) => ({
        company_id: companyId,
        internal_code: row.codigo,
        supplier: row.proveedor || null,
        name: row.producto,
        category: row.categoria || null,
        cost_price: row.precio,
        last_price_update: new Date().toISOString(),
      }))

      const { error: upsertError } = await supabase
        .from('products')
        .upsert(productsToInsert, {
          onConflict: 'company_id,internal_code',
        })

      if (upsertError) throw upsertError

      toast.success('Productos sincronizados correctamente.')
      setRows([])
    } catch (err: any) {
      toast.error(err.message || 'Error al importar productos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="relative z-10">
          <Link
            href="/productos"
            className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 hover:text-white"
          >
            <ArrowLeft size={17} />
            Volver a productos
          </Link>

          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
            <FileSpreadsheet size={14} />
            Importación
          </div>

          <h1 className="text-3xl font-black">
            Importar productos desde Excel
          </h1>

          <p className="mt-2 text-sm text-slate-300">
            El archivo debe tener las columnas:
            <br />
            <b>codigo, proveedor, producto, categoria, precio</b>
          </p>
        </div>
      </section>

      {/* CARGA */}
      <section className="rounded-3xl border bg-white p-6 shadow-sm space-y-4">
        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-2xl p-10 cursor-pointer hover:bg-slate-50">
          <Upload size={30} className="text-slate-400" />
          <p className="text-sm font-bold text-slate-600">
            Seleccionar archivo Excel
          </p>

          <input type="file" accept=".xlsx,.xls" hidden onChange={handleFile} />
        </label>

        {rows.length > 0 && (
          <div className="text-sm text-green-600 font-bold flex items-center gap-2">
            <CheckCircle2 size={16} />
            {rows.length} productos listos para importar
          </div>
        )}
      </section>

      {/* PREVIEW */}
      {rows.length > 0 && (
        <section className="rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-black text-lg">Vista previa</h2>
          </div>

          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left text-xs">Código</th>
                <th className="p-3 text-left text-xs">Producto</th>
                <th className="p-3 text-left text-xs">Proveedor</th>
                <th className="p-3 text-left text-xs">Precio</th>
              </tr>
            </thead>

            <tbody>
              {rows.slice(0, 10).map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3">{r.codigo}</td>
                  <td className="p-3 font-bold">{r.producto}</td>
                  <td className="p-3">{r.proveedor}</td>
                  <td className="p-3">
                    ${r.precio.toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* BOTÓN */}
      <div>
        <button
          onClick={importProducts}
          disabled={loading || rows.length === 0}
          className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Importando...' : 'Importar productos'}
        </button>
      </div>
    </div>
  )
}