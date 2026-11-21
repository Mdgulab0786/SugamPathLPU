
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('student','estate_staff','lift_operator','admin');
CREATE TYPE public.node_kind AS ENUM ('building','entrance','junction','lift','ramp','checkpoint','destination','other');
CREATE TYPE public.verification_state AS ENUM ('unverified','verified');
CREATE TYPE public.surface_type AS ENUM ('smooth_paved','paved','paving_blocks','gravel','rough','grass','indoor','unknown');
CREATE TYPE public.barrier_state AS ENUM ('clear','caution','blocked');
CREATE TYPE public.access_class AS ENUM ('accessible','limited','inaccessible','unknown');
CREATE TYPE public.lift_status AS ENUM ('operational','out_of_service','under_maintenance','unknown');
CREATE TYPE public.report_category AS ENUM ('broken_ramp','ramp_ends_at_step','blocked_pathway','damaged_pavement','locked_entrance','lift_not_working','missing_signage','narrow_pathway','other');
CREATE TYPE public.report_status AS ENUM ('new','under_review','assigned','in_progress','resolved','rejected','duplicate');
CREATE TYPE public.report_priority AS ENUM ('critical','high','medium','low');

-- ============ PROFILES & ROLES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_bootstrap_emails (
  email text PRIMARY KEY
);
GRANT ALL ON public.admin_bootstrap_emails TO service_role;
ALTER TABLE public.admin_bootstrap_emails ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('estate_staff','admin'))
$$;

CREATE OR REPLACE FUNCTION public.can_manage_lifts(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('lift_operator','estate_staff','admin'))
$$;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Users read own roles, admins read all" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins grant roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins revoke roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND NOT (user_id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  IF NEW.email IS NOT NULL AND EXISTS (SELECT 1 FROM public.admin_bootstrap_emails WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SETTINGS ============
CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  demo_mode boolean NOT NULL DEFAULT true,
  verification_freshness_days int NOT NULL DEFAULT 180 CHECK (verification_freshness_days BETWEEN 1 AND 3650),
  lift_status_freshness_hours int NOT NULL DEFAULT 24 CHECK (lift_status_freshness_hours BETWEEN 1 AND 720),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.app_settings (id) VALUES (1);

-- ============ MAP GRAPH ============
CREATE TABLE public.route_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text UNIQUE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  kind public.node_kind NOT NULL DEFAULT 'junction',
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  description text,
  is_destination boolean NOT NULL DEFAULT false,
  accessible_entrance boolean,
  verification_status public.verification_state NOT NULL DEFAULT 'unverified',
  last_verified_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX route_nodes_kind_idx ON public.route_nodes(kind);
CREATE INDEX route_nodes_demo_idx ON public.route_nodes(is_demo);

CREATE TABLE public.lifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120),
  node_id uuid REFERENCES public.route_nodes(id) ON DELETE SET NULL,
  location_description text,
  status public.lift_status NOT NULL DEFAULT 'unknown',
  status_updated_at timestamptz,
  status_updated_by uuid,
  issue text,
  alternative_info text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.route_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id uuid NOT NULL REFERENCES public.route_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES public.route_nodes(id) ON DELETE CASCADE,
  name text,
  distance_m numeric NOT NULL CHECK (distance_m > 0 AND distance_m < 20000),
  surface public.surface_type NOT NULL DEFAULT 'unknown',
  clear_width_m numeric CHECK (clear_width_m IS NULL OR (clear_width_m > 0 AND clear_width_m < 50)),
  slope_percent numeric CHECK (slope_percent IS NULL OR (slope_percent >= 0 AND slope_percent <= 100)),
  has_steps boolean,
  step_count int CHECK (step_count IS NULL OR step_count >= 0),
  has_kerb boolean,
  has_ramp boolean NOT NULL DEFAULT false,
  ramp_verified boolean NOT NULL DEFAULT false,
  lift_id uuid REFERENCES public.lifts(id) ON DELETE SET NULL,
  barrier_status public.barrier_state NOT NULL DEFAULT 'clear',
  barrier_note text,
  classification public.access_class NOT NULL DEFAULT 'unknown',
  verification_status public.verification_state NOT NULL DEFAULT 'unverified',
  last_verified_at timestamptz,
  evidence_ref text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_node_id <> to_node_id)
);
CREATE INDEX route_edges_from_idx ON public.route_edges(from_node_id);
CREATE INDEX route_edges_to_idx ON public.route_edges(to_node_id);
CREATE INDEX route_edges_lift_idx ON public.route_edges(lift_id);

CREATE TABLE public.route_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid REFERENCES public.route_nodes(id) ON DELETE CASCADE,
  edge_id uuid REFERENCES public.route_edges(id) ON DELETE CASCADE,
  verified_on date NOT NULL,
  verified_by text NOT NULL CHECK (length(trim(verified_by)) > 1),
  evidence_ref text NOT NULL CHECK (length(trim(evidence_ref)) > 1),
  observations text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((node_id IS NULL) <> (edge_id IS NULL))
);
CREATE INDEX route_verifications_edge_idx ON public.route_verifications(edge_id);
CREATE INDEX route_verifications_node_idx ON public.route_verifications(node_id);

CREATE TABLE public.lift_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lift_id uuid NOT NULL REFERENCES public.lifts(id) ON DELETE CASCADE,
  old_status public.lift_status,
  new_status public.lift_status NOT NULL,
  issue text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lift_status_history_lift_idx ON public.lift_status_history(lift_id, changed_at DESC);

-- convenience views required by the brief
CREATE VIEW public.campus_locations WITH (security_invoker = true) AS
  SELECT * FROM public.route_nodes WHERE is_destination OR kind IN ('building','destination');
CREATE VIEW public.campus_entrances WITH (security_invoker = true) AS
  SELECT * FROM public.route_nodes WHERE kind = 'entrance';

GRANT SELECT ON public.route_nodes, public.route_edges, public.lifts, public.lift_status_history, public.campus_locations, public.campus_entrances TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.route_nodes, public.route_edges, public.lifts TO authenticated;
GRANT SELECT, INSERT ON public.route_verifications TO authenticated;
GRANT ALL ON public.route_nodes, public.route_edges, public.lifts, public.lift_status_history, public.route_verifications TO service_role;

ALTER TABLE public.route_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lift_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads nodes" ON public.route_nodes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff insert nodes" ON public.route_nodes FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update nodes" ON public.route_nodes FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins delete nodes" ON public.route_nodes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Public reads edges" ON public.route_edges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff insert edges" ON public.route_edges FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update edges" ON public.route_edges FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins delete edges" ON public.route_edges FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Public reads lifts" ON public.lifts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff insert lifts" ON public.lifts FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Lift managers update lifts" ON public.lifts FOR UPDATE TO authenticated USING (public.can_manage_lifts(auth.uid())) WITH CHECK (public.can_manage_lifts(auth.uid()));
CREATE POLICY "Admins delete lifts" ON public.lifts FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Public reads lift history" ON public.lift_status_history FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Staff read verifications" ON public.route_verifications FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff record verifications" ON public.route_verifications FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND recorded_by = auth.uid());

-- ============ REPORTS ============
CREATE TABLE public.barrier_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('CR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  category public.report_category NOT NULL,
  node_id uuid REFERENCES public.route_nodes(id) ON DELETE SET NULL,
  edge_id uuid REFERENCES public.route_edges(id) ON DELETE SET NULL,
  lift_id uuid REFERENCES public.lifts(id) ON DELETE SET NULL,
  lat double precision CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  lng double precision CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  location_text text CHECK (location_text IS NULL OR length(location_text) <= 300),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 2000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reporter_id uuid,
  is_anonymous boolean NOT NULL DEFAULT false,
  status public.report_status NOT NULL DEFAULT 'new',
  priority public.report_priority,
  assigned_to uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX barrier_reports_status_idx ON public.barrier_reports(status);
CREATE INDEX barrier_reports_reporter_idx ON public.barrier_reports(reporter_id);
CREATE INDEX barrier_reports_node_idx ON public.barrier_reports(node_id);

CREATE TABLE public.report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.barrier_reports(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo','resolution')),
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_attachments_report_idx ON public.report_attachments(report_id);

CREATE TABLE public.report_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.barrier_reports(id) ON DELETE CASCADE,
  assigned_to uuid,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.report_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.barrier_reports(id) ON DELETE CASCADE,
  old_status public.report_status,
  new_status public.report_status NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_status_history_report_idx ON public.report_status_history(report_id, created_at);

CREATE TABLE public.report_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.barrier_reports(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.report_rate_limits (
  id bigserial PRIMARY KEY,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_rate_limits_idx ON public.report_rate_limits(ip_hash, created_at);

GRANT SELECT, UPDATE ON public.barrier_reports TO authenticated;
GRANT SELECT, INSERT ON public.report_attachments TO authenticated;
GRANT SELECT ON public.report_assignments TO authenticated;
GRANT SELECT ON public.report_status_history TO authenticated;
GRANT SELECT, INSERT ON public.report_notes TO authenticated;
GRANT ALL ON public.barrier_reports, public.report_attachments, public.report_assignments, public.report_status_history, public.report_notes, public.report_rate_limits TO service_role;
GRANT USAGE ON SEQUENCE public.report_rate_limits_id_seq TO service_role;

ALTER TABLE public.barrier_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporter or staff read reports" ON public.barrier_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Staff update reports" ON public.barrier_reports FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Reporter or staff read attachments" ON public.report_attachments FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.barrier_reports r WHERE r.id = report_id AND r.reporter_id = auth.uid()));
CREATE POLICY "Staff add resolution evidence" ON public.report_attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND kind = 'resolution' AND uploaded_by = auth.uid());

CREATE POLICY "Staff read assignments" ON public.report_assignments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Reporter or staff read status history" ON public.report_status_history FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.barrier_reports r WHERE r.id = report_id AND r.reporter_id = auth.uid()));

CREATE POLICY "Staff read notes" ON public.report_notes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff write notes" ON public.report_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND author_id = auth.uid());

-- ============ NOTIFICATIONS & AUDIT ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT ON public.notifications TO anon;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public campus updates" ON public.notifications FOR SELECT TO anon USING (user_id IS NULL);
CREATE POLICY "Own and campus notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Mark own read" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs(entity_type, entity_id, created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT USAGE ON SEQUENCE public.audit_logs_id_seq TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.get_public_barriers()
RETURNS TABLE (id uuid, category public.report_category, status public.report_status, node_id uuid, edge_id uuid, lift_id uuid, lat double precision, lng double precision, location_text text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.category, r.status, r.node_id, r.edge_id, r.lift_id, r.lat, r.lng, r.location_text, r.created_at
  FROM public.barrier_reports r
  WHERE r.status IN ('new','under_review','assigned','in_progress')
  ORDER BY r.created_at DESC
  LIMIT 500
$$;
GRANT EXECUTE ON FUNCTION public.get_public_barriers() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_report(p_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'code', r.code, 'category', r.category, 'status', r.status,
    'created_at', r.created_at, 'updated_at', r.updated_at, 'resolved_at', r.resolved_at,
    'history', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', h.new_status, 'at', h.created_at) ORDER BY h.created_at)
                         FROM public.report_status_history h WHERE h.report_id = r.id), '[]'::jsonb))
  FROM public.barrier_reports r
  WHERE r.code = upper(trim(p_code))
$$;
GRANT EXECUTE ON FUNCTION public.track_report(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_staff()
RETURNS TABLE (id uuid, display_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.id, p.display_name, p.email
  FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('estate_staff','admin') AND public.is_staff(auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.list_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_users_with_roles()
RETURNS TABLE (id uuid, display_name text, email text, roles public.app_role[], created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.email,
         COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}'), p.created_at
  FROM public.profiles p LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE public.has_role(auth.uid(),'admin')
  GROUP BY p.id
  ORDER BY p.created_at
$$;
GRANT EXECUTE ON FUNCTION public.list_users_with_roles() TO authenticated;

-- ============ DEMO DATA (synthetic) ============
INSERT INTO public.route_nodes (id, ref, name, kind, lat, lng, description, is_destination, accessible_entrance, verification_status, last_verified_at, is_demo) VALUES
 ('00000000-0000-4000-a000-000000000001','DEMO-N01','Demo Main Gate','entrance',31.25380,75.70300,'Synthetic demonstration data – not verified LPU accessibility information',true,true,'verified',now() - interval '20 days',true),
 ('00000000-0000-4000-a000-000000000002','DEMO-N02','Demo Junction North','junction',31.25460,75.70300,'Synthetic demonstration data – not verified LPU accessibility information',false,null,'verified',now() - interval '20 days',true),
 ('00000000-0000-4000-a000-000000000003','DEMO-N03','Demo Block A – Accessible Entrance','entrance',31.25460,75.70200,'Synthetic demonstration data – not verified LPU accessibility information',true,true,'verified',now() - interval '20 days',true),
 ('00000000-0000-4000-a000-000000000004','DEMO-N04','Demo Library','building',31.25560,75.70300,'Synthetic demonstration data – not verified LPU accessibility information',true,true,'verified',now() - interval '20 days',true),
 ('00000000-0000-4000-a000-000000000005','DEMO-N05','Demo Ramp Point','ramp',31.25510,75.70380,'Synthetic demonstration data – not verified LPU accessibility information',false,null,'verified',now() - interval '20 days',true),
 ('00000000-0000-4000-a000-000000000006','DEMO-N06','Demo Lift Lobby (ground)','lift',31.25600,75.70360,'Synthetic demonstration data – not verified LPU accessibility information',false,null,'verified',now() - interval '20 days',true),
 ('00000000-0000-4000-a000-000000000007','DEMO-N07','Demo Block B – Upper Level','destination',31.25640,75.70400,'Synthetic demonstration data – not verified LPU accessibility information',true,true,'verified',now() - interval '20 days',true),
 ('00000000-0000-4000-a000-000000000008','DEMO-N08','Demo Junction South','junction',31.25380,75.70420,'Synthetic demonstration data – not verified LPU accessibility information',false,null,'verified',now() - interval '20 days',true),
 ('00000000-0000-4000-a000-000000000009','DEMO-N09','Demo Cafeteria','destination',31.25380,75.70540,'Synthetic demonstration data – not verified LPU accessibility information',true,true,'verified',now() - interval '20 days',true),
 ('00000000-0000-4000-a000-000000000010','DEMO-N10','Demo Hostel','destination',31.25300,75.70540,'Synthetic demonstration data – not verified LPU accessibility information',true,null,'unverified',null,true),
 ('00000000-0000-4000-a000-000000000011','DEMO-N11','Demo Checkpoint East','checkpoint',31.25460,75.70500,'Synthetic demonstration data – not verified LPU accessibility information',false,null,'verified',now() - interval '20 days',true),
 ('00000000-0000-4000-a000-000000000012','DEMO-N12','Demo Sports Ground','destination',31.25300,75.70300,'Synthetic demonstration data – not verified LPU accessibility information',true,false,'verified',now() - interval '20 days',true);

INSERT INTO public.lifts (id, label, node_id, location_description, status, status_updated_at, issue, alternative_info, is_demo) VALUES
 ('00000000-0000-4000-b000-000000000001','DEMO Lift 1','00000000-0000-4000-a000-000000000006','Demo Lift Lobby – serves Demo Block B upper level (synthetic)','operational',now(),null,'Unverified ramp from Demo Library to Demo Block B (use with caution).',true);

INSERT INTO public.route_edges (from_node_id,to_node_id,name,distance_m,surface,clear_width_m,slope_percent,has_steps,step_count,has_kerb,has_ramp,ramp_verified,lift_id,barrier_status,barrier_note,classification,verification_status,last_verified_at,evidence_ref,notes,is_demo) VALUES
 ('00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002','Demo gate walkway',89,'smooth_paved',2.5,1.5,false,0,false,false,false,null,'clear',null,'accessible','verified',now()-interval '20 days','DEMO-AUDIT-01','Synthetic',true),
 ('00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000003','Demo path to Block A',95,'paved',2.0,2.0,false,0,false,false,false,null,'clear',null,'accessible','verified',now()-interval '20 days','DEMO-AUDIT-02','Synthetic',true),
 ('00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000004','Demo library steps shortcut',111,'paved',1.8,null,true,12,false,false,false,null,'clear',null,'inaccessible','verified',now()-interval '20 days','DEMO-AUDIT-03','Synthetic – flight of steps',true),
 ('00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000005','Demo path to ramp',87,'smooth_paved',2.0,3.0,false,0,false,false,false,null,'clear',null,'accessible','verified',now()-interval '20 days','DEMO-AUDIT-04','Synthetic',true),
 ('00000000-0000-4000-a000-000000000005','00000000-0000-4000-a000-000000000004','Demo verified ramp to library',95,'smooth_paved',1.6,6.5,false,0,false,true,true,null,'clear',null,'accessible','verified',now()-interval '20 days','DEMO-AUDIT-05','Synthetic – ramp 1:15',true),
 ('00000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000006','Demo indoor corridor',63,'indoor',2.2,0,false,0,false,false,false,null,'clear',null,'accessible','verified',now()-interval '20 days','DEMO-AUDIT-06','Synthetic',true),
 ('00000000-0000-4000-a000-000000000006','00000000-0000-4000-a000-000000000007','Demo Lift 1 ride',30,'indoor',1.4,0,false,0,false,false,false,'00000000-0000-4000-b000-000000000001','clear',null,'accessible','verified',now()-interval '20 days','DEMO-AUDIT-07','Synthetic',true),
 ('00000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000007','Demo unverified ramp to Block B',140,'paving_blocks',1.2,9.0,false,0,false,true,false,null,'clear',null,'unknown','unverified',null,null,'Synthetic – ramp not yet surveyed',true),
 ('00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000008','Demo south walkway',114,'smooth_paved',2.4,1.0,false,0,false,false,false,null,'clear',null,'accessible','verified',now()-interval '20 days','DEMO-AUDIT-08','Synthetic',true),
 ('00000000-0000-4000-a000-000000000008','00000000-0000-4000-a000-000000000009','Demo cafeteria direct path',114,'paved',2.0,1.0,false,0,false,false,false,null,'blocked','Synthetic: construction materials blocking path','accessible','verified',now()-interval '20 days','DEMO-AUDIT-09','Synthetic',true),
 ('00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000011','Demo east connector',190,'smooth_paved',2.0,2.0,false,0,false,false,false,null,'clear',null,'accessible','verified',now()-interval '20 days','DEMO-AUDIT-10','Synthetic',true),
 ('00000000-0000-4000-a000-000000000011','00000000-0000-4000-a000-000000000009','Demo path to cafeteria',115,'paved',1.8,3.5,false,0,true,false,false,null,'clear',null,'limited','verified',now()-interval '20 days','DEMO-AUDIT-11','Synthetic – dropped kerb absent',true),
 ('00000000-0000-4000-a000-000000000008','00000000-0000-4000-a000-000000000011','Demo checkpoint link',130,'smooth_paved',2.0,2.5,false,0,false,false,false,null,'clear',null,'accessible','verified',now()-interval '20 days','DEMO-AUDIT-12','Synthetic',true),
 ('00000000-0000-4000-a000-000000000011','00000000-0000-4000-a000-000000000009','Demo cafeteria ramp entrance',125,'smooth_paved',1.8,5.0,false,0,false,true,true,null,'clear',null,'accessible','verified',now()-interval '20 days','DEMO-AUDIT-13','Synthetic',true),
 ('00000000-0000-4000-a000-000000000009','00000000-0000-4000-a000-000000000010','Demo hostel path (unsurveyed)',89,'unknown',null,null,null,null,null,false,false,null,'clear',null,'unknown','unverified',null,null,'Synthetic – not surveyed',true),
 ('00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000012','Demo sports ground steps',89,'paved',1.5,null,true,8,false,false,false,null,'clear',null,'inaccessible','verified',now()-interval '20 days','DEMO-AUDIT-14','Synthetic – only access is by steps',true);

-- ============ TRIGGERS (created after seeding) ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER route_nodes_touch BEFORE UPDATE ON public.route_nodes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER route_edges_touch BEFORE UPDATE ON public.route_edges FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lifts_touch BEFORE UPDATE ON public.lifts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER barrier_reports_touch BEFORE UPDATE ON public.barrier_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- New nodes/edges never start verified
CREATE OR REPLACE FUNCTION public.force_unverified_on_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.verification_status := 'unverified';
  NEW.last_verified_at := NULL;
  IF TG_TABLE_NAME = 'route_edges' THEN
    NEW.ramp_verified := false;
    NEW.evidence_ref := NULL;
  END IF;
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  RETURN NEW;
END; $$;
CREATE TRIGGER route_nodes_unverified BEFORE INSERT ON public.route_nodes FOR EACH ROW EXECUTE FUNCTION public.force_unverified_on_insert();
CREATE TRIGGER route_edges_unverified BEFORE INSERT ON public.route_edges FOR EACH ROW EXECUTE FUNCTION public.force_unverified_on_insert();

-- Changing measured attributes invalidates verification; verification fields can only be set by the verification trigger
CREATE OR REPLACE FUNCTION public.edge_guard_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('clearroute.verifying', true) = 'on' THEN
    RETURN NEW;
  END IF;
  -- block manual tampering with verification fields
  NEW.verification_status := OLD.verification_status;
  NEW.last_verified_at := OLD.last_verified_at;
  NEW.ramp_verified := OLD.ramp_verified;
  NEW.evidence_ref := OLD.evidence_ref;
  IF (NEW.from_node_id, NEW.to_node_id, NEW.distance_m, NEW.surface, NEW.clear_width_m, NEW.slope_percent,
      NEW.has_steps, NEW.step_count, NEW.has_kerb, NEW.has_ramp, NEW.lift_id, NEW.classification)
     IS DISTINCT FROM
     (OLD.from_node_id, OLD.to_node_id, OLD.distance_m, OLD.surface, OLD.clear_width_m, OLD.slope_percent,
      OLD.has_steps, OLD.step_count, OLD.has_kerb, OLD.has_ramp, OLD.lift_id, OLD.classification) THEN
    NEW.verification_status := 'unverified';
    NEW.ramp_verified := false;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER route_edges_guard BEFORE UPDATE ON public.route_edges FOR EACH ROW EXECUTE FUNCTION public.edge_guard_verification();

CREATE OR REPLACE FUNCTION public.node_guard_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('clearroute.verifying', true) = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.verification_status := OLD.verification_status;
  NEW.last_verified_at := OLD.last_verified_at;
  IF (NEW.lat, NEW.lng, NEW.kind, NEW.accessible_entrance) IS DISTINCT FROM (OLD.lat, OLD.lng, OLD.kind, OLD.accessible_entrance) THEN
    NEW.verification_status := 'unverified';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER route_nodes_guard BEFORE UPDATE ON public.route_nodes FOR EACH ROW EXECUTE FUNCTION public.node_guard_verification();

CREATE OR REPLACE FUNCTION public.apply_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verified_on > current_date THEN
    RAISE EXCEPTION 'Verification date cannot be in the future';
  END IF;
  PERFORM set_config('clearroute.verifying', 'on', true);
  IF NEW.edge_id IS NOT NULL THEN
    UPDATE public.route_edges
      SET verification_status = 'verified', last_verified_at = NEW.verified_on::timestamptz,
          evidence_ref = NEW.evidence_ref, ramp_verified = has_ramp
      WHERE id = NEW.edge_id;
  ELSE
    UPDATE public.route_nodes
      SET verification_status = 'verified', last_verified_at = NEW.verified_on::timestamptz
      WHERE id = NEW.node_id;
  END IF;
  PERFORM set_config('clearroute.verifying', 'off', true);
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'verified', CASE WHEN NEW.edge_id IS NOT NULL THEN 'route_edge' ELSE 'route_node' END,
          COALESCE(NEW.edge_id, NEW.node_id)::text,
          jsonb_build_object('verified_on', NEW.verified_on, 'verified_by', NEW.verified_by, 'evidence_ref', NEW.evidence_ref, 'observations', NEW.observations));
  RETURN NEW;
END; $$;
CREATE TRIGGER route_verifications_apply AFTER INSERT ON public.route_verifications FOR EACH ROW EXECUTE FUNCTION public.apply_verification();

-- Generic audit for map data
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME,
          COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)::text, null),
          CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
               WHEN TG_OP = 'DELETE' THEN jsonb_build_object('before', to_jsonb(OLD))
               ELSE jsonb_build_object('after', to_jsonb(NEW)) END);
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER route_nodes_audit AFTER INSERT OR UPDATE OR DELETE ON public.route_nodes FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER route_edges_audit AFTER INSERT OR UPDATE OR DELETE ON public.route_edges FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER lifts_audit AFTER INSERT OR DELETE ON public.lifts FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Route disruption broadcast
CREATE OR REPLACE FUNCTION public.edge_disruption_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.barrier_status IS DISTINCT FROM OLD.barrier_status THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NULL, 'route_disruption',
      CASE NEW.barrier_status WHEN 'blocked' THEN 'Pathway blocked' WHEN 'caution' THEN 'Pathway caution' ELSE 'Pathway reopened' END,
      COALESCE(NEW.name, 'A campus pathway') || COALESCE(' – ' || NEW.barrier_note, '') || CASE WHEN NEW.is_demo THEN ' (demo data)' ELSE '' END,
      '/map');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER route_edges_disruption AFTER UPDATE ON public.route_edges FOR EACH ROW EXECUTE FUNCTION public.edge_disruption_notify();

-- Lift status changes
CREATE OR REPLACE FUNCTION public.lift_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.issue IS DISTINCT FROM OLD.issue THEN
    NEW.status_updated_at := now();
    NEW.status_updated_by := auth.uid();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER lifts_before_update BEFORE UPDATE ON public.lifts FOR EACH ROW EXECUTE FUNCTION public.lift_before_update();

CREATE OR REPLACE FUNCTION public.lift_after_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.status_updated_at IS DISTINCT FROM OLD.status_updated_at THEN
    INSERT INTO public.lift_status_history (lift_id, old_status, new_status, issue, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.issue, auth.uid());
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'status_change', 'lifts', NEW.id::text, jsonb_build_object('from', OLD.status, 'to', NEW.status, 'issue', NEW.issue));
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NULL, 'lift_status',
      NEW.label || ' is now ' || replace(NEW.status::text, '_', ' '),
      COALESCE(NEW.issue, '') || CASE WHEN NEW.is_demo THEN ' (demo data)' ELSE '' END,
      '/lifts');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER lifts_after_update AFTER UPDATE ON public.lifts FOR EACH ROW EXECUTE FUNCTION public.lift_after_update();

-- Report lifecycle
CREATE OR REPLACE FUNCTION public.report_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN NEW.resolved_at := now(); END IF;
  IF NEW.status <> 'resolved' THEN NEW.resolved_at := NULL; END IF;
  -- immutable submission fields
  NEW.code := OLD.code; NEW.reporter_id := OLD.reporter_id; NEW.created_at := OLD.created_at; NEW.is_anonymous := OLD.is_anonymous;
  RETURN NEW;
END; $$;
CREATE TRIGGER barrier_reports_before_update BEFORE UPDATE ON public.barrier_reports FOR EACH ROW EXECUTE FUNCTION public.report_before_update();

CREATE OR REPLACE FUNCTION public.report_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.report_status_history (report_id, old_status, new_status, changed_by) VALUES (NEW.id, NULL, NEW.status, NEW.reporter_id);
  IF NEW.reporter_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.reporter_id, 'report_submitted', 'Report ' || NEW.code || ' received', 'Thank you. The estate team will review your report.', '/track?code=' || NEW.code);
  END IF;
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT DISTINCT ur.user_id, 'staff_new_report', 'New barrier report ' || NEW.code, replace(NEW.category::text, '_', ' '), '/staff/reports/' || NEW.id
  FROM public.user_roles ur WHERE ur.role IN ('estate_staff','admin');
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (NEW.reporter_id, 'created', 'barrier_reports', NEW.id::text, jsonb_build_object('code', NEW.code, 'category', NEW.category));
  RETURN NEW;
END; $$;
CREATE TRIGGER barrier_reports_after_insert AFTER INSERT ON public.barrier_reports FOR EACH ROW EXECUTE FUNCTION public.report_after_insert();

CREATE OR REPLACE FUNCTION public.report_after_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.report_status_history (report_id, old_status, new_status, changed_by) VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
    IF NEW.reporter_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, kind, title, body, link)
      VALUES (NEW.reporter_id, CASE WHEN NEW.status = 'resolved' THEN 'report_resolved' ELSE 'report_status' END,
        'Report ' || NEW.code || ': ' || replace(NEW.status::text, '_', ' '),
        CASE WHEN NEW.status = 'resolved' THEN 'The estate team has marked this barrier as resolved.' ELSE 'The status of your report has changed.' END,
        '/track?code=' || NEW.code);
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'status_change', 'barrier_reports', NEW.id::text, jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.report_assignments (report_id, assigned_to, assigned_by) VALUES (NEW.id, NEW.assigned_to, auth.uid());
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, kind, title, body, link)
      VALUES (NEW.assigned_to, 'report_assigned', 'Report ' || NEW.code || ' assigned to you', replace(NEW.category::text, '_', ' '), '/staff/reports/' || NEW.id);
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'assignment', 'barrier_reports', NEW.id::text, jsonb_build_object('from', OLD.assigned_to, 'to', NEW.assigned_to));
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'priority_change', 'barrier_reports', NEW.id::text, jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER barrier_reports_after_update AFTER UPDATE ON public.barrier_reports FOR EACH ROW EXECUTE FUNCTION public.report_after_update();

CREATE OR REPLACE FUNCTION public.settings_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); NEW.updated_by := auth.uid(); RETURN NEW; END; $$;
CREATE TRIGGER app_settings_before_update BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.settings_before_update();

-- ============ STORAGE POLICIES (bucket: report-photos) ============
CREATE POLICY "Staff read report photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-photos' AND (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.barrier_reports r WHERE r.id::text = (storage.foldername(name))[1] AND r.reporter_id = auth.uid())
  ));
CREATE POLICY "Staff upload resolution evidence" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-photos' AND public.is_staff(auth.uid()) AND (storage.foldername(name))[2] = 'resolution');

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.lifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.route_edges;
