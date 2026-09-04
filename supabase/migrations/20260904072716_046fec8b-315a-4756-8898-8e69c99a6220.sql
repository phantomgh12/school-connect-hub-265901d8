DO $$
DECLARE
  keep text[] := ARRAY[
    'badges','shop_items','missions','quests','houses','blocked_username_patterns',
    'site_settings','challenges','school_wars','seasonal_events','gifts','gift_catalog'
  ];
  t record;
  stmt text := '';
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT (c.relname = ANY(keep))
  LOOP
    stmt := stmt || format('%I,', t.relname);
  END LOOP;
  IF stmt <> '' THEN
    EXECUTE 'TRUNCATE TABLE ' || left(stmt, length(stmt) - 1) || ' CASCADE';
  END IF;
END $$;

DELETE FROM auth.users;
