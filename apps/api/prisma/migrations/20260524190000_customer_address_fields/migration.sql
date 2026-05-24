-- AlterTable: add structured address + secondary phone + billing fields to Customer.
-- BillingType enum already exists from migration 20260523180000_so_booking_fields.
ALTER TABLE "customers"
  ADD COLUMN "phone2"            TEXT,
  ADD COLUMN "billing_type"      "BillingType",
  ADD COLUMN "billing_branch_no" TEXT,
  ADD COLUMN "addr_line1"        TEXT,
  ADD COLUMN "addr_moo"          TEXT,
  ADD COLUMN "addr_soi"          TEXT,
  ADD COLUMN "addr_street"       TEXT,
  ADD COLUMN "addr_kwang"        TEXT,
  ADD COLUMN "addr_district"     TEXT,
  ADD COLUMN "addr_province"     TEXT,
  ADD COLUMN "addr_postal"       TEXT;
