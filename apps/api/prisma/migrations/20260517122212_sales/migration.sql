-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD');

-- CreateEnum
CREATE TYPE "TaxInvoiceType" AS ENUM ('ABBREVIATED', 'FULL');

-- AlterTable
ALTER TABLE "point_transactions" ADD COLUMN     "sale_id" INTEGER;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "sale_id" INTEGER;

-- CreateTable
CREATE TABLE "number_sequences" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "cashier_id" INTEGER NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "subtotal" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "points_redeemed" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "tax_base" INTEGER NOT NULL,
    "vat_amount" INTEGER NOT NULL,
    "points_earned" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" INTEGER NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_invoices" (
    "id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "type" "TaxInvoiceType" NOT NULL,
    "customer_tax_id" TEXT,
    "customer_tax_name" TEXT,
    "customer_tax_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_branch_id_kind_key" ON "number_sequences"("branch_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "sales_number_key" ON "sales"("number");

-- CreateIndex
CREATE UNIQUE INDEX "tax_invoices_sale_id_key" ON "tax_invoices"("sale_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
