-- Add nullable salesperson FK on sales_orders. Distinct from created_by:
-- created_by = who entered the SO into the system (audit),
-- salesperson = who actually closed the sale (business attribution).
-- Legacy rows get null; UI falls back to created_by.name for those.
ALTER TABLE "sales_orders" ADD COLUMN "salesperson_id" INTEGER;
ALTER TABLE "sales_orders"
  ADD CONSTRAINT "sales_orders_salesperson_id_fkey"
  FOREIGN KEY ("salesperson_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "sales_orders_salesperson_id_idx" ON "sales_orders"("salesperson_id");
