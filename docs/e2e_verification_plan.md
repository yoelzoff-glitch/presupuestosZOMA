# Protocolo de Verificación E2E - ZOMA ERP

Para garantizar que el sistema es seguro y funcional para el lanzamiento (GA), se han verificado los siguientes puntos críticos.

## 1. Seguridad y Middleware
- [x] **Redirección de Invitados**: Al intentar acceder a `http://localhost:3001/vendedor` o `http://localhost:3001/clientes`, el sistema DEBE redirigir automáticamente a `/auth/login`.
- [x] **Validación de Archivo**: Se confirmó que `middleware.ts` existe y tiene el nombre correcto para ser ejecutado por Next.js (se corrigió el nombre previo `proxy.ts`).
- [x] **Aislamiento de Roles**: El middleware bloquea a los Clientes (customers) de acceder a las rutas de Vendedor/Admin.

## 2. Optimización del Dashboard (RPC)
> [!IMPORTANT]
> Se detectó que la base de datos actual tiene una versión antigua de la función `get_dashboard_stats`.

- [ ] **Acción Requerida**: Se DEBE ejecutar el contenido de `supabase/schema.sql` en el SQL Editor de Supabase para actualizar la firma de la función `get_dashboard_stats`.
- [ ] **Verificación**: Una vez actualizado el SQL, el dashboard del vendedor cargará todos los datos en una sola petición de red (RPC), eliminando la lentitud previa.

## 3. Lógica de Numeración Atómica
- [x] **Endpoint Localizado**: El endpoint `/api/next-number` responde correctamente a peticiones `POST` autenticadas.
- [x] **Evitación de Duplicados**: La lógica utiliza el cliente de administración para consultar el último número registrado de forma segura, evitando colisiones entre múltiples vendedores.

## 4. Localización y Experiencia de Usuario
- [x] **Idioma 100% Español**: Se verificó que las etiquetas, estados de presupuesto (Pendiente, Aprobado, etc.) y nombres de variables en los componentes clave (`VendedorDashboardClient`, `ProductCatalog`, `ShoppingCartPanel`) están totalmente en español.
- [x] **Props Normalizadas**: Todos los componentes RSC pasan datos mediante props con nombres en español (ej: `vendedoresIniciales`, `estadisticasIniciales`).

## 5. Próximos Pasos Recomendados para el Despliegue
1. **Ejecutar SQL**: Aplicar los cambios en `supabase/schema.sql` en el entorno de producción.
2. **Generar Tipos**: Ejecutar `npx supabase gen types typescript --local > types/database.ts`.
3. **Prueba de Humo**: Crear un presupuesto de prueba desde la cuenta de un vendedor para verificar el incremento del número secuencial.
