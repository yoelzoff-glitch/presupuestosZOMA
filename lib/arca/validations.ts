import { z } from 'zod'

export const CreateInvoiceRequestSchema = z.object({
  budget_id: z.string().uuid({ message: 'El ID del presupuesto debe ser un UUID válido.' }),
  cbteTipoOverride: z.number().int().positive().optional(),
  isCreditNote: z.boolean().optional(),
  isDebitNote: z.boolean().optional(),
  customAmount: z.number().positive({ message: 'El monto debe ser mayor a 0.' }).optional(),
  addIva: z.boolean().optional(),
  serviceDates: z.object({
    FchServDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^\d{8}$/, { message: 'Formato de fecha inválido' }).optional(),
    FchServHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^\d{8}$/, { message: 'Formato de fecha inválido' }).optional(),
    FchVtoPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^\d{8}$/, { message: 'Formato de fecha inválido' }).optional(),
  }).optional()
}).refine(data => !(data.isCreditNote && data.isDebitNote), {
  message: 'Un comprobante no puede ser Nota de Crédito y Nota de Débito simultáneamente.'
})

export const UpdateFiscalConfigSchema = z.object({
  cuit: z.string().min(10, 'El CUIT debe tener al menos 10 dígitos'),
  tipo_contribuyente: z.enum(['monotributo', 'responsable_inscripto', 'exento']),
  punto_venta: z.number().int().positive('El Punto de Venta debe ser un número entero mayor a 0'),
  cert_content: z.string().min(20, 'El contenido del certificado PEM es obligatorio'),
  key_content: z.string().min(20, 'El contenido de la clave privada PEM es obligatorio'),
  is_sandbox: z.boolean()
})
