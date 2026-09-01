export interface TaxCalculationInput {
  montoTotal: number
  cbteTipo: number // 1: Factura A, 6: Factura B, 11: Factura C, etc.
  addIva?: boolean
  hasExistingDraft?: boolean
}

export interface TaxCalculationResult {
  montoTotal: number
  impNeto: number
  impIva: number
  impTotConc: number
  impOpEx: number
  impTrib: number
  ivaArray: Array<{ Id: number; BaseImp: number; Importe: number }>
}

/**
 * Calcula los montos de IVA, Neto y Total según normativa ARCA para comprobantes A, B y C.
 * En este sprint se valida estrictamente que Facturas A/B utilicen exclusivamente la alícuota general del 21%,
 * y Factura C no discrimine IVA.
 */
export function calculateInvoiceTaxes(input: TaxCalculationInput): TaxCalculationResult {
  let total = Number(input.montoTotal)
  if (isNaN(total) || total <= 0) {
    throw new Error('El importe total debe ser un número positivo mayor a 0.')
  }

  const isAorB = [1, 6, 2, 7, 3, 8].includes(input.cbteTipo)
  const isC = [11, 12, 13].includes(input.cbteTipo)

  if (!isAorB && !isC) {
    throw new Error(
      `Tipo de comprobante ${input.cbteTipo} no soportado. Solo se permiten Facturas y Notas A (1,2,3), B (6,7,8) y C (11,12,13).`
    )
  }

  // Si se solicita adicionar IVA 21% y no proviene de un borrador ya calculado
  if (input.addIva && !input.hasExistingDraft && isAorB) {
    total = parseFloat((total * 1.21).toFixed(2))
  }

  let impNeto = total
  let impIva = 0
  const impTotConc = 0
  const impOpEx = 0
  const impTrib = 0
  let ivaArray: Array<{ Id: number; BaseImp: number; Importe: number }> = []

  if (isAorB) {
    // Para A y B se calcula Base Imponible y Débito Fiscal al 21%
    impNeto = parseFloat((total / 1.21).toFixed(2))
    impIva = parseFloat((total - impNeto).toFixed(2))

    ivaArray = [{
      Id: 5, // Código 5 en ARCA representa la alícuota general del 21%
      BaseImp: impNeto,
      Importe: impIva
    }]
  } else if (isC) {
    // Para Factura C el importe total es completamente neto/no discriminado
    impNeto = total
    impIva = 0
    ivaArray = []
  }

  // Garantizar ecuación fundamental de ARCA: ImpTotal = ImpNeto + ImpIVA + ImpTrib + ImpOpEx + ImpTotConc
  const sumaCalculada = parseFloat((impNeto + impIva + impTrib + impOpEx + impTotConc).toFixed(2))
  if (Math.abs(sumaCalculada - total) > 0.05) {
    total = sumaCalculada
  }

  return {
    montoTotal: total,
    impNeto,
    impIva,
    impTotConc,
    impOpEx,
    impTrib,
    ivaArray
  }
}
