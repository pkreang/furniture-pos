-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('HEAD_OFFICE', 'BRANCH');

-- CreateEnum
CREATE TYPE "SoDeliveryType" AS ENUM ('COMPANY', 'SELF_PICKUP', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentTerm" AS ENUM ('DEPOSIT', 'FULL', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "PaymentMethodKind" AS ENUM ('CASH', 'TRANSFER', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('VISA', 'MASTERCARD', 'OTHER');

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "book_no" TEXT,
ADD COLUMN     "billing_type" "BillingType",
ADD COLUMN     "billing_branch_no" TEXT,
ADD COLUMN     "customer_phone2" TEXT,
ADD COLUMN     "addr_line1" TEXT,
ADD COLUMN     "addr_moo" TEXT,
ADD COLUMN     "addr_soi" TEXT,
ADD COLUMN     "addr_street" TEXT,
ADD COLUMN     "addr_kwang" TEXT,
ADD COLUMN     "addr_district" TEXT,
ADD COLUMN     "addr_province" TEXT,
ADD COLUMN     "addr_postal" TEXT,
ADD COLUMN     "can_ship_immediately" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "delivery_type" "SoDeliveryType",
ADD COLUMN     "delivery_type_other" TEXT,
ADD COLUMN     "delivery_info" JSONB,
ADD COLUMN     "payment_term" "PaymentTerm",
ADD COLUMN     "installment_months" INTEGER,
ADD COLUMN     "deposit_method" "PaymentMethodKind",
ADD COLUMN     "deposit_card_type" "CardType",
ADD COLUMN     "balance_method" "PaymentMethodKind",
ADD COLUMN     "balance_card_type" "CardType";

-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN     "size" TEXT,
ADD COLUMN     "materials" TEXT,
ADD COLUMN     "color" TEXT;
