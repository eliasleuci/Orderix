-- ==========================================
-- MIGRACIÓN 013: Fix de Tabla Tables y Relaciones
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- 1. CREAR TABLA TABLES SI NO EXISTE
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  label TEXT,
  capacity INTEGER DEFAULT 2,
  status TEXT CHECK (status IN ('FREE', 'OCCUPIED', 'RESERVED')) DEFAULT 'FREE',
  customer_name TEXT,
  notes TEXT,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, number)
);

-- 2. ASEGURAR RELACIÓN ORDERS -> TABLES
-- Asegurar que table_id exista en orders (fue añadido de forma suelta antes, ahora lo formalizamos)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'table_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN table_id UUID;
  END IF;
END $$;

-- Asegurar que tenga su Foreign Key hacia tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_orders_table_id' OR constraint_name = 'orders_table_id_fkey'
  ) THEN
    -- Intentar añadir la FK. Si falla es porque ya existe bajo otro nombre, o hay datos basura. (Ignoramos errores)
    BEGIN
      ALTER TABLE orders ADD CONSTRAINT fk_orders_table_id FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- 3. HABILITAR RLS y POLÍTICAS PARA TABLES
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tables Read Policy" ON tables;
CREATE POLICY "Tables Read Policy" ON tables
  FOR SELECT USING (
    branch_id = get_my_branch_id() 
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN' 
    OR auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Tables Write Policy" ON tables;
CREATE POLICY "Tables Write Policy" ON tables
  FOR ALL USING (
    branch_id = get_my_branch_id() 
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

-- 4. AÑADIR A REALTIME
ALTER TABLE public.tables REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tables'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tables;
  END IF;
END $$;

-- 5. RECARGAR CACHE DEL ESQUEMA (CRÍTICO PARA QUE DESAPAREZCA EL ERROR)
NOTIFY pgrst, 'reload schema';
