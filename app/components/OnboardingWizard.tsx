'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Package,
  SkipForward,
  Upload,
  Users,
} from 'lucide-react'

type EntityType = 'products' | 'clients'
type RawRow = Record<string, unknown>

const fields: Record<EntityType, Array<{ key: string; label: string; required?: boolean; aliases: string[] }>> = {
  products: [
    { key: 'name', label: 'Nombre', required: true, aliases: ['nombre', 'producto', 'name'] },
    { key: 'internal_code', label: 'Código interno', aliases: ['codigo', 'código', 'sku', 'internal_code'] },
    { key: 'category', label: 'Categoría', aliases: ['categoria', 'categoría', 'rubro', 'category'] },
    { key: 'supplier', label: 'Proveedor', aliases: ['proveedor', 'supplier'] },
    { key: 'cost_price', label: 'Precio de costo', aliases: ['costo', 'precio costo', 'cost_price'] },
    { key: 'sale_price', label: 'Precio de venta', aliases: ['precio', 'venta', 'precio venta', 'sale_price'] },
    { key: 'stock_quantity', label: 'Stock', aliases: ['stock', 'cantidad', 'stock_quantity'] },
    { key: 'track_stock', label: 'Controlar stock', aliases: ['control stock', 'track_stock'] },
  ],
  clients: [
    { key: 'name', label: 'Nombre', required: true, aliases: ['nombre', 'razon social', 'razón social', 'name'] },
    { key: 'cuit', label: 'CUIT', required: true, aliases: ['cuit', 'documento'] },
    { key: 'email', label: 'Email', aliases: ['email', 'correo'] },
    { key: 'phone', label: 'Teléfono', aliases: ['telefono', 'teléfono', 'celular', 'phone'] },
    { key: 'address', label: 'Dirección', aliases: ['direccion', 'dirección', 'domicilio', 'address'] },
    { key: 'client_type', label: 'Tipo de cliente', aliases: ['tipo', 'client_type'] },
  ],
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

export default function OnboardingWizard() {
  const router = useRouter()
  const [entity, setEntity] = useState<EntityType>('products')
  const [fileName, setFileName] = useState('')
  const [rawRows, setRawRows] = useState<RawRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<null | {
    imported_rows: number
    skipped_rows: number
    error_rows: number
    duplicate?: boolean
  }>(null)

  const mappedRows = useMemo(() => rawRows.map((row) => {
    const output: RawRow = {}
    for (const field of fields[entity]) {
      const source = mapping[field.key]
      if (source) output[field.key] = row[source]
    }
    return output
  }), [entity, mapping, rawRows])

  function switchEntity(next: EntityType) {
    setEntity(next)
    setRawRows([])
    setHeaders([])
    setMapping({})
    setFileName('')
    setResult(null)
    setError('')
  }

  async function readFile(file: File) {
    setError('')
    setResult(null)
    const XLSX = await import('xlsx')
    const bytes = await file.arrayBuffer()
    const workbook = XLSX.read(bytes, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<RawRow>(firstSheet, { defval: '' })

    if (!rows.length) throw new Error('El archivo no contiene filas.')
    if (rows.length > 500) throw new Error('La primera versión admite hasta 500 filas por importación.')

    const detectedHeaders = Object.keys(rows[0])
    const automaticMapping: Record<string, string> = {}
    for (const field of fields[entity]) {
      const match = detectedHeaders.find((header) =>
        field.aliases.map(normalized).includes(normalized(header))
      )
      if (match) automaticMapping[field.key] = match
    }

    setFileName(file.name)
    setHeaders(detectedHeaders)
    setRawRows(rows)
    setMapping(automaticMapping)
  }

  async function importRows() {
    const missing = fields[entity].filter((field) => field.required && !mapping[field.key])
    if (missing.length) {
      setError(`Asigna las columnas obligatorias: ${missing.map((field) => field.label).join(', ')}.`)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/onboarding/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: entity, file_name: fileName, rows: mappedRows }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'No pudimos importar el archivo.')
      setResult(body)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'No pudimos importar el archivo.')
    } finally {
      setLoading(false)
    }
  }

  async function finish() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (!response.ok) throw new Error('No pudimos finalizar la configuración.')
      router.replace('/dashboard')
      router.refresh()
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : 'No pudimos continuar.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <span className="text-xl font-extrabold tracking-tight">ZOMA <span className="text-emerald-700">ERP</span></span>
          <button onClick={finish} disabled={loading} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950">
            Omitir por ahora <SkipForward size={16} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 lg:py-12">
        <div className="mb-7 max-w-2xl">
          <p className="text-sm font-bold text-emerald-700">Empresa creada correctamente</p>
          <h1 className="mt-1 text-3xl font-extrabold">Carga tus datos iniciales</h1>
          <p className="mt-2 text-slate-600">Importa una planilla Excel o CSV. Primero podrás relacionar columnas y revisar una muestra.</p>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200 p-2">
            <button onClick={() => switchEntity('products')} className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-bold ${entity === 'products' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Package size={17} /> Productos
            </button>
            <button onClick={() => switchEntity('clients')} className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-bold ${entity === 'clients' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Users size={17} /> Clientes
            </button>
          </div>

          <div className="grid gap-7 p-5 sm:p-7">
            {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

            {!rawRows.length ? (
              <label className="grid min-h-56 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-emerald-600 hover:bg-emerald-50">
                <span>
                  <Upload className="mx-auto text-emerald-700" size={34} />
                  <span className="mt-3 block font-extrabold">Seleccionar Excel o CSV</span>
                  <span className="mt-1 block text-sm text-slate-500">Máximo 500 filas por archivo</span>
                </span>
                <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void readFile(file).catch((fileError) => setError(fileError.message))
                }} />
              </label>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <FileSpreadsheet className="text-emerald-700" size={22} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{fileName}</p>
                    <p className="text-xs text-slate-500">{rawRows.length} filas detectadas</p>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-extrabold">Relacionar columnas</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {fields[entity].map((field) => (
                      <label key={field.key} className="grid gap-1.5 text-sm font-semibold text-slate-700">
                        {field.label}{field.required && <span className="text-red-600"> *</span>}
                        <select value={mapping[field.key] || ''} onChange={(e) => setMapping((current) => ({ ...current, [field.key]: e.target.value }))} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                          <option value="">No importar</option>
                          {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-950 text-white"><tr>{fields[entity].filter((field) => mapping[field.key]).map((field) => <th key={field.key} className="px-3 py-2 font-bold">{field.label}</th>)}</tr></thead>
                    <tbody>{mappedRows.slice(0, 5).map((row, index) => <tr key={index} className="border-t border-slate-200">{fields[entity].filter((field) => mapping[field.key]).map((field) => <td key={field.key} className="max-w-48 truncate px-3 py-2">{String(row[field.key] ?? '')}</td>)}</tr>)}</tbody>
                  </table>
                </div>

                {result && (
                  <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <CheckCircle2 className="shrink-0" size={21} />
                    <div><p className="font-extrabold">Importación terminada</p><p>{result.imported_rows} agregados, {result.skipped_rows} omitidos y {result.error_rows} con error.</p></div>
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5">
                  <button onClick={() => { setRawRows([]); setHeaders([]); setMapping({}); setResult(null) }} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Elegir otro archivo</button>
                  <div className="flex gap-3">
                    {!result && <button onClick={importRows} disabled={loading} className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{loading && <Loader2 className="animate-spin" size={16} />} Importar {entity === 'products' ? 'productos' : 'clientes'}</button>}
                    {result && <button onClick={finish} disabled={loading} className="flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white">Ir al dashboard <ArrowRight size={16} /></button>}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
