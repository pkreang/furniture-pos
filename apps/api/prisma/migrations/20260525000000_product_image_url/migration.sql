-- Add nullable image URL to products. Pure text field for now (operator
-- pastes any https URL); native upload via Vercel Blob can come later
-- without another schema change.
ALTER TABLE "products" ADD COLUMN "image_url" TEXT;
