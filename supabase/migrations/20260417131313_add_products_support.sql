-- =============================================
-- Suporte a Produtos (PipeRun Items)
-- =============================================

-- 1. Cache de produtos do catálogo PipeRun
CREATE TABLE public.piperun_items_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piperun_item_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price DECIMAL(15,2),
  data JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.piperun_items_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read items cache"
  ON public.piperun_items_cache FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role manages items cache"
  ON public.piperun_items_cache FOR ALL
  TO service_role USING (true);

-- 2. Produtos ativos selecionados pelo admin
CREATE TABLE public.active_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piperun_item_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.active_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active products"
  ON public.active_products FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage active products"
  ON public.active_products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('master', 'admin')
    )
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.active_products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Coluna item_id no cache de deals (vínculo deal → produto)
ALTER TABLE public.piperun_deals_cache
  ADD COLUMN item_id INTEGER;

CREATE INDEX idx_deals_cache_item ON public.piperun_deals_cache(item_id);

-- 4. Coluna product_id na tabela goals (meta por produto)
ALTER TABLE public.goals
  ADD COLUMN product_id UUID REFERENCES public.active_products(id) ON DELETE SET NULL;

CREATE INDEX idx_goals_product ON public.goals(product_id);

-- 5. Expandir goal_type para incluir deals_won
ALTER TABLE public.goals
  DROP CONSTRAINT goals_goal_type_check,
  ADD CONSTRAINT goals_goal_type_check
    CHECK (goal_type IN ('revenue', 'entry', 'meetings', 'leads', 'deals_won'));

-- 6. Habilitar realtime na tabela active_products
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_products;
