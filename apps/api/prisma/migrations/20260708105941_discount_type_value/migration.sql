-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('AMOUNT', 'PERCENT');

-- DropIndex
DROP INDEX "sales_orders_salesperson_id_idx";

-- AlterTable
ALTER TABLE "quotation_items" ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount_type" "DiscountType" NOT NULL DEFAULT 'AMOUNT',
ADD COLUMN     "discount_value" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount_type" "DiscountType" NOT NULL DEFAULT 'AMOUNT',
ADD COLUMN     "discount_value" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "discount_type" "DiscountType" NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "discount_value" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN     "discount_type" "DiscountType" NOT NULL DEFAULT 'AMOUNT',
ADD COLUMN     "discount_value" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "discount_type" "DiscountType" NOT NULL DEFAULT 'AMOUNT',
ADD COLUMN     "discount_value" INTEGER NOT NULL DEFAULT 0;
