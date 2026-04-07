-- Fix: Add missing columns and foreign key for ingredients table
-- This fixes the Stock module relationship errors

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Add category_id column if it doesn't exist
ALTER TABLE public.ingredients 
ADD COLUMN IF NOT EXISTS category_id UUID;

-- Add is_active column if it doesn't exist
ALTER TABLE public.ingredients 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create FK if doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'ingredients'
      AND kcu.column_name = 'category_id'
  ) THEN
    ALTER TABLE public.ingredients 
    ADD CONSTRAINT fk_ingredients_category 
    FOREIGN KEY (category_id) 
    REFERENCES public.ingredient_categories(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Update existing records
UPDATE public.ingredients SET is_active = true WHERE is_active IS NULL;

-- Grant permissions for PostgREST to access the tables
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated;
GRANT SELECT ON public.ingredients TO anon, authenticated;
GRANT SELECT ON public.ingredient_categories TO anon, authenticated;
