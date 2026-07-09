/*
  Warnings:

  - You are about to drop the column `discount_type` on the `quotation_items` table. All the data in the column will be lost.
  - You are about to drop the column `discount_value` on the `quotation_items` table. All the data in the column will be lost.
  - You are about to drop the column `discount_type` on the `quotations` table. All the data in the column will be lost.
  - You are about to drop the column `discount_value` on the `quotations` table. All the data in the column will be lost.
  - You are about to drop the column `discount_type` on the `sales` table. All the data in the column will be lost.
  - You are about to drop the column `discount_value` on the `sales` table. All the data in the column will be lost.
  - You are about to drop the column `discount_type` on the `sales_order_items` table. All the data in the column will be lost.
  - You are about to drop the column `discount_value` on the `sales_order_items` table. All the data in the column will be lost.
  - You are about to drop the column `discount_type` on the `sales_orders` table. All the data in the column will be lost.
  - You are about to drop the column `discount_value` on the `sales_orders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "quotation_items" DROP COLUMN "discount_type",
DROP COLUMN "discount_value",
ADD COLUMN     "discount_baht" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount_percent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotations" DROP COLUMN "discount_type",
DROP COLUMN "discount_value",
ADD COLUMN     "discount_baht" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount_percent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales" DROP COLUMN "discount_type",
DROP COLUMN "discount_value",
ADD COLUMN     "discount_baht" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount_percent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_order_items" DROP COLUMN "discount_type",
DROP COLUMN "discount_value",
ADD COLUMN     "discount_baht" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount_percent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_orders" DROP COLUMN "discount_type",
DROP COLUMN "discount_value",
ADD COLUMN     "discount_baht" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount_percent" INTEGER NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "DiscountType";

-- CreateIndex
CREATE INDEX "sales_orders_salesperson_id_idx" ON "sales_orders"("salesperson_id");
