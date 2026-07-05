
-- School type enum
CREATE TYPE public.school_type AS ENUM ('primary','jhs','shs','technical','university','alumni');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT UNIQUE,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  school_name TEXT,
  school_type public.school_type,
  grade_class TEXT,
  graduation_year INT,
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

-- Questionnaire table
CREATE TABLE public.student_questionnaire (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school TEXT,
  level TEXT,
  class_grade TEXT,
  favorite_subjects TEXT,
  hobbies TEXT,
  inspiration TEXT,
  career_goal TEXT,
  clubs_activities TEXT,
  reconnect_classmates BOOLEAN,
  message_to_students TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_questionnaire TO authenticated;
GRANT ALL ON public.student_questionnaire TO service_role;
ALTER TABLE public.student_questionnaire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "q_select_own" ON public.student_questionnaire
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "q_insert_own" ON public.student_questionnaire
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "q_update_own" ON public.student_questionnaire
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "q_delete_own" ON public.student_questionnaire
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER questionnaire_set_updated_at BEFORE UPDATE ON public.student_questionnaire
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
