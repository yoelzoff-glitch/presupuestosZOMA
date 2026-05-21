-- Añadir columna de tipo de negocio a la tabla de empresas
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'products' 
CHECK (business_type IN ('products', 'services'));
