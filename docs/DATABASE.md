# Diccionario de Base de Datos (ZOMA ERP)

El sistema utiliza Supabase (PostgreSQL) con una arquitectura multitenant basada en la columna `company_id`.

## Tablas Principales

### 1. `companies`
Contiene la configuración de marca blanca y límites del sistema.
*   `id`: UUID (Primary Key).
*   `name`: Nombre comercial.
*   `logo_url`: Enlace al Storage de Supabase.
*   `enable_cascading_discounts`: Boolean que activa/desactiva el motor de descuentos `10+5`.

### 2. `users_profiles`
Extensión de `auth.users` que define el rol y pertenencia.
*   `id`: UUID (FK a auth.users).
*   `role`: Enum (`admin`, `vendedor`).
*   `company_id`: UUID (FK a companies).

### 3. `clients`
Base de datos de clientes corporativos y consumidores finales.
*   `company_id`: Para aislamiento de datos.
*   `seller_id`: Define quién es el dueño del cliente. Si es `null`, es un cliente de la casa (Admin).
*   `cuit`: Índice único parcial (por empresa).

### 4. `budgets` y `budget_items`
El motor de presupuestos. 
*   **Nota de Integridad**: Cuando un presupuesto se convierte a pedido, el estado cambia a `approved` y se vincula mediante `orders.budget_id`.

### 5. `orders` y `order_items`
Órdenes de venta confirmadas.
*   `source`: Indica de dónde vino el pedido (`manual`, `portal`, `vendedor`).
*   `status`: `pending` (requiere aprobación), `confirmed`, `cancelled`.

---

## Seguridad RLS (Row Level Security)

Todas las tablas deben tener habilitada la RLS con la siguiente política base:

```sql
-- Ejemplo para la tabla clients
CREATE POLICY "Users can only see clients of their own company"
ON public.clients
FOR ALL
USING (
  company_id = (SELECT company_id FROM users_profiles WHERE id = auth.uid())
);
```

*   **Admin**: Puede ver todos los registros donde coincida el `company_id`.
*   **Vendedor**: Puede ver registros de su `company_id` Y donde el `seller_id` sea el suyo (o nulo, según configuración).

---
