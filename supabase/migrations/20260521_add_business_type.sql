-- Añadir columna de tipo de negocio a la tabla de empresas
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'products' 
CHECK (business_type IN ('products', 'services'));

-- Añadir columnas para almacenar rango de fechas de prestación de servicios AFIP
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS afip_servicio_desde text,
ADD COLUMN IF NOT EXISTS afip_servicio_hasta text,
ADD COLUMN IF NOT EXISTS afip_servicio_vto text;

