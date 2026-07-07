-- Read: any authenticated user can view
CREATE POLICY "media_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('post-media','avatars','covers'));

-- Write: only inside own uid-prefixed folder
CREATE POLICY "media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('post-media','avatars','covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "media_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('post-media','avatars','covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('post-media','avatars','covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );