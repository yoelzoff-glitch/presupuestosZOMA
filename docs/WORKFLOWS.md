# Flujos de Trabajo y Lógica de Negocio

Este documento detalla los procesos internos más complejos del sistema ZOMA ERP.

---

## 1. Ciclo de Vida: Presupuesto a Pedido

El sistema busca mantener una trazabilidad total. El flujo estándar es:

1.  **Emisión**: Se crea un `budget` con estado `issued`.
2.  **Conversión**: 
    *   Si es un **Admin**, el presupuesto puede convertirse a pedido directamente y queda en estado `confirmed`.
    *   Si es un **Vendedor**, el pedido queda en estado `pending` hasta que un administrativo lo valida.
3.  **Vínculo Técnico**: El pedido (`orders`) guarda el `budget_id` original. Esto permite que el Admin vea exactamente qué se le prometió al cliente antes de la confirmación final.

---

## 2. Motor de Descuentos en Cascada

Diseñado para industrias donde los descuentos se acumulan (ej: ferreterías, autopartes).

*   **Entrada**: Una cadena de texto tipo `-10-5+2`.
*   **Proceso**:
    1.  Se limpia la cadena para obtener solo números.
    2.  Se aplica el primer porcentaje al precio base.
    3.  El segundo porcentaje se aplica sobre el **resultado** del paso anterior, y así sucesivamente.
*   **Ejemplo**:
    *   Precio Base: $100
    *   Descuento: `10+5`
    *   Paso 1: $100 - 10% = $90
    *   Paso 2: $90 - 5% = $85.50
    *   *Resultado final: $85.50 (No es lo mismo que un 15% directo, que sería $85).*

---

## 3. Notificaciones en Tiempo Real

El sistema utiliza **Supabase Realtime** para alertar a los administradores:
*   Cada vez que un **Vendedor** carga un pedido, se dispara un canal de notificación.
*   Cada vez que un **Cliente** envía una solicitud desde el portal, aparece un "badge" rojo en la campana del administrador.

---

## 4. Impresión de PDF (Zero-dependency)

No utilizamos librerías pesadas de servidor para generar PDFs. Usamos **Print-CSS**:
*   El archivo `presupuestos/[id]/page.tsx` contiene un bloque `<style jsx global>` que se activa solo al presionar `Ctrl+P` o el botón de imprimir.
*   Esto garantiza que el PDF sea una copia exacta de lo que el administrador ve, optimizado para hoja A4.

---
