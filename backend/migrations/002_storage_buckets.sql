-- ============================================================================
-- STORAGE POLICIES - pdfs bucket
-- ============================================================================

-- Users can read their own PDFs
CREATE POLICY "Users can read own PDFs"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'pdfs' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can upload their own PDFs
CREATE POLICY "Users can upload own PDFs"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own PDFs
CREATE POLICY "Users can update own PDFs"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own PDFs
CREATE POLICY "Users can delete own PDFs"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- STORAGE POLICIES - temp_uploads bucket
-- ============================================================================

-- Users can upload to temp_uploads
CREATE POLICY "Users can upload to temp_uploads"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'temp_uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Auto-cleanup function for temp_uploads
CREATE OR REPLACE FUNCTION cleanup_temp_uploads()
RETURNS void AS $$
BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'temp_uploads'
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
