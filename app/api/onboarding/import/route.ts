import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { CompanyAccessError, requireActiveCompany } from '@/lib/billing/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  entity_type: z.enum(['products', 'clients']),
  file_name: z.string().trim().max(255).optional(),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
})

const optionalText = z.preprocess(
  (value) => value == null ? '' : String(value).trim(),
  z.string().max(255)
)

const optionalNumber = z.preprocess(
  (value) => value === '' || value == null ? 0 : Number(String(value).replace(',', '.')),
  z.number().finite().nonnegative()
)

const productSchema = z.object({
  name: z.preprocess((value) => String(value || '').trim(), z.string().min(1).max(255)),
  internal_code: optionalText,
  category: optionalText,
  supplier: optionalText,
  cost_price: optionalNumber,
  sale_price: optionalNumber,
  stock_quantity: optionalNumber,
  track_stock: z.preprocess(
    (value) => ['true', '1', 'si', 'sí', 'yes'].includes(String(value).toLowerCase()),
    z.boolean()
  ).default(false),
})

const clientSchema = z.object({
  name: z.preprocess((value) => String(value || '').trim(), z.string().min(1).max(255)),
  cuit: z.preprocess((value) => String(value || '').replace(/[^0-9]/g, ''), z.string().min(1).max(20)),
  email: optionalText,
  phone: optionalText,
  address: optionalText,
  client_type: z.preprocess(
    (value) => value === 'distribuidor' ? 'distribuidor' : 'consumidor_final',
    z.enum(['consumidor_final', 'distribuidor'])
  ),
})

export async function POST(request: NextRequest) {
  try {
    const context = await requireActiveCompany()
    if (context.role !== 'admin') {
      return NextResponse.json({ error: 'Solo un administrador puede importar datos.' }, { status: 403 })
    }

    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'El archivo no tiene un formato válido.' }, { status: 400 })
    }

    const admin = createSupabaseAdminClient()
    const fileHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ type: parsed.data.entity_type, rows: parsed.data.rows }))
      .digest('hex')

    const { data: duplicate } = await admin
      .from('import_jobs')
      .select('id, imported_rows, skipped_rows, error_rows')
      .eq('company_id', context.companyId)
      .eq('entity_type', parsed.data.entity_type)
      .eq('file_hash', fileHash)
      .in('status', ['completed', 'completed_with_errors'])
      .maybeSingle()

    if (duplicate) {
      return NextResponse.json({ ok: true, duplicate: true, job: duplicate })
    }

    const { data: job, error: jobError } = await admin
      .from('import_jobs')
      .insert({
        company_id: context.companyId,
        user_id: context.userId,
        entity_type: parsed.data.entity_type,
        file_name: parsed.data.file_name || null,
        file_hash: fileHash,
        total_rows: parsed.data.rows.length,
        status: 'processing',
      })
      .select('id')
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'No pudimos iniciar la importación.' }, { status: 500 })
    }

    const validRows: Array<Record<string, unknown>> = []
    const errors: Array<Record<string, unknown>> = []

    parsed.data.rows.forEach((row, index) => {
      const rowResult = parsed.data.entity_type === 'products'
        ? productSchema.safeParse(row)
        : clientSchema.safeParse(row)

      if (rowResult.success) {
        validRows.push({ ...rowResult.data, __row_number: index + 2 })
      } else {
        errors.push({
          import_job_id: job.id,
          row_number: index + 2,
          field_name: rowResult.error.issues[0]?.path.join('.') || null,
          error_code: rowResult.error.issues[0]?.code || 'invalid_row',
          message: rowResult.error.issues[0]?.message || 'Fila inválida',
          raw_row: row,
        })
      }
    })

    let skipped = 0
    let imported = 0
    const rowsToInsert: Array<Record<string, unknown>> = []

    if (parsed.data.entity_type === 'products') {
      const codes = validRows.map((row) => String(row.internal_code || '')).filter(Boolean)
      const names = validRows.map((row) => String(row.name || '')).filter(Boolean)
      const existingCodes = new Set<string>()
      const existingNames = new Set<string>()

      if (codes.length) {
        const { data } = await admin
          .from('products')
          .select('internal_code')
          .eq('company_id', context.companyId)
          .in('internal_code', codes)
        data?.forEach((row) => row.internal_code && existingCodes.add(row.internal_code.toLowerCase()))
      }
      if (names.length) {
        const { data } = await admin
          .from('products')
          .select('name')
          .eq('company_id', context.companyId)
          .in('name', names)
        data?.forEach((row) => existingNames.add(row.name.toLowerCase()))
      }

      for (const row of validRows) {
        const code = String(row.internal_code || '').toLowerCase()
        const name = String(row.name).toLowerCase()
        if ((code && existingCodes.has(code)) || existingNames.has(name)) {
          skipped += 1
          continue
        }
        const record = { ...row }
        Reflect.deleteProperty(record, '__row_number')
        rowsToInsert.push({ ...record, company_id: context.companyId, active: true })
        if (code) existingCodes.add(code)
        existingNames.add(name)
      }
    } else {
      const cuits = validRows.map((row) => String(row.cuit))
      const { data } = await admin
        .from('clients')
        .select('cuit')
        .eq('company_id', context.companyId)
        .in('cuit', cuits)
      const existingCuits = new Set((data || []).map((row) => row.cuit))

      for (const row of validRows) {
        const cuit = String(row.cuit)
        if (existingCuits.has(cuit)) {
          skipped += 1
          continue
        }
        const record = { ...row }
        Reflect.deleteProperty(record, '__row_number')
        rowsToInsert.push({ ...record, company_id: context.companyId, active: true })
        existingCuits.add(cuit)
      }
    }

    if (rowsToInsert.length) {
      const { data: inserted, error: insertError } = await admin
        .from(parsed.data.entity_type)
        .insert(rowsToInsert)
        .select('id')

      if (insertError) {
        await admin.from('import_jobs').update({
          status: 'failed',
          error_rows: parsed.data.rows.length,
          completed_at: new Date().toISOString(),
        }).eq('id', job.id)
        return NextResponse.json({ error: `No pudimos guardar las filas: ${insertError.message}` }, { status: 500 })
      }

      imported = inserted?.length || rowsToInsert.length
      if (inserted?.length) {
        await admin.from('imported_row_keys').insert(inserted.map((row, index) => ({
          import_job_id: job.id,
          row_key: crypto.createHash('sha256').update(JSON.stringify(rowsToInsert[index])).digest('hex'),
          created_record_id: row.id,
        })))
      }
    }

    if (errors.length) await admin.from('import_job_errors').insert(errors)

    const finalStatus = errors.length ? 'completed_with_errors' : 'completed'
    await admin.from('import_jobs').update({
      status: finalStatus,
      imported_rows: imported,
      skipped_rows: skipped,
      error_rows: errors.length,
      completed_at: new Date().toISOString(),
    }).eq('id', job.id)

    return NextResponse.json({
      ok: true,
      job_id: job.id,
      status: finalStatus,
      imported_rows: imported,
      skipped_rows: skipped,
      error_rows: errors.length,
      errors: errors.slice(0, 30),
    })
  } catch (error) {
    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    console.error('Onboarding import failed:', error)
    return NextResponse.json({ error: 'No pudimos procesar la importación.' }, { status: 500 })
  }
}
