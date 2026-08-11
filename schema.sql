PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  product_type TEXT NOT NULL CHECK (product_type IN ('segunda_mano','nuevo')),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  condition_text TEXT NOT NULL DEFAULT '',
  dimensions TEXT NOT NULL DEFAULT '',
  price_cents INTEGER,
  price_on_request INTEGER NOT NULL DEFAULT 0 CHECK (price_on_request IN (0,1)),
  store_stock INTEGER NOT NULL DEFAULT 0 CHECK (store_stock >= 0),
  replenishable INTEGER NOT NULL DEFAULT 0 CHECK (replenishable IN (0,1)),
  supplier_lead_days INTEGER,
  mounting TEXT NOT NULL DEFAULT 'consultar' CHECK (mounting IN ('incluido','opcional','no_requiere','consultar')),
  transport TEXT NOT NULL DEFAULT 'consultar' CHECK (transport IN ('incluido','opcional','no_disponible','consultar')),
  status TEXT NOT NULL DEFAULT 'disponible' CHECK (status IN ('disponible','reservado','vendido','oculto')),
  specs_json TEXT NOT NULL DEFAULT '{}',
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  object_key TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_cover INTEGER NOT NULL DEFAULT 0 CHECK (is_cover IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  change_qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_published ON products(published);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
