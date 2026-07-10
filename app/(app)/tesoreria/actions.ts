'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createServerComponentClient, getServerUserContext } from '@/lib/supabase/server'

const registerPurchaseSchema = z.object({
  productId: z.string().uuid('Producto inválido'),
  supplierId: z.string().uuid('Proveedor inválido'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.number().nonnegative('El costo unitario no puede ser negativo'),
  taxRate: z.number().nonnegative('La tasa de impuesto no puede ser negativa'),
  operationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  providerInvoice: z.string().optional().nullable(),
  providerRemito: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  paymentStatus: z.enum(['paid', 'pending']),
  amountPaid: z.number().nonnegative('El monto pagado no puede ser negativo'),
  paymentMethod: z.string().optional().nullable(),
  updateSalePrice: z.boolean(),
  newSalePrice: z.number().nonnegative('El nuevo precio de venta no puede ser negativo').optional().nullable(),
  recordType: z.enum(['blanco', 'x']).default('blanco'),
})

export async function registerSupplierPurchaseAction(rawInput: unknown) {
  try {
    // 1. Obtener contexto del usuario
    const context = await getServerUserContext()
    if (!context || !context.idEmpresa) {
      return { ok: false, error: 'Usuario no autenticado o sin empresa asignada.' }
    }

    // 2. Validar input con Zod
    const validation = registerPurchaseSchema.safeParse(rawInput)
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((issue) => issue.message).join(', ')
      return { ok: false, error: `Validación fallida: ${errorMsg}` }
    }

    const input = validation.data
    const supabase = await createServerComponentClient()

    // 3. Normalizar montos
    const subtotal = input.quantity * input.unitCost
    const taxAmount = subtotal * (input.taxRate / 100)
    const totalWithTax = subtotal + taxAmount

    let finalAmountPaid = input.amountPaid
    let finalPaymentStatus = input.paymentStatus

    if (input.paymentStatus === 'paid') {
      finalAmountPaid = totalWithTax
    }

    // Validar coherencia del pago
    if (finalAmountPaid > totalWithTax) {
      return { ok: false, error: 'El monto pagado no puede ser mayor al total con impuestos.' }
    }

    if (finalAmountPaid > 0 && (!input.paymentMethod || !input.paymentMethod.trim())) {
      return { ok: false, error: 'Debe especificar un método de pago si el monto pagado es mayor a 0.' }
    }

    // Si es cuenta espejo, forzar recordType a blanco
    let finalRecordType = input.recordType
    const { data: mirrorCheck } = await supabase
      .from('mirror_accounts')
      .select('id')
      .eq('mirror_user_id', context.idUsuario)
      .eq('is_active', true)
      .maybeSingle()

    if (mirrorCheck) {
      finalRecordType = 'blanco'
    }

    // 4. Preparar payload para la RPC
    const payload = {
      company_id: context.idEmpresa,
      user_id: context.idUsuario,
      product_id: input.productId,
      supplier_id: input.supplierId,
      quantity: input.quantity,
      unit_cost: input.unitCost,
      tax_rate: input.taxRate,
      operation_date: input.operationDate,
      provider_invoice: input.providerInvoice?.trim() || null,
      provider_remito: input.providerRemito?.trim() || null,
      notes: input.notes?.trim() || null,
      payment_status: finalPaymentStatus,
      amount_paid: finalAmountPaid,
      payment_method: finalAmountPaid > 0 ? input.paymentMethod?.trim() : null,
      update_sale_price: input.updateSalePrice,
      new_sale_price: input.updateSalePrice ? input.newSalePrice : null,
      record_type: finalRecordType,
    }

    // 5. Ejecutar RPC
    const { data, error } = await supabase.rpc('register_supplier_purchase', {
      payload,
    })

    if (error) {
      console.error('Error RPC register_supplier_purchase:', error)
      return { ok: false, error: error.message }
    }

    // Revalidar caché de tesorería
    revalidatePath('/tesoreria')

    return { ok: true, data }
  } catch (err: any) {
    console.error('Error en registerSupplierPurchaseAction:', err)
    return { ok: false, error: err.message || 'Error interno del servidor.' }
  }
}
