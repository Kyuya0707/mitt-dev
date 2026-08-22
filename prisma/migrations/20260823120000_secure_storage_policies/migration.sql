-- Keep public profile/question images directly viewable while preventing
-- unauthenticated listing and uploads. The legacy answers bucket has no live
-- AnswerImage references and is made private without deleting its objects.

DROP POLICY IF EXISTS "Allow anon upload 1l0lcvp_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload 1l0lcvp_1" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files 1ige2ga_0" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files 42yurj_0" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files answers 1l0lcvp_0" ON storage.objects;
DROP POLICY IF EXISTS "Public can read all files 1ige2ga_0" ON storage.objects;
DROP POLICY IF EXISTS "Public can read all files 42yurj_0" ON storage.objects;
DROP POLICY IF EXISTS "Public can read all files answers 1l0lcvp_0" ON storage.objects;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('answers', 'answer-images-private');

UPDATE storage.buckets
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('profiles', 'question-images');

CREATE POLICY "storage_profiles_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "storage_question_images_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'question-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
