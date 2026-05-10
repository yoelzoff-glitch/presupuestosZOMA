# 📑 Análisis Funcional y Validaciones - ZOMA ERP

## 1. Descripción General
ZOMA ERP es una plataforma SaaS (Software as a Service) diseñada para la gestión comercial integral de PyMEs, mayoristas y distribuidores. El sistema permite la gestión de presupuestos, pedidos, stock (productos), clientes y cuentas corrientes en tiempo real, con una arquitectura multi-tenant.

## 2. Arquitectura Técnica
- **Frontend**: Next.js 15 (App Router) con React 19.
- **Estilos**: Tailwind CSS con diseño Premium Dark/Light.
- **Backend/Base de Datos**: Supabase (PostgreSQL).
- **Autenticación**: Supabase Auth (Email/Password y Usuarios Virtuales).
- **Real-time**: Supabase Presence y Broadcast (para Chat e indicadores de conexión).
- **Pagos**: MercadoPago API (Integración para suscripciones y pagos de pedidos).

---

## 3. Módulos y Roles de Usuario

### A. Portal Administrativo (Dueño de Empresa)
Es el núcleo del sistema. Permite la gestión total de la entidad.
- **Dashboard**: Estadísticas de ventas, pedidos pendientes y saldos.
- **Gestión de Clientes**: Alta, baja y modificación (ABM) de clientes con saldos históricos.
- **Catálogo de Productos**: Gestión de precios, costos y actualizaciones masivas.
- **Presupuestos y Pedidos**: Creación de documentos comerciales con persistencia de notas y condiciones.
- **Cuentas Corrientes**: Seguimiento detallado de débitos y créditos por cliente.
- **Gestión de Vendedores (Plan PRO)**: Administración de cuentas para fuerza de ventas externa.

### B. Portal de Vendedores (Fuerza de Ventas - Plan PRO)
Acceso simplificado para personal de campo.
- **Carga de Pedidos**: Interfaz optimizada para móviles para tomar pedidos en el local del cliente.
- **Consulta de Clientes**: Ver deudas y estados de cuenta antes de realizar una venta.
- **Chat Interno**: Comunicación directa con la administración.

### C. Portal de Clientes (Autogestión)
Acceso exclusivo para los clientes de la empresa.
- **Mis Pedidos**: Seguimiento de estado (Pendiente, Entregado, Pagado).
- **Estado de Cuenta**: Visualización y descarga de su resumen de cuenta corriente.
- **Pagos Online**: Integración con MercadoPago para cancelar deudas.

---

## 4. Lógica de Planes SaaS (Pricing Strategy)

El sistema opera bajo dos modalidades de suscripción controladas por la columna `plan_type` en la tabla `companies`.

| Característica | Plan BASE | Plan PRO |
| :--- | :---: | :---: |
| Presupuestos y Pedidos | ✅ | ✅ |
| Portal de Clientes | ✅ | ✅ |
| Cuenta Corriente | ✅ | ✅ |
| Productos Ilimitados | ✅ | ✅ |
| Soporte 24/7 | ✅ | ✅ |
| **Portal de Vendedores** | ❌ | ✅ |
| **Chat Interno Real-time** | ❌ | ✅ |
| **Acceso a Fuerza de Ventas** | ❌ | ✅ |

---

## 5. Validaciones y Seguridad

### 🛡️ Aislamiento de Datos (Multi-tenancy)
La seguridad se basa en **RLS (Row Level Security)** de Supabase. Cada tabla tiene una política que garantiza que un usuario solo pueda ver o modificar datos que pertenezcan a su `company_id`.
- **Validación**: Ninguna empresa puede acceder a los clientes o pedidos de otra, incluso si conocen el ID.

### 🔐 Validación de Rutas y Accesos
- **Middleware/Layout Check**: Si un usuario de una empresa con **Plan Base** intenta acceder a `/vendedor` o `/vendedores`, el sistema lo detecta en el lado del servidor/cliente y lo redirige al login con un error de restricción.
- **Chat Guard**: El componente `GlobalChatBubble` valida el plan antes de inicializar la conexión al canal de Supabase.

### 📑 Integridad de Documentos
- **Conversión Presupuesto -> Pedido**: El sistema valida que al convertir un documento, se mantengan las condiciones comerciales originales (notas) para evitar conflictos legales o comerciales.
- **Cuentas Corrientes**: Cada movimiento de cuenta (`account_movements`) está vinculado obligatoriamente a una `company_id` y un `client_id` para asegurar la trazabilidad.

---

## 6. Flujos Críticos de Negocio

1.  **Carga de Presupuesto**: El Admin/Vendedor selecciona productos. El sistema calcula totales dinámicamente y aplica condiciones por defecto de la empresa.
2.  **Confirmación de Pedido**: Al confirmar, el presupuesto cambia de estado y se genera automáticamente un movimiento de **DÉBITO** en la cuenta corriente del cliente.
3.  **Pago de Cliente**: Al registrar un pago (manual o vía MercadoPago), se genera un movimiento de **CRÉDITO**, impactando el saldo real del cliente.
4.  **Sincronización de Presencia**: El sistema detecta usuarios online mediante `supabase_presence` para facilitar la comunicación inmediata en el plan PRO.

---
**Documento de Auditoría Interna - ZOMA TECHNOLOGY v2.0**
