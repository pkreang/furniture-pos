-- Add nullable descriptive attributes to products: size, material, color.
-- Free-text for now (not linked to the sofa materials/colors tables); these
-- show up read-only on the stock, transfer, and POS cart lines.
ALTER TABLE "products" ADD COLUMN "size" TEXT;
ALTER TABLE "products" ADD COLUMN "material" TEXT;
ALTER TABLE "products" ADD COLUMN "color" TEXT;
