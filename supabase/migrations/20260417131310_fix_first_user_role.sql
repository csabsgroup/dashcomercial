-- Fix: First user should get 'master' role instead of 'closer'
-- This prevents the setup lockout where no user can access /setup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  assigned_role TEXT;
BEGIN
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
