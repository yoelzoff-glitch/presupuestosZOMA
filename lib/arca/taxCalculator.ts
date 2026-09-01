export interface TaxCalculationInput {
  montoTotal: number
  cbteTipo: number // 1, 6, 11, etc.
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
 * Calcula de manera centralizada y precisa los montos de IVA, Neto y Total según normativa AFIP
 */
export function calculateInvoiceTaxes(input: TaxCalculationInput): TaxCalculationResult {
  let total = Number(input.montoTotal) || 0
  const isDiscriminated = input.cbteTipo === 1 || input.cbteTipo === 6 || input.cbteTipo === 3 || input.cbteTipo === 8 || input.cbteTipo === 2 || input.cbteTipo === 7

  // Si se solicita adicionar IVA 21% y no proviene de un borrador ya calculado
  if (input.addIva && !input.hasExistingDraft && isDiscriminated) {
    total = parseFloat((total * 1.21).toFixed(2))
  }

  let impNeto = total
  let impIva = 0
  const impTotConc = 0
  const impOpEx = 0
  const impTrib = 0
  let ivaArray: Array<{ Id: number; BaseImp: number; Importe: number }> = []

  if (isDiscriminated) {
    // Cálculo de Base Imponible y Débito Fiscal al 21%
    impNeto = parseFloat((total / 1.21).toFixed(2))
    impIva = parseFloat((total - impNeto).toFixed(2))

    ivaArray = [{
      Id: 5, // Código 5 en AFIP representa la alícuota general del 21%
      BaseImp: impNeto,
      Importe: impIva
    }]
  }

  // Garantizar ecuación fundamental de AFIP: ImpTotal = ImpNeto + ImpIVA + ImpTrib + ImpOpEx + ImpTotConc
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
