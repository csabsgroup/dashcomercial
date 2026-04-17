-- =============================================
-- Dashboard Comercial Contador CEO — Schema Completo
-- =============================================

-- =============================================
-- PERFIS DE USUÁRIO
-- =============================================
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('master', 'admin', 'closer', 'sdr')),
  avatar_url TEXT,
  piperun_user_id INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- METAS
-- =============================================
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('annual', 'quarterly', 'monthly')),
  period_value INTEGER,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('revenue', 'entry', 'meetings', 'leads')),
  target_value DECIMAL(15,2) NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CONFIGURAÇÃO DA INTEGRAÇÃO PIPERUN
-- =============================================
CREATE TABLE public.piperun_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_token_encrypted TEXT NOT NULL,
  base_url TEXT DEFAULT 'https://api.pipe.run/v1',
  account_name TEXT,
  token_user_email TEXT,
  token_user_acl TEXT,
  closer_pipeline_id INTEGER,
  closer_pipeline_name TEXT,
  sdr_pipeline_id INTEGER,
  sdr_pipeline_name TEXT,
  stage_mappings JSONB DEFAULT '{}',
  field_mappings JSONB DEFAULT '{}',
  visible_fields JSONB DEFAULT '{}',
  dashboard_config JSONB DEFAULT '{}',
  sync_interval_minutes INTEGER DEFAULT 5,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT DEFAULT 'never',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CACHE DE DEALS DO PIPERUN
-- =============================================
CREATE TABLE public.piperun_deals_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piperun_deal_id INTEGER NOT NULL UNIQUE,
  pipeline_id INTEGER NOT NULL,
  stage_id INTEGER,
  user_id INTEGER,
  status TEXT CHECK (status IN ('open', 'won', 'lost')),
  value DECIMAL(15,2),
  title TEXT,
  origin_id INTEGER,
  lost_reason_id INTEGER,
  person_id INTEGER,
  company_id INTEGER,
  custom_fields JSONB DEFAULT '{}',
  piperun_created_at TIMESTAMPTZ,
  piperun_updated_at TIMESTAMPTZ,
  last_stage_updated_at TIMESTAMPTZ,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deals_cache_pipeline ON public.piperun_deals_cache(pipeline_id);
CREATE INDEX idx_deals_cache_user ON public.piperun_deals_cache(user_id);
CREATE INDEX idx_deals_cache_status ON public.piperun_deals_cache(status);
CREATE INDEX idx_deals_cache_created ON public.piperun_deals_cache(piperun_created_at);
CREATE INDEX idx_deals_cache_updated ON public.piperun_deals_cache(piperun_updated_at);

-- =============================================
-- CACHE DE ATIVIDADES DO PIPERUN
-- =============================================
CREATE TABLE public.piperun_activities_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piperun_activity_id INTEGER NOT NULL UNIQUE,
  deal_id INTEGER,
  user_id INTEGER,
  activity_type_id INTEGER,
  status TEXT,
  title TEXT,
  piperun_created_at TIMESTAMPTZ,
  piperun_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_cache_deal ON public.piperun_activities_cache(deal_id);
CREATE INDEX idx_activities_cache_user ON public.piperun_activities_cache(user_id);
CREATE INDEX idx_activities_cache_type ON public.piperun_activities_cache(activity_type_id);

-- =============================================
-- LOG DE SINCRONIZAÇÃO
-- =============================================
CREATE TABLE public.sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'error')),
  deals_synced INTEGER DEFAULT 0,
  activities_synced INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
  error_message TEXT,
  duration_ms INTEGER
);

-- =============================================
-- SNAPSHOTS DO RANKING
-- =============================================
CREATE TABLE public.ranking_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('closer', 'sdr')),
  metric TEXT NOT NULL,
  ranking_data JSONB NOT NULL
);

-- =============================================
-- NOTIFICAÇÕES
-- =============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('goal_reached', 'ranking_change', 'gap_alert', 'high_value_deal', 'sync_error')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, read);

-- =============================================
-- TABELAS DE REFERÊNCIA (cache de dados estáticos do PipeRun)
-- =============================================
CREATE TABLE public.piperun_stages_cache (
  piperun_stage_id INTEGER PRIMARY KEY,
  pipeline_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  "position" INTEGER,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.piperun_origins_cache (
  piperun_origin_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.piperun_lost_reasons_cache (
  piperun_reason_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.piperun_activity_types_cache (
  piperun_type_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TRIGGERS: auto-update updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.piperun_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- TRIGGER: auto-create user_profiles on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  assigned_role TEXT;
BEGIN
  -- First user gets 'master' role, subsequent users get 'closer'
  SELECT COUNT(*) INTO user_count FROM public.user_profiles;
  IF user_count = 0 THEN
    assigned_role := 'master';
  ELSE
    assigned_role := 'closer';
  END IF;

  INSERT INTO public.user_profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    assigned_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- FUNCTION: generate ranking snapshot
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_ranking_snapshot()
RETURNS void AS $$
DECLARE
  v_month INTEGER := EXTRACT(MONTH FROM NOW());
  v_year INTEGER := EXTRACT(YEAR FROM NOW());
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
BEGIN
  v_start_date := date_trunc('month', NOW());
  v_end_date := date_trunc('month', NOW()) + INTERVAL '1 month';

  -- Closer ranking by revenue (value of won deals)
  INSERT INTO public.ranking_snapshots (period_month, period_year, role_type, metric, ranking_data)
  SELECT
    v_month,
    v_year,
    'closer',
    'revenue',
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'piperun_user_id', sub.user_id,
          'value', sub.total_value,
          'deals_count', sub.deals_count
        ) ORDER BY sub.total_value DESC
      ),
      '[]'::jsonb
    )
  FROM (
    SELECT
      d.user_id,
      COALESCE(SUM(d.value), 0) AS total_value,
      COUNT(*) AS deals_count
    FROM public.piperun_deals_cache d
    JOIN public.piperun_config c ON d.pipeline_id = c.closer_pipeline_id
    WHERE d.status = 'won'
      AND d.piperun_created_at >= v_start_date
      AND d.piperun_created_at < v_end_date
    GROUP BY d.user_id
  ) sub;

  -- SDR ranking by meetings (activities count)
  INSERT INTO public.ranking_snapshots (period_month, period_year, role_type, metric, ranking_data)
  SELECT
    v_month,
    v_year,
    'sdr',
    'meetings',
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'piperun_user_id', sub.user_id,
          'value', sub.activity_count
        ) ORDER BY sub.activity_count DESC
      ),
      '[]'::jsonb
    )
  FROM (
    SELECT
      a.user_id,
      COUNT(*) AS activity_count
    FROM public.piperun_activities_cache a
    WHERE a.piperun_created_at >= v_start_date
      AND a.piperun_created_at < v_end_date
    GROUP BY a.user_id
  ) sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =============================================
-- FUNCTION: cleanup old snapshots (> 90 days)
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_snapshots()
RETURNS void AS $$
BEGIN
  DELETE FROM public.ranking_snapshots WHERE snapshot_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =============================================
-- RLS POLICIES
-- =============================================

-- user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('master', 'admin')
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('master', 'admin')
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('master', 'admin')
    )
    OR NOT EXISTS (SELECT 1 FROM public.user_profiles)
  );

CREATE POLICY "Master can delete profiles"
  ON public.user_profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'master'
    )
  );

-- goals
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read goals"
  ON public.goals FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage goals"
  ON public.goals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('master', 'admin')
    )
  );

-- piperun_config
ALTER TABLE public.piperun_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read piperun config"
  ON public.piperun_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('master', 'admin')
    )
  );

CREATE POLICY "Admins can manage piperun config"
  ON public.piperun_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('master', 'admin')
    )
  );

-- cache tables: everyone reads, service_role writes
ALTER TABLE public.piperun_deals_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read deals cache"
  ON public.piperun_deals_cache FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE public.piperun_activities_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read activities cache"
  ON public.piperun_activities_cache FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read sync log"
  ON public.sync_log FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE public.ranking_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read ranking"
  ON public.ranking_snapshots FOR SELECT
  USING (auth.role() = 'authenticated');

-- notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own and global notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- reference tables
ALTER TABLE public.piperun_stages_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read stages"
  ON public.piperun_stages_cache FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE public.piperun_origins_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read origins"
  ON public.piperun_origins_cache FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE public.piperun_lost_reasons_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read lost reasons"
  ON public.piperun_lost_reasons_cache FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE public.piperun_activity_types_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read activity types"
  ON public.piperun_activity_types_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- =============================================
-- REALTIME: enable on tables frontend needs
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.piperun_deals_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE public.piperun_activities_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ranking_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_log;
