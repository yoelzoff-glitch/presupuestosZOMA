# 🛡️ Guía Técnica de Validaciones - ZOMA ERP

Este documento detalla las capas de seguridad y validación de datos implementadas para garantizar la integridad y el aislamiento multi-tenant del sistema.

---

## 1. Aislamiento Multi-Empresa (RLS)
El sistema utiliza **Row Level Security (RLS)** de PostgreSQL vía Supabase. Cada fila en la base de datos está protegida por políticas que validan el `company_id`.

- **Validación**: `auth.uid()` -> `users_profiles.company_id` == `tabla.company_id`.
- **Efecto**: Es imposible que un usuario, incluso mediante inyección de código o herramientas externas, acceda a registros de otra empresa.

---

## 2. Validación de Planes SaaS (Tiers)
Implementamos una capa de validación lógica basada en el campo `companies.plan_type`.

### A. Restricción de Portal Vendedor
- **Ubicación**: `app/vendedor/layout.tsx`.
- **Lógica**: Al iniciar sesión, el sistema consulta el `plan_type`. Si el valor es `'base'`, el usuario es desconectado automáticamente (`auth.signOut()`) y redirigido con el error `plan_restriction`.
- **Propósito**: Evitar que empresas del plan base utilicen la infraestructura de fuerza de ventas.

### B. Restricción de Gestión de Vendedores
- **Ubicación**: `app/(app)/vendedores/page.tsx`.
- **Lógica**: Si `planType === 'base'`, se bloquea el renderizado de la tabla de gestión y se muestra un "Paywall" (pantalla de upgrade).
- **Seguridad**: La API de creación de vendedores (`/api/vendedores/create`) también debe validar el plan del solicitante (Siguiente paso de seguridad).

---

## 3. Validaciones de Roles (RBAC)
Cada usuario tiene un rol asignado en `users_profiles.role`: `admin`, `vendedor`, o `customer`.

- **Admin**: Acceso total a `app/(app)/*`.
- **Vendedor**: Acceso restringido a `app/vendedor/*`. Redirección automática si intenta entrar al panel administrativo.
- **Cliente**: Acceso exclusivo a `app/portal/*`. No tiene permisos para ver precios de costo o márgenes de ganancia.

---

## 4. Integridad de Documentos Comerciales

### A. Presupuestos a Pedidos
- **Validación**: Al convertir un presupuesto en pedido, se clonan las líneas de detalle (`budget_items` -> `order_items`) para congelar los precios y condiciones en ese momento histórico.
- **Notas**: Se validan y persisten las "Notas y Condiciones" personalizadas del presupuesto para que el pedido final respete lo acordado con el cliente.

### B. Numeración Automática
- **Lógica**: El sistema genera `budget_number` y `order_number` de forma secuencial y única por empresa, utilizando funciones de base de datos para evitar duplicados en cargas simultáneas.

---

## 5. Validaciones de Cuentas Corrientes
Toda operación que afecte el saldo de un cliente debe pasar por la tabla `account_movements`.

- **Débito Automático**: Al confirmar un Pedido.
- **Crédito Automático**: Al registrar un Pago (MercadoPago o Manual).
- **Consistencia**: No se permiten movimientos de cuenta sin un `client_id` y `company_id` válidos.

---

## 6. Validaciones de Interfaz (UX)
- **Inputs Numéricos**: Validación de valores positivos en cantidades y precios.
- **Formularios de Registro**: Validación de CUIT (formato) y obligatoriedad de campos críticos.
- **Feedback**: Uso de `sonner` para notificaciones de error/éxito en tiempo real.

---
**Última actualización**: 10 de Mayo de 2026
**Responsable**: Auditoría de Desarrollo ZOMA
