/**
 * Obtiene el siguiente número secuencial desde la API centralizada.
 * Reemplaza las consultas SELECT del lado del cliente que eran vulnerables a condiciones de carrera.
 * 
 * @param tipo - 'budget' o 'order'
 * @returns El próximo número disponible
 * @throws Error si la llamada a la API falla
 */
export async function fetchNextNumber(tipo: 'budget' | 'order'): Promise<number> {
  const res = await fetch('/api/next-number', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo }),
  })

  if (!res.ok) {
    const datos = await res.json().catch(() => null)
    throw new Error(datos?.error || `Error generando número de ${tipo === 'budget' ? 'presupuesto' : 'pedido'}`)
  }

  const datos = await res.json()
  return datos.proximo_numero
}
