# Onboarding autoservicio de ZOMA

## Activación

1. Ejecutar `supabase/migrations/20260801120000_saas_self_service_onboarding.sql` en Supabase.
2. Crear una aplicación de Mercado Pago exclusiva para cobrar ZOMA.
3. Configurar las variables documentadas en `.env.example`.
4. Publicar `POST /api/webhooks/mercadopago` por HTTPS.
5. Configurar un cron horario contra `POST /api/internal/billing/reconcile` con `Authorization: Bearer <BILLING_RECONCILIATION_SECRET>`.

## Eventos

El endpoint procesa:

- `subscription_preapproval`
- `subscription_authorized_payment`
- `payment`

La notificación se valida con HMAC SHA-256 y luego se consulta el recurso directamente a Mercado Pago. La URL de retorno del checkout nunca habilita una empresa por sí sola.

## Compatibilidad

Las empresas existentes no reciben valores nuevos. El control de acceso usa `billing_status` cuando está disponible y conserva `subscription_expiry` como fallback.

## Prueba local

1. Iniciar Next.js.
2. Exponer el puerto con ngrok.
3. Definir `NEXT_PUBLIC_APP_URL` con la URL HTTPS de ngrok.
4. Usar credenciales y usuarios de prueba de Mercado Pago.
5. Verificar `onboarding_sessions`, `saas_webhook_events` y `saas_billing_events` después de cada escenario.
