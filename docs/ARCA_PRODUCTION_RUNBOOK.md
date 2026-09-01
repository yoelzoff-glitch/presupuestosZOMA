# RUNBOOK: PUESTA EN PRODUCCIÓN ARCA (AFIP)

Este documento detalla el procedimiento operativo estándar para la configuración, validación, primer uso y resolución de incidencias en **ARCA Producción** (ex-AFIP) para la aplicación ZOMA.

---

## 1. Variables de Entorno Requeridas en Vercel / Hosting

Para que la integración fiscal funcione en producción, deben configurarse las siguientes variables de entorno:

| Variable | Descripción | Formato / Ejemplo |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de la instancia de Supabase | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave pública anónima de Supabase | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave administrativa de servidor | `eyJhbGciOi...` |
| `ARCA_ENCRYPTION_KEY` | **OBLIGATORIA:** Llave de 32 bytes en Base64 para cifrado AES-256-GCM de certificados y tickets | Cadena Base64 de 44 caracteres (ej: `openssl rand -base64 32`) |

> [!CAUTION]
> Si `ARCA_ENCRYPTION_KEY` no está configurada o no tiene exactamente 32 bytes decodificados, el servidor rechazará cualquier operación criptográfica de forma inmediata y no recurrirá a ninguna clave fallback.

---

## 2. Checklist Previo al Pase a Producción

- [ ] Las migraciones SQL de `supabase/migrations/20260901000000_arca_production_hardening.sql` han sido ejecutadas en la base de datos de Supabase.
- [ ] La variable `ARCA_ENCRYPTION_KEY` está configurada en Vercel (Production & Preview).
- [ ] La empresa cuenta con el certificado de Producción emitido por ARCA (`.crt`) y su clave privada (`.key`).
- [ ] El servicio **WSFE** (Facturación Electrónica) está delegado al CUIT en el portal de ARCA / AFIP (Administrador de Relaciones de Clave Fiscal).
- [ ] El **Punto de Venta** para Web Services está dado de alta en ARCA (debe ser tipo "Web Services", no comprobantes en línea).

---

## 3. Procedimiento de Validación Inicial en Homologación (Testing)

1. Iniciar sesión como Administrador en ZOMA e ir a **Configuración Fiscal**.
2. Seleccionar la pestaña **Homologación (Testing)**.
3. Completar:
   - **CUIT de la Empresa** (11 dígitos).
   - **Punto de Venta de Testing** (creado en ARCA Sandbox).
   - **Condición IVA** (Monotributista / Responsable Inscripto / Exento).
   - **Certificado (.crt)** y **Clave Privada (.key)** de Homologación.
4. Hacer clic en **Guardar Homologación**.
5. Hacer clic en **Probar Conexión (HOMO)**.
   - Si todo es correcto, aparecerá el mensaje de confirmación y el estado cambiará a **Validado** con la fecha y fingerprint.
6. Emitir un comprobante de prueba desde un presupuesto de testing.
7. Verificar que el comprobante figure como `issued` con su número de CAE y vencimiento.
8. Reintentar emitir sobre el mismo presupuesto: el sistema debe retornar el CAE existente de forma inmediata sin generar duplicados.

---

## 4. Procedimiento de Carga y Validación en Producción (Real)

1. En **Configuración Fiscal**, cambiar a la pestaña **Producción (Oficial)**.
   *(Nota: Cambiar de pestaña nunca borra ni altera los certificados de Homologación)*.
2. Completar:
   - **CUIT real de la Empresa**.
   - **Punto de Venta Productivo** (habilitado para Web Services en ARCA).
   - **Condición IVA real**.
   - **Certificado (.crt)** y **Clave Privada (.key)** productivos.
3. Hacer clic en **Guardar Producción**.
4. Hacer clic en **Probar Conexión (PROD)**.
   - El sistema validará contra los servidores oficiales de ARCA que el CUIT, certificado y Punto de Venta existan y estén desbloqueados.
   - Solo cuando la prueba sea exitosa quedará registrado el estado **Validado** en `arca_credentials`.

---

## 5. Emisión de la Primera Factura Real Controlada

1. Crear un presupuesto real con un cliente con CUIT o DNI verificado.
2. Abrir la **Vista Previa de Factura**.
3. Seleccionar el tipo de comprobante (A, B o C) y confirmar importes e IVA.
4. Presionar **Confirmar y Emitir Factura**.
5. Validar que la respuesta contenga:
   - CAE oficial de 14 dígitos.
   - Fecha de vencimiento del CAE.
   - Número correlativo de comprobante.
   - Estado `persisted` en la base de datos.
6. Imprimir o descargar el PDF con el código QR oficial de ARCA.

---

## 6. Runbook de Reconciliación y Recuperación ante Fallos

En caso de que ocurra una interrupción de red o fallo de base de datos inmediatamente después de que ARCA otorgó el CAE:

1. El sistema registra el intento en `arca_invoice_attempts` con estado `reconciliation_required` o `authorized_pending_persistence`.
2. Al reintentar la emisión (o al consultar el comprobante), ZOMA ejecuta automáticamente `reconcileVoucherWithArca` invocando `getVoucherInfo` en ARCA para el número planificado.
3. Si ARCA confirma que el comprobante fue emitido, ZOMA sincroniza la base de datos local **sin llamar a `createVoucher`**, evitando cualquier emisión duplicada o salto de numeración.
