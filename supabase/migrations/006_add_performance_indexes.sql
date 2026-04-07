-- Performance optimization: Add indexes for products and orders tables
-- These indexes speed up queries filtered by branch_id, category_id, and status

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_branch_id ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_branch_active ON products(branch_id, is_active);

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
