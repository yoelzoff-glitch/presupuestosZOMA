# ZOMA ERP - Sistema de Gestión Comercial Multi-Portal

ZOMA es una plataforma SaaS de gestión comercial diseñada para escalar. Utiliza una arquitectura de **Triple Portal** para separar las responsabilidades de los tres actores principales del ecosistema comercial.

---

## 🏗️ Arquitectura de Namespaces

La aplicación está dividida en tres universos aislados para garantizar escalabilidad y seguridad:

### 1. Portal Administrativo `app/(app)/`
*   **Actor**: Dueños de empresa y personal administrativo.
*   **Funcionalidad**: Visión 360° del negocio, gestión de catálogo global, control de vendedores, configuración de empresa y marca blanca.
*   **Escalabilidad**: Vistas maestras con filtrado cruzado por vendedor y cliente.

### 2. Portal de Vendedores `app/vendedor/`
*   **Actor**: Fuerza de ventas (Mobile-first).
*   **Funcionalidad**: Carga rápida de presupuestos en calle, gestión de cartera de clientes propia, descuentos en cascada y seguimiento de pedidos.
*   **Seguridad**: Scoping estricto por `seller_id`. El vendedor solo accede a su propia información comercial.

### 3. Portal de Clientes `app/portal/`
*   **Actor**: Clientes finales de la empresa.
*   **Funcionalidad**: Consulta de lista de precios en tiempo real, descarga de catálogos (Excel), historial de presupuestos y envío de solicitudes de compra autónomas.

---

## 🛠️ Stack Tecnológico

*   **Frontend**: Next.js 15 (App Router) + React 19.
*   **Estilos**: Vanilla CSS / Tailwind (UI Premium y Custom).
*   **Base de Datos & Auth**: Supabase (PostgreSQL).
*   **Real-time**: Supabase Channels (Chat interno y notificaciones).
*   **Generación de Documentos**: Sistema nativo de impresión CSS A4 para presupuestos (Zero-dependency).

---

## 📊 Modelo de Datos Maestro

| Tabla | Propósito | Relación Clave |
| :--- | :--- | :--- |
| `companies` | Datos de la empresa (Marca Blanca). | `id` -> Root |
| `users_profiles` | Perfiles y roles (Admin, Vendedor). | `company_id`, `role` |
| `clients` | Cartera de clientes. | `seller_id` (Dueño del cliente) |
| `products` | Catálogo de productos. | `company_id` |
| `budgets` | Presupuestos emitidos. | `client_id`, `seller_id` |
| `orders` | Pedidos confirmados. | `budget_id` (Backlink de auditoría) |
| `company_messages` | Chat interno corporativo. | `sender_id`, `receiver_id` |

---

## 🔒 Seguridad y Escalabilidad

1.  **RLS (Row Level Security)**: La base de datos está protegida a nivel de fila en Supabase.
2.  **Server-side Logic**: Los números de presupuesto y pedido se calculan de forma secuencial por empresa.
3.  **Namespacing**: El aislamiento de rutas evita colisiones de lógica entre roles.

---
*Documentación generada por Antigravity v2.0 - 2026*
