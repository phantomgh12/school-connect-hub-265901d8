-- Normalizer: lowercase, split camelCase, collapse punctuation/whitespace to single dash
CREATE OR REPLACE FUNCTION public.normalize_school(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    trim(both '-' from
      regexp_replace(
        lower(
          regexp_replace(coalesce(_name, ''), '([a-z])([A-Z])', '\1 \2', 'g')
        ),
        '[^a-z0-9]+', '-', 'g'
      )
    ),
    ''
  );
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_slug text
  GENERATED ALWAYS AS (public.normalize_school(school_name)) STORED;

CREATE INDEX IF NOT EXISTS profiles_school_slug_idx ON public.profiles(school_slug);